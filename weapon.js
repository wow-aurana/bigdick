'use strict';

class Weapon {
  constructor(char, stats, name, isMainhand = true) {
    this.log = new SwingLog(name);

    this.char = char;
    // Wind Blessed (Skyborne racial): +1% haste, always on -- folded
    // straight into gear haste since it never changes mid-fight, unlike
    // Berserking's temporary haste (see applyRacialHaste() below).
    const totalHaste = char.stats.haste + (char.race === 'skyborne' ? 1 : 0);
    const speed = stats.speed / (1 + totalHaste / 100);
    this.cooldown = new Cooldown(speed, name);

    this.stats = stats;
    this.avgDmg = (stats.min + stats.max) * .5;
    this.isMainhand = isMainhand;
    this.is = { flurried: false, berserking: false };
    this.table = {};

    const crusader = stats.crusader ? new Crusader(stats.speed) : null;
    const strproc = getStrengthProc(stats.speed, stats.proc);
    this.strprocs = [crusader, strproc].filter((e) => !!e);
    this.extraAttacks = getExtraAttacks(stats.proc);

    final(this);
  }

  tick(seconds) {
    this.cooldown.tick(seconds);
    for (const proc of this.strprocs) { proc.tick(seconds); }
  }

  getDmg() {
    const dmg = this.avgDmg + (this.char.getAp()) / 14 * this.stats.speed;

    if (this.isMainhand) return (dmg * this.char.multiplier());
    return (dmg * this.char.multiplier() * this.char.offhandDmgMul);
  }

  // See https://github.com/magey/classic-warrior/wiki/Attack-table
  // Not frozen (unlike most cached state in this codebase): stance changes
  // mid-fight change crit chance, so this can be recomputed more than once
  // -- see Character.recomputeTables().
  setTarget(target) {
    // Dual wield miss penalty is a flat +19, not the older 0.8x+20 estimate:
    // https://github.com/magey/classic-warrior/wiki/Attack-table
    const missBonus = this.char.off ? 19 : 0;
    const { miss, dodge, crit } =
        baseAttackChances(this.char, target, this.stats.skill, missBonus);
    this.table.miss = miss;
    // Dual Wield Specialization's off-hand hit bonus (+2/4/6/8/10%).
    if (!this.isMainhand) {
      this.table.miss = clamp(0, 100)(this.table.miss - this.char.offhandHitBonus);
    }

    this.table.dodge = dodge;
    this.table.dodge += this.table.miss;

    // glance
    const targetDef = target.level * 5;
    const baseSkill = this.char.level * 5;
    const skillDiff = targetDef - this.stats.skill;
    this.table.glanceMul = clamp(.2, .95)(.65 + (15 - skillDiff) * .04);
    const glance = 10 + (targetDef - m.min(baseSkill, this.stats.skill)) * 2;
    this.table.glance = clamp(0, 100)(glance);
    this.table.glance += this.table.dodge;

    this.table.crit = clamp(0, 100)(
        crit + this.char.weaponTypeCritBonus(this.stats.type));
    this.table.crit += this.table.glance;
  }

  // Weaponmaster: Mace/Staff attacks "ignore X% of the target's armor"
  // (+3/6/9/12/15%). The sim only ever precomputes one mitigation number
  // from the target's raw armor (Character.armorDmgMul), so exact armor
  // isn't threaded down to individual weapons -- this approximates armor
  // penetration as closing X% of the gap between full mitigation and none,
  // which is a common stand-in when the real armor value isn't available.
  effectiveArmorMul() {
    if (this.stats.type !== 'mace' && this.stats.type !== 'staff') {
      return this.char.armorDmgMul;
    }
    const armorPen = this.char.weaponmaster * .03;
    return this.char.armorDmgMul + (1 - this.char.armorDmgMul) * armorPen;
  }

  timeUntil() { return this.cooldown.timeUntil(); }
  // Slam no longer interacts with autoattacks at all (see abilities.js) --
  // this used to pause swings while a Slam cast was in flight.
  canUse() { return true; }

  reset() {
    this.cooldown.reset();
    this.is.flurried = false;
    this.is.berserking = false;
    for (const proc of this.strprocs) { proc.reset(); }
  }

  applyFlurry() {
    // This code assumes that the remaining swing time is recalculated
    // if flurry goes up or down mid swing (e.g. offhand eats last charge).
    if (this.is.flurried && !this.char.flurry.hasCharges()) {
      this.cooldown.time.left *= this.char.flurryHaste;
      this.is.flurried = false;
    }
    if (!this.is.flurried && this.char.flurry.hasCharges()) {
      this.cooldown.time.left /= this.char.flurryHaste;
      this.is.flurried = true;
    }
  }

  // Berserking (Troll racial): +10% autoattack speed while active. Same
  // toggle-on-state-change pattern as applyFlurry() above, just for a
  // (usually much longer) racial cooldown window instead of Flurry
  // charges.
  applyRacialHaste() {
    const active = this.char.race === 'troll' && this.char.racialActive
        && this.char.racialActive.active();
    if (this.is.berserking && !active) {
      this.cooldown.time.left *= 1.1;
      this.is.berserking = false;
    }
    if (!this.is.berserking && active) {
      this.cooldown.time.left /= 1.1;
      this.is.berserking = true;
    }
  }

  proc(extraSwing) {
    for (const proc of this.strprocs) { proc.proc(); }
    if (!extraSwing) this.char.procHoJ();
    if (!extraSwing) this.char.procWindfury();
    if (!extraSwing) this.char.procBloodthrill();
    // Weapon procs
    if (!extraSwing && (m.random() * 60 < this.stats.speed)) {
      for (let i = 0; i < this.extraAttacks; ++i) {
        Debug.log(this.log.name + ' ' + this.stats.proc + ' proc: extra attack');
        this.char.main.cooldown.reset();
        this.char.main.swing(true);
      }
    }
    // Weaponmaster: Sword gets a flat chance (+1/2/3/4/5%) to trigger an
    // extra attack, specific to whichever weapon is actually a sword.
    if (!extraSwing && this.stats.type === 'sword'
        && m.random() * 100 < this.char.weaponmaster) {
      Debug.log(this.log.name + ' Weaponmaster (Sword) proc: extra attack');
      this.char.main.cooldown.reset();
      this.char.main.swing(true);
    }
  }

  // Dual Wield Specialization's off-hand rage generation bonus
  // (+20/40/60/80/100%).
  rageGain(dmg) {
    return this.isMainhand ? dmg : dmg * this.char.offhandRageMul;
  }

  swing(extraSwing = false) {
    this.cooldown.use();
    this.is.flurried = false;  // will be recalculated in main loop
    this.is.berserking = false;  // ditto -- see applyRacialHaste()

    // Extra swings also can be Heroic Strikes
    if (this.isMainhand && this.char.heroicQueued()) {
      this.char.heroic.is.queued = false;
      if (this.char.heroic.canUse()) {
        this.char.heroic.swing();
        return;
      }
    }
    this.char.flurry.useCharge();

    this.log.swings += 1;
    let roll = m.random() * 100;
    const label = this.log.name + (extraSwing ? ' (extra swing)' : '');
    const rageNow = () => this.char.rage.is.now.toFixed(1);

    // Heroic Strike bug: https://bit.ly/2mK8i3Y
    if (!this.isMainhand) {
      if (!!this.char.heroic && this.char.heroic.is.queued) {
        roll += m.min(20, this.table.miss);
      }
    }

    // Unbridled Wrath's extra-rage chance grants 2 rage instead of 1 for
    // two-handed weapons.
    const extraRage = this.char.twohand ? 2 : 1;

    let dmg = this.getDmg() * this.effectiveArmorMul();
    if (roll < this.table.miss) {
      this.log.misses += 1;
      Debug.log(label + ': miss');

    } else if (roll < this.table.dodge) {
      this.log.dodges += 1;
      // According to Vilius on Fight Club, dodges give 75% rage.
      this.char.rage.gainFromSwing(this.rageGain(dmg * .75));
      this.char.procOverpowerDodge();
      Debug.log(label + ': dodged (rage: ' + rageNow() + ')');

    } else if (roll < this.table.glance) {
      this.log.glances += 1;
      this.proc(extraSwing);
      dmg *= this.table.glanceMul;
      this.log.dmg += dmg;
      this.char.rage.gainFromSwing(this.rageGain(dmg));
      if (this.char.extraRageChance > m.random()) this.char.rage.gain(extraRage);
      this.char.procTouchOfGrave();
      Debug.log(label + ': glancing blow for ' + dmg.toFixed(0)
                + ' (rage: ' + rageNow() + ')');

    } else if (roll < this.table.crit) {
      this.log.crits += 1;
      this.proc(extraSwing);
      dmg *= 2;
      this.log.dmg += dmg;
      this.char.rage.gainFromSwing(this.rageGain(dmg));
      this.char.flurry.refresh();
      this.char.procDeepWounds();
      if (this.char.extraRageChance > m.random()) this.char.rage.gain(extraRage);
      this.char.procTouchOfGrave();
      Debug.log(label + ': critical hit for ' + dmg.toFixed(0)
                + ' (rage: ' + rageNow() + ')');

    } else {  // hit
      this.log.hits += 1;
      this.proc(extraSwing);
      this.log.dmg += dmg;
      this.char.rage.gainFromSwing(this.rageGain(dmg));
      if (this.char.extraRageChance > m.random()) this.char.rage.gain(extraRage);
      this.char.procTouchOfGrave();
      Debug.log(label + ': hit for ' + dmg.toFixed(0)
                + ' (rage: ' + rageNow() + ')');
    }
  }

  handle() { this.swing(); }
}

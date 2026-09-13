'use strict';

class Weapon {
  constructor(char, stats, name, isMainhand = true) {
    this.log = new SwingLog(name);

    this.char = char;
    const speed = stats.speed / (1 + char.stats.haste / 100);
    this.cooldown = new Cooldown(speed, name);

    this.stats = stats;
    this.avgDmg = (stats.min + stats.max) * .5;
    this.isMainhand = isMainhand;
    this.is = { flurried: false };
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
  setTarget(target) {
    // Dual wield miss penalty is a flat +19, not the older 0.8x+20 estimate:
    // https://github.com/magey/classic-warrior/wiki/Attack-table
    const missBonus = this.char.off ? 19 : 0;
    const { miss, dodge, crit } =
        baseAttackChances(this.char, target, this.stats.skill, missBonus);
    this.table.miss = miss;

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

    this.table.crit = crit;
    this.table.crit += this.table.glance;
    final(this.table);
  }

  timeUntil() { return this.cooldown.timeUntil(); }
  canUse() { return !(this.char.slam && this.char.slam.casting); }

  reset() {
    this.cooldown.reset();
    this.is.flurried = false;
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
  
  proc(extraSwing) {
    for (const proc of this.strprocs) { proc.proc(); }
    if (!extraSwing) this.char.procHoJ();
    if (!extraSwing) this.char.procWindfury();
    // Weapon procs
    if (!extraSwing && (m.random() * 60 < this.stats.speed)) {
      for (let i = 0; i < this.extraAttacks; ++i) {
        Debug.log(this.log.name + ' ' + this.stats.proc + ' proc: extra attack');
        this.char.main.cooldown.reset();
        this.char.main.swing(true);
      }
    }
  }

  swing(extraSwing = false) {
    this.cooldown.use();
    this.is.flurried = false;  // will be recalculated in main loop

    if (this.isMainhand && this.char.slam) this.char.slam.opportunity.force();

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

    let dmg = this.getDmg() * this.char.armorDmgMul;
    if (roll < this.table.miss) {
      this.log.misses += 1;
      Debug.log(label + ': miss');

    } else if (roll < this.table.dodge) {
      this.log.dodges += 1;
      // According to Vilius on Fight Club, dodges give 75% rage.
      this.char.rage.gainFromSwing(dmg * .75);
      Debug.log(label + ': dodged (rage: ' + rageNow() + ')');

    } else if (roll < this.table.glance) {
      this.log.glances += 1;
      this.proc(extraSwing);
      dmg *= this.table.glanceMul;
      this.log.dmg += dmg;
      this.char.rage.gainFromSwing(dmg);
      if (this.char.extraRageChance > m.random()) this.char.rage.gain(1);
      Debug.log(label + ': glancing blow for ' + dmg.toFixed(0)
                + ' (rage: ' + rageNow() + ')');

    } else if (roll < this.table.crit) {
      this.log.crits += 1;
      this.proc(extraSwing);
      dmg *= 2;
      this.log.dmg += dmg;
      this.char.rage.gainFromSwing(dmg);
      this.char.flurry.refresh();
      if (this.char.extraRageChance > m.random()) this.char.rage.gain(1);
      Debug.log(label + ': critical hit for ' + dmg.toFixed(0)
                + ' (rage: ' + rageNow() + ')');

    } else {  // hit
      this.log.hits += 1;
      this.proc(extraSwing);
      this.log.dmg += dmg;
      this.char.rage.gainFromSwing(dmg);
      if (this.char.extraRageChance > m.random()) this.char.rage.gain(1);
      Debug.log(label + ': hit for ' + dmg.toFixed(0)
                + ' (rage: ' + rageNow() + ')');
    }
  }

  handle() { this.swing(); }
}

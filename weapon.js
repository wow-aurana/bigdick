'use strict';

class Weapon {
  constructor(char, stats, name) {
    this.log = new SwingLog(name);

    this.char = char;
    const speed = stats.speed / (1 + char.stats.haste / 100);
    this.cooldown = new Cooldown(speed, name);

    this.stats = stats;
    this.avgDmg = (stats.min + stats.max) * .5;
    this.isMainhand = true;  // Will be set to false for OH in Character
    this.is = { flurried: false };
    this.table = {};
    
    const crusader = stats.crusader ? new Crusader(stats.speed) : null;
    const strproc = getStrengthProc(stats.speed, stats.proc);
    this.strprocs = [crusader, strproc].filter((e) => !!e);
    this.extraAttacks = getExtraAttacks(stats.proc);
  }

  // TODO refactor offhand flag so this crutch isn't needed.
  lock() { final(this); }

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
    const stats = this.char.stats;

    const targetDef = target.level * 5;
    const baseSkill = this.char.level * 5;
    const skillDiff = targetDef - this.stats.skill;

    // miss
    // see this blue post:
    // https://us.forums.blizzard.com/en/wow/t/bug-hit-tables/185675/33
    const hitOnGear = m.max(0, this.char.stats.hit - (skillDiff > 10 ? 1 : 0));
    const missFromSkill = (skillDiff > 10 ? .2 : .1) * skillDiff;
    const baseMiss = 5 + missFromSkill;
    const actualMiss = !this.char.off ? baseMiss : (.8 * baseMiss + 20);
    this.table.miss = clamp(0, 100)(actualMiss - hitOnGear);
    
    // dodge
    this.table.dodge = clamp(0, 100)(5 + skillDiff * .1);
    this.table.dodge += this.table.miss;

    // glance
    this.table.glanceMul = clamp(.2, .95)(.65 + (15 - skillDiff) * .04);
    const glance = 10 + (targetDef - m.min(baseSkill, this.stats.skill)) * 2;
    this.table.glance = clamp(0, 100)(glance); 
    this.table.glance += this.table.dodge;

    // crit
    const baseSkillDiff = targetDef - baseSkill;
    const magicNumber = (target.level - this.char.level) > 2 ? 1.8 : 0;
    this.table.crit =
        clamp(0, 100)(this.char.stats.crit - baseSkillDiff *.2 - magicNumber);
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
    if (!this.is.flurried && this.char.flurry.hasCharges()) {
      this.cooldown.time.left /= this.char.flurryHaste;
      this.is.flurried = true;
    }
  }

  unapplyFlurry() {
    if (this.is.flurried && !this.char.flurry.hasCharges()) {
      this.cooldown.time.left *= this.char.flurryHaste;
      this.is.flurried = false;
    }
  }
  
  proc(extraSwing) {
    for (const proc of this.strprocs) { proc.proc(); }
    if (!extraSwing) this.char.procHoJ();
    if (!extraSwing) this.char.procWindfury();
    // Weapon procs
    if (!extraSwing && (m.random() * 60 < this.stats.speed)) {
      for (let i = 0; i < this.extraAttacks; ++i) {
        this.char.main.cooldown.reset();
        this.char.main.swing(true);
      }
    }
  }

  procUnbridledWrath() {
    if (this.char.extraRageChance > m.random()) {
      this.char.batch.add(() => this.char.rage.gain(1), 1);
    }
  }

  swing(extraSwing = false) {
    this.cooldown.use();
    if (this.char.flurry.hasCharges()) {
      this.cooldown.time.left /= this.char.flurryHaste;
    }

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

    // Heroic Strike bug: https://bit.ly/2mK8i3Y
    if (!this.isMainhand) {
      if (!!this.char.heroic && this.char.heroic.is.queued) {
        roll += m.min(20, this.table.miss);
      }
    }

    let dmg = this.getDmg() * this.char.armorDmgMul;
    if (roll < this.table.miss) {
      this.log.misses += 1;

    } else if (roll < this.table.dodge) {
      this.log.dodges += 1;
      // According to Vilius on Fight Club, dodges give 75% rage.
      this.char.rage.gainFromSwing(dmg * .75);

    } else if (roll < this.table.glance) {
      this.log.glances += 1;
      this.proc(extraSwing);
      dmg *= this.table.glanceMul;
      this.log.dmg += dmg;
      this.char.rage.gainFromSwing(dmg);
      this.procUnbridledWrath();

    } else if (roll < this.table.crit) {
      this.log.crits += 1;
      this.proc(extraSwing);
      dmg *= 2;
      this.log.dmg += dmg;
      this.char.rage.gainFromSwing(dmg);
      this.char.flurry.refresh();
      this.procUnbridledWrath();

    } else {  // hit
      this.log.hits += 1;
      this.proc(extraSwing);
      this.log.dmg += dmg;
      this.char.rage.gainFromSwing(dmg);
      this.procUnbridledWrath();
    }
  }

  handle() { this.swing(); }
}

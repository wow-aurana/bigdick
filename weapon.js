class Weapon {
  constructor(char, stats, name) {
    this.log = new SwingLog(name);

    this.char = char;
    this.cooldown = new Cooldown(stats.speed, name);

    this.stats = stats;
    this.avgDmg = (stats.min + stats.max) * .5;
    this.isMainhand = true;
    this.flurried = false;
    this.table = {};
    this.crusader = stats.crusader ? new Aura(15, 'Crusader') : null;
  }

  tick(seconds) {
    this.cooldown.tick(seconds);
    if (this.crusader) this.crusader.tick(seconds);
  }

  getDmg(extraAp = 0) {
    const dmg =
        this.avgDmg + (this.char.getAp() + extraAp) / 14 * this.stats.speed;

    if (this.isMainhand) {
      return dmg * this.char.wpnspec;
    }
    return dmg * this.char.offhandDmgMul;
  }

  // See https://github.com/magey/classic-warrior/wiki/Attack-table
  setTarget(target) {
    const stats = this.char.stats;

    const targetDef = target.level * 5;
    const baseSkill = this.char.level * 5;
    const skillDiff = targetDef - this.stats.skill;
    const penalty = this.char.off ? 19 : 0;

    // miss
    // see this blue post:
    // https://us.forums.blizzard.com/en/wow/t/bug-hit-tables/185675/33
    const hitOnGear = m.max(0, this.char.stats.hit - (skillDiff > 10 ? 1 : 0));
    const missFromSkill = (skillDiff > 10 ? .2 : .1) * skillDiff;
    this.table.miss =
        clamp(0, 100)(penalty + 5 + missFromSkill - hitOnGear);
    
    // dodge
    this.table.dodge = clamp(0, 100)(5 + skillDiff * .1);
    this.table.dodge += this.table.miss;

    // glance
    this.glanceMul = clamp(.2, .95)(.65 + (15 - skillDiff) * .04);
    const glance = 10 + (targetDef - m.min(baseSkill, this.stats.skill)) * 2;
    this.table.glance = clamp(0, 100)(glance); 
    this.table.glance += this.table.dodge;

    // crit
    const baseSkillDiff = targetDef - baseSkill;
    const magicNumber = (target.level - this.char.level) > 2 ? 1.8 : 0;
    this.table.crit =
        clamp(0, 100)(this.char.stats.crit - baseSkillDiff *.2 - magicNumber);
    this.table.crit += this.table.glance;
  }

  timeUntil() {
    return this.cooldown.timeUntil();
  }

  canUse() { return !(this.char.slam && this.char.slam.casting); }

  applyFlurry() {
    // This code assumes that the remaining swing time is recalculated
    // if flurry goes up or down mid swing (e.g. offhand eats last charge).
    if (this.flurried && !this.char.flurry.hasCharges()) {
      this.cooldown.timer *= this.char.flurryHaste;
      this.flurried = false;
    }
    if (!this.flurried && this.char.flurry.hasCharges()) {
      this.cooldown.timer /= this.char.flurryHaste;
      this.flurried = true;
    }
  }
  
  proc(extraSwing) {
    if (this.char.extraRageChance > m.random()) this.char.rage.gain(1);
    if (this.crusader) {
      const roll = m.random() * 60;
      if (roll < this.stats.speed) this.crusader.gain();
    }
    if (!extraSwing) this.char.procHoJ();
    if (!extraSwing) this.char.procWindfury();
  }

  swing(extraSwing = false, extraAp = 0) {
    this.char.flurry.useCharge();
    this.cooldown.use();
    this.flurried = false;  // will be recalculated in main loop

    if (this.isMainhand && this.char.slam) this.char.slam.opportunity.force();

    if (!extraSwing && this.isMainhand && this.char.heroicQueued) {
      this.char.heroicQueued = false;
      if (this.char.heroic.canUse()) {
        this.char.heroic.swing();
        return;
      }
    }

    this.log.swings += 1;
    let roll = m.random() * 100;
    // Heroic Strike bug: https://github.com/SunwellTracker/issues/issues/2170
    // Put this back in if it turns out that it exists in classic
    // const hsBug = (!this.isMainhand && this.char.heroicQueued)
    //               ? m.min(19, this.table.miss) : 0;
    // roll += hsBug;

    let dmg = this.getDmg(extraAp) * this.char.armorDmgMul;
    if (roll < this.table.miss) {
      this.log.misses += 1;

    } else if (roll < this.table.dodge) {
      this.log.dodges += 1;
      // According to Vilius on Fight Club, dodges give 75% rage.
      this.char.rage.gainFromSwing(dmg * .75);

    } else if (roll < this.table.glance) {
      this.log.glances += 1;
      this.proc(extraSwing);
      dmg *= this.glanceMul;
      this.log.dmg += dmg;
      this.char.rage.gainFromSwing(dmg);

    } else if (roll < this.table.crit) {
      this.log.crits += 1;
      this.proc(extraSwing);
      dmg *= 2;
      this.log.dmg += dmg;
      this.char.rage.gainFromSwing(dmg);
      this.char.flurry.refresh();

    } else {  // hit
      this.log.hits += 1;
      this.proc(extraSwing);
      this.log.dmg += dmg;
      this.char.rage.gainFromSwing(dmg);
    }
  }

  handle() { this.swing(); }
}

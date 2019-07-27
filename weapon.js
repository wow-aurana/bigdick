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
  }

  // TODO armor
  getDmg() {
    const dmg = (this.avgDmg + this.char.getAp() / 14 * this.stats.speed);
    return dmg * (this.isMainhand ? 1 : .625);
  }

  // See https://github.com/magey/classic-warrior/wiki/Attack-table
  setTarget(target) {
    const stats = this.char.stats;

    const targetDef = target.level * 5;
    const baseSkill = this.char.level * 5;
    const skillDiff = targetDef - this.stats.skill;

    // miss
    this.table.miss = 
        clamp(0, 100)(19 + 5 + (skillDiff > 10 ? 1 : 0) + skillDiff * .1 - this.char.stats.hit);
    
    // dodge
    this.table.dodge = clamp(0, 100)(5 + skillDiff * .1);
    this.table.dodge += this.table.miss;

    // glance
    this.glanceMul = clamp(.2, .95)(.65 + (15 - skillDiff) * .04);
    this.table.glance = clamp(0, 100)(10 + (targetDef - m.min(baseSkill, this.stats.skill)) * 2); 
    this.table.glance += this.table.dodge;

    // crit
    const baseSkillDiff = targetDef - baseSkill;
    const magicNumber = (target.level - this.char.level) > 2 ? 1.8 : 0;
    this.table.crit = clamp(0, 100)(this.char.stats.crit - baseSkillDiff *.2 - magicNumber);
    this.table.crit += this.table.glance;
  }

  getCooldown() {
    return this.cooldown.timer;
  }

  canUse() { return true; }

  applyFlurry() {
    // This code assumes that the remaining swing time is recalculated
    // if flurry goes up or down mid swing (e.g. offhand eats last charge).
    if (this.flurried && !this.char.flurry.hasCharges()) {
      this.cooldown.timer *= 1.3;
      this.flurried = false;
    }
    if (!this.flurried && this.char.flurry.hasCharges()) {
      this.cooldown.timer /= 1.3;
      this.flurried = true;
    }
  }
  
  swing() {
    this.char.flurry.useCharge();
    this.cooldown.use();
    this.flurried = false;  // will be recalculated in main loop

    if (this.isMainhand && this.char.heroicQueued) {
      this.char.heroicQueued = false;
      if (this.char.heroic.canUse()) {
        this.char.heroic.swing();
        return;
      }
    }

    this.log.swings += 1;
    const rageBar = this.char.rage;
    const baseDmg = this.getDmg();

    let roll = m.random() * 100;
    // Heroic Strike bug: https://github.com/SunwellTracker/issues/issues/2170
    const hsBug = (!this.isMainhand && this.char.heroicQueued)
                  ? m.min(19, this.table.miss) : 0;
    roll += hsBug;
    if (roll < this.table.miss) {
      this.log.misses += 1;

    } else if (roll < this.table.dodge) {
      this.log.dodges += 1;

    } else if (roll < this.table.glance) {
      this.log.glances += 1;
      const dmg = baseDmg * this.glanceMul;
      this.log.dmg += dmg;
      rageBar.gain(rageBar.toRage(dmg));

    } else if (roll < this.table.crit) {
      this.log.crits += 1;
      const dmg = baseDmg * 2;
      this.log.dmg += dmg;
      rageBar.gain(rageBar.toRage(dmg));
      this.char.flurry.refresh();

    } else {  // hit
      this.log.hits += 1;
      this.log.dmg += baseDmg;
      rageBar.gain(rageBar.toRage(baseDmg));
    }
  }
}
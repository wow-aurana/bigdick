class Ability {
  constructor(char, rage, cooldown, name) {
    this.log = new SwingLog(name);

    this.char = char;
    this.cooldown = new Cooldown(cooldown, name);
    this.cost = rage;

    this.miss = 0;
    this.table = {};
    this.refundRage = true;
    this.onGcd = true;
  }

  getDmg() {
    console.assert(false, 'Not implemented.');
    return 0;
  }

  setTarget(target) {
    const stats = this.char.stats;

    const targetDef = target.level * 5;
    const baseSkill = this.char.level * 5;
    const skillDiff = targetDef - this.char.main.stats.skill;

    // miss
    this.miss = 
        clamp(0, 100)(5 + (skillDiff > 10 ? 1 : 0) + skillDiff * .1 - stats.hit);
    
    // dodge
    this.table.dodge = clamp(0, 100)(5 + skillDiff * .1);

    // crit
    const baseSkillDiff = targetDef - baseSkill;
    const magicNumber = (target.level - this.char.level) > 2 ? 1.8 : 0;
    this.table.crit = clamp(0, 100)(this.char.stats.crit - baseSkillDiff *.2 - magicNumber);
    this.table.crit += this.table.dodge;
  }

  getCooldown() { return m.max(this.cooldown.timer, this.char.gcd.timer); }

  canUse() { return this.char.rage.has(this.cost); }
  
  swing() {
    this.log.swings += 1;

    this.cooldown.use();
    this.onGcd && this.char.gcd.use();
    this.char.rage.use(this.cost);

    // Yellow attacks are on a 2 roll system
    if (this.miss > 0 && m.random() * 100 < this.miss) {
      this.log.misses += 1;
      return;
    }

    const secondRoll = m.random() * 100;
    if (secondRoll < this.table.dodge) {
      this.log.dodges += 1;
      // TODO figure out exact rage refunds
      if (this.refundRage) this.char.rage.gain(this.cost * .84);

    } else if (secondRoll < this.table.crit) {
      this.log.crits += 1;
      this.log.dmg += this.getDmg() * 2.2;
      this.char.flurry.refresh();

    } else {  // hit
      this.log.hits += 1;
      this.log.dmg += this.getDmg();
    }
  }
}

class Bloodthirst extends Ability {
  constructor(char) {
    super(char, 30, 6, 'Bloodthirst');
  }

  // TODO armor
  getDmg() { return this.char.getAp() * .45; }
}

class Whirlwind extends Ability {
  constructor(char) {
    super(char, 25, 10, 'Whirlwind');
    this.refundRage = false;
  }

  // TODO armor
  getDmg() {
    // TODO 2hand and daggers
    return this.char.main.avgDmg + this.char.getAp() / 14 * 2.4;
  }
}

class HeroicStrike extends Ability {
  constructor(char) {
    super(char, 12, 0, 'Heroic Strike');
    // TODO confirm that HS does not refund rage on dodge/parry/miss
    this.refundRage = false;
    this.onGcd = false;
  }

  // TODO armor
  getDmg() {
    return this.char.main.getDmg() + 138;
  }
}
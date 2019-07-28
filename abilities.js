class Ability {
  constructor(char, rage, cooldown, name) {
    this.log = new SwingLog(name);

    this.char = char;
    this.cooldown = new Cooldown(cooldown, name);
    this.cost = rage;

    this.table = {};
    this.crit = 0;
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
    this.table.miss = clamp(0, 100)(5 + (skillDiff > 10 ? 1 : 0)
                                      + skillDiff * .1 - stats.hit);

    // dodge
    this.table.dodge = clamp(0, 100)(5 + skillDiff * .1);
    this.table.dodge += this.table.miss;

    // crit
    const baseSkillDiff = targetDef - baseSkill;
    const magicNumber = (target.level - this.char.level) > 2 ? 1.8 : 0;
    this.table.crit =
        clamp(0, 100)(this.char.stats.crit - baseSkillDiff *.2 - magicNumber);

  }

  getCooldown() { return m.max(this.cooldown.timer, this.char.gcd.timer); }
  canUse() { return this.char.rage.has(this.cost); }
  
  swing() {
    this.log.swings += 1;

    this.cooldown.use();
    this.onGcd && this.char.gcd.use();
    this.char.rage.use(this.cost);

    // Yellow attacks are on a 2 roll system
    const firstRoll = m.random() * 100;
    if (firstRoll < this.table.miss) {
      this.log.misses += 1;
    } else if (firstRoll < this.table.dodge) {
      this.log.dodges += 1;
      // TODO figure out exact rage refunds
      if (this.refundRage) this.char.rage.gain(this.cost * .84);
    } else {
      const secondRoll = m.random() * 100;
      if (secondRoll < this.table.crit) {
        this.log.crits += 1;
        this.char.main.proc();
        this.log.dmg += this.getDmg() * this.char.yellowCritMul;
        this.char.flurry.refresh();

      } else {  // hit
        this.log.hits += 1;
        this.char.main.proc();
        this.log.dmg += this.getDmg();
      }
    }
  }

  handle() { this.swing(); }
}

class Bloodthirst extends Ability {
  constructor(char) {
    super(char, 30, 6, 'Bloodthirst');
  }

  // TODO armor
  getDmg() {
    return this.char.getAp() * .45 * this.char.wpnspec;
  }
}

class Whirlwind extends Ability {
  constructor(char) {
    super(char, 25, 10, 'Whirlwind');
    this.refundRage = false;
  }

  // TODO armor
  getDmg() {
    // TODO dagger
    const normalization = this.char.stats.twohand ? 3.4 : 2.4;
    const dmg =
        this.char.main.avgDmg + this.char.getAp() / 14 * normalization;  
    return dmg * this.char.wpnspec;
  }
}

class HeroicStrike extends Ability {
  constructor(char) {
    super(char, char.heroicCost, 0, 'Heroic Strike');
    // TODO confirm that HS does not refund rage on dodge/parry/miss
    this.refundRage = false;
    this.onGcd = false;
  }

  // TODO armor
  getDmg() {
    return this.char.main.getDmg() + 138 * this.char.wpnspec;
  }
}

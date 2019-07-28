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

  tick(seconds) { this.cooldown.tick(seconds); }

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

  timeUntil() {
    return m.max(this.cooldown.timeUntil(), this.char.gcd.timeUntil());
  }
  
  canUse() { return this.char.rage.has(this.cost); }
  
  swing() {
    this.log.swings += 1;
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

  handle() {
    this.cooldown.use();
    this.onGcd && this.char.gcd.use();
    this.swing();
  }
}

class Bloodthirst extends Ability {
  constructor(char) {
    super(char, 30, 6, 'Bloodthirst');
  }

  getDmg() { return this.char.getAp() * .45 * this.char.wpnspec; }
}

class Slam extends Ability {
  constructor(char, slamWhen) {
    super(char, 15, 0, 'Slam');
    this.slamWhen = slamWhen;
    this.casting = false;
    this.opportunity = new Cooldown(this.slamWhen.delay / 1000, 'Slam now!');
  }
  tick(seconds) { super.tick(seconds); this.opportunity.tick(seconds); }

  canUse() {
    return !this.casting
           && this.opportunity.running()
           && this.char.rage.has(m.max(this.cost, this.slamWhen.rage));
  }

  getDmg() {
    return this.char.main.getDmg() + 87 * this.char.wpnspec;
  }

  swing() {
    console.assert(this.casting, 'Trying to swing slam when not casting');
    this.casting = false;
    super.swing();
    for (const a of this.char.autos) {
      a.cooldown.force();
    }
  }

  handle() {
    this.cooldown.use();
    this.onGcd && this.char.gcd.use();
    this.casting = true;
    this.char.slamSwing.use();
  }
}

class Whirlwind extends Ability {
  constructor(char) {
    super(char, 25, 10, 'Whirlwind');
    this.refundRage = false;
  }

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

  getDmg() {
    return this.char.main.getDmg() + 138 * this.char.wpnspec;
  }
}

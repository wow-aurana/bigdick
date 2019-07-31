class Ability {
  constructor(char, rage, cooldown, usewhen, name) {
    this.log = new SwingLog(name);

    this.char = char;
    this.cost = rage;
    this.cooldown = new Cooldown(cooldown, name);
    this.usewhen = usewhen;

    this.table = {};
    this.crit = 0;
  }

  tick(seconds) { this.cooldown.tick(seconds); }

  getDmg() {
    console.assert(false, 'Not implemented.');
    return 0;
  }

  // See https://github.com/magey/classic-warrior/wiki/Attack-table
  setTarget(target) {
    const stats = this.char.stats;

    const targetDef = target.level * 5;
    const baseSkill = this.char.level * 5;
    const skillDiff = targetDef - this.char.main.stats.skill;

    // miss
    // see this blue post:
    // https://us.forums.blizzard.com/en/wow/t/bug-hit-tables/185675/33
    const hitOnGear = m.max(0, this.char.stats.hit - (skillDiff > 10 ? 1 : 0));
    const missFromSkill = (skillDiff > 10 ? .2 : .1) * skillDiff;
    this.table.miss =
        clamp(0, 100)(5 + missFromSkill - hitOnGear);

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

  checkUserConditions() { return true; }
  onMiss() { this.char.rage.use(this.cost); }
  // Assuming rage refunding is 84%
  onDodge() { this.char.rage.use(this.cost * .16); }
  onHit() { this.char.rage.use(this.cost); }

  canUse() {
    if (!this.char.rage.has(this.cost)) return false;
    return this.checkUserConditions();
  }
  
  swing() {
    this.log.swings += 1;

    // Yellow attacks are on a 2 roll system
    const firstRoll = m.random() * 100;
    if (firstRoll < this.table.miss) {
      this.log.misses += 1;
      this.onMiss();
    } else if (firstRoll < this.table.dodge) {
      this.log.dodges += 1;
      this.onDodge();
    } else {
      const dmg = this.getDmg();
      this.onHit();
      const secondRoll = m.random() * 100;
      if (secondRoll < this.table.crit) {
        this.log.crits += 1;
        this.char.main.proc();
        this.log.dmg += dmg * this.char.yellowCritMul;
        this.char.flurry.refresh();

      } else {  // hit
        this.log.hits += 1;
        this.char.main.proc();
        this.log.dmg += dmg;
      }
    }
  }

  handle() {
    this.cooldown.use();
    this.char.gcd.use();
    this.swing();
  }
}

// Execute
// TODO refund rage properly
class Execute extends Ability {
  constructor(char, usewhen) {
    super(char, char.executeCost, 0, usewhen, 'Execute');
  }

  onMiss() { this.char.rage.use(this.char.rage.current * .16); }
  onDodge() { this.char.rage.use(this.char.rage.current * .16); }
  onHit() { this.char.rage.use(this.char.rage.current); }

  checkUserConditions() {
    // Use when below this much rage, not above
    if (!this.char.rage.has(this.usewhen.rage)) return true;
    return this.char.checkBtWwCd(this.usewhen.btww);
  }

  getDmg() { 
    return (600 + (this.char.rage.current - this.cost) * 15)
           * this.char.wpnspec;
  }
}

// Slam
class Slam extends Ability {
  constructor(char, usewhen) {
    super(char, 15, 0, usewhen, 'Slam');
    this.casting = false;
    this.opportunity = new Cooldown(this.usewhen.delay / 1000, 'Slam now!');
  }
  tick(seconds) { super.tick(seconds); this.opportunity.tick(seconds); }

  checkUserConditions() {
    return !this.casting
           && this.opportunity.running()
           && this.char.rage.has(this.usewhen.rage);
  }

  getDmg() { return this.char.main.getDmg() + 87 * this.char.wpnspec; }

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
    this.char.gcd.use();
    this.casting = true;
    this.char.slamSwing.use();
  }
}

// Bloodthirst
class Bloodthirst extends Ability {
  constructor(char, usewhen) {
    super(char, 30, 6, usewhen, 'Bloodthirst');
  }

  checkUserConditions() { return this.char.rage.has(this.usewhen.rage); }
  getDmg() { return this.char.getAp() * .45 * this.char.wpnspec; }
}

// Whirlwind
class Whirlwind extends Ability {
  constructor(char, usewhen) {
    super(char, 25, 10, usewhen, 'Whirlwind');
  }

  checkUserConditions() {
    if (!this.char.rage.has(this.usewhen.rage)) return false;
    return this.char.checkBtCd(this.usewhen.bt);
  }

  onDodge() { this.char.rage.use(this.cost); }

  getDmg() {
    const normalization = this.char.stats.twohand ? 3.3 : 2.4;
    const dmg = this.char.main.avgDmg + this.char.getAp() / 14 * normalization;  
    return dmg * this.char.wpnspec;
  }
}

// Heroic Strike
class HeroicStrike extends Ability {
  constructor(char, usewhen) {
    super(char, char.heroicCost, 0, usewhen, 'Heroic Strike');
  }

  // TODO confirm that HS does not refund rage on dodge/parry/miss
  onDodge() { this.char.rage.use(this.cost); }

  checkUserConditions() {
    if (!this.char.rage.has(this.usewhen.rage)) return false;
    return this.char.checkBtWwCd(this.usewhen.btww);
  }

  getDmg() { return this.char.main.getDmg() + 138 * this.char.wpnspec; }
  timeUntil() { console.assert(false, 'How did HS get in the event queue?'); }
  handle() { console.assert(false, 'How did HS get in the event queue?'); }
}

// Hamstring
class Hamstring extends Ability {
  constructor(char, usewhen) {
    super(char, 30, 0, usewhen, 'Hamstring');
  }

  checkUserConditions() {
    if (!this.char.rage.has(this.usewhen.rage)) return false;
    return this.char.checkBtWwCd(this.usewhen.btww);
  }

  getDmg() { return 45 * this.char.wpnspec; }
}

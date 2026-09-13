'use strict';

class Ability {
  constructor(char, rage, cooldown, usewhen, name) {
    this.log = new SwingLog(name);

    this.char = char;
    this.cost = rage;
    this.cooldown = new Cooldown(cooldown, name);
    this.usewhen = usewhen;

    this.table = {};
  }

  reset() { this.cooldown.reset(); }
  tick(seconds) { this.cooldown.tick(seconds); }

  getDmg() {
    console.assert(false, 'Not implemented.');
    return 0;
  }

  // See https://github.com/magey/classic-warrior/wiki/Attack-table
  setTarget(target) {
    const { miss, dodge, crit } =
        baseAttackChances(this.char, target, this.char.main.stats.skill);
    this.table.miss = miss;
    this.table.dodge = dodge;
    this.table.dodge += this.table.miss;
    this.table.crit = crit;
    final(this.table);
  }

  timeUntil() {
    return m.max(this.cooldown.timeUntil(), this.char.gcd.timeUntil()) +
           this.char.brainlag.current;
  }

  checkConditions() { return true; }
  checkExecuteConditions() { return false; }
  // Assuming rage refunding is 80%
  onMiss() { this.char.rage.use(this.cost * .2); }
  onDodge() { this.char.rage.use(this.cost * .2); }
  onHit() { this.char.rage.use(this.cost); }

  canUse() {
    if (!this.char.rage.has(this.cost)) return false;
    if (this.char.can.execute) return this.checkExecuteConditions();
    return this.checkConditions();
  }
  
  swing() {
    this.log.swings += 1;
    const label = this.log.name;
    const rageNow = () => this.char.rage.is.now.toFixed(1);

    // Yellow attacks are on a 2 roll system
    const firstRoll = m.random() * 100;
    if (firstRoll < this.table.miss) {
      this.log.misses += 1;
      this.onMiss();
      Debug.log(label + ': miss (rage: ' + rageNow() + ')');
    } else if (firstRoll < this.table.dodge) {
      this.log.dodges += 1;
      this.onDodge();
      Debug.log(label + ': dodged (rage: ' + rageNow() + ')');
    } else {
      const dmg = this.getDmg() * this.char.armorDmgMul;
      this.onHit();
      const secondRoll = m.random() * 100;
      if (secondRoll < this.table.crit) {
        this.log.crits += 1;
        this.char.main.proc();
        const critDmg = dmg * this.char.yellowCritMul;
        this.log.dmg += critDmg;
        this.char.flurry.refresh();
        Debug.log(label + ': critical hit for ' + critDmg.toFixed(0)
                  + ' (rage: ' + rageNow() + ')');

      } else {  // hit
        this.log.hits += 1;
        this.char.main.proc();
        this.log.dmg += dmg;
        Debug.log(label + ': hit for ' + dmg.toFixed(0)
                  + ' (rage: ' + rageNow() + ')');
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
class Execute extends Ability {
  constructor(char, usewhen) {
    super(char, char.executeCost, 0, usewhen, 'Execute');
    this.ragereset = new RageReset(char.rage);

    final(this);
  }

  getDmg() { 
    return (600 + (this.char.rage.is.now - this.cost) * 15)
           * this.char.multiplier();
  }

  // TODO verify that rage is refunded correctly
  onMiss() { this.char.rage.use(this.cost); }
  onDodge() { this.char.rage.use(this.cost); }

  onHit() {
    this.char.rage.use(this.cost);
    this.ragereset.did.execute = true;
    // Spell batching nonsense
    this.ragereset.force(.4 + m.random() * .4);
  }

  checkConditions() { return false; }
  checkExecuteConditions() { return true; }
}

// Slam
class Slam extends Ability {
  constructor(char, usewhen) {
    super(char, 15, 0, usewhen, 'Slam');
    this.is = { casting: false };
    this.opportunity = new Cooldown(this.usewhen.delay / 1000, 'Slam now!');

    final(this);
  }

  reset() { super.reset(); this.is.casting = false; }
  tick(seconds) { super.tick(seconds); this.opportunity.tick(seconds); }
  getDmg() { return this.char.main.getDmg() + 87 * this.char.multiplier(); }

  checkConditions() {
    return !this.is.casting
           && this.opportunity.running()
           && this.char.rage.has(this.usewhen.rage);
  }

  swing() {
    console.assert(this.is.casting, 'Trying to swing slam when not casting');
    this.is.casting = false;
    super.swing();
    for (const a of this.char.autos) {
      a.cooldown.force();
    }
  }

  handle() {
    this.cooldown.use();
    this.char.gcd.use();
    this.is.casting = true;
    this.char.slamSwing.use();
  }
}

// Bloodthirst
class Bloodthirst extends Ability {
  constructor(char, usewhen) {
    super(char, 30, 6, usewhen, 'Bloodthirst');

    final(this);
  }

  getDmg() { return this.char.getAp() * .45 * this.char.multiplier(); }
  checkConditions() { return this.char.rage.has(this.usewhen.rage); }
  
  checkExecuteConditions() {
    if (!this.usewhen.execute) return false;
    if (!this.char.rage.has(this.usewhen.execute.rage)) return false;
    return (this.char.getAp() > this.usewhen.execute.ap);
  }
}

// Whirlwind
class Whirlwind extends Ability {
  constructor(char, usewhen) {
    super(char, 25, 10, usewhen, 'Whirlwind');

    final(this);
  }

  getDmg() {
    const dmg = this.char.main.avgDmg
              + this.char.getAp() / 14 * this.char.abilityApScaling;  
    return dmg * this.char.multiplier();
  }

  checkConditions() {
    if (!this.char.rage.has(this.usewhen.rage)) return false;
    return this.char.checkBtCd(this.usewhen.bt);
  }

  checkExecuteConditions() {
    if (!this.usewhen.execute) return false;
    if (!this.char.rage.has(this.usewhen.execute.rage)) return false;
    return (this.char.getAp() > this.usewhen.execute.ap);
  }

  onMiss() { this.char.rage.use(this.cost); }
  onDodge() { this.char.rage.use(this.cost); }
}

// Heroic Strike
class HeroicStrike extends Ability {
  constructor(char, usewhen) {
    super(char, char.heroicCost, 0, usewhen, 'Heroic Strike');
    this.is = { queued: false };

    final(this);
  }

  getDmg() { return this.char.main.getDmg() + 138 * this.char.multiplier(); }

  checkConditions() {
    if (!this.char.rage.has(this.usewhen.rage)) return false;
    return this.char.checkBtWwCd(this.usewhen.btww);
  }

  timeUntil() { console.assert(false, 'How did HS get in the event queue?'); }
  handle() { console.assert(false, 'How did HS get in the event queue?'); }
}

// Hamstring
class Hamstring extends Ability {
  constructor(char, usewhen) {
    const cost = usewhen.gloves ? 7 : 10;
    super(char, cost, 0, usewhen, 'Hamstring');

    final(this);
  }

  getDmg() { return 45 * this.char.multiplier(); }

  checkConditions() {
    if (!this.char.rage.has(this.usewhen.rage)) return false;
    return this.char.checkBtWwCd(this.usewhen.btww);
  }
}

'use strict';

class Ability {
  // `stances`, if given, is the list of stances this ability can be used
  // in (e.g. ['berserker']); null means no restriction. Defensive Stance
  // is never modeled, so an ability usable in "Battle or Defensive" etc.
  // can just be left unrestricted (null) -- the sim never enters Defensive
  // anyway, so there's nothing to gate.
  constructor(char, rage, cooldown, usewhen, name, stances = null) {
    this.log = new SwingLog(name);

    this.char = char;
    this.cost = rage;
    this.cooldown = new Cooldown(cooldown, name);
    this.usewhen = usewhen;
    this.stances = stances;

    this.table = {};
  }

  reset() { this.cooldown.reset(); }
  tick(seconds) { this.cooldown.tick(seconds); }

  getDmg() {
    console.assert(false, 'Not implemented.');
    return 0;
  }

  // See https://github.com/magey/classic-warrior/wiki/Attack-table
  // Not frozen (unlike most cached state in this codebase): stance changes
  // mid-fight change crit chance, so this can be recomputed more than once
  // -- see Character.recomputeTables().
  setTarget(target) {
    const { miss, dodge, crit } =
        baseAttackChances(this.char, target, this.char.main.stats.skill);
    this.table.miss = miss;
    this.table.dodge = dodge;
    this.table.dodge += this.table.miss;
    this.table.crit = crit;
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

  inRightStance() {
    return !this.stances || this.stances.includes(this.char.stance.is.current);
  }

  // If a stance switch is needed and available, that switch will cap rage
  // (see Stance.switchTo()) *before* this ability actually spends any --
  // stance-dancing into a costly ability on high rage can leave too little
  // for the very ability that demanded the dance. Returns the rage that
  // would actually be available at the moment this ability executes.
  rageAfterStanceSwitch() {
    if (!this.stances || this.inRightStance()) return this.char.rage.is.now;
    if (this.char.stance.running()) return 0;
    return m.min(this.char.rage.is.now, this.char.stance.retainedRage());
  }

  canUse() {
    const rage = this.rageAfterStanceSwitch();
    if (rage < this.cost) return false;
    if (rage === this.char.rage.is.now) {
      // No stance switch pending: check conditions against real rage.
      if (this.char.can.execute) return this.checkExecuteConditions();
      return this.checkConditions();
    }
    // A switch is pending and will cap rage first -- checkConditions()
    // reads char.rage directly, so briefly present it with the post-switch
    // value. Synchronous and restored before anything else can observe it.
    const real = this.char.rage.is.now;
    this.char.rage.is.now = rage;
    const result = this.char.can.execute
        ? this.checkExecuteConditions() : this.checkConditions();
    this.char.rage.is.now = real;
    return result;
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
    // Stance switching is instant and off the GCD, so this still happens
    // in the same instant as the rest of the ability below.
    if (this.stances && !this.inRightStance()) {
      this.char.stance.switchTo(this.stances[0]);
    }
    this.cooldown.use();
    this.char.gcd.use();
    this.swing();
  }
}

// Execute
class Execute extends Ability {
  constructor(char, usewhen) {
    super(char, char.executeCost, 0, usewhen, 'Execute');

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
    // Used to be delayed a batch or two ("spell batching") -- up to 400-800ms
    // when the batch window was 400ms -- but patch 1.13.7 (2021) cut that
    // window to 10ms, well below anything this sim resolves, so the reset is
    // effectively instant now.
    const remaining = this.char.rage.is.now;
    this.char.rage.use(remaining);
    if (remaining > 0) {
      Debug.log('Execute rage reset: ' + remaining.toFixed(1) + ' -> 0');
    }
  }

  checkConditions() { return false; }
  checkExecuteConditions() { return true; }
}

// Slam. Only meant to be used once Improved Slam rank 2 is talented --
// below that it still interrupts (resets) your melee swing timer, which
// this sim doesn't model at all now that it no longer needs to: rank 2's
// "Slam no longer interrupts your melee swing time" makes Slam a plain
// cast-time GCD ability with zero interaction with autoattacks, so there's
// no swing-timing window to approximate (the old "cast within N ms of a
// swing" mechanic and its opportunity-window Cooldown are gone). The
// checkbox on the main page is hidden below Improved Slam rank 2.
class Slam extends Ability {
  constructor(char, usewhen) {
    super(char, 15, 0, usewhen, 'Slam');
    this.is = { casting: false };

    final(this);
  }

  reset() { super.reset(); this.is.casting = false; }
  getDmg() { return this.char.main.getDmg() + 87 * this.char.multiplier(); }

  checkConditions() {
    return !this.is.casting && this.char.rage.has(this.usewhen.rage);
  }

  swing() {
    console.assert(this.is.casting, 'Trying to swing slam when not casting');
    this.is.casting = false;
    super.swing();
  }

  handle() {
    this.cooldown.use();
    this.char.gcd.use();
    this.is.casting = true;
    this.char.slamSwing.use();
  }
}

// Mortal Strike. "Weapon damage plus 160" per forever-spells-notes.md --
// unlike Bloodthirst this scales off weapon damage, not attack power. No
// stance requirement. Only meaningful once talented (see the checkbox
// gating in main.js/updateTalentGating()).
class MortalStrike extends Ability {
  constructor(char, usewhen) {
    super(char, 30, 6, usewhen, 'Mortal Strike');

    final(this);
  }

  getDmg() { return this.char.main.getDmg() + 160 * this.char.multiplier(); }
  checkConditions() { return this.char.rage.has(this.usewhen.rage); }

  checkExecuteConditions() {
    if (!this.usewhen.execute) return false;
    if (!this.char.rage.has(this.usewhen.execute.rage)) return false;
    return (this.char.getAp() > this.usewhen.execute.ap);
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
    super(char, 25, 10, usewhen, 'Whirlwind', ['berserker']);

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

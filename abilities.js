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
      this.char.procOverpowerDodge();
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
        this.char.procDeepWounds();
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

// Rend. Only meaningful with Bloodthrill talented (see the checkbox gating
// in main.js) -- Bloodthrill's proc requires Rend to be up on the target.
// Deals no direct damage on application; all of it comes from the periodic
// bleed (RendDot in cooldowns.js). Requires Battle Stance (Defensive isn't
// modeled, see character.js's Stance comment).
class Rend extends Ability {
  constructor(char, usewhen) {
    super(char, 10, 0, usewhen, 'Rend', ['battle']);

    final(this);
  }

  getDmg() { return 0; }
  // "Keep it up as best as possible": only re-cast once it's fully fallen
  // off. Priority among everything else is left for later refinement.
  checkConditions() { return !this.char.rendDot.active(); }

  onHit() {
    super.onHit();
    this.char.rendDot.apply();
  }
}

// Overpower. Classic's dodge-triggered window isn't modeled here --
// Bloodthrill (procBloodthrill() in character.js) is the only way this sim
// grants a charge, and using Overpower consumes it immediately regardless
// of whether the swing then hits or misses. Improved Overpower's crit
// bonus is flat, not suppressed like normal crit sources -- see
// forever-talents-notes.md/talent-data.js, it isn't described as an aura
// or gear-like source there.
class Overpower extends Ability {
  constructor(char, usewhen) {
    super(char, 5, 5, usewhen, 'Overpower', ['battle']);

    final(this);
  }

  setTarget(target) {
    super.setTarget(target);
    this.table.crit =
        clamp(0, 100)(this.table.crit + this.char.improvedOverpower * 25);
  }

  getDmg() { return this.char.main.getDmg() + 35 * this.char.multiplier(); }

  // Either window is enough to use it -- Bloodthrill (talent-driven) or
  // the default dodge trigger (always available, see
  // Character.procOverpowerDodge()).
  checkConditions() {
    return this.char.overpowerReady.running()
        || this.char.overpowerDodge.running();
  }

  handle() {
    // Using Overpower consumes both windows regardless of which one (or
    // both) actually enabled this cast.
    this.char.overpowerReady.reset();
    this.char.overpowerDodge.reset();
    super.handle();
  }
}

// Spearing Strike. 40% weapon damage, +80% more (120% total) against
// Giants, Dragonkin, or a mounted target -- see the "Enemy type" setting
// on the main form, threaded through as char.target.type. There's no
// separate "mounted" toggle: mounts are Beast-type creatures, so
// selecting Beast already covers the mounted case (see rtfm.html). No
// stance requirement is mentioned in its tooltip, unlike Sweeping Strikes.
class SpearingStrike extends Ability {
  constructor(char, usewhen) {
    super(char, 15, 10, usewhen, 'Spearing Strike');

    final(this);
  }

  bonusApplies() {
    const type = this.char.target.type;
    return type === 'giant' || type === 'dragonkin' || type === 'beast';
  }

  getDmg() {
    const mul = this.bonusApplies() ? 1.2 : .4;
    return this.char.main.getDmg() * mul;
  }

  checkConditions() { return this.char.rage.has(this.usewhen.rage); }
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
    // Classic's Slam has no cooldown beyond the cast time/GCD; Forever
    // gives it a real 15 sec cooldown (confirmed by the user, 2026-09-20).
    super(char, 15, 15, usewhen, 'Slam');
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

  // 35% AP + 30 flat, per talent-data.js (from the user's own screenshot).
  // forever-spells-notes.md separately recorded 45% AP with no flat bonus,
  // but that came from wowforevertalents.com's Classic-talent placeholder,
  // not a screenshot -- the user's own source wins per this project's
  // established authority order.
  getDmg() { return (this.char.getAp() * .35 + 30) * this.char.multiplier(); }
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

  // Raging Blows: "causes your Whirlwind to also strike with your
  // off-hand weapon." A fully separate hit/crit/miss roll against the
  // same attack table, on top of the normal (mainhand-based) swing above.
  // Doesn't generate rage or proc weapon effects, and isn't counted in
  // this.log's swings/hits/crits/misses (which stay a clean read on the
  // mainhand roll) -- only its damage is added, to keep this simple.
  getOffhandDmg() {
    const dmg = this.char.off.avgDmg
              + this.char.getAp() / 14 * this.char.abilityApScaling;
    return dmg * this.char.multiplier() * this.char.offhandDmgMul;
  }

  swing() {
    super.swing();
    if (this.char.ragingBlows && this.char.off) this.swingOffhand();
  }

  swingOffhand() {
    const label = this.log.name + ' (off-hand, Raging Blows)';
    const rageNow = () => this.char.rage.is.now.toFixed(1);
    const roll = m.random() * 100;
    if (roll < this.table.miss) {
      Debug.log(label + ': miss');
    } else if (roll < this.table.dodge) {
      Debug.log(label + ': dodged');
    } else {
      const dmg = this.getOffhandDmg() * this.char.armorDmgMul;
      if (m.random() * 100 < this.table.crit) {
        const critDmg = dmg * this.char.yellowCritMul;
        this.log.dmg += critDmg;
        Debug.log(label + ': critical hit for ' + critDmg.toFixed(0)
                  + ' (rage: ' + rageNow() + ')');
      } else {
        this.log.dmg += dmg;
        Debug.log(label + ': hit for ' + dmg.toFixed(0)
                  + ' (rage: ' + rageNow() + ')');
      }
    }
  }
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

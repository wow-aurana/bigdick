'use strict';

class CooldownBase {
  constructor(duration, name) {
    this.duration = duration;
    this.time = { left: 0 };
    this.name = name;
  }
  
  running() { return this.time.left > 0; }
  timeUntil() { return this.time.left; }
  tick(seconds) { this.time.left = m.max(this.time.left - seconds, 0); }

  use() {
    console.assert(this.time.left <= 0,
        'Trying use ' + this.name + ' before it is ready');
    this.time.left = this.duration;
  }

  force(seconds = this.duration) { this.time.left = seconds; }
  reset() { this.time.left = 0; }
}

class Cooldown extends CooldownBase {
  constructor(duration, name) {
    super(duration, name);

    final(this);
  }
}

class ApOnUse extends CooldownBase {
  constructor(cfg) {
    super(cfg.cooldown, 'AP on use');
    this.ap = cfg.ap;
    this.uptime = cfg.uptime;

    final(this);
  }

  getAp() {
    if (this.duration - this.time.left < this.uptime) return this.ap
    return 0;
  }

  canUse() { return true; }
  handle() {
    this.use();
    Debug.log('AP trinket activated (+' + this.ap + ' AP for '
              + this.uptime + 's)');
  }
}

class DeathWish extends CooldownBase {
  constructor(char, cfg) {
    super(180, 'Death Wish');
    this.char = char;
    this.waitForEndOfFight = cfg.endoffight;

    final(this);
  }

  canUse(fightEndsIn) {
    if (!this.char.rage.has(30)) return false;
    if (!this.waitForEndOfFight) return true;
    if (fightEndsIn <= 31.5) return true;
    // For fights longer than 210 seconds
    return (this.time.left + this.duration < fightEndsIn - 30);
  }

  timeUntil() { return m.max(this.time.left, this.char.gcd.timeUntil()); }

  use() {
    super.use();
    this.char.gcd.use();
    this.char.rage.use(30);
    Debug.log('Death Wish activated (rage: '
              + this.char.rage.is.now.toFixed(1) + ')');
    // "With Death Wish" racial trigger: piggyback the racial active
    // ability's use onto this one, silently skipped if it's still on its
    // own cooldown -- see RacialActive in cooldowns.js.
    const racial = this.char.racialActive;
    if (racial && racial.trigger === 'deathwish' && !racial.running()) {
      racial.handle();
    }
  }

  active() { return (this.duration - this.time.left) < 30; }
  handle() { this.use(); }
}

class RagePotion extends CooldownBase {
  constructor(rage) {
    super(120, 'Mighty Rage Potion');
    this.rage = rage;

    final(this);
  }

  canUse() { return true; }
  getStr() { return (this.duration - this.time.left) < 20 ? 60 : 0; }

  handle() {
    this.use();
    const gain = 45 + m.random() * 30;
    this.rage.gain(gain);
    Debug.log('Mighty Rage Potion: +' + gain.toFixed(1) + ' rage (rage: '
              + this.rage.is.now.toFixed(1) + ')');
  }
}

// Generic on-use racial ability (Elune's Light, Blood Fury, Berserking --
// Eureka! is a small subclass below). Off the GCD, no rage cost. What the
// buff window actually *does* (crit, AP, haste...) is read elsewhere via
// active(), the same pattern Death Wish's own this.char.deathwish.active()
// already uses -- see Character.getCrit()/getAp() and
// Weapon.applyRacialHaste().
//
// `trigger` (from the "Racial active ability" setting) picks the schedule:
//  - 'immediate': usable from the start of the fight, then on cooldown.
//  - 'delayed': not usable until `cfg.seconds` into the fight, then on
//    cooldown as normal after that first use.
//  - 'deathwish': never picked by the normal event loop (canUse() is
//    always false) -- instead Death Wish's own use() calls use() on this
//    directly, so it only ever fires alongside Death Wish, silently
//    skipped if still on cooldown at that moment.
class RacialActive extends CooldownBase {
  constructor(char, name, duration, uptime, cfg) {
    super(duration, name);
    this.char = char;
    this.uptime = uptime;
    this.trigger = cfg.trigger;
    this.delaySeconds = cfg.trigger === 'delayed' ? (cfg.seconds || 0) : 0;
    this.reset();

    final(this);
  }

  active() { return this.duration - this.time.left < this.uptime; }
  canUse() { return this.trigger !== 'deathwish'; }

  handle() {
    this.use();
    Debug.log(this.name + ' activated');
  }

  reset() { this.time.left = this.trigger === 'delayed' ? this.delaySeconds : 0; }
}

// Eureka! (Gnome): rather than a duration-gated buff, grants 3 charges
// consumed one at a time by the next 3 abilities -- see
// Character.consumeEureka() and Ability.handle()/swing() in abilities.js.
class EurekaActive extends RacialActive {
  constructor(char, cfg) {
    super(char, 'Eureka!', 120, 0, cfg);

    final(this);
  }

  handle() {
    this.use();
    this.char.racial.eurekaCharges = 3;
    Debug.log('Eureka! activated: next 3 abilities cost 40% less rage and deal 10% more damage');
  }
}

class SlamSwing extends CooldownBase {
  constructor(slam, castTime) {
    super(castTime, 'Slam swing');
    this.slam = slam;

    final(this);
  }

  canUse() { return this.slam.is.casting; }
  handle() { this.slam.swing(); }
}

class AngerManagement extends CooldownBase {
  constructor(rage) {
    super(3, 'Anger Management');
    this.rage = rage;

    final(this);
  }

  canUse() { return true; }

  handle() {
    this.use();
    this.rage.gain(1);
    Debug.log('Anger Management: +1 rage (rage: '
              + this.rage.is.now.toFixed(1) + ')');
  }
}

class BloodrageTick extends CooldownBase {
  constructor(rage) {
    super(1, 'Bloodrage tick');
    this.rage = rage;
    this.has = { charges: 0 };

    final(this);
  }

  start() { this.has.charges = 10; this.use(); }
  canUse() { return this.has.charges > 0; }

  handle() {
    this.use();
    this.rage.gain(1);
    this.has.charges -= 1;
    Debug.log('Bloodrage tick: +1 rage (rage: '
              + this.rage.is.now.toFixed(1) + ')');
  }
}

class Bloodrage extends CooldownBase {
  constructor(rage) {
    super(60, 'Bloodrage');
    this.rage = rage;
    this.ragetick = new BloodrageTick(rage);

    final(this);
  }

  canUse() { return true; }

  handle() {
    this.use();
    this.rage.gain(10);
    this.ragetick.start();
    Debug.log('Bloodrage activated: +10 rage (rage: '
              + this.rage.is.now.toFixed(1) + ')');
  }
}

// Rend's periodic bleed. Rend itself (abilities.js) deals no direct damage
// on application -- all of it comes from here, credited to Rend's own log
// so it reports as one "Rend" damage source. Max rank (7, level 60): 147
// total over 21 sec, ticking every 3 sec -- see forever-spells-notes.md.
// No rank-scaling modeled, matching this sim's level-60-only assumption.
// A crit on the application doesn't change the bleed's damage in Classic,
// so apply() always sets up the same flat total regardless of that roll.
class RendDot extends CooldownBase {
  constructor(char) {
    super(3, 'Rend tick');
    this.char = char;
    this.has = { ticksLeft: 0, dmgPerTick: 0 };

    final(this);
  }

  active() { return this.has.ticksLeft > 0; }
  canUse() { return this.has.ticksLeft > 0; }

  // force() rather than use(): re-applying while a previous Rend is still
  // ticking down (shouldn't normally happen, since Rend.checkConditions()
  // requires !active() first, but this stays safe either way) would
  // otherwise trip use()'s "already running" assertion.
  apply() {
    const total = 147 * (1 + this.char.improvedRend * .12);
    this.has.ticksLeft = 7;
    this.has.dmgPerTick = total / 7;
    this.force();
  }

  handle() {
    this.has.ticksLeft -= 1;
    this.char.rend.log.dmg += this.has.dmgPerTick;
    Debug.log('Rend tick: ' + this.has.dmgPerTick.toFixed(0) + ' damage ('
              + this.has.ticksLeft + ' tick' + (this.has.ticksLeft === 1 ? '' : 's')
              + ' left, rage: ' + this.char.rage.is.now.toFixed(1) + ')');
    // Only re-arm the 3 sec tick timer if there's another tick to come --
    // otherwise this is done, and the timer must actually read as expired
    // (not just "about to run out") for the next apply() to work.
    if (this.has.ticksLeft > 0) this.force();
  }

  reset() { super.reset(); this.has.ticksLeft = 0; }
}

// Deep Wounds' bleed: "your critical strikes cause your opponent to bleed,
// dealing 20/40/60% of your melee weapon's average damage over 12 sec."
// Ticks every 1 sec (12 ticks). Triggers on any crit -- white or yellow,
// see Character.procDeepWounds(), called from both Weapon.swing() and
// Ability.swing(). Re-triggering refreshes rather than stacks, matching
// Rend's own re-application above. Has its own SwingLog (not tied to any
// one ability) so it shows up as its own line in the damage report --
// see compileResults() in sim.js.
class DeepWoundsDot extends CooldownBase {
  constructor(char) {
    super(1, 'Deep Wounds tick');
    this.char = char;
    this.has = { ticksLeft: 0, dmgPerTick: 0 };
    this.log = new SwingLog('Deep Wounds');

    final(this);
  }

  active() { return this.has.ticksLeft > 0; }
  canUse() { return this.has.ticksLeft > 0; }

  apply() {
    const total = this.char.main.avgDmg * this.char.deepWoundsPercent;
    this.has.ticksLeft = 12;
    this.has.dmgPerTick = total / 12;
    this.log.swings += 1;  // counts applications, for the report's "per fight" line
    this.force();
  }

  handle() {
    this.has.ticksLeft -= 1;
    this.log.dmg += this.has.dmgPerTick;
    Debug.log('Deep Wounds tick: ' + this.has.dmgPerTick.toFixed(0)
              + ' damage (' + this.has.ticksLeft + ' tick'
              + (this.has.ticksLeft === 1 ? '' : 's') + ' left)');
    if (this.has.ticksLeft > 0) this.force();
  }

  reset() { super.reset(); this.has.ticksLeft = 0; }
}

// Switching stances is instant but shares its own 1.5 sec cooldown between
// switches -- separate from the GCD, so an ability used in the same instant
// as a switch still goes on its own cooldown/GCD normally. See
// Ability.canUse()/handle() in abilities.js for how abilities trigger a
// switch when they need a stance they're not currently in.
class Stance extends CooldownBase {
  constructor(char, starting) {
    super(1.5, 'Stance');
    this.char = char;
    this.starting = starting;
    this.is = { current: starting };

    final(this);
  }

  // Rage retained on a stance change. Forever apparently bakes in what used
  // to be the Tactical Mastery *talent* in Classic as a free baseline 10
  // (unconfirmed -- see forever-spells-notes.md), with Improved Tactical
  // Mastery then adding +3 per rank on top of that.
  retainedRage() { return 10 + this.char.improvedTacticalMastery * 3; }

  switchTo(target) {
    if (target === this.is.current) return;
    console.assert(!this.running(),
        'Trying to switch stance before its cooldown is up');
    const before = this.char.rage.is.now;
    this.char.rage.cap(this.retainedRage());
    this.is.current = target;
    this.use();
    this.char.recomputeTables();
    Debug.log('Stance: switched to ' + target + ' (rage: '
              + before.toFixed(1) + ' -> ' + this.char.rage.is.now.toFixed(1)
              + ')');
  }

  reset() {
    super.reset();
    this.is.current = this.starting;
    this.char.recomputeTables();
  }
}

// Switches back to the preferred stance once the Stance cooldown allows it,
// for "battle"/"berserker" default-stance modes ("lazy" never returns). Not
// itself a cooldown -- its readiness just mirrors char.stance's -- so
// tick()/reset() are no-ops even though it ends up ticked/reset alongside
// everything else in char.events/char.cooldowns.
class StanceReturn {
  constructor(char) {
    this.char = char;

    final(this);
  }

  canUse() {
    return this.char.stancePreferred !== 'lazy'
        && this.char.stance.is.current !== this.char.stancePreferred;
  }

  timeUntil() { return this.char.stance.timeUntil(); }
  tick() {}
  reset() {}
  handle() { this.char.stance.switchTo(this.char.stancePreferred); }
}

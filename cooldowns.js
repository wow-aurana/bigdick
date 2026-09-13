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
    if (!this.char.rage.has(10)) return false;
    if (!this.waitForEndOfFight) return true;
    if (fightEndsIn <= 31.5) return true;
    // For fights longer than 210 seconds
    return (this.time.left + this.duration < fightEndsIn - 30);
  }

  timeUntil() { return m.max(this.time.left, this.char.gcd.timeUntil()); }

  use() {
    super.use();
    this.char.gcd.use();
    this.char.rage.use(10);
    Debug.log('Death Wish activated (rage: '
              + this.char.rage.is.now.toFixed(1) + ')');
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

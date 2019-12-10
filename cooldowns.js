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

class Batching extends CooldownBase {
  constructor() {
    super(.4, 'Server batching');
    this.events = [];

    final(this);
  }

  canUse() { return true; }
  reset() { super.reset(); this.events.length = 0; }
  
  add(event, delay = 0) {
    if (delay > 0) {
      this.events.push(() => this.add(event, delay - 1));
      return;
    } 
    this.events.push(event);
  }

  handle() { 
    this.use();
    if (!this.events.length) return;
    const events = [...this.events];
    this.events.length = 0;
    for (const fn of events) fn();
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
  handle() { this.use(); }
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
  use() { super.use(); this.char.gcd.use(); this.char.rage.use(10); }
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
  handle() { this.use(); this.rage.gain(45 + m.random() * 30); }
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

class RageReset extends CooldownBase {
  constructor(rage) {
    super(.8, 'Execute rage reset');
    this.rage = rage;
    this.did = { execute: false, };
    final(this);
  }

  canUse() { return this.did.execute; }
  handle() { this.did.execute = false; this.rage.use(this.rage.is.now); }
}

class AngerManagement extends CooldownBase {
  constructor(rage) {
    super(3, 'Anger Management');
    this.rage = rage;

    final(this);
  }

  canUse() { return true; }
  handle() { this.use(); this.rage.gain(1); }
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
  handle() { this.use(); this.rage.gain(1); this.has.charges -= 1; }
}

class Bloodrage extends CooldownBase {
  constructor(rage) {
    super(60, 'Bloodrage');
    this.rage = rage;
    this.ragetick = new BloodrageTick(rage);

    final(this);
  }

  canUse() { return true; }
  handle() { this.use(); this.rage.gain(10); this.ragetick.start(); }
}

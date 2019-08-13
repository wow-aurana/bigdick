const m = Math;
const clamp =
    (min, max) => (value) => value < min ? min : value > max ? max : value;

class SwingLog {
  constructor(name) {
    this.name = name;
    this.dmg = 0;
    this.hits = 0;
    this.swings = 0;
    this.misses = 0;
    this.dodges = 0;
    this.crits = 0;
    this.glances = 0;
  }
}

class Rage {
  constructor(lvl) {
    this.current = 0;
    this.log = { gained: 0, fromSwings: 0, swings: 0, };

    // See https://wowwiki.fandom.com/wiki/Rage#Rage_conversion_value
    this.constant = 0.0091107836 * lvl * lvl + 3.225598133 * lvl + 4.2652911;
  }
  
  has(amount) { return this.current >= amount; }

  gain(amount) {
    const gain = m.min(amount, 100 - this.current);
    this.log.gained += gain;
    this.current = this.current + gain;
  }

  gainFromSwing(dmg) {
    this.log.swings += 1;
    const amount = dmg / this.constant * 7.5
    const gain = m.min(amount, 100 - this.current);
    this.log.fromSwings += gain;
    this.log.gained += gain;
    this.current = this.current + gain;
  }

  use(amount) {
    console.assert(this.current >= amount, 'Trying use ' + amount
                   + ' rage while only has' + this.current);
    this.current -= amount;
  }
}

class Cooldown {
  constructor(duration, name = 'cooldown') {
    this.duration = duration;
    this.timer = 0;
    this.name = name;
  }
  
  running() { return this.timer > 0; }
  timeUntil() { return this.timer; }
  tick(seconds) { this.timer = m.max(this.timer - seconds, 0); }

  use() {
    console.assert(this.timer <= 0,
        'Trying use ' + this.name + ' before it is ready');
    this.timer = this.duration;
  }

  force() { this.timer = this.duration; }
  reset() { this.timer = 0; }
}

class ApOnUse extends Cooldown {
  constructor(cfg) {
    super(cfg.cooldown, 'AP on use');
    this.ap = cfg.ap;
    this.uptime = cfg.uptime;
  }

  canUse() { return true; }
  getAp() { return (this.duration - this.timer) < this.uptime ? this.ap : 0; }
  handle() { this.use(); }
}

class RagePotion extends Cooldown {
  constructor(rage) {
    super(120, 'Mighty Rage Potion');
    this.rage = rage;
  }

  canUse() { return true; }
  getStr() { return (this.duration - this.timer) < 20 ? 60 : 0; }
  handle() { this.use(); this.rage.gain(45 + m.random() * 30); }
}

class SlamSwing extends Cooldown {
  constructor(slam, castTime) {
    super(castTime, 'Slam swing');
    this.slam = slam;
  }

  canUse() { return this.slam.casting; }
  handle() { this.slam.swing(); }
}

class AngerManagement extends Cooldown {
  constructor(rage) {
    super(3, 'Anger Management');
    this.rage = rage;
  }

  canUse() { return true; }
  handle() { this.use(); this.rage.gain(1); }
}

class BloodrageTick extends Cooldown {
  constructor(rage) {
    super(1, 'Bloodrage tick');
    this.rage = rage;
    this.charges = 0;
  }

  start() { this.charges = 10; this.use(); }
  canUse() { return this.charges > 0; }
  handle() { this.use(); this.rage.gain(1); this.charges -= 1; }
}

class Bloodrage extends Cooldown {
  constructor(rage) {
    super(60, 'Bloodrage');
    this.rage = rage;
    this.ragetick = new BloodrageTick(rage);
  }

  canUse() { return true; }
  handle() { this.use(); this.rage.gain(10); this.ragetick.start(); }
}

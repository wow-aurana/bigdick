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

  string() {
    const toPercent = (count) => {
      return '' + (count / this.swings * 100).toFixed(2) + '%';
    };
    let ret = '' + this.name + ' dmg done: ' + m.round(this.dmg)
              + ', swings: ' + this.swings
              + ', hits: ' + toPercent(this.hits)
              + ', crits: ' + toPercent(this.crits)
              + ', misses: ' + toPercent(this.misses)
              + ', dodges: ' + toPercent(this.dodges);
    if (this.glances > 0) {
      ret += ', glances: ' + toPercent(this.glances);
    }
    return ret;
  }
}

class Rage {
  constructor(lvl) {
    this.gained = 0;
    this.current = 0;
    this.count = 0
    // See https://wowwiki.fandom.com/wiki/Rage#Rage_conversion_value
    this.constant = 0.0091107836 * lvl * lvl + 3.225598133 * lvl + 4.2652911;
  }
  toRage(dmg) { return dmg / this.constant * 7.5; }
  has(amount) { return this.current >= amount; }

  gain(amount) {
    this.count += 1;
    const gain = m.min(amount, 100 - this.current);
    this.gained += gain;
    this.current = this.current + gain;
  }

  use(amount) {
    console.assert(this.current >= amount, 'Trying use ' + amount
                   + ' rage while only has' + this.current);
    this.current -= amount;
  }
}

class Flurry {
  constructor() {
    this.charges = 0;
    this.uptime = 0;
  }
  hasCharges() { return this.charges > 0; }
  useCharge() { this.charges = m.max(this.charges - 1, 0); }
  refresh() { this.charges = 3; }
  tick(seconds) { if (this.hasCharges()) this.uptime += seconds; }
}

class Cooldown {
  constructor(duration, name = 'cooldown') {
    this.duration = duration;
    this.timer = 0;
    this.name = name;
  }
  
  running() { return this.timer > 0; }
  tick(seconds) { this.timer -= seconds; }

  use() {
    console.assert(this.timer <= 0,
        'Trying use ' + this.name + ' before it is ready');
    this.timer = this.duration;
  }

  reset() { this.timer = 0; }
}

class Aura {
  constructor(duration, name = 'cooldown') {
    this.duration = duration;
    this.name = name;
    this.timer = 0;
    this.count = 0;
    this.uptime = 0;
  }
  
  running() { return this.timer > 0; }
  tick(seconds) {
    this.uptime += m.min(seconds, this.timer);
    this.timer = m.max(0, this.timer - seconds);
  }
  gain() { this.timer = this.duration; this.count += 1; }
}
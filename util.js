'use strict';

const m = Math;
const clamp =
    (min, max) => (value) => value < min ? min : value > max ? max : value;
const final = Object.freeze;

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
    this.is = { now: 0 };
    this.log = { gained: 0, fromSwings: 0, swings: 0, };

    // See https://wowwiki.fandom.com/wiki/Rage#Rage_conversion_value
    this.constant = 0.0091107836 * lvl * lvl + 3.225598133 * lvl + 4.2652911;
    final(this);
  }
  
  has(amount) { return this.is.now >= amount; }

  gain(amount) {
    const gain = m.min(amount, 100 - this.is.now);
    this.log.gained += gain;
    this.is.now = this.is.now + gain;
  }

  gainFromSwing(dmg) {
    this.log.swings += 1;
    const amount = dmg / this.constant * 7.5
    const gain = m.min(amount, 100 - this.is.now);
    this.log.fromSwings += gain;
    this.log.gained += gain;
    this.is.now = this.is.now + gain;
  }

  use(amount) {
    console.assert(this.is.now >= amount, 'Trying use ' + amount
                   + ' rage while only has' + this.is.now);
    this.is.now -= amount;
  }
}

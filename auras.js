'use strict';

class Flurry {
  constructor() {
    this.charges = 0;
    this.uptime = 0;
  }

  hasCharges() { return this.charges > 0; }
  useCharge() { this.charges = m.max(this.charges - 1, 0); }
  refresh() { this.charges = 3; }
  reset() { this.charges = 0; }
  tick(seconds) { if (this.hasCharges()) this.uptime += seconds; }
}

class Aura {
  constructor(duration, name = 'Aura') {
    this.duration = duration;
    this.timer = 0;
    this.log = { name: name, count: 0, uptime: 0, };
  }
  
  running() { return this.timer > 0; }
  gain() { this.timer = this.duration; this.log.count += 1; }
  reset() { this.timer = 0; }

  tick(seconds) {
    this.log.uptime += m.min(seconds, this.timer);
    this.timer = m.max(0, this.timer - seconds);
  }
}

class WindfuryAp extends Aura {
  constructor() {
    super(1.6, 'Windfury AP buff');
  }

  rollDuration() {
    // The duration of the AP buff from WF is not static.
    // See: https://github.com/magey/classic-warrior/issues/7
    // This code tries to simulate observed behavior.
    const lowDuration = (m.random() > .5);
    if (lowDuration) return (.4 + m.random() * .4);
    return (1.4 + m.random() * .2);
  }

  gain() { this.duration = this.rollDuration(); super.gain(); }
}

class ProcStr extends Aura {
  constructor(wpnspeed, amount, duration, name = 'Strength proc') {
    super(duration, name);
    this.amount = amount;
    this.speed = wpnspeed;
  }

  proc() { const roll = m.random() * 60; if (roll < this.speed) this.gain(); }
}

class Crusader extends ProcStr {
  constructor(wpnspeed) { super(wpnspeed, 100, 15, 'Crusader'); }
}

function getStrengthProc(speed, id) {
  if (id == 'MS') {
    return new ProcStr(speed, 50, 30, 'Malown\'s Slam');
  } else if (id == 'AC') {
    return new ProcStr(speed, 120, 30, 'Strength of the Champion');
  } else if (id == 'UTB') {
    return new ProcStr(speed, 300, 8, 'Untamed Fury');
  }
  return null;
}

function getExtraAttacks(id) {
  if (id == 'TB' || id == 'FA') return 1;
  if (id == 'IF') return 2;
  return 0;
}
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

  tick(seconds) {
    this.log.uptime += m.min(seconds, this.timer);
    this.timer = m.max(0, this.timer - seconds);
  }
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

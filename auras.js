'use strict';

class Flurry {
  constructor(batch, main, off) {
    this.batch = batch;
    this.main = main;
    this.off = off;
    this.has = { charges: 0 };
    this.log = { uptime: 0 };

    final(this);
  }

  hasCharges() { return this.has.charges > 0; }
  reset() { this.has.charges = 0; }
  tick(seconds) { if (this.hasCharges()) this.log.uptime += seconds; }
  
  useCharge() {
    this.batch.add(() => {
      this.has.charges = m.max(this.has.charges - 1, 0);
      if (!this.has.charges) {
        this.main.unapplyFlurry();
        this.off && this.off.unapplyFlurry();
      }
    }, 1);
  }

  refresh() {
    this.batch.add(() => { 
      this.has.charges = 3;
      this.main.applyFlurry();
      this.off && this.off.applyFlurry();
    }, 1);
  }
}

class Aura {
  constructor(duration, name) {
    this.duration = duration;
    this.time =  { left: 0 };
    this.log = { name: name, count: 0, uptime: 0, };
  }
  
  running() { return this.time.left > 0; }
  gain() { this.time.left = this.duration; this.log.count += 1; }
  reset() { this.time.left = 0; }

  tick(seconds) {
    this.log.uptime += m.min(seconds, this.time.left);
    this.time.left = m.max(0, this.time.left - seconds);
  }
}

class WindfuryAp extends Aura {
  constructor(cfg) {
    // The duration of the AP buff from WF is not static.
    // See: https://github.com/magey/classic-warrior/issues/7
    // This code tries to simulate observed behavior.
    // TODO update with new findings.
    super(1.5, 'Windfury AP buff');
    this.ap = 315 * (!!cfg.improved ? 1.3 : 1);

    final(this);
  }

  gain() { super.gain(); }
}

function ppmToChance(ppm, speed) { return (ppm / 60) * speed; }

class ProcStr extends Aura {
  constructor(chance, amount, duration, name = 'Strength proc') {
    super(duration, name);
    this.amount = amount;
    this.chance = chance;
  }

  proc() { if (m.random() < this.chance) this.gain(); }
}

class Crusader extends ProcStr {
  constructor(wpnspeed) {
    super(ppmToChance(1, wpnspeed), 100, 15, 'Crusader');

    final(this);
  }
}

function getStrengthProc(speed, id) {
  const chance = ppmToChance(1, speed);
  if (id == 'MS') {
    return final(new ProcStr(chance, 50, 30, 'Malown\'s Slam'));
  } else if (id == 'AC') {
    return final(new ProcStr(chance, 120, 30, 'Strength of the Champion'));
  } else if (id == 'UTB') {
    return final(new ProcStr(chance, 300, 8, 'Untamed Fury'));
  }
  return null;
}

function getExtraAttacks(id) {
  if (id == 'TB' || id == 'FA') return 1;
  if (id == 'IF') return 2;
  return 0;
}
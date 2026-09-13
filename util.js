'use strict';

const m = Math;
const clamp =
    (min, max) => (value) => value < min ? min : value > max ? max : value;
const final = Object.freeze;

// Debug event log. Off (and free) by default; enabled by the "Debug log"
// checkbox on the main page, which also caps the run to 10 iterations (see
// sim.js) so the log stays a readable, copy-pasteable size. A single mutable
// global rather than something threaded through every class, since half the
// codebase would otherwise need a reference passed in just to log a line.
const Debug = {
  enabled: false,
  iteration: 0,
  time: 0,
  lines: [],

  reset(enabled) {
    this.enabled = enabled;
    this.iteration = 0;
    this.time = 0;
    this.lines = [];
  },

  log(msg) {
    if (!this.enabled) return;
    this.lines.push(
        '[fight ' + this.iteration + ' @ ' + this.time.toFixed(2) + 's] '
        + msg);
  },
};

// The extra crit suppression applied against +3 level targets only affects
// crit gained from auras/talents/gear, not base Agility-derived crit.
// See https://github.com/magey/classic-warrior/wiki/Crit-aura-suppression
function applyCritSuppression(totalCrit, agility, suppression) {
  const agiCrit = m.min(totalCrit, (agility || 0) / 20);
  const nonAgiCrit = totalCrit - agiCrit;
  return agiCrit + m.max(0, nonAgiCrit - suppression);
}

// Base miss/dodge/crit chances against `target`, as independent percentages
// (not yet chained into a cumulative roll table -- white and yellow attacks
// each stack these together differently: white attacks add glancing blows
// on top and yellow attacks use a separate two-roll system instead of
// chaining crit at all). weaponSkill is the attacker's weapon skill rating;
// missBonus is an additional flat miss percentage added before the
// hit-rating subtraction (used for the dual-wield miss penalty).
// See https://github.com/magey/classic-warrior/wiki/Attack-table
function baseAttackChances(char, target, weaponSkill, missBonus = 0) {
  const targetDef = target.level * 5;
  const baseSkill = char.level * 5;
  const skillDiff = targetDef - weaponSkill;

  // miss
  // see this blue post:
  // https://us.forums.blizzard.com/en/wow/t/bug-hit-tables/185675/33
  // Hit rating suppression scales continuously past the +10 skill deficit
  // threshold.
  const hitSuppression = skillDiff > 10 ? (skillDiff - 10) * .2 : 0;
  const hitOnGear = m.max(0, char.stats.hit - hitSuppression);
  const missFromSkill = (skillDiff > 10 ? .2 : .1) * skillDiff;
  // Precision (+1/2/3% hit with all abilities and melee attacks).
  const miss = clamp(0, 100)(
      5 + missFromSkill + missBonus - hitOnGear - char.precisionHit);

  // dodge
  const dodge = clamp(0, 100)(5 + skillDiff * .1);

  // crit
  const baseSkillDiff = targetDef - baseSkill;
  const magicNumber = (target.level - char.level) > 2 ? 1.8 : 0;
  const suppressedCrit =
      applyCritSuppression(char.getCrit(), char.stats.agility, magicNumber);
  const crit = clamp(0, 100)(suppressedCrit - baseSkillDiff * .2);

  return { miss, dodge, crit };
}

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
  // `max` is 100 by default, raised by Boundless Rage (+10/20/30).
  constructor(lvl, max = 100) {
    this.is = { now: 0 };
    this.log = { gained: 0, fromSwings: 0, swings: 0, };
    this.max = max;

    // See https://wowwiki.fandom.com/wiki/Rage#Rage_conversion_value
    this.constant = 0.0091107836 * lvl * lvl + 3.225598133 * lvl + 4.2652911;
    final(this);
  }

  has(amount) { return this.is.now >= amount; }

  gain(amount) {
    const gain = m.min(amount, this.max - this.is.now);
    this.log.gained += gain;
    this.is.now = this.is.now + gain;
  }

  gainFromSwing(dmg) {
    this.log.swings += 1;
    const amount = dmg / this.constant * 7.5
    const gain = m.min(amount, this.max - this.is.now);
    this.log.fromSwings += gain;
    this.log.gained += gain;
    this.is.now = this.is.now + gain;
  }

  use(amount) {
    console.assert(this.is.now >= amount, 'Trying use ' + amount
                   + ' rage while only has' + this.is.now);
    this.is.now -= amount;
  }

  // Used when switching stances: rage above `max` is lost, the rest is
  // retained.
  cap(max) {
    this.is.now = m.min(this.is.now, max);
  }
}

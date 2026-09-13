'use strict';

class Character {
  constructor(char, target) {
    this.stats = char.stats;
    this.level = char.level;
    this.gcd = new Cooldown(1.5, 'GCD');
    this.can = { execute: false };

    // Target armor mitigation
    this.armorDmgMul = 1;

    // Talents. Parsed before Rage below since Boundless Rage raises its cap.
    const talents = parseTalents(char.talents);
    this.rage = new Rage(char.level, 100 + talents.boundlessRage * 10);
    this.heroicCost = 15 - talents.improvedHS;
    this.yellowCritMul = 2 + talents.impale * .1;
    this.weaponspec = char.twohand ? (1 + talents.twoHandSpec * .01) : 1;
    // Dual Wield Specialization: +5%/rank off-hand damage (on top of the
    // 50% base), +20%/rank off-hand rage generation, +2%/rank off-hand hit.
    this.offhandDmgMul = .5 + talents.dualWieldSpec * .05;
    this.offhandRageMul = 1 + talents.dualWieldSpec * .2;
    this.offhandHitBonus = talents.dualWieldSpec * 2;
    // -0.25 sec/rank per Improved Slam's tooltip (talent-data.js) -- this
    // used to hardcode -0.1, fixed while touching Slam anyway.
    this.slamCast = 1.5 - talents.improvedSlam * .25;
    // 5%/rank, no rank-1 offset -- this used to add an extra +1 to the rank
    // before scaling (1 + (rank+1)*.05), giving one rank too many at every
    // level (e.g. 30% at max rank instead of the tooltip's 25%). Fixed.
    this.flurryHaste = 1 + talents.flurry * .05;
    this.anger = talents.angerMgmt ? new AngerManagement(this.rage) : null;
    // 12%/rank per the tooltip (talent-data.js), not the 8% this used to
    // hardcode. The "2 rage for two-handed weapons" part of the tooltip is
    // handled at the point rage is actually granted -- see Weapon.swing().
    this.extraRageChance = talents.unbridledWrath * .12;
    // -3 Rage at rank 1, -5 (cumulative, not -2 as this used to say) at
    // rank 2 -- matches the confirmed correction already recorded in
    // forever-talents-notes.md, which the code itself never actually got
    // updated to match until now.
    this.executeCost = 15 - (talents.improvedExecute > 1 ? 5 :
                             talents.improvedExecute > 0 ? 3 : 0);
    this.improvedTacticalMastery = talents.improvedTacticalMastery;
    this.improvedOverpower = talents.improvedOverpower;
    // 2/4/6/8/10% per rank -- see procBloodthrill().
    this.bloodthrillChance = talents.bloodthrill * .02;
    // +12/24/36% Rend bleed damage -- see RendDot.apply() in cooldowns.js.
    this.improvedRend = talents.improvedRend;
    // Deep Wounds: 20/40/60% of weapon average damage, as a fraction --
    // see DeepWoundsDot in cooldowns.js. Only constructed if talented.
    this.deepWoundsPercent = talents.deepWounds * .2;
    this.deepWounds = talents.deepWounds ? new DeepWoundsDot(this) : null;
    // Raging Blows: Whirlwind also strikes with the off-hand weapon --
    // see Whirlwind.swingOffhand() in abilities.js.
    this.ragingBlows = !!talents.ragingBlows;
    // +1/2/3% hit with all abilities and melee attacks -- see
    // baseAttackChances() in util.js.
    this.precisionHit = talents.precision;
    // Axe/Polearm crit, Mace/Staff armor pen, Sword extra-attack chance,
    // all per weapon type -- see Weapon.setTarget()/effectiveArmorMul()/
    // proc() in weapon.js. Same raw rank (1-5) drives all three; which one
    // (if any) actually applies depends on that weapon's own configured
    // type.
    this.weaponmaster = talents.weaponmaster;

    // Stance. Defensive Stance is never modeled -- only Battle and
    // Berserker are real options here. "lazy" only switches when an
    // ability demands it and never switches back; "battle"/"berserker"
    // switch back to that preferred stance as soon as the switch cooldown
    // allows (see StanceReturn). Start already in the preferred stance
    // (or Battle, for "lazy") -- no need to "dance" into position before
    // the fight begins.
    this.stancePreferred = char.stance || 'battle';
    this.stance = new Stance(
        this, this.stancePreferred === 'lazy' ? 'battle' : this.stancePreferred);

    // Weapons, procs etc.
    this.handOfJustice = char.hoj;
    this.blessingOfKings = char.bok;
    this.windfury = !!char.wftotem ? new WindfuryAp(char.wftotem) : null;
    this.flurry = new Flurry();
    this.rendDot = new RendDot(this);
    // Bloodthrill's "for 1 attack, lasts 6 seconds" window: Overpower is
    // usable while this is up, consumed the instant Overpower is used --
    // see Overpower.handle() in abilities.js.
    this.overpowerReady = new Aura(6, 'Bloodthrill');
    // Overpower's default (talent-free) trigger: usable for 5 sec after
    // the target dodges any of your attacks. Classic-era duration, not
    // confirmed changed for Forever. A separate Aura from the Bloodthrill
    // one above since they have different durations, but Overpower.handle()
    // consumes both regardless of which one (or both) let it be cast.
    this.overpowerDodge = new Aura(5, 'Overpower (dodge)');
    this.abilityApScaling = !!char.twohand ? 3.3
                            : char.mainhand.dagger ? 1.7 : 2.4;

    this.main = new Weapon(this, char.twohand || char.mainhand, 'Mainhand');
    this.off = char.offhand ?
        new Weapon(this, char.offhand, 'Offhand', false) : null;

    // AP on use (Blood Fury, trinkets etc.)
    this.apOnUse = !!char.aponuse ? new ApOnUse(char.aponuse) : null;
    // Mighty Rage Potion
    this.ragePotion = !!char.ragepotion ? new RagePotion(this.rage) : null;

    const create = (classptr, usewhen) => {
      return usewhen ? new classptr(this, usewhen) : null;
    };

    // Abilites
    this.deathwish = create(DeathWish, char.deathwish);

    this.brainlag = {
      max: ((char.lag && char.lag.delay / 1000) || 0),
      current: 0,
    };

    this.bloodrage = new Bloodrage(this.rage);
    this.stanceReturn = new StanceReturn(this);

    this.execute = create(Execute, {});

    this.rend = create(Rend, char.rend);
    // Not talent-gated like most other create() calls here -- the checkbox
    // just lets you turn the ability off entirely. When on, it's used
    // whenever a charge is up (either from a dodge, always possible, or
    // from Bloodthrill, if talented -- see Overpower.checkConditions() in
    // abilities.js).
    this.overpower = create(Overpower, char.overpower);

    this.mortalStrike = create(MortalStrike, char.mortalstrike);

    this.spearingStrike = create(SpearingStrike, char.spearingstrike);

    this.bloodthirst = create(Bloodthirst, char.bloodthirst);

    this.whirlwind = create(Whirlwind, char.whirlwind);

    this.heroic = create(HeroicStrike, char.heroic);

    this.slam = create(Slam, char.slam);
    this.slamSwing = this.slam ? new SlamSwing(this.slam, this.slamCast) : null;

    this.hamstring = create(Hamstring, char.hamstring);

    // Setup abilities in the correct priority order
    const exists = (e) => !!e;
    this.abilities = [
      this.execute,
      this.overpower,
      this.rend,
      this.slam,
      this.mortalStrike,
      this.spearingStrike,
      this.bloodthirst,
      this.whirlwind,
      this.hamstring,
    ].filter(exists);

    this.onGcd = [this.deathwish].concat(this.abilities).filter(exists);
 
    this.autos = [this.main, this.off].filter(exists);

    this.events = [...this.onGcd].concat(this.autos).concat([
      this.anger,
      this.ragePotion,
      this.slamSwing,
      this.bloodrage,
      this.bloodrage.ragetick,
      this.apOnUse,
      this.stanceReturn,
      this.rendDot,
      this.deepWounds,
    ]).filter(exists);

    this.cooldowns = [...this.events].concat([
      this.gcd,
      this.flurry,
      this.windfury,
      this.stance,
      this.overpowerReady,
      this.overpowerDodge,
    ]).filter(exists);

    // Set target
    if (target.armor > 0) {
      const mitigation = target.armor / (target.armor + 400 + 85 * this.level);
      this.armorDmgMul = 1 - mitigation;
    }

    this.target = target;
    this.recomputeTables();

    // helper methods
    this.checkBtCd = !!this.bloodthirst ?
        (cutoff) => this.bloodthirst.cooldown.timeUntil() > cutoff :
        () => true;
    this.checkWwCd = !!this.whirlwind ?
        (cutoff) => this.whirlwind.cooldown.timeUntil() > cutoff :
        () => true;
    this.checkBtWwCd =
        (cutoff) => this.checkBtCd(cutoff) && this.checkWwCd(cutoff);

    final(this);
  }

  // Recomputes every attack table (they cache crit chance, which depends on
  // current stance -- see getCrit()). Called once at setup and again
  // whenever the stance actually changes.
  recomputeTables() {
    for (const swing of this.abilities.concat(this.autos)) {
      swing.setTarget(this.target);
    }
    if (this.heroic) this.heroic.setTarget(this.target);
  }

  // Berserker Stance grants +3% crit; Battle (and, if it mattered here,
  // Defensive) doesn't.
  getCrit() {
    return this.stats.crit + (this.stance.is.current === 'berserker' ? 3 : 0);
  }

  multiplier() {
    if (!this.deathwish) return this.weaponspec;
    if (!this.deathwish.active()) return this.weaponspec;
    return this.weaponspec * 1.2;
  }

  getAp() {
    let apBuffs = !!this.apOnUse ? this.apOnUse.getAp() : 0;
    // TODO lower WF ranks
    if (this.windfury && this.windfury.running()) apBuffs += this.windfury.ap;
    
    let procStr = 0;
    for (const weapon of this.autos) {
      for (const proc of weapon.strprocs) {
        if (proc.running()) procStr += proc.amount;
      }
    }
    if (this.ragePotion) procStr += this.ragePotion.getStr();
    if (this.blessingOfKings) procStr *= 1.1;
    return this.stats.ap + apBuffs + procStr * 2;
  }

  heroicQueued() {
    if (!this.heroic) return false;
    return this.heroic.is.queued; 
  }

  queueHeroicStrike() {
    if (!this.heroic) return;
    if (!this.heroic.canUse()) return;
    this.heroic.is.queued = true; 
  }

  procHoJ() {
    if (this.handOfJustice && m.random() <= .02) {
      Debug.log('Hand of Justice proc: extra mainhand swing');
      this.main.cooldown.reset();
      this.main.swing(true);
    }
  }

  procWindfury() {
    if (!this.windfury) return;
    if (!this.windfury.offCooldown()) return;
    if (m.random() > .2) return;
    this.windfury.triggerIcd();
    this.main.cooldown.reset();
    this.windfury.gain();
    Debug.log('Windfury Totem proc (+' + this.windfury.ap + ' AP)');
    this.main.swing(true);
  }

  // Deep Wounds: "your critical strikes cause your opponent to bleed."
  // Unlike Bloodthrill this triggers on *any* crit, white or yellow --
  // called from both Weapon.swing() and Ability.swing()'s crit branches.
  procDeepWounds() {
    if (!this.deepWounds) return;
    this.deepWounds.apply();
    Debug.log('Deep Wounds applied: ' + (this.main.avgDmg * this.deepWoundsPercent).toFixed(0) + ' over 12s');
  }

  // Bloodthrill: "Your melee attacks against targets afflicted by your
  // Rend have a X% chance to activate your Overpower ability for 1 attack
  // on your current target. Lasts 6 seconds." "Melee attacks" means
  // autoattacks only -- this is called from Weapon.proc(), never for
  // yellow-attack abilities like Mortal Strike.
  procBloodthrill() {
    if (!this.bloodthrillChance) return;
    if (!this.rendDot.active()) return;
    if (m.random() > this.bloodthrillChance) return;
    this.overpowerReady.gain();
    Debug.log('Bloodthrill proc: Overpower ready for 6s');
  }

  // Overpower's baseline trigger, independent of Bloodthrill: any of your
  // attacks (white or yellow) being dodged grants a 5 sec window. Called
  // from the dodge branch of both Weapon.swing() and Ability.swing().
  procOverpowerDodge() {
    this.overpowerDodge.gain();
    Debug.log('Target dodged: Overpower ready for 5s');
  }

  getNextEvent(fightEndsIn) {
    // Reroll brain lag
    this.brainlag.current = m.random() * this.brainlag.max;

    return this.events.reduce((ret, e) => {
      if (!e.canUse(fightEndsIn)) return ret;
      if (e.timeUntil() >= ret.timeUntil()) return ret;
      return e;
    }, this.main);
  }

  advanceTime(seconds) {
    for (const e of this.cooldowns) {
      e.tick(seconds);
    }
  }

  finishFight() {
    this.rage.is.now = 0;
    this.can.execute = false;

    for (const e of this.cooldowns) {
      e.reset();
    }
  }
}

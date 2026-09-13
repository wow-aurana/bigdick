'use strict';

class Character {
  constructor(char, target) {
    this.stats = char.stats;
    this.level = char.level;
    this.gcd = new Cooldown(1.5, 'GCD');
    this.rage = new Rage(char.level);
    this.can = { execute: false };

    // Target armor mitigation
    this.armorDmgMul = 1;

    // Talents
    const talents = parseTalents(char.talents);
    this.heroicCost = 15 - talents.improvedHS;
    this.yellowCritMul = 2 + talents.impale * .1;
    this.weaponspec = char.twohand ? (1 + talents.twoHandSpec * .01) : 1;
    this.offhandDmgMul = .5 + talents.dualWieldSpec * .025;
    this.flurryHaste = talents.flurry ? 1 + (talents.flurry + 1) * .05 : 1;
    this.anger = talents.angerMgmt ? new AngerManagement(this.rage) : null;
    this.extraRageChance = talents.unbridledWrath * .08;
    // Improved Slam's tooltip (talent-data.js) says -0.25 sec per rank, not
    // the -0.1 this used to hardcode -- fixed while touching Slam anyway.
    this.slamCast = 1.5 - talents.improvedSlam * .25;
    this.executeCost = 15 - (talents.improvedExecute > 1 ? 5 :
                             talents.improvedExecute > 0 ? 2 : 0);
    this.improvedTacticalMastery = talents.improvedTacticalMastery;
    this.improvedOverpower = talents.improvedOverpower;
    // 2/4/6/8/10% per rank -- see procBloodthrill().
    this.bloodthrillChance = talents.bloodthrill * .02;

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
    // No checkbox: always available, gated purely by whether a charge is
    // up (either from a dodge, always possible, or from Bloodthrill, if
    // talented -- see Overpower.checkConditions() in abilities.js).
    this.overpower = new Overpower(this, {});

    this.mortalStrike = create(MortalStrike, char.mortalstrike);

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

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
    this.flurryHaste = 1 + (talents.flurry && (talents.flurry + 1) * .05) || 0;
    this.anger = talents.angerMgmt ? new AngerManagement(this.rage) : null;
    this.extraRageChance = talents.unbridledWrath * .08;
    this.slamCast = 1.5 - talents.improvedSlam * .1;
    this.executeCost = 15 - (talents.improvedExecute > 1 ? 5 :
                             talents.improvedExecute > 0 ? 2 : 0);

    // Weapons, procs etc.
    this.handOfJustice = char.hoj;
    this.blessingOfKings = char.bok;
    this.windfury = !!char.wftotem ? new WindfuryAp(char.wftotem) : null;
    this.flurry = new Flurry();
    this.abilityApScaling = !!char.twohand ? 3.3
                            : char.mainhand.dagger ? 1.7 : 2.4;

    this.main = new Weapon(this, char.twohand || char.mainhand, 'Mainhand');
    this.main.lock();

    this.off = char.offhand ? new Weapon(this, char.offhand, 'Offhand') : null;
    if (this.off) {
      this.off.isMainhand = false;
      this.off.lock();
    }

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

    this.execute = create(Execute, {});
    
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
      this.slam,
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
      this.execute.ragereset,
    ]).filter(exists);

    this.cooldowns = [...this.events].concat([
      this.gcd,
      this.flurry,
      this.windfury,
    ]).filter(exists);

    // Set target
    if (target.armor > 0) {
      const mitigation = target.armor / (target.armor + 400 + 85 * this.level);
      this.armorDmgMul = 1 - mitigation;
    }

    for (const swing of this.abilities.concat(this.autos)) {
      swing.setTarget(target);
    }
    if (this.heroic) this.heroic.setTarget(target);

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
      this.main.cooldown.reset();
      this.main.swing(true);
    }
  }

  procWindfury() {
    if (!this.windfury) return;
    if (m.random() > .2) return;
    this.main.cooldown.reset();
    this.windfury.gain();
    this.main.swing(true);
  }

  getNextEvent(fightEndsIn) {
    // console.clear();
    // Reroll brain lag
    this.brainlag.current = m.random() * this.brainlag.max;

    const nextEvent = this.events.reduce((ret, e) => {
      // console.log(e);
      if (!e.canUse(fightEndsIn)) return ret;
      if (e.timeUntil() >= ret.timeUntil()) return ret;
      return e;
    }, this.main);
    // console.log('-----');
    // console.log(nextEvent);
    // debugger;
    return nextEvent;
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

'use strict';

class Character {
  constructor(char) {
    this.stats = char.stats;
    this.level = char.level;
    this.gcd = new Cooldown(1.5, 'GCD');
    this.rage = new Rage(char.level);
    this.canExecute = false;

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
    this.windfuryTotem = char.wftotem;
    this.windfuryBuff = new WindfuryAp();
    this.flurry = new Flurry();
    this.abilityApScaling = !!char.twohand ? 3.3
                            : char.mainhand.dagger ? 1.7 : 2.4;

    this.main = new Weapon(this, char.twohand || char.mainhand, 'Mainhand');

    this.off = char.offhand ? new Weapon(this, char.offhand, 'Offhand') : null;
    if (this.off) this.off.isMainhand = false;
    // First offhand swing delayed by 200ms (according to some guy on Discord)
    if (this.off) this.off.cooldown.timer = .2;

    // AP on use (Blood Fury, trinkets etc.)
    this.apOnUse = !!char.aponuse ? new ApOnUse(char.aponuse) : null;
    // Mighty Rage Potion
    this.ragePotion = !!char.ragepotion ? new RagePotion(this.rage) : null;

    const create = (classptr, usewhen) => {
      return usewhen ? new classptr(this, usewhen) : null;
    };

    // Abilites
    this.deathwish = create(DeathWish, char.deathwish);

    this.brainlag = (char.lag && char.lag.delay / 1000) || 0;
    this.delay = 0;

    this.bloodrage = new Bloodrage(this.rage);

    this.execute = create(Execute, {});
    
    this.bloodthirst = create(Bloodthirst, char.bloodthirst);

    this.whirlwind = create(Whirlwind, char.whirlwind);

    this.heroic = create(HeroicStrike, char.heroic);
    this.heroicQueued = false;

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
 
    this.autos = [this.main, this.off].filter(exists);

    this.events = [...this.abilities].concat(this.autos).concat([
      this.deathwish,
      this.anger,
      this.ragePotion,
      this.slamSwing,
      this.bloodrage,
      this.bloodrage.ragetick,
      this.apOnUse,
    ]).filter(exists);

    this.cooldowns = [...this.events].concat([
      this.gcd,
      this.flurry,
      this.windfuryBuff,
    ]);

    // helper methods
    this.checkBtCd = !!this.bloodthirst ?
        (cutoff) => this.bloodthirst.cooldown.timeUntil() > cutoff :
        () => true;
    this.checkWwCd = !!this.whirlwind ?
        (cutoff) => this.whirlwind.cooldown.timeUntil() > cutoff :
        () => true;
    this.checkBtWwCd =
        (cutoff) => this.checkBtCd(cutoff) && this.checkWwCd(cutoff);
  }

  multiplier() {
    if (!this.deathwish) return this.weaponspec;
    if (!this.deathwish.active()) return this.weaponspec;
    return this.weaponspec * 1.2;
  }

  getAp() {
    let apBuffs = !!this.apOnUse ? this.apOnUse.getAp() : 0;
    // TODO lower WF ranks
    if (this.windfuryBuff.running()) apBuffs += 315;
    
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

  setTarget(target) {
    if (target.armor > 0) {
      const mitigation = target.armor / (target.armor + 400 + 85 * this.level);
      this.armorDmgMul = 1 - mitigation;
    }

    for (const swing of this.abilities.concat(this.autos)) {
      swing.setTarget(target);
    }
    if (this.heroic) this.heroic.setTarget(target);
  }

  shouldHeroicStrike() { return this.heroic && this.heroic.canUse(); }

  procHoJ() {
    if (this.handOfJustice && m.random() <= .02) {
      this.main.cooldown.reset();
      this.main.swing(true);
    }
  }

  procWindfury() {
    if (this.windfuryTotem && m.random() <= .2) {
      this.main.cooldown.reset();
      this.windfuryBuff.gain();
      this.main.swing(true);
    }
  }

  getNextEvent(fightEndsIn) {
    // Reroll brain lag
    this.delay = m.random() * this.brainlag;

    const nextEvent = this.events.reduce((ret, e) => {
      if (!e.canUse(fightEndsIn)) return ret;
      if (e.timeUntil() > ret.timeUntil()) return ret;
      return e;
    }, this.main);
    return nextEvent;
  }

  advanceTime(seconds) {
    for (const e of this.cooldowns) {
      e.tick(seconds);
    }
  }

  finishFight() {
    this.rage.current = 0;
    this.canExecute = false;

    for (const e of this.cooldowns) {
      e.reset();
    }
  }
}

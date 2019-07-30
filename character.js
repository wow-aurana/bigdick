class Character {
  constructor(char) {
    this.stats = char.stats;
    this.level = char.level;
    this.gcd = new Cooldown(1.5, 'GCD');
    this.rage = new Rage(char.level);
    
    // Talents
    const talents = parseTalents(char.talents);
    this.heroicCost = 15 - talents.improvedHS;
    this.yellowCritMul = 2 + talents.impale * .1;
    this.wpnspec = char.twohand ? (1 + talents.twoHandSpec * .01) : 1;
    this.offhandDmgMul = .5 + talents.dualWieldSpec * .025;
    this.flurryHaste = 1 + (talents.flurry && (talents.flurry + 1) * .05) || 0;
    this.anger = talents.angerMgmt ? new AngerManagement(this.rage) : null;
    this.extraRageChance = talents.unbridledWrath * .08;
    this.slamCast = 1.5 - talents.improvedSlam * .1;
    this.executeCost = 15 - (talents.improvedExecute > 1 ? 5 :
                             talents.improvedExecute > 0 ? 2 : 0);

    // Weapons, procs etc.
    this.handOfJustice = char.hoj;
    this.windfuryTotem = char.wftotem;
    this.flurry = new Flurry();
    this.main = new Weapon(this, char.twohand || char.mainhand, 'Mainhand');
    this.off = char.offhand ? new Weapon(this, char.offhand, 'Offhand') : null;
    if (this.off) this.off.isMainhand = false;
    // First offhand swing delayed by 200ms (according to some guy on Discord)
    if (this.off) this.off.cooldown.timer = .2;

    const create = (classptr, usewhen) => {
      return usewhen ? new classptr(this, usewhen) : null;
    };

    // Abilites
    this.execute = create(Execute, char.execute);
    
    this.bloodthirst = create(Bloodthirst, char.bloodthirst);

    this.whirlwind = create(Whirlwind, char.whirlwind);

    this.heroic = create(HeroicStrike, char.heroic);
    this.heroicQueued = false;

    this.slam = create(Slam, char.slam);
    this.slamSwing = this.slam ? new SlamSwing(this.slam, this.slamCast) : null;

    this.hamstring = create(Hamstring, char.hamstring);

    // Setup
    const exists = (e) => !!e;
    this.abilities = [
      this.execute,
      this.slam,
      this.bloodthirst,
      this.whirlwind,
      this.hamstring
    ].filter(exists);
 
    this.autos = [this.main, this.off].filter(exists);

    this.events = [...this.abilities].concat(this.autos).concat([
      this.anger,
      this.slam,
    ]).filter(exists);

    this.cooldowns = [...this.events].concat([this.gcd, this.flurry]);

    // helper methods
    this.checkBtCd = this.bloodthirst ?
        (cutoff) => this.bloodthirst.cooldown.timeUntil() > cutoff :
        () => true;
    this.checkWwCd = this.whirlwind ?
        (cutoff) => this.whirlwind.cooldown.timeUntil() > cutoff :
        () => true;
    this.checkBtWwCd =
        (cutoff) => this.checkBtCd(cutoff) && this.checkWwCd(cutoff);
  }

  getAp() {
    let ap = this.stats.ap;
    // TODO Blessing of Kings
    if (this.main.crusader && this.main.crusader.running()) ap += 200;
    if (this.off && this.off.crusader && this.off.crusader.running()) ap += 200;
    return ap;
  }

  setTarget(target) {
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
      this.main.swing(true, 315);
    }
  }

  getNextEvent() {
    // if (this.slam && this.slam.casting)
    //   debugger;
    const nextEvent = this.events.reduce((ret, e) => {
      return (e.canUse() && e.timeUntil() < ret.timeUntil()) ? e : ret;
    }, this.main);
    return nextEvent;
  }

  advanceTime(seconds) {
    for (const e of this.cooldowns) {
      e.tick(seconds);
    }
  }
}

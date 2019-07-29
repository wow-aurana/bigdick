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

    // Weapons, procs etc.
    this.handOfJustice = char.hoj;
    this.windfuryTotem = char.wftotem;
    this.flurry = new Flurry();
    this.main = new Weapon(this, char.main, 'Mainhand');
    this.off = !char.off ? null : new Weapon(this, char.off, 'Offhand');
    if (this.off) this.off.isMainhand = false;

    // Abilites use char.mainhand
    this.bloodthirst = new Bloodthirst(this);
    this.whirlwind = new Whirlwind(this);

    // Heroic Strike
    this.heroicWhen = char.hswhen || null;
    this.heroic = !this.heroicWhen ? null : new HeroicStrike(this);
    this.heroicQueued = false;

    // Slam
    this.slam = !char.slamwhen ? null : new Slam(this, char.slamwhen);
    this.slamSwing = !char.slamwhen ? null
                                    : new SlamSwing(this.slam, this.slamCast);

    // Setup
    this.abilities = [this.bloodthirst, this.whirlwind];
    if (this.slam) this.abilities.unshift(this.slam);

    this.autos = [this.main];
    if (this.off) this.autos.push(this.off);
    // First offhand swing delayed by 200ms (according to some guy on Discord)
    if (this.off) this.off.cooldown.timer = .2;

    this.events = [...this.abilities].concat(this.autos);
    if (this.anger) this.events.unshift(this.anger);
    if (this.slam) this.events.unshift(this.slamSwing);

    this.cooldowns = [...this.events].concat([this.gcd, this.flurry]);
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

  shouldHeroicStrike() {
    return this.heroicWhen && this.heroicWhen.rage < this.rage.current 
        && this.heroicWhen.btcd < this.bloodthirst.timeUntil()
        && this.heroicWhen.wwcd < this.whirlwind.timeUntil();
  }

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

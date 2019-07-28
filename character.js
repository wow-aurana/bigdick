class Character {
  constructor(char) {
    this.stats = char.stats;
    this.level = char.level;
    this.gcd = new Cooldown(1.5, 'GCD');
    this.rage = new Rage(char.level);
    
    // Talents
    const talents = parseTalents(char.talents);
    this.heroicCost = 15 - talents.improvedHeroicStrike;
    this.yellowCritMul = 2 + talents.impale * .1;
    this.wpnspec = char.twohand ? (1 + talents.twoHandSpec * .01) : 1;
    this.offhandDmgMul = .5 + talents.dualWieldSpec * .025;
    this.flurryHaste = 1 + (talents.flurry && (talents.flurry + 1) * .05) || 0;

    // Weapons, procs etc.
    this.handOfJustice = char.hoj;
    this.flurry = new Flurry();
    this.main = new Weapon(this, char.main, 'Mainhand');
    this.off = char.off ? new Weapon(this, char.off, 'Offhand') : null;
    if (this.off) this.off.isMainhand = false;

    // Abilites use char.mainhand
    this.bloodthirst = new Bloodthirst(this);
    this.whirlwind = new Whirlwind(this);

    // Heroic Strike
    this.heroic = new HeroicStrike(this);
    this.heroicQueued = false;
    this.heroicWhen = char.hswhen;

    this.swings = [this.bloodthirst, this.whirlwind];
    if (this.off) this.swings.unshift(this.off);
    this.swings.unshift(this.main);

    this.cooldowns = [
      this.bloodthirst.cooldown,
      this.whirlwind.cooldown,
      this.gcd,
      this.flurry,
    ];
    if (this.off) this.cooldowns.unshift(this.off);
    this.cooldowns.unshift(this.main);
  }

  getAp() {
    let ap = this.stats.ap;
    // TODO Blessing of Kings
    if (this.main.crusader && this.main.crusader.running()) ap += 200;
    if (this.off && this.off.crusader && this.off.crusader.running()) ap += 200;
    return ap;
  }

  setTarget(target) {
    for (const swing of this.swings) {
      swing.setTarget(target);
    }
    this.heroic.setTarget(target);
  }

  shouldHeroicStrike() {
    return this.heroicWhen.rage < this.rage.current 
        && this.heroicWhen.btcd < this.bloodthirst.getCooldown()
        && this.heroicWhen.wwcd < this.whirlwind.getCooldown();
  }

  procHoJ() {
    if (this.handOfJustice && m.random() <= .02) {
      this.main.cooldown.reset();
      this.main.swing(true);
    }
  }

  getNextEvent() {
    const nextEvent = this.swings.reduce((ret, e) => {
      return (e.canUse() && e.getCooldown() < ret.getCooldown()) ? e : ret;
    }, this.main);
    return nextEvent;
  }

  advanceTime(seconds) {
    for (const e of this.cooldowns) {
      e.tick(seconds);
    }
  }
}
class Character {
  constructor(char) {
    this.stats = char.stats;
    this.level = char.level;
    this.gcd = new Cooldown(1.5, 'GCD');
    this.rage = new Rage(char.level);
    this.flurry = new Flurry();
    this.main = new Weapon(this, char.main, 'Mainhand');
    this.off = char.off ? new Weapon(this, char.off, 'Offhand') : null;
    if (this.off) this.off.isMainhand = false;
    this.wpnspec = char.stats.twohand ? 1.03 : 1;

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
    // TODO no kings
    if (this.main.crusader && this.main.crusader.running()) ap += 220;
    if (this.off && this.off.crusader && this.off.crusader.running()) ap += 220;
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
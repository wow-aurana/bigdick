class Character {
  constructor(char) {
    this.stats = char.stats;
    this.level = char.level;
    this.gcd = new Cooldown(1.5, 'GCD');
    this.rage = new Rage(char.level);
    this.flurry = new Flurry();
    this.main = new Weapon(this, char.main, 'Mainhand');
    this.off = new Weapon(this, char.off, 'Offhand');
    this.off.isMainhand = false;

    // Abilites use char.mainhand
    this.bloodthirst = new Bloodthirst(this);
    this.whirlwind = new Whirlwind(this);

    // Heroic Strike
    this.heroic = new HeroicStrike(this);
    this.heroicQueued = false;
    this.heroicWhen = char.hswhen;

    this.swings = [this.main, this.off, this.bloodthirst, this.whirlwind];
  }

  getAp() { return this.stats.ap; }

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
    for (const e of [this.main, this.off]) {
      console.assert(e.cooldown.timer >= seconds, 'Tried to reduce attack cooldown below 0.');
      e.cooldown.tick(seconds);
    }
    for (const e of [this.bloodthirst.cooldown, this.whirlwind.cooldown, this.gcd, this.flurry]) {
      e.tick(seconds);
    }
  }
}
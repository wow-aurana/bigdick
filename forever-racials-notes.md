# WoW Forever Warrior racials

Implemented as-is from [tzcnt/WarriorSim](https://github.com/tzcnt/WarriorSim)
(`data/forever/RACIALS.md`, `js/racial-rules.js`), a similar Forever sim --
see `warriorsim-comparison-notes.md` for how that project compares more
broadly. Cross-checked against [Wowhead's Forever racials guide]
(https://www.wowhead.com/forever/guide/new-race-class-combinations), which
is itself pre-beta and being actively corrected via reader comments as of
2026-09-14. "Confirmed" below means confirmed by that second, still-
provisional source -- not by beta. Numbers can change once the beta
(2026-09-17) or real data is available; this is a starting point, not a
verified spec.

## Passives (no UI beyond the Race selector)

| Race | Bonus | Status |
| --- | --- | --- |
| Human | Sword Spec: +2% crit (auto/ability) while wielding a sword | Confirmed (value) |
| Dwarf | Mace Spec: +1% crit while wielding a mace | Confirmed (value) |
| Dwarf | Big Game Hunter: +5% damage vs. Beasts | Confirmed (value) |
| Orc | Axe Spec: +1% crit while wielding an axe | Unconfirmed magnitude (Wowhead doesn't give a %) |
| Undead | Touch of the Grave: 5% chance per landed hit, 5% of max HP as magic damage, no ICD | Confirmed chance/magnitude; ICD is WarriorSim's own assumption |
| Tauren | Endurance: +1% hit (+5% max health, not modeled -- no DPS effect since we don't track health for anyone but Undead's own Touch of the Grave) | Confirmed |
| Troll | Beast Slaying: +5% damage vs. Beasts | Confirmed |
| Skyborne | Wind Blessed: +1% haste (always on); Elemental Insight: +5% damage vs. Elementals | Confirmed (both factions share these) |

Weapon-type crit bonuses (Human/Dwarf/Orc) and Weaponmaster's Axe/Polearm
bonus now share one helper, `Character.weaponTypeCritBonus()`, applied to
both autoattacks (per actual weapon) and abilities (off the mainhand, same
as Weaponmaster's armor-pen/extra-attack effects already were). This also
fixes a pre-existing gap: Weaponmaster's own crit bonus previously only
ever reached autoattacks, never abilities.

"vs. enemy type" bonuses (Dwarf/Troll vs. Beasts, Skyborne vs. Elementals)
apply via `Character.multiplier()`, so they reach the same things Death
Wish already does -- including *not* reaching Rend/Deep Wounds ticks,
which don't scale with multiplier() at all (a pre-existing limitation,
not something new here).

## Active abilities

Four races get an on-use ability. All are off the GCD and cost no rage
(per WarriorSim's own notes). The **Racial active ability** setting picks
when it's used, shared across whichever race actually has one:
- **Immediately (on cooldown)**: usable from the start of the fight, then
  reused every time it's off cooldown.
- **With Death Wish**: fires in lockstep with Death Wish's own activation
  instead of its own schedule, silently skipped if still on cooldown at
  that moment.
- **X seconds into the fight**: delayed first use, then on cooldown as
  normal after that.

| Race | Ability | Effect | Cooldown | Status |
| --- | --- | --- | --- | --- |
| Night Elf | Elune's Light | +10% crit, 15s | 3 min | Confirmed value/duration; cooldown is WarriorSim's own guess |
| Gnome | Eureka! | Next 3 abilities: -40% rage cost, +10% damage | 2 min | +10% damage confirmed; -40% cost and cooldown are WarriorSim's own guesses |
| Orc | Blood Fury | +10% total AP (multiplicative, applied last), 15s | 2 min | +10%/15s confirmed for Forever specifically -- note this is *not* Classic's real Blood Fury (+25% melee AP, 2 min CD, -50% healing taken for 25s); Forever's version is reworked. Cooldown assumed from Classic, not confirmed for Forever. |
| Troll | Berserking | +10% autoattack speed (fixed, no longer health-scaling like Classic), 10s | 3 min | +10%/10s confirmed for Forever; cooldown assumed from Classic (raised from 2 to 3 min at some point), not confirmed for Forever |

Eureka!'s charge consumption is implemented at the shared `Ability` level
(`this.cast.eurekaBoosted`, set once in `handle()`), covering Mortal
Strike/Bloodthirst/Whirlwind (both hands)/Execute/Overpower/Slam/Rend/
Hamstring/Spearing Strike uniformly. Two known simplifications, both
documented in code comments:
- **Heroic Strike** never consumes or benefits from a charge -- it bypasses
  `handle()` entirely (triggered straight from `Weapon.swing()`).
- **Execute**'s rage cost is untouched by Eureka! (its rage math is already
  special-cased elsewhere), matching WarriorSim's own stated exception.
  Execute's damage still gets the +10% like everything else.

Blood Fury and Berserking's cooldowns needed a real number to support
"immediately on cooldown" as a genuine repeating schedule -- WarriorSim
itself doesn't model them that way (it just uses each once per fight), so
those two specific values are this sim's own addition, not ported from
anywhere.

## New inputs this required

- **Race** (3x3 grid, like Enemy type): defaults to Human.
- **Max HP**: plain manual number, shown only for Undead. This sim has
  never tracked health for anything else, so -- like WarriorSim's own "Max
  Health (override)" field -- it's a direct input, not derived from
  stamina/gear/buffs.
- **Racial active ability** (trigger + seconds): shown only for the four
  races with an active ability.

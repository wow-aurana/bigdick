# Comparison against tzcnt/WarriorSim (2026-09-14)

Source: https://github.com/tzcnt/WarriorSim (live at https://fleetcode.com/WarriorSim/),
a similar project -- an old Classic-era sim adapted for WoW Forever. Its combat math
lives in a WASM/C++ engine (`wasm/src/*.cpp`); the JS layer is only character setup.
Cloned and read directly for this comparison, not summarized from docs.

Not urgent: nothing here is confirmed wrong, and Forever's basic mechanics may still
change before/during beta. Kept for later reference if DPS numbers look off or when
cross-checking against real beta data.

## Top findings, ranked by likely DPS impact

### 1. Ability crit rolls: independent second roll vs. chained onto the same roll

Biggest potential impact -- affects most of the Fury rotation's crit rate.

- **Us** ([abilities.js](abilities.js), `Ability.swing()`): every ability rolls
  miss/dodge on roll #1, then -- if it landed -- rolls crit on a fresh, independent
  roll #2. Effective crit-if-landed is always exactly the raw crit% input, regardless
  of miss/dodge chance.
- **WarriorSim** (`wasm/src/player.cpp`, `rollMeleeSpell()`): crit is chained onto the
  *same* roll as miss/dodge (`tmp += crit*100; if (roll < tmp)`) for every ability
  *except* Bloodthirst and Execute, which explicitly set `weaponspell = false`
  (`js/classes/spell.js` lines 15, 76, 169) to get the independent-roll treatment.
  Mortal Strike, Whirlwind, Overpower, Spearing Strike, Slam, Heroic Strike,
  Hamstring, Sunder Armor, Thunder Clap all use the chained model.

Chaining onto one roll raises the effective landed-crit-rate above the flat input
value whenever there's real miss+dodge chance (e.g. ~42% raw crit becomes ~52% of
landed hits once you condition out a 20% miss+dodge pool). Found no comment or
citation on either side settling which is correct for Classic -- top priority to
research (start with the classic-warrior wiki's attack-table page, and see if
Bloodthirst/Execute being singled out in WarriorSim hints at a specific known
exception rather than a universal rule).

### 2. Dual-wield miss penalty formula

- **Us** ([weapon.js](weapon.js), `setTarget()`): flat `+19` to base miss, with an
  existing comment: "Dual wield miss penalty is a flat +19, not the older 0.8x+20
  estimate" (citing https://github.com/magey/classic-warrior/wiki/Attack-table).
- **WarriorSim** (`wasm/src/player.cpp`, `dwMissChance()`): `miss = (5 +
  skillDiff-scaling) * 0.8 + 20` -- exactly the formula our own comment calls
  outdated.

The two formulas only coincide at skillDiff=0 and diverge as the skill/defense gap
grows. Our own code already anticipated and cited a source disputing WarriorSim's
formula -- worth re-verifying that citation still holds up.

### 3. Hit rating's value past the +10 defense-skill threshold

- **Us** ([util.js](util.js), `baseAttackChances()`): hit suppression scales
  continuously past a +10 skill deficit (`(skillDiff-10)*.2`), citing a specific
  Blizzard forum post (https://us.forums.blizzard.com/en/wow/t/bug-hit-tables/185675/33).
- **WarriorSim** (`wasm/src/player.cpp`, `missChance()`): a flat, one-time `-1` to
  hit rating's value past +10, no scaling, no citation anywhere in their repo.

Same threshold, structurally different formulas beyond it.

## Areas that agree -- treat as cross-validated, not bugs

- **Rage conversion constant**: identical quadratic formula
  (`0.0091107836*lvl^2 + 3.225598133*lvl + 4.2652911`), same 7.5 multiplier, same
  75% rage-on-dodge.
- **Base dodge/glance formulas**: `5% + skillDiff*0.1` for dodge,
  `10% + max(defDiff,0)*2` for glance -- structurally identical.
- **Crit-vs-level-difference**: WarriorSim has a second crit function
  (`effectiveCrit()`, weapon-skill*0.04 term) that looked like a real disagreement at
  first, but it's dead code -- never consumed by their live roll (`crit =
  critChance()` is what's actually used, and `mh.effectiveCrit`/`oh.effectiveCrit`
  are set but never read anywhere). Their real crit formula uses only level
  difference plus the same +3-level 1.8 suppression we use, which is mathematically
  equivalent to our `skillDiff*0.2` term (5 skill/level * 0.2 = 1%/level). Same
  mechanic, different units -- not a real disagreement once traced through.
- **Stance-switch rage retention**: their docs independently state "10 baseline + 3
  per rank Tactical Mastery" -- matches our own (previously unconfirmed-by-us)
  assumption in forever-spells-notes.md.
- **Spearing Strike** (40%/120% vs Giant/Dragonkin/mounted), **Weaponmaster**
  (mace/staff armor-pen after debuffs, sword extra-attack), **Raging Blows**
  (Whirlwind rolls each hand independently), **Bloodthrill** (2%/rank, no ICD,
  independent of the dodge window) -- all match our implementation closely.

## Scope gap worth knowing about (not a bug)

WarriorSim models a configurable incoming-attack rate against the player
specifically so damage-taken-reactive talents work (their own docs: "Incoming
attacks are configured damage events, without avoidance, block or crit outcomes").
That's how they implement Enrage (2%/rank damage buff on a 30% chance per incoming
hit) -- a talent we currently skip entirely since our sim has no concept of incoming
damage to the player at all. If Enrage is worth real DPS for a Fury build eating
regular boss cleave/melee, that's a scope gap in our model, not just a missing
talent -- would need a similar "assumed incoming attack rate" input to model at all.

## Minor note

Their glance-damage-reduction is a randomized range per glance (`[low,high]` roll,
e.g. [0.8, 0.9] at skillDiff=10) vs. our single fixed average value (0.85 at the
same skillDiff -- lands right at their range's midpoint). Expected value converges
to about the same; likely not a DPS bias, just less variance modeling on our side.

## Source

Cloned at commit HEAD as of 2026-09-14 from
https://github.com/tzcnt/WarriorSim.git (not tracked in this repo; re-clone if
revisiting this analysis). Read directly: `wasm/src/engine.cpp`, `player.cpp`,
`spells.cpp`; `js/classes/spell.js`; `js/classes/player.js`; `data/forever/README.md`.

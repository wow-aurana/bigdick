# Warrior Spells — Classic baseline + "Forever" changes (research notes)

Started 2026-09-13. Companion to `forever-talents-notes.md` (which covers the
54 *talent-tree* entries); this file covers the **36 trainer-taught base
spells** — the warrior's actual spellbook, independent of talents — plus the
3 stances. Nothing here is wired into the sim yet; this is reference data
for whenever we get to implementing stance-gating and the wider ability set.

## Sources & confidence

Two sources, cross-checked against each other:

1. **`classic.wowhead.com` live spell tooltips** (Classic Era client
   1.13.0/1.13.x) — fetched directly, one spell at a time. This is where the
   **stance requirement** ("Forms" field), rank-1 numbers, rage cost, cast
   time, cooldown and range come from. Treat these as solid/verified — they
   come straight from the live tooltip, not a guess. Note: this uses the
   *modern* Classic ruleset (post-hotfixes), which is why a few things here
   contradict "well known vanilla trivia" — see the callouts below.
2. **`wowforevertalents.com/abilities/warrior/`** — a fan-made tracker
   (unofficial, not Blizzard) that starts from the same Classic Era baseline
   and layers on whatever's been confirmed from BlizzCon 2026 footage, with
   each spell explicitly tagged **New in Forever**, **Changed from
   Classic**, **Removed in Forever**, or untagged (= assumed unchanged,
   showing Classic's numbers as a placeholder). As of this writing the
   Forever beta hasn't started (begins 2026-09-17), so **only 4 of the 36
   spells have any confirmed Forever-specific data** (2 new, 1 changed, 1
   tagged removed) — everything else below is Classic's real data standing
   in until the beta client is out. This site also supplied the higher-rank
   numbers (Classic rank tables weren't fetched rank-by-rank; only rank 1
   was pulled from Wowhead directly for each spell, which is enough to
   confirm cost/cooldown/cast time/stance since those don't change by rank).
   **Caveat**: this ability tracker (4/36 confirmed) is much less mature
   than the same site's talent tracker (54/54 confirmed), and its one
   "removed" tag is directly contradicted by the talent side's data — see
   the Intercept entry below. Don't take this tracker's tags as confidently
   as the talent notes treat theirs.

Tags used below:
- **[FOREVER: NEW]** — no Classic equivalent; footage-confirmed to exist in Forever.
- **[FOREVER: CHANGED]** — footage-confirmed different from Classic; specifics noted inline.
- **[FOREVER: REMOVED]** — footage-confirmed gone from the Forever warrior kit (used once below, for Intercept — and even there, see that entry's caveat; take this tag with a grain of salt).
- Untagged — no Forever-specific confirmation either way yet; numbers shown are Classic's, standing in as a placeholder until the beta ships.
- **(talent-tooltip placeholder)** — this spell is baseline-only in Forever (learned from a trainer/by level), but wowforevertalents doesn't have Forever numbers for it, so it's showing the *Classic talent version's* tooltip as the closest stand-in. Treat the numbers as illustrative, not confirmed.

**Two "well-known vanilla trivia" corrections** worth flagging since they
contradict common assumption (verified directly against live Wowhead Classic
tooltips, twice, to be sure): **Thunder Clap requires Battle Stance only**
(not usable in Defensive — protection warriors have to stance-dance for it),
and **Taunt requires Defensive Stance only** (not free-for-all). Both
surprised me too; the tooltips are unambiguous ("Forms: Battle Stance" /
"Forms: Defensive Stance").

## Stances

**Battle Stance** — Level 1 (starting stance). Instant, 1 sec cooldown.
"A balanced combat stance."

**Defensive Stance** — Level 10. Instant, 1 sec cooldown.
"A defensive combat stance. Decreases damage taken by 10% and damage caused
by 10%. Increases threat generated."
*Note: real vanilla Classic teaches this via a class quest at/after level
10, not a flat trainer level — unconfirmed whether Forever keeps a quest
step or truly simplifies to level-gated only.*

**Berserker Stance** — Level 30. Instant, 1 sec cooldown.
"An aggressive stance. Critical hit chance is increased by 3% and all
damage taken is increased by 10%."
*Same quest-vs-level caveat as Defensive Stance (vanilla ties this to the
"Death and Decay"/Whirlwind Axe class quest chain around level 30).*

---

## Arms (12)

**Tactical Mastery** — Baseline (no level gate). **[FOREVER: NEW]**
No Classic equivalent as a *baseline* spell — in Classic this is an Arms
talent (retain rage on stance change, +3/6/9/12/15 per rank on top of a base
10). No Forever tooltip captured yet; existence/icon only.

**Victory Rush** — Baseline (no level gate). **[FOREVER: NEW]**
Doesn't exist in vanilla Classic at all (later-expansion ability: a free
attack usable shortly after killing an enemy). No numbers captured yet.

**Battle Stance** — see Stances.

**Heroic Strike** — Rank 9 (max). Level 1 (rank 1) / 60 (rank 9). 15 Rage,
Melee Range, next-melee (instant, replaces your next swing). No stance
requirement (any stance).
"A strong attack that increases melee damage by 157" (rank 9) / "+11" (rank
1, Classic).

**Charge** — Rank 3 (max). Level 4 (rank 1) / 46 (rank 3). No cost (rage is
generated, not spent), 8-25 yd range, Instant, 15 sec cooldown. **Requires
Battle Stance.** Cannot be used in combat.
"Charge an enemy, generate 15 rage (rank 3) / 9 (rank 1), and stun it for 1
sec."

**Rend** — Rank 7 (max, per current Classic client — not 9 like older
pre-Classic vanilla patches). Level 4 (rank 1) / 60 (rank 7). 10 Rage,
Melee Range, Instant. **Requires Battle Stance or Defensive Stance** (not
Berserker).
"Wounds the target causing them to bleed for 147 damage over 21 sec" (rank
7) / "15 damage over 9 sec" (rank 1).

**Thunder Clap** — Rank 6 (max). Level 6 (rank 1) / 58 (rank 6). 20 Rage,
Instant, 4 sec cooldown. **Requires Battle Stance only** (see callout
above). Affects up to 4 targets.
"Blasts nearby enemies, increasing the time between their attacks by 10%
for 30 sec (rank 6) / 10 sec (rank 1) and doing damage to them" (10 damage
at rank 1).

**Hamstring** — Rank 3 (max). Level 8 (rank 1) / 54 (rank 3). 10 Rage,
Melee Range, Instant. **Requires Battle Stance or Berserker Stance** (not
Defensive).
"Maims the enemy, causing 45 damage (rank 3) / 5 (rank 1) and slowing the
enemy's movement by 50% (rank 3) / 40% (rank 1) for 15 sec."

**Overpower** — Rank 4 (max). Level 12 (rank 1) / 60 (rank 4). 5 Rage,
Melee Range, Instant, 5 sec cooldown. **Requires Battle Stance only.**
Only usable in the brief window after the target dodges.
"Instantly overpower the enemy, causing weapon damage plus 35" (rank 4).

**Mocking Blow** — Rank 5 (max). Level 16 (rank 1) / 56 (rank 5). 10 Rage,
Melee Range, Instant, 2 min cooldown. **Requires Battle Stance only.**
"A mocking attack that causes 93 damage (rank 5), a moderate amount of
threat and forces the target to focus attacks on you for 6 sec."

**Retaliation** — No ranks. Level 20. Instant, 30 min cooldown. **Requires
Battle Stance only.**
"Instantly counterattack any enemy that strikes you in melee for 15 sec.
Melee attacks made from behind cannot be counterattacked. A maximum of 30
attacks will cause retaliation."

**Mortal Strike** — Rank 4 (talent-tooltip placeholder). Level 60 (trainer
slot: level 48). **[FOREVER: NEW]** — doesn't exist in vanilla Classic at
all (it's a TBC+ ability); this is one of the 2 confirmed-new entries.
30 Rage, Melee Range, Instant, 6 sec cooldown. Stance requirement not
independently verified (no Classic version exists to check against; TBC's
Mortal Strike has no stance requirement, plausibly the same here, but
**unconfirmed**).
"A vicious strike that deals weapon damage plus 160 and wounds the target,
reducing the effectiveness of any healing by 50% for 10 sec."

---

## Fury (13)

**Battle Shout** — Rank 7 (max). Level 1 (rank 1) / 60 (rank 7). 10 Rage,
Instant. No stance requirement (any stance).
"The warrior shouts, increasing the melee attack power of all party members
within 20 yards by 232 (rank 7) / 20 (rank 1). Lasts 2 min."

**Demoralizing Shout** — Rank 5 (max). Level 14 (rank 1) / 54 (rank 5). 10
Rage, Instant. No stance requirement.
"Reduces the melee attack power of all enemies within 10 yards by 146 (rank
5) / 45 (rank 1) for 30 sec."

**Cleave** — Rank 5 (max). Level 20 (rank 1) / 60 (rank 5). 20 Rage, Melee
Range, next-melee (instant). No stance requirement.
"A sweeping attack that does your weapon damage plus 50 (rank 5) / 5 (rank
1) to the target and his nearest ally."

**Intimidating Shout** — No ranks. Level 22. 25 Rage, 10 yd range, Instant,
3 min cooldown. No stance requirement.
"The warrior shouts, causing the targeted enemy to cower in fear. Up to 5
total nearby enemies will flee in fear. Lasts 8 sec."

**Execute** — Rank 5 (max). Level 24 (rank 1) / 56 (rank 5). 15 Rage, Melee
Range, Instant. **Requires Battle Stance or Berserker Stance** (not
Defensive). Only usable below 20% target health.
"Attempt to finish off a wounded foe, causing 600 damage (rank 5, or 125 at
rank 1) and converting each extra point of rage into additional damage."

**Challenging Shout** — No ranks. Level 26. 5 Rage, Instant, 10 min
cooldown. No stance requirement.
"Forces all nearby enemies to focus attacks on you for 6 sec."

**Berserker Stance** — see Stances.

**Intercept** — **[CONTRADICTED, do not trust the "removed" tag]**. The
abilities tracker on wowforevertalents.com tags this "Removed in Forever"
(and its ability grid visually drops the icon from the Fury list) — but
the *same site's talent calculator* (a far more mature dataset: 54/54
talents footage-confirmed vs. this ability tracker's 4/36) still has
**Improved Intercept** at Fury tier 20, tagged "✓ Same as Classic (verified)
· 3 sources," with the tooltip "Reduces the cooldown of your Intercept
ability by 5 sec." That talent only makes sense if the base Intercept spell
still exists, so the "Removed" tag on the abilities page is most likely a
tracking error on the less-verified half of that site, not a real Forever
change. **Treat Intercept as presumed still present** until the beta
confirms one way or the other. Classic reference data: Level 30, 10 Rage,
8-25 yd range, Instant, 30 sec cooldown. **Requires Berserker Stance only**
(not Battle+Berserker, contrary to common recollection — verified
directly). "Charge an enemy, generate rage, and stun it."

**Slam** — **[FOREVER: CHANGED]** — one of the 2 confirmed changes. Base
rank learned at level 30: 15 Rage, Melee Range, 1.5 sec cast, no stance
requirement (any stance, per Classic). Classic: "Slams the opponent,
causing weapon damage plus 87" (highest Classic rank) / "+32" (rank 1).
**Confirmed change**: the rank-up schedule was accelerated — Rank 3 is
already known by level 38 in Forever, vs. level 46 in Classic. Exact new
per-rank damage values not yet captured from footage.

**Berserker Rage** — No ranks. Level 32. Instant, 30 sec cooldown.
**Requires Berserker Stance only.**
"The warrior enters a berserker rage, becoming immune to Fear and
Incapacitate effects and generating extra rage when taking damage. Lasts 10
sec."

**Whirlwind** — No ranks. Level 36. 25 Rage, Instant, 10 sec cooldown.
**Requires Berserker Stance only.**
"In a whirlwind of steel you attack up to 4 enemies within 8 yards, causing
weapon damage to each enemy."

**Pummel** — Rank 2 (max). Level 38 (rank 1) / 58 (rank 2). 10 Rage, Melee
Range, Instant, 10 sec cooldown. **Requires Berserker Stance only.**
"Pummel the target for 50 damage (rank 2). It also interrupts spellcasting
and prevents any spell in that school from being cast for 4 sec."

**Bloodthirst** — Rank 4 (talent-tooltip placeholder). Level 60 (trainer
slot: level 48). Appears here as a **baseline trainer spell** in Forever —
in Classic this is a Fury *talent*, not trainer-taught, so its very
presence in this list is itself a de facto Forever change (not
independently footage-tagged by the tracker, but structurally new). 30
Rage, Melee Range, Instant, 6 sec cooldown. No stance requirement (checked
directly against the Classic talent tooltip — somewhat surprising for a
"Berserker-flavored" ability, but confirmed no "Forms" restriction).
"Instantly attack the target causing damage equal to 45% of your attack
power. In addition, the next 5 successful melee attacks will restore 20
health. This effect lasts 8 sec."

**Recklessness** — No ranks. Level 50. Instant, 30 min cooldown. **Requires
Berserker Stance only.**
"The warrior will cause critical hits with most attacks and will be immune
to Fear effects for the next 15 sec, but all damage taken is increased by
20%."

---

## Protection (10)

**Bloodrage** — No ranks. Level 10. Cost: 20% of base health, Instant, 1
min cooldown. No stance requirement.
"Generates 10 rage at the cost of health, and then generates an additional
10 rage over 10 sec. The warrior is considered in combat for the duration."

**Defensive Stance** — see Stances.

**Sunder Armor** — Rank 5 (max). Level 10 (rank 1) / 58 (rank 5). 15 Rage,
Melee Range, Instant. No stance requirement (the classic Defensive-Stance
requirement was removed early in vanilla's life and confirmed absent here
too — verified directly, no "Forms" line).
"Sunders the target's armor, reducing it by 450 (rank 5) / 90 (rank 1) per
Sunder Armor and causes a high amount of threat. Can be applied up to 5
times. Lasts 30 sec."

**Taunt** — No ranks. Level 10. Melee range, Instant, 10 sec cooldown.
**Requires Defensive Stance only** (see callout above — this one surprised
me too).
"Taunts the target to attack you, but has no effect if the target is
already attacking you."

**Shield Bash** — Rank 3 (max). Level 12 (rank 1) / 52 (rank 3). 10 Rage,
Melee Range, Instant, 12 sec cooldown. **Requires Battle Stance or
Defensive Stance** (not Berserker — this one genuinely is stance-gated,
unlike the shield abilities below).
"Bashes the target with your shield for 45 damage (rank 3) / 6 (rank 1). It
also interrupts spellcasting and prevents any spell in that school from
being cast for 6 sec."

**Revenge** — Rank 6 (max). Level 14 (rank 1) / 60 (rank 6). 5 Rage, Melee
Range, Instant, 5 sec cooldown. **Requires Defensive Stance only.** Must
follow a block, dodge or parry.
"Instantly counterattack an enemy for 81 to 99 damage (rank 6) and a high
amount of threat."

**Shield Block** — No ranks. Level 16. 10 Rage, Instant, 5 sec cooldown.
**Requires Defensive Stance only.**
"Increases chance to block by 75% for 5 sec, but will only block 1 attack."

**Disarm** — No ranks. Level 18. 20 Rage, Melee Range, Instant, 1 min
cooldown. **Requires Defensive Stance only.**
"Disarm the enemy's weapon for 10 sec."

**Shield Wall** — No ranks. Level 28. Instant, 30 min cooldown. **Requires
Defensive Stance only.**
"Reduces the damage taken from melee attacks, ranged attacks and spells by
75% for 10 sec."

**Shield Slam** — Rank 4 (talent-tooltip placeholder). Level 60 (trainer
slot: level 48). Same situation as Bloodthirst: appears as a **baseline
trainer spell** here, a talent in Classic. 20 Rage, Melee Range, Instant, 6
sec cooldown. No stance requirement (checked directly against the Classic
talent tooltip — only requires a shield equipped, not a specific stance).
"Slam the target with your shield, causing 342 to 358 damage, modified by
your shield block value, and has a 50% chance of dispelling 1 magic effect
on the target. Also causes a high amount of threat."

---

## Summary table — stance requirements

| Any stance | Battle only | Defensive only | Berserker only | Battle + Defensive | Battle + Berserker |
|---|---|---|---|---|---|
| Heroic Strike, Battle Shout, Demoralizing Shout, Cleave, Intimidating Shout, Challenging Shout, Sunder Armor, Bloodrage, Bloodthirst*, Shield Slam*, Slam | Charge, Overpower, Mocking Blow, Retaliation, Thunder Clap | Taunt, Revenge, Shield Block, Disarm, Shield Wall | Berserker Rage, Whirlwind, Pummel, Recklessness, Intercept† | Shield Bash | Rend, Hamstring, Execute |

\* Bloodthirst/Shield Slam checked against their Classic *talent* tooltips
(no Classic baseline version exists to check, since they're talent-only
there); Mortal Strike's stance requirement is unverified (see entry above).
† Intercept is presumed still present despite the abilities tracker's
"Removed" tag — see that entry's caveat above.

## Open questions / to revisit once the beta is live

- Whether Intercept is actually still in the kit (presumed yes — see its
  entry above) and, if so, whether its stance/cost/cooldown changed at all.
- Real Forever tooltip numbers for the 2 new spells (Tactical Mastery,
  Victory Rush) and the changed one (Slam's new per-rank values).
- Whether Defensive/Berserker Stance still require a class quest, or are
  simply level-gated now.
- Whether Bloodthirst/Shield Slam/Mortal Strike/Recklessness's move to
  baseline-at-level-48/50 comes with new stance requirements distinct from
  their Classic talent versions (all three "Talent" placeholders above
  showed no stance requirement, but that's the *talent* tooltip's rule, not
  necessarily what Forever's baseline version does).

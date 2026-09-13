'use strict';

// Reads the talent selection produced by talents.html (see
// TALENTS_STORAGE_KEY in talent-picker.js) and translates it into the flags
// Character.js expects. `talents` is {arms: {key: rank}, fury: {...},
// protection: {...}}, as collected by collectInputs() in main.js.

function parseTalents(talents) {
  const arms = (talents && talents.arms) || {};
  const fury = (talents && talents.fury) || {};

  const rank = (tree, key) => tree[key] || 0;

  return {
    improvedHS: rank(arms, 'improved-heroic-strike'),
    angerMgmt: rank(arms, 'anger-management'),
    deepWounds: rank(arms, 'deep-wounds'),
    twoHandSpec: rank(arms, 'two-handed-weapon-specialization'),
    impale: rank(arms, 'impale'),
    improvedRend: rank(arms, 'improved-rend'),
    spearingStrike: rank(arms, 'spearing-strike'),
    weaponmaster: rank(arms, 'weaponmaster'),
    // Deflection (parry), Improved Charge (Charge isn't modeled), Improved
    // Hamstring (root chance -- no DPS effect), Sweeping Strikes and
    // Improved Cleave (Cleave isn't modeled) have nothing for this sim to
    // hook into; see forever-talents-notes.md for the full accounting.
    boomingVoice: rank(fury, 'booming-voice'),
    unbridledWrath: rank(fury, 'unbridled-wrath'),
    dualWieldSpec: rank(fury, 'dual-wield-specialization'),
    improvedExecute: rank(fury, 'improved-execute'),
    improvedSlam: rank(arms, 'improved-slam'),
    deathWish: rank(fury, 'death-wish'),
    flurry: rank(fury, 'flurry'),
    improvedTacticalMastery: rank(arms, 'improved-tactical-mastery'),
    improvedOverpower: rank(arms, 'improved-overpower'),
    bloodthrill: rank(fury, 'bloodthrill'),
    boundlessRage: rank(fury, 'boundless-rage'),
    ragingBlows: rank(fury, 'raging-blows'),
    precision: rank(fury, 'precision'),
    // Cruelty is deliberately not modeled -- per the user, gear-based crit
    // input is assumed to already include it if the build uses it. Iron
    // Will/Blood Craze (no DPS effect), Piercing Howl (pure CC), Enrage
    // (would need an incoming-damage model this sim doesn't have),
    // Improved Intercept/Improved Berserker Rage (neither ability is
    // modeled) also have nothing to hook into.
  }
}

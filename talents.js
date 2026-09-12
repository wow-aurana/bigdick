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
    // TODO add rest of arms?
    boomingVoice: rank(fury, 'booming-voice'),
    unbridledWrath: rank(fury, 'unbridled-wrath'),
    dualWieldSpec: rank(fury, 'dual-wield-specialization'),
    improvedExecute: rank(fury, 'improved-execute'),
    improvedSlam: rank(arms, 'improved-slam'),
    deathWish: rank(fury, 'death-wish'),
    flurry: rank(fury, 'flurry'),
  }
}

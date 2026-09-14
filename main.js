'use strict';

const audioURL = 'https://www.myinstants.com/media/sounds/anime-wow-sound-effect.mp3';

// Light/dark mode. Default is dark (see the inline <script> in index.html's
// <head>, which applies this before the page renders to avoid a flash of
// the wrong theme). Kept in its own localStorage key rather than folded
// into the form's saveSettings()/loadSettings(), since it's a display
// preference rather than a simulation input.
// "Forever"-namespaced (unlike the base sim's plain "bigdick..." keys)
// since this and the base sim share one GitHub Pages origin
// (wow-aurana.github.io/bigdick/ vs /bigdick/forever/) -- localStorage
// and BroadcastChannel are both origin-scoped, not path-scoped, so an
// un-namespaced key would be shared state between the two.
const THEME_KEY = 'bigdickForeverTheme';
const darkmodeCheckbox = getElement('darkmode');
darkmodeCheckbox.checked = !document.documentElement.classList.contains('light-mode');
darkmodeCheckbox.addEventListener('change', () => {
  const isDark = darkmodeCheckbox.checked;
  document.documentElement.classList.toggle('light-mode', !isDark);
  try {
    localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
  } catch (e) {
    // Storage unavailable (private browsing, disabled, quota, ...). Ignore.
  }
});

// Debug log. Streams simulation events to a dedicated debug.html tab over a
// BroadcastChannel as the sim runs (see sim.js/simworker.js for the
// producing end). Kept out of the persisted #setup form, like the theme
// toggle above: restoring a checked state via loadSettings()'s .click()
// would try to window.open() outside of a user gesture on page load and get
// silently swallowed by the popup blocker, so this always starts unchecked.
const debugChannel = new BroadcastChannel('bigdickForeverDebug');
const debugCheckbox = getElement('debuglog');
debugCheckbox.addEventListener('change', () => {
  if (debugCheckbox.checked) window.open('debug.html', 'bigdickForeverDebug');
});

const output = new Output();

const updateMitigtion = () => {
  getElement('effective').textContent = 
      '(Mitigation: ' + (getMitigation() * 100).toFixed(1) + '%)';
}
updateMitigtion();

const armorCheckboxes = [
    new Checkbox('sunder'),
    new Checkbox('faerie'),
    new Checkbox('curse'),
    new Checkbox('annihilator'),
];
armorCheckboxes.forEach(checkbox => checkbox.clickCb = updateMitigtion);

const twohand = new WeaponCheckbox('twohand');
twohand.check(false);
const mainhand = new WeaponCheckbox('mainhand');
const offhand = new WeaponCheckbox('offhand');
twohand.clickCb = (enabled) => {
  mainhand.check(!enabled, false);
  offhand.check(!enabled, false);
  offhand.enable(!enabled);
};

mainhand.clickCb = (enabled) => {
  twohand.check(!enabled, false);
  offhand.enable(enabled);
  offhand.check(enabled, false);
};

const executems = new Checkbox('executems');
const executebt = new Checkbox('executebt');
const executeww = new Checkbox('executeww');

const abilities = {
  wftotem: new Checkbox('wftotem'),
  deathwish: new Checkbox('deathwish'),
  aponuse: new Checkbox('aponuse'),
  overpower: new Checkbox('overpower'),
  rend: new Checkbox('rend'),
  spearingstrike: new Checkbox('spearingstrike'),
  slam: new Checkbox('slam'),
  mortalstrike: new Checkbox('mortalstrike'),
  bloodthirst: new Checkbox('bloodthirst'),
  whirlwind: new Checkbox('whirlwind'),
  heroic: new Checkbox('heroic'),
  hamstring: new Checkbox('hamstring'),
  brainlag: new Checkbox('lag'),
  twohand,
  mainhand,
  offhand,
};

abilities.mortalstrike.clickCb = (enabled) => {
  if (!enabled) executems.check(enabled);
  executems.enable(enabled);
};

abilities.bloodthirst.clickCb = (enabled) => {
  if (!enabled) executebt.check(enabled);
  executebt.enable(enabled);
};

abilities.whirlwind.clickCb = (enabled) => {
  if (!enabled) executeww.check(enabled);
  executeww.enable(enabled);
};

// Some abilities disabled by default
abilities.wftotem.check(false);
abilities.aponuse.check(false);
abilities.slam.check(false);
abilities.hamstring.check(false);
abilities.brainlag.check(false);
executeww.check(false);
new Checkbox('ragepotion').check(false);

// EP calculations disabled by default.
const apep = new Checkbox('apep');
apep.check(false);

// Add auto-select-all to inputs
for (const el of getElement('setup').elements) {
  if (el.type == 'text' || el.type == 'number') {
    el.onfocus = (e) => {
      if (document.activeElement == e.target) e.target.select();
    };
  }
}

function collectInputs() {
  const config = {
    char: {
      level: getInputNumber('charlvl'),
      talents: getTalents(),
      stance: getRadioValue('stance'),
      bok: getInputChecked('bok'),
      hoj: getInputChecked('hoj'),
      ragepotion: getInputChecked('ragepotion'),
      stats: {
        ap: getInputNumber('charap'),
        crit: getInputNumber('charcrit'),
        agility: getInputNumber('charagi'),
        hit: getInputNumber('charhit'),
        reduceDodge: getInputNumber('charreducedodge'),
        haste: getInputNumber('charhaste'),
      },
    },
    target: {
      level: getInputNumber('targetlvl'),
      armor: getEffectiveArmor(),
      type: getRadioValue('enemytype'),
    },
    iterations: getInputNumber('iterations'),
    duration: getInputNumber('duration'),
    execute: getInputNumber('executephase'),
  }

  for (const a of Object.values(abilities)) {
    config.char[a.name] = a.collect();
  }
  if (executems.checked())
    config.char.mortalstrike.execute = executems.collect();
  if (executebt.checked())
    config.char.bloodthirst.execute = executebt.collect();
  if (executeww.checked())
    config.char.whirlwind.execute = executeww.collect();
  return config;
}

let workers = {};

function createWorker(cfg, onFinished) {
  const worker = new SimWorker(cfg);
  worker.onProgress = () => {
    output.clear();
    const wrks = Object.values(workers);
    const progressAll = wrks.reduce((a, w) => a + w.progress(), 0);
    output.print('' + (progressAll / wrks.length).toFixed(0) + '% complete');
  };
  worker.onFinished = onFinished;
  return worker;
}

// Runs a simulation. Shared by the form's 'submit' handler and by a "run"
// request from the debug.html tab (opening that tab steals focus -- browsers
// don't let scripts open a background tab or suppress that -- so its Run
// button lets you kick off a debug run without switching back here).
function runSim(debugOn) {
  getElement('submit').disabled = true;

  // Remove workers from previous run
  workers = {};

  // Debug mode is a focused, single-run tool: it skips the EP-comparison
  // workers below (which would each also be capped and each want their own
  // log) and just streams one baseline run's events to the debug.html tab.
  if (debugOn) debugChannel.postMessage({ type: 'reset' });

  const checkboxes = apep.collect();
  const apepOn = apep.checked() && !debugOn;
  const onWorkersFinished = apepOn ? () => {
    getElement('submit').disabled = false;

    const wrks = Object.values(workers);
    // Wait until all workers finished
    for (const worker of wrks) { if (!worker.finished()) return; }

    if (getInputChecked('ping')) new Audio(audioURL).play();

    output.clear();

    const baseDps = workers.baseline.getDps();
    output.print('Base DPS: ' + baseDps.toFixed(2));
    const apDps = workers.ap.getDps();
    output.print('50 AP improves DPS by ' + (apDps - baseDps).toFixed(2));
    const apValue = (apDps - baseDps) / 50;

    const reportEp = (worker, label) => {
      if (!worker) return;
      const dps = worker.getDps();
      const apep = (dps - baseDps) / apValue;

      output.print('' + label + ' improves DPS by ' + (dps - baseDps).toFixed(2)
                   + ', APEP of ' + label + ' is ' + apep.toFixed(3));
    };
    reportEp(workers.hit, '1% hit');
    reportEp(workers.crit, '1% crit');
    reportEp(workers.reducedodge, '1% reduce dodge/parry');
    reportEp(workers.haste, '' + checkboxes.hastestep + '% attack speed');
    reportEp(workers.mskill, '' + checkboxes.mskillstep + ' mainhand skill');
    reportEp(workers.oskill, '' + checkboxes.oskillstep + ' offhand skill');
    reportEp(workers.mspeed, '' + checkboxes.mspeedstep + ' slower mainhand');
    reportEp(workers.ospeed, '' + checkboxes.ospeedstep + ' slower offhand');

    const maxTime = wrks.reduce((a, w) => w.runtime() > a ? w.runtime() : a, 0);
    output.print('(Finished in ' + maxTime + ' seconds)');
  } : () => {  // No APEP calculations
    getElement('submit').disabled = false;

    if (getInputChecked('ping')) new Audio(audioURL).play();

    output.clear();
    const report = workers.baseline.report();
    for (const line of report) {
      output.print(line);
    }
    if (debugOn) debugChannel.postMessage({ type: 'done' });
  };

  const cfg = collectInputs();
  if (debugOn) {
    cfg.debug = true;
    cfg.iterations = Math.min(cfg.iterations, 10);
  }
  workers.baseline = createWorker(cfg, onWorkersFinished);
  if (debugOn) {
    workers.baseline.onDebugLog =
        (lines) => debugChannel.postMessage({ type: 'lines', lines });
  }
  if (apepOn) {

    const apCfg = collectInputs();
    apCfg.char.stats.ap += 50;
    workers.ap = createWorker(apCfg, onWorkersFinished);

    if (checkboxes.hit) {
      const hitCfg = collectInputs();
      hitCfg.char.stats.hit += 1;
      workers.hit = createWorker(hitCfg, onWorkersFinished);
    }

    if (checkboxes.crit) {
      const critCfg = collectInputs();
      critCfg.char.stats.crit += 1;
      workers.crit = createWorker(critCfg, onWorkersFinished);
    }

    if (checkboxes.reducedodge) {
      const reduceDodgeCfg = collectInputs();
      reduceDodgeCfg.char.stats.reduceDodge += 1;
      workers.reducedodge = createWorker(reduceDodgeCfg, onWorkersFinished);
    }

    if (checkboxes.haste) {
      const hasteCfg = collectInputs();
      const step = checkboxes.hastestep;
      hasteCfg.char.stats.haste += step;
      workers.haste = createWorker(hasteCfg, onWorkersFinished);
    }

    if (checkboxes.mskill) {
      const skillCfg = collectInputs();
      const step = checkboxes.mskillstep;
      if (skillCfg.char.twohand) skillCfg.char.twohand.skill += step;
      if (skillCfg.char.mainhand) skillCfg.char.mainhand.skill += step;
      workers.mskill = createWorker(skillCfg, onWorkersFinished);
    }

    if (checkboxes.oskill) {
      const skillCfg = collectInputs();
      const step = checkboxes.oskillstep;
      if (skillCfg.char.offhand) {
        skillCfg.char.offhand.skill += step;
        workers.oskill = createWorker(skillCfg, onWorkersFinished);
      } 
    }

    if (checkboxes.mspeed) {
      const speedCfg = collectInputs();
      const step = checkboxes.mspeedstep;
      const weapon = speedCfg.char.twohand || speedCfg.char.mainhand;
      const factor = (weapon.speed + step) / weapon.speed;
      weapon.speed += step; weapon.min *= factor; weapon.max *= factor;
      workers.mspeed = createWorker(speedCfg, onWorkersFinished);
    }

    if (checkboxes.ospeed) {
      const speedCfg = collectInputs();
      const weapon = speedCfg.char.offhand;
      if (weapon) {
        const step = checkboxes.ospeedstep;
        const factor = (weapon.speed + step) / weapon.speed;
        weapon.speed += step; weapon.min *= factor; weapon.max *= factor;
        workers.ospeed = createWorker(speedCfg, onWorkersFinished);
      }
    }
  }

  for (const worker of Object.values(workers)) { worker.start(); }
}

getElement('setup').addEventListener('submit', (e) => {
  if (e.preventDefault) e.preventDefault();
  runSim(debugCheckbox.checked);
});

// A "run" request from the debug.html tab's Run button.
debugChannel.onmessage = (e) => {
  if (e.data && e.data.type === 'run') {
    debugCheckbox.checked = true;
    runSim(true);
  }
};

// Persist the whole form to localStorage and restore it on load, so a
// browser refresh doesn't lose the current setup. Must run after all the
// Checkbox/WeaponCheckbox wiring and default-check calls above, so it
// overrides those hardcoded defaults with whatever was last saved.
getElement('setup').addEventListener('change', saveSettings);
getElement('setup').addEventListener('input', saveSettings);
loadSettings();

// Talent spec is set on talents.html (a separate tab), not on this form, so
// keep a live read-only summary here instead. Refresh whenever the user
// could plausibly have changed it there: on load, when this tab regains
// focus, and immediately if talents.html is open in another tab right now
// (the 'storage' event only fires in *other* tabs of the same origin).
function updateTalentsSummary() {
  const talents = getTalents();
  const summary = TALENT_TREES.map((tree) => {
    const points = tree.talents.reduce((sum, t) => {
      return sum + ((talents[tree.key] && talents[tree.key][t.key]) || 0);
    }, 0);
    return tree.name + ' ' + points;
  }).join(' / ');
  getElement('talentsSummary').textContent = ' (' + summary + ')';
}
updateTalentsSummary();
window.addEventListener('focus', updateTalentsSummary);
window.addEventListener('storage', (e) => {
  if (e.key === 'bigdickForeverTalents') updateTalentsSummary();
});

// Some abilities only make sense once a specific talent is spent: Mortal
// Strike and Bloodthirst are talent-only in Classic and stay talent-*gated*
// here even though Forever then lets you train further ranks at a trainer
// (see forever-spells-notes.md); Slam is actively bad without Improved
// Slam rank 2's swing-interrupt removal (see abilities.js). Hide (and
// force off) their checkboxes otherwise, refreshed on the same triggers as
// updateTalentsSummary() above.
function updateTalentGating() {
  const talents = getTalents();
  const rank = (tree, key) => (talents[tree] && talents[tree][key]) || 0;

  // Top-level ability checkbox: row hidden, checkbox disabled and forced
  // off unless the talent it depends on is present.
  const gateAbility = (rowId, checkbox, available) => {
    getElement(rowId).style.display = available ? '' : 'none';
    checkbox.enable(available);
    if (!available) checkbox.check(false);
  };
  // Execute-phase checkbox: same row-hiding/force-off, but its own
  // enabled/disabled state is already governed by the matching ability
  // checkbox's clickCb cascade above -- never re-enable it here.
  const gateExecute = (rowId, checkbox, available) => {
    getElement(rowId).style.display = available ? '' : 'none';
    if (!available) checkbox.check(false);
  };

  const deathWish = rank('fury', 'death-wish') > 0;
  const improvedSlam2 = rank('arms', 'improved-slam') >= 2;
  const mortalStrike = rank('arms', 'mortal-strike') > 0;
  const bloodthirst = rank('fury', 'bloodthirst') > 0;
  const bloodthrill = rank('fury', 'bloodthrill') > 0;
  const spearingStrike = rank('arms', 'spearing-strike') > 0;

  gateAbility('deathwish-row', abilities.deathwish, deathWish);
  gateAbility('rend-row', abilities.rend, bloodthrill);
  gateAbility('spearingstrike-row', abilities.spearingstrike, spearingStrike);
  gateAbility('slam-row', abilities.slam, improvedSlam2);
  gateAbility('mortalstrike-row', abilities.mortalstrike, mortalStrike);
  gateExecute('executems-row', executems, mortalStrike);
  gateAbility('bloodthirst-row', abilities.bloodthirst, bloodthirst);
  gateExecute('executebt-row', executebt, bloodthirst);
}
updateTalentGating();
window.addEventListener('focus', updateTalentGating);
window.addEventListener('storage', (e) => {
  if (e.key === 'bigdickForeverTalents') updateTalentGating();
});

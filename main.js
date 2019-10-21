'use strict';

const audioURL = 'https://www.myinstants.com/media/sounds/anime-wow-sound-effect.mp3';

const output = new Output();

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

const executebt = new Checkbox('executebt');
const executeww = new Checkbox('executeww');

const abilities = {
  wftotem: new Checkbox('wftotem'),
  deathwish: new Checkbox('deathwish'),
  aponuse: new Checkbox('aponuse'),
  slam: new Checkbox('slam'),
  bloodthirst: new Checkbox('bloodthirst'),
  whirlwind: new Checkbox('whirlwind'),
  heroic: new Checkbox('heroic'),
  hamstring: new Checkbox('hamstring'),
  brainlag: new Checkbox('lag'),
  twohand,
  mainhand,
  offhand,
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
  const talentSource = 'classic.wowhead.com/talent-calc/warrior/';
  const talentUrl = getInputString('talents');
  if (talentUrl.indexOf(talentSource) < 0) {
    output.clear();
    output.print('Use talent source from ' + talentSource);
    return;
  }

  const config = {
    char: {
      level: getInputNumber('charlvl'),
      talents: talentUrl,
      bok: getInputChecked('bok'),
      hoj: getInputChecked('hoj'),
      ragepotion: getInputChecked('ragepotion'),
      stats: {
        ap: getInputNumber('charap'),
        crit: getInputNumber('charcrit'),
        hit: getInputNumber('charhit'),
        haste: getInputNumber('charhaste'),
      },
    },
    target: {
      level: getInputNumber('targetlvl'),
      armor: getEffectiveArmor(),
    },
    iterations: getInputNumber('iterations'),
    duration: getInputNumber('duration'),
    execute: getInputNumber('executephase'),
  }

  for (const a of Object.values(abilities)) {
    config.char[a.name] = a.collect();
  }
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

// Main 'submit' button hook
getElement('setup').addEventListener('submit', (e) => {
  if (e.preventDefault) e.preventDefault();

  getElement('submit').disabled = true;

  // Remove workers from previous run
  workers = {};

  const checkboxes = apep.collect();
  const onWorkersFinished = apep.checked() ? () => {
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
  };

  const cfg = collectInputs();
  workers.baseline = createWorker(cfg, onWorkersFinished);
  if (apep.checked()) {

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
});

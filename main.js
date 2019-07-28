
const output = new Output();

const offhand = new Checkbox('off', (e) => {
  const checked = e.target.checked;

  for (const id of ['off_min', 'off_max', 'off_speed', 'off_skill']) {
    document.getElementById(id).disabled = !checked;
  }
  document.getElementById('2hand').checked = !checked;
});

const submit = new Submit(() => {
  const talentSource = 'classic.wowhead.com/talent-calc/warrior/';
  const talentUrl = getInput('talents');
  if (talentUrl.indexOf(talentSource) < 0) {
    output.clear();
    output.print('Use talent source from ' + talentSource);
    return;
  }

  const config = {
    char: {
      level: getInputNumber('charlvl'),
      talents: talentUrl,
      twohand: getChecked('2hand'),
      hoj: getChecked('hoj'),
      wftotem: getChecked('wftotem'),
      stats: {
        ap: getInputNumber('ap'),
        crit: getInputNumber('crit'),
        hit: getInputNumber('hit'),
      },
      main: {
        min: getInputNumber('main_min'),
        max: getInputNumber('main_max'),
        speed: getInputNumber('main_speed'),
        skill: getInputNumber('main_skill'),
        crusader: getChecked('main_crusader'),
      },
      hswhen: {
        rage: getInputNumber('hs_rage'),
        btcd: getInputNumber('hs_bt_cd'),
        wwcd: getInputNumber('hs_ww_cd'),
      },
    },
    target: {
      level: getInputNumber('targetlvl'),
      armor: 4000,
    },
    duration: getInputNumber('duration'),
  }
  if (offhand.checked()) {
    config.char.off = {
      min: getInputNumber('off_min'),
      max: getInputNumber('off_max'),
      speed: getInputNumber('off_speed'),
      skill: getInputNumber('off_skill'),
      crusader: getChecked('off_crusader'),
    };
  }
  const worker = new Worker('sim.js');
  worker.onerror = function(e) {
    console.log('Worker error:');
    console.log(e);
  }
  worker.onmessageerror = function(e) {
    console.log('Worker error:');
    console.log(e);
  }
  worker.onmessage = function(e) {
    output.clear();
    const result = e.data;
    for (const e of result) {
      output.print(e);
    }
    if (result.length > 1 && getChecked('ping')) {
      new Audio('https://www.myinstants.com/media/sounds/anime-wow-sound-effect.mp3').play();
    }
  };
  worker.postMessage(config);
});

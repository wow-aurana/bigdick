const audioURL = 'https://www.myinstants.com/media/sounds/anime-wow-sound-effect.mp3';

const output = new Output();

const twohand = new Checkbox('twohand');
twohand.check(false);
const mainhand = new Checkbox('mainhand');
const offhand = new Checkbox('offhand');
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

const abilities = [
  new Checkbox('execute'),
  new Checkbox('slam'),
  new Checkbox('bloodthirst'),
  new Checkbox('whirlwind'),
  new Checkbox('heroic'),
  new Checkbox('hamstring'),
  new Checkbox('lag'),
  mainhand,
  offhand,
  twohand,
];

abilities[0].check(false);  // Execute
abilities[1].check(false);  // Slam
abilities[5].check(false);  // Hamstring

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
      wftotem: getInputChecked('wftotem'),
      stats: {
        ap: getInputNumber('charap'),
        crit: getInputNumber('charcrit'),
        hit: getInputNumber('charhit'),
      },
    },
    target: {
      level: getInputNumber('targetlvl'),
      armor: getEffectiveArmor(),
    },
    duration: getInputNumber('duration'),
  }

  for (a of abilities) {
    config.char[a.name] = a.collect();
  }
  return config;
}

getElement('setup').addEventListener('submit', (e) => {
  if (e.preventDefault) e.preventDefault();

  const workers = [];
  const cfg = collectInputs();
  workers.push(new SimWorker(cfg, () => {
    output.clear();

    const complete = workers.reduce((a, w) => a && w.finished(), true);
    if (complete) {
      if (getInputChecked('ping')) new Audio(audioURL).play();

      for (const worker of workers) {
        const report = worker.report();
        for (const line of report) {
          output.print(line);
        }
      }
    } else {
      const progress =
          workers.reduce((a, w) => a + w.progress(), 0) / workers.length;
      output.print('' + progress.toFixed(0) + '% complete');
    }
  }));

  for (const worker of workers) { worker.start(); }
});

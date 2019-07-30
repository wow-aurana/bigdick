
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
  mainhand,
  offhand,
  twohand,
];

abilities[0].check(false);  // Execute
abilities[1].check(false);  // Slam
abilities[5].check(false);  // Hamstring

getElement('setup').addEventListener('submit', (e) => {
  if (e.preventDefault) e.preventDefault();

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
      armor: 4000,
    },
    duration: getInputNumber('duration'),
  }

  for (a of abilities) {
    config.char[a.name] = a.collect();
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
    if (result.length > 1 && getInputChecked('ping')) {
      new Audio('https://www.myinstants.com/media/sounds/anime-wow-sound-effect.mp3').play();
    }
  };
  worker.postMessage(config);
});

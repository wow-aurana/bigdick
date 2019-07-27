
const output = new Output();

const submit = new Submit(() => {
  const config = {
    char: {
      level: 60,
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
      },
      off: {
        min: getInputNumber('off_min'),
        max: getInputNumber('off_max'),
        speed: getInputNumber('off_speed'),
        skill: getInputNumber('off_skill'),
      },
      hswhen: {
        rage: getInputNumber('hs_rage'),
        btcd: getInputNumber('hs_bt_cd'),
        wwcd: getInputNumber('hs_ww_cd'),
      },
    },
    target: {
      level: 63,
      armor: 4000,
    },
    duration: getInputNumber('duration'),
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
  };
  worker.postMessage(config);
});
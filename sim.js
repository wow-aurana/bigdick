importScripts('util.js');
importScripts('talents.js');
importScripts('weapon.js');
importScripts('abilities.js');
importScripts('character.js');


function reportProgress(progress) {
  postMessage({ progress });
}

function compileResults(char, duration) {
  const res = { duration };

  const dmgSources = [...char.autos].concat(char.abilities);
  if (char.heroic) dmgSources.push(char.heroic);
  res.dmg = dmgSources.reduce((a, s) => a + s.log.dmg, 0);
  res.sources = dmgSources.map((s) => s.log);
  // TODO clean up procs
  res.crusader = {};
  if (char.main.crusader) res.crusader.main = char.main.crusader.log;
  if (char.off && char.off.crusader) res.crusader.off = char.off.crusader.log;
  res.flurry = char.flurry.uptime;
  res.rage = char.rage.log;
  return res;
}

function runSimulation(cfg) {
  const startTime = new Date().getTime();
  const duration = cfg.duration;

  const char = new Character(cfg.char);
  char.setTarget(cfg.target);

  let timer = 0;
  let reportedProgress = 0;

  while (timer < duration) {
    const progress = Math.round(timer / duration * 100);
    if (progress > reportedProgress) {
      reportedProgress = progress;
      reportProgress(progress);
    }

    const nextEvent = char.getNextEvent();
    nextEventTimer = nextEvent.timeUntil();
    console.assert(nextEventTimer >= 0, 'Trying to go back in time!');
    timer += nextEventTimer;
    char.advanceTime(nextEventTimer);

    nextEvent.handle();
    char.main.applyFlurry();
    if (char.off) char.off.applyFlurry();
    char.heroicQueued |= char.shouldHeroicStrike();
  }

  const results = compileResults(char, duration);
  const endTime = new Date().getTime();
  results.runtime = ((endTime - startTime) / 1000).toFixed(1);
  postMessage({progress: 100, summary: results });
}

onmessage = function(e) {
  const config = e.data;
  runSimulation(config);
};

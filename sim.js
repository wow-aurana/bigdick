importScripts('util.js');
importScripts('auras.js');
importScripts('talents.js');
importScripts('weapon.js');
importScripts('abilities.js');
importScripts('character.js');


function reportProgress(progress) {
  postMessage({ progress });
}

function compileResults(char) {
  const res = {};

  const dmgSources = [...char.autos].concat(char.abilities);
  if (char.heroic) dmgSources.push(char.heroic);
  res.dmg = dmgSources.reduce((a, s) => a + s.log.dmg, 0);
  res.sources = dmgSources.map((s) => s.log);

  res.procs = { main: char.main.strprocs.map((s) => s.log) };
  res.procs.off = !!char.off ? char.off.strprocs.map((s) => s.log) : [];

  res.flurry = char.flurry.uptime;
  res.rage = char.rage.log;
  return res;
}

function runSimulation(cfg) {
  const startTime = new Date().getTime();

  const char = new Character(cfg.char);
  char.setTarget(cfg.target);

  let reportedProgress = 0;

  for (let i = 0; i < cfg.iterations; ++i) {
    const progress = m.round(i / cfg.iterations * 100);
    if (progress > reportedProgress) {
      reportedProgress = progress;
      reportProgress(progress);
    }

    let timer = 0;
    const executeWindowStart = cfg.duration - cfg.execute;
    while (timer < cfg.duration) {
      char.canExecute = timer >= executeWindowStart;
      const nextEvent = char.getNextEvent(cfg.duration - timer);
      nextEventTimer = nextEvent.timeUntil();
      console.assert(nextEventTimer >= 0, 'Trying to go back in time!');
      timer += nextEventTimer;

      char.advanceTime(nextEventTimer);
      if (timer > cfg.duration) break;

      nextEvent.handle();
      char.main.applyFlurry();
      if (char.off) char.off.applyFlurry();
      char.heroicQueued |= char.shouldHeroicStrike();
    }

    char.finishFight();
  }

  const results = compileResults(char);
  const endTime = new Date().getTime();
  results.runtime = ((endTime - startTime) / 1000).toFixed(1);
  postMessage({progress: 100, summary: results });
}

onmessage = function(e) {
  const config = e.data;
  runSimulation(config);
};

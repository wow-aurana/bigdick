'use strict';

importScripts('util.js?v=5');
importScripts('cooldowns.js?v=10');
importScripts('auras.js?v=2');
importScripts('talents.js?v=4');
importScripts('weapon.js?v=9');
importScripts('abilities.js?v=14');
importScripts('character.js?v=11');


function reportProgress(progress) {
  postMessage({ progress });
}

function compileResults(char) {
  const res = {};

  const dmgSources = [...char.autos].concat(char.abilities);
  if (char.heroic) dmgSources.push(char.heroic);
  if (char.deepWounds) dmgSources.push(char.deepWounds);
  if (char.touchOfGrave) dmgSources.push(char.touchOfGrave);
  res.dmg = dmgSources.reduce((a, s) => a + s.log.dmg, 0);
  res.sources = dmgSources.map((s) => s.log);

  res.procs = { main: char.main.strprocs.map((s) => s.log) };
  res.procs.off = !!char.off ? char.off.strprocs.map((s) => s.log) : [];

  res.flurry = char.flurry.log.uptime;
  res.rage = char.rage.log;
  return res;
}

function runSimulation(cfg) {
  const startTime = new Date().getTime();
  Debug.reset(!!cfg.debug);
  // Debug mode's whole point is a readable, copy-pasteable log, so cap the
  // run regardless of what the iterations field says. main.js already caps
  // this before sending cfg over so its own DPS/report math (which uses its
  // copy of cfg.iterations) stays consistent with what actually ran here;
  // this is just a second line of defense.
  const iterations = Debug.enabled ? m.min(cfg.iterations, 10) : cfg.iterations;

  const char = new Character(cfg.char, cfg.target);

  let reportedProgress = 0;

  for (let i = 0; i < iterations; ++i) {
    Debug.iteration = i + 1;
    Debug.time = 0;
    Debug.log('--- Fight start ---');

    const progress = m.round(i / iterations * 100);
    if (progress > reportedProgress) {
      reportedProgress = progress;
      reportProgress(progress);
    }

    let timer = 0;
    const executeWindowStart = cfg.duration - cfg.execute;
    while (timer < cfg.duration) {
      char.can.execute = timer >= executeWindowStart;
      const nextEvent = char.getNextEvent(cfg.duration - timer);
      const nextEventTimer = nextEvent.timeUntil();
      console.assert(nextEventTimer >= 0, 'Trying to go back in time!');
      timer += nextEventTimer;

      char.advanceTime(nextEventTimer);
      if (timer > cfg.duration) break;

      Debug.time = timer;
      nextEvent.handle();
      char.main.applyFlurry();
      char.main.applyRacialHaste();
      if (char.off) {
        char.off.applyFlurry();
        char.off.applyRacialHaste();
      }
      char.queueHeroicStrike();
    }

    char.finishFight();
    Debug.log('--- Fight end ---');
    if (Debug.enabled) {
      postMessage({ debugLog: Debug.lines });
      Debug.lines = [];
    }
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

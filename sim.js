importScripts('util.js');
importScripts('talents.js');
importScripts('weapon.js');
importScripts('abilities.js');
importScripts('character.js');


function reportProgress(progress) {
  postMessage(['' + progress + '% complete.']);
}

function runSimulation(cfg) {
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

  let result = [];
  const dmgSources = [...char.autos].concat(char.abilities);
  if (char.heroic) dmgSources.push(char.heroic);
  const dmg = dmgSources.reduce((a, s) => a + s.log.dmg, 0);
  let whiteDmg = char.main.log.dmg;
  if (char.off) whiteDmg += char.off.log.dmg; 
  result.push('DPS: ' + (dmg / duration).toFixed(1));
  let percentages = '';
  for (const source of dmgSources) {
    if (source != char.main) percentages += ', ';
    percentages += source.log.name + ': '
                   + (source.log.dmg * 100 / dmg).toFixed(1) + '%';
  }
  result.push(percentages);
  // result.push(
  //            + ', Whirlwind: '
  //            + (char.whirlwind.log.dmg * 100 / dmg).toFixed(1) + '%');
  // if (char.heroic) result[result.length - 1]
  //            += (', Heroic Strike: '
  //            + (char.heroic.log.dmg * 100 / dmg).toFixed(1) + '%');
  // if (char.slam) result[result.length - 1]
  //            += (', Slam: '
  //            + (char.slam.log.dmg * 100 / dmg).toFixed(1) + '%');
  result.push('Flurry uptime: '
             + (char.flurry.uptime * 100 / duration).toFixed(3) + '%');
  result.push('Mainhand average swing time: '
             + (duration / (char.main.log.swings
                           + (char.heroic ? char.heroic.log.swings
                                         : 0))).toFixed(3));
  char.off && result.push('Offhand average swing time: '
             + (duration / char.off.log.swings).toFixed(3) + 's');
  char.bloodthirst && result.push('Avg. time between Bloodthirsts: '
             + (duration / char.bloodthirst.log.swings).toFixed(3) + 's');
  char.whirlwind && result.push('Avg. time between Whirlwinds: '
             + (duration / char.whirlwind.log.swings).toFixed(3) + 's');
  char.heroic && result.push('Avg. time between Heroic Strikes: '
             + (duration / char.heroic.log.swings).toFixed(3) + 's');
  result.push('Avg. rage gain per white hit: '
             + (char.rage.gainedFromSwings / char.rage.swingCount).toFixed(2)
             + ', per second: '
             + (char.rage.gained / duration).toFixed(3));
  char.main.crusader && result.push('Mainhand crusader procs: '
             + char.main.crusader.count
             + ', effective ppm: '
             + (char.main.crusader.count / (duration / 60)).toFixed(2)
             + ', uptime: '
             + (char.main.crusader.uptime * 100 / duration).toFixed(1) + '%');
  char.off && char.off.crusader && result.push('Offhand crusader procs: '
             + char.off.crusader.count
             + ', effective ppm: '
             + (char.off.crusader.count / (duration / 60)).toFixed(2)
             + ', uptime: '
             + (char.off.crusader.uptime * 100 / duration).toFixed(1) + '%');
  for (const source of dmgSources) {
    result.push(source.log.string());
  }

  postMessage(result);
}

onmessage = function(e) {
  const config = e.data;
  runSimulation(config);
};

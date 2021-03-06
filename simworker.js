'use strict';

class SimWorker {
  constructor(cfg) {
    this.cfg = cfg;
    this.result = { progress: 0 };
    this.worker = new Worker('sim.js');

    this.onProgress = () => {};
    this.onFinished = () => {};

    this.worker.onerror = (e) => {
      console.log('Worker error:');
      console.log(e);
    };

    this.worker.onmessageerror = (e) => {
      console.log('Worker error:');
      console.log(e);
    };

    this.worker.onmessage = (e) => {
      this.result = e.data;
      !!this.result.summary ? this.onFinished() : this.onProgress();
    };
  }

  finished() { return !!this.result.summary; }
  progress() { return this.result.progress; }
  start() { this.worker.postMessage(this.cfg); }

  getDps() {
    console.assert(this.result.summary);
    const duration = this.cfg.duration * this.cfg.iterations;
    return (this.result.summary.dmg / duration);
  }

  runtime() {
    console.assert(this.result.summary);
    return this.result.summary.runtime;
  }

  report() {
    const summary = this.result.summary;
    const iterations = this.cfg.iterations;
    const duration = this.cfg.duration * this.cfg.iterations;

    const report = [];
    report.push('DPS: ' + (summary.dmg / duration).toFixed(1));

    const getAbility = (name) => {
      return summary.sources.reduce((a, w) => {
        return w.name.indexOf(name) < 0 ? a : w;
      }, null);
    };

    const mainhand = getAbility('Mainhand');
    const offhand = getAbility('Offhand');
    const heroic = getAbility('Heroic');

    let percentages = '';
    for (const source of summary.sources) {
      if (source != mainhand) percentages += ', ';
      percentages += source.name + ': '
                     + (source.dmg * 100 / summary.dmg).toFixed(1) + '%';
    }
    report.push(percentages);

    for (const source of summary.sources) {
      const swings = source.swings || 1;
      const toPercent = (count) => {
        return '' + (count / swings * 100).toFixed(2) + '%';
      };
      let line = '' + source.name
                 + ' damage per hit: ' + (source.dmg / swings).toFixed(0)
                 + ', hits: ' + toPercent(source.hits)
                 + ', crits: ' + toPercent(source.crits)
                 + ', misses: ' + toPercent(source.misses)
                 + ', dodges: ' + toPercent(source.dodges);
      if (source.glances > 0) {
        line += ', glances: ' + toPercent(source.glances);
      }
      report.push(line);
    }
    report.push('Flurry uptime: '
               + (summary.flurry * 100 / duration).toFixed(2) + '%');
    report.push('Mainhand swings per fight: '
               + ((mainhand.swings + (heroic ? heroic.swings : 0))
                   / iterations).toFixed(2));
    offhand && report.push('Offhand swings per fight: '
             + (offhand.swings / iterations).toFixed(2));
    for (const source of summary.sources) {
      if (source == mainhand || source == offhand) continue;
      report.push('' + source.name + 's per fight: '
                 + (source.swings / iterations).toFixed(2));
    }
    report.push('Rage gain per white hit: '
               + (summary.rage.fromSwings / summary.rage.swings).toFixed(2)
               + ', per second: '
               + (summary.rage.gained / duration).toFixed(2));
    
    for (const proc of summary.procs.main) {
      report.push('Mainhand ' + proc.name + ' procs per fight: '
                  + (proc.count / iterations).toFixed(2) + ', effective ppm: '
                  + (proc.count / (duration / 60)).toFixed(2) + ', uptime: '
                  + (proc.uptime * 100 / duration).toFixed(1) + '%');
    }

    for (const proc of summary.procs.off) {
      report.push('Offhand ' + proc.name + ' procs per fight: '
                  + (proc.count / iterations).toFixed(2) + ', effective ppm: '
                  + (proc.count / (duration / 60)).toFixed(2) + ', uptime: '
                  + (proc.uptime * 100 / duration).toFixed(1) + '%');
    }

    report.push('(Finished in ' + summary.runtime + ' seconds)');
    return report;
  }
}

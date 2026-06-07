// Spawned by the profiler for --io mode.
// Wraps the user script with perf_hooks async tracking, then exits cleanly.
const { performance, PerformanceObserver } = require('node:perf_hooks');
const [,, scriptPath, durationMs, reportPath] = process.argv;

const entries = [];

const obs = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.duration > 1) { // ignore sub-ms noise
      entries.push({
        name: entry.name,
        type: entry.entryType,
        durationMs: entry.duration,
        startTime: entry.startTime,
      });
    }
  }
});

obs.observe({ entryTypes: ['http', 'http2', 'net', 'dns', 'node'] });

// Also patch fs async methods to track timing
const fs = require('node:fs');
const origReadFile = fs.readFile.bind(fs);
const origWriteFile = fs.writeFile.bind(fs);

function tracked(name, orig) {
  return function(...args) {
    const cb = args[args.length - 1];
    if (typeof cb !== 'function') return orig(...args);
    const start = performance.now();
    args[args.length - 1] = function(...cbArgs) {
      entries.push({ name, type: 'fs', durationMs: performance.now() - start, startTime: start });
      cb(...cbArgs);
    };
    return orig(...args);
  };
}

fs.readFile = tracked('fs.readFile', origReadFile);
fs.writeFile = tracked('fs.writeFile', origWriteFile);

setTimeout(() => {
  obs.disconnect();
  require('node:fs').writeFileSync(reportPath, JSON.stringify(entries));
  process.exit(0);
}, Number(durationMs));

require(scriptPath);

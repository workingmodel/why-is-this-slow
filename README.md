# wm-why-is-this-slow

[![npm version](https://img.shields.io/npm/v/wm-why-is-this-slow.svg)](https://www.npmjs.com/package/wm-why-is-this-slow)

Zero-config CLI that profiles a Node.js app and outputs a plain-English bottleneck report. No setup, no dashboard, no API key. You run it, it tells you what's slow and why.

Developed by [Working Model Inc](https://workingmodel.co)

```
npx wm-why-is-this-slow node server.js
```

```
CPU Bottleneck Report — server.js (10.1s sample)
────────────────────────────────────────────────────────────────────────

🔴  writeLog  src/logger.ts:14
   3.2s — called 4,100x — 31.4% of cpu
   Synchronous filesystem call on the hot path — blocks the event loop for every caller.
   → Replace with the async equivalent (e.g. fs.promises.writeFile) and await it.

🟠  getUserById  src/db.ts:42
   1.8s — called 220x — 17.6% of cpu
   Very high call count with non-trivial self-time — hot inner loop.
   → Profile the call site. Consider memoization, batching, or inlining the logic.

🟡  parseConfig  src/config.ts:8
   420ms — called 890x — 4.1% of cpu
   Meaningful CPU time spent here.
   → Review the implementation for unnecessary work, repeated computation, or missing caching.
```

---

## Install

```bash
# Run once without installing
npx wm-why-is-this-slow node server.js

# Or install globally
npm install -g wm-why-is-this-slow
wm-why-is-this-slow node server.js
```

**Requirements:** Node.js 18+. No other setup.

---

## Usage

```bash
wm-why-is-this-slow <command> [script] [...args]
```

### Examples

```bash
# Profile a server for 10 seconds (default)
wm-why-is-this-slow node server.js

# Profile a script that takes arguments
wm-why-is-this-slow node scripts/migrate.js --env production

# Profile for 30 seconds
wm-why-is-this-slow node server.js --duration 30

# Profile heap allocations instead of CPU
wm-why-is-this-slow node server.js --memory

# Profile async I/O wait time
wm-why-is-this-slow node server.js --io

# Save a flamegraph (opens in speedscope.app)
wm-why-is-this-slow node server.js --flamegraph

# Machine-readable JSON output
wm-why-is-this-slow node server.js --json > report.json

# Include node_modules frames (hidden by default)
wm-why-is-this-slow node server.js --include-deps
```

---

## Options

| Flag | Default | Description |
|---|---|---|
| `--duration, -d <s>` | `10` | Profile for this many seconds |
| `--top <n>` | `10` | Show top N bottlenecks |
| `--memory` | off | Profile heap allocations instead of CPU |
| `--io` | off | Profile async I/O wait time instead of CPU |
| `--flamegraph` | off | Save speedscope-compatible flamegraph to `.wm-profile/` |
| `--json` | off | Output machine-readable JSON |
| `--include-deps` | off | Include `node_modules` frames (hidden by default) |

---

## How it works

**CPU mode (default)** — Spawns your script with Node's built-in `--cpu-prof` flag (no native deps). After the duration, parses the V8 `.cpuprofile` and ranks frames by self-time. A heuristic rule engine matches function names against known bad patterns (synchronous I/O, blocking crypto, hot loops, JSON churn) and generates a plain-English explanation + fix for each.

**Memory mode (`--memory`)** — Uses `--heap-prof` to sample allocations. Reports the top allocating call sites by bytes, with rules for Buffer overuse, JSON parse allocation, and array spread patterns.

**I/O mode (`--io`)** — Injects `perf_hooks` observers and patches `fs.readFile` / `fs.writeFile` to measure async wait time. Reports the operations consuming the most I/O time.

**Flamegraph (`--flamegraph`)** — Writes a [speedscope](https://www.speedscope.app)-compatible JSON file to `.wm-profile/flamegraph.json`. Drag it into speedscope.app for an interactive view.

---

## Limitations

- **CommonJS only** — the script must be runnable with `node <script>` (CJS). ESM scripts (`type: "module"`) are not yet supported.
- **Short scripts** — if your script exits in under ~1s, the profiler may not collect enough samples. Use `--duration` to match your script's natural runtime.
- **Memory mode accuracy** — heap sampling is statistical. Low-allocation code paths may not appear in the report. Use `--include-deps` to widen the frame set.

---

## License

MIT © [Working Model](https://workingmodel.co)

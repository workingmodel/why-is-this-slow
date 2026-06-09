# @workingmodel/why-is-this-slow

Tells you in plain English why your Node app is slow. Developed by [Working Model](https://workingmodel.co).

[![npm version](https://img.shields.io/npm/v/@workingmodel/why-is-this-slow)](https://www.npmjs.com/package/@workingmodel/why-is-this-slow)
[![npm downloads](https://img.shields.io/npm/dm/@workingmodel/why-is-this-slow)](https://www.npmjs.com/package/@workingmodel/why-is-this-slow)
[![license](https://img.shields.io/npm/l/@workingmodel/why-is-this-slow)](LICENSE)

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
npx @workingmodel/why-is-this-slow node server.js

# Or install globally
npm install -g @workingmodel/why-is-this-slow
why-is-this-slow node server.js
```

**Requirements:** Node.js 18+. No other setup.

---

## Usage

```bash
why-is-this-slow <command> [script] [...args]
```

### Examples

```bash
# Profile a server for 10 seconds (default)
why-is-this-slow node server.js

# Profile a script that takes arguments
why-is-this-slow node scripts/migrate.js --env production

# Profile for 30 seconds
why-is-this-slow node server.js --duration 30

# Profile heap allocations instead of CPU
why-is-this-slow node server.js --memory

# Profile async I/O wait time
why-is-this-slow node server.js --io

# Save a flamegraph (opens in speedscope.app)
why-is-this-slow node server.js --flamegraph

# Machine-readable JSON output
why-is-this-slow node server.js --json > report.json

# Include node_modules frames (hidden by default)
why-is-this-slow node server.js --include-deps
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

## Why This Exists

Every Node performance problem ends the same way: someone adds a console.log, stares at a flamegraph they can't read, or pastes an error into a forum and waits. The tools exist but they assume you already know what you're looking for. This one doesn't. You point it at your app and it tells you what's slow, why it's slow, and what to do about it — in plain English, with no setup.

---

## More tools →

More tools from Working Model → [workingmodel.co](https://workingmodel.co)

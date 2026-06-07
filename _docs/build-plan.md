# wm-why-is-this-slow — Build Plan

**Project:** `wm-why-is-this-slow`  
**Remote:** https://github.com/workingmodel/wm-why-is-this-slow.git  
**Local:** `WM-Projects/WM-Why-Is-This-Slow`  
**Stack:** Node.js 20, TypeScript 5, tsup, Vitest  
**Goal:** Zero-config CLI that profiles a Node.js app and outputs a plain-English bottleneck report.

---

## What It Does (User Perspective)

```
npx wm-why-is-this-slow node server.js
```

You get back something like:

```
Bottleneck Report — server.js (12.4s sample)

🔴 getUserById() — 847ms avg — called 220x — 34% of CPU time
   → Hot loop with high call count. Consider caching the result outside the loop.

🟠 processImage() — 312ms avg — called 44x — 11% of CPU time
   → High self-time in image path. Check for synchronous resizing or uncompressed buffers.

🟡 writeLog() — 28ms avg — called 3,400x — 8% of CPU time
   → fs.writeFileSync called on every request. Switch to async writes or buffer in memory.

Full flamegraph saved to: .wm-profile/flamegraph.html
```

No config file. No API key. No dashboard. Works offline. Just answers.

---

## Architecture

### Core Loop

```
CLI Entry
  → spawn child process with --cpu-prof (V8 built-in)
  → run user's script for N seconds (default: 10s)
  → kill child, collect .cpuprofile
  → parse profile → flat frame list with self-time + call count
  → run heuristic rule engine against frame names + paths
  → score + rank by self-time %, filter node_modules
  → render plain-English terminal report
  → write speedscope-compatible flamegraph to .wm-profile/
```

### What Gets Profiled

- CPU: V8 `--cpu-prof` (built into Node 12+, zero deps)
- Memory: `--heap-prof` (opt-in via `--memory` flag)
- I/O: `perf_hooks` injection wrapper (opt-in via `--io` flag)

### Heuristic Rule Engine

The plain-English output comes from a pattern-matching rule set applied to frame names and file paths — no LLM required. Rules match on:

- **Known sync APIs** — `writeFileSync`, `readFileSync`, `execSync`, `spawnSync` → flag as blocking I/O
- **Call count × self-time** — high call count + non-trivial self-time → "hot loop / consider caching"
- **JSON churn** — `JSON.parse` / `JSON.stringify` in hot frames → "serialization overhead"
- **Crypto** — `pbkdf2Sync`, `createHash` in hot paths → "sync crypto, move off request path"
- **Regex** — `RegExp` in high-call-count frames → "possible catastrophic backtracking"
- **Generic high self-time** — no pattern match → "high self-time, review this function"

Each rule produces `{ severity, explanation, fix }`. Rules are data — an array of `{ match, severity, explanation, fix }` objects — easy to extend.

---

## Project Structure

```
wm-why-is-this-slow/
├── _docs/
│   └── build-plan.md          ← this file
├── src/
│   ├── index.ts               ← CLI entry (bin)
│   ├── profiler.ts            ← spawn + collect V8 profile
│   ├── parser.ts              ← parse .cpuprofile → flat frame list
│   ├── analyzer.ts            ← score frames, filter, rank top N
│   ├── rules.ts               ← heuristic rule set (data + matcher)
│   ├── renderer.ts            ← terminal output (chalk)
│   ├── flamegraph.ts          ← speedscope JSON writer
│   └── types.ts               ← shared types
├── tests/
│   ├── parser.test.ts
│   ├── analyzer.test.ts
│   └── rules.test.ts
├── fixtures/
│   └── sample.cpuprofile      ← real profile fixture for tests
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
└── README.md
```

---

## Sprints

### Sprint 1 — Core Pipeline

**Goal:** `npx wm-why-is-this-slow node script.js` produces a full plain-English report.

Tasks:
- [ ] `package.json` — name, bin, scripts, deps (chalk, execa)
- [ ] `tsconfig.json` — strict, ESNext, bundler moduleResolution
- [ ] `tsup.config.ts` — single CJS bundle, sourcemap
- [ ] `src/types.ts` — `HotFrame`, `RuleMatch`, `Report` types
- [ ] `src/profiler.ts` — spawn `node --cpu-prof <script>`, kill after timeout, return `.cpuprofile` path
- [ ] `src/parser.ts` — parse V8 `.cpuprofile` JSON → flat frame list with self-time + call count
- [ ] `src/rules.ts` — rule set data + `applyRules(frame) → RuleMatch | null` matcher
- [ ] `src/analyzer.ts` — sort by self-time %, apply rules, filter node_modules, return top 10
- [ ] `src/renderer.ts` — terminal output with severity colors (chalk)
- [ ] `src/index.ts` — CLI: parse argv, wire pipeline, render
- [ ] `tests/parser.test.ts` — unit test against `fixtures/sample.cpuprofile`
- [ ] `tests/analyzer.test.ts` — scoring + filtering logic
- [ ] `tests/rules.test.ts` — each rule matches expected frame names

Deliverable: full working CLI, no API key, all tests green.

---

### Sprint 2 — Depth + Polish

**Goal:** Memory + I/O modes, flamegraph output, all flags.

Tasks:
- [ ] `src/flamegraph.ts` — write speedscope-compatible JSON to `.wm-profile/` (opens in speedscope.app)
- [ ] `--memory` flag: heap profiling via `--heap-prof`, parse + report top allocators
- [ ] `--io` flag: async I/O tracing via `perf_hooks` injection wrapper
- [ ] `--duration <s>` flag (default 10s)
- [ ] `--top <n>` flag (default 10 frames)
- [ ] `--include-deps` flag: include node_modules frames (hidden by default)
- [ ] `--json` flag: machine-readable JSON output
- [ ] Expand rule set based on real profiles encountered during testing

Deliverable: full flag surface, flamegraph output, memory + I/O modes working.

---

### Sprint 3 — Publish

**Goal:** Production-quality CLI, published to npm.

Tasks:
- [ ] README — usage, all flags, examples, no API key callout
- [ ] CI: GitHub Actions — `lint`, `test`, `build` on push
- [ ] npm publish as `wm-why-is-this-slow`

---

## Key Technical Decisions

| Decision | Choice | Reason |
|---|---|---|
| Profiler mechanism | `node --cpu-prof` (V8 built-in) | Zero deps, works on Node 12+, no install |
| Diagnosis | Heuristic rule engine | Works offline, no API key, deterministic output |
| Bundle format | CJS via tsup | `npx` compatibility without ESM loader flags |
| Flamegraph format | speedscope JSON | Browser-native, no server needed |
| node_modules | Hidden by default | 99% of the time the user's code is the culprit |
| No config file | Hard constraint | Core product promise — zero setup |

---

## Dependencies

**Runtime:**
- `chalk` — terminal colors
- `execa` — child process management

**Dev:**
- `typescript`, `tsup`, `vitest`
- `@types/node`

No LLM. No API keys. Works offline.

---

## Success Criteria

- [ ] `npx wm-why-is-this-slow node my-script.js` produces a report in < 12s
- [ ] Works on Node 18+, no install, no config, no API key
- [ ] Report is understandable by a developer who has never used a profiler
- [ ] All tests pass, CI green
- [ ] Published to npm as `wm-why-is-this-slow`
- [ ] Score: 10/10 on WM DevOps review

---

_Plan authored: 2026-06-07 | Updated: 2026-06-07 — removed LLM, heuristic rule engine instead_

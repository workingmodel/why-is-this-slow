import type { HotFrame, RuleMatch, ProfilingMode } from "./types.js";

interface Rule {
  match: (frame: HotFrame) => boolean;
  severity: RuleMatch["severity"];
  explanation: string;
  fix: string;
}

const cpuRules: Rule[] = [
  {
    match: (f) => /(?:writeFileSync|appendFileSync|readFileSync|existsSync|mkdirSync|readdirSync|statSync|unlinkSync|copyFileSync|renameSync)/.test(f.name),
    severity: "critical",
    explanation: "Synchronous filesystem call on the hot path — blocks the event loop for every caller.",
    fix: "Replace with the async equivalent (e.g. fs.promises.writeFile) and await it.",
  },
  {
    match: (f) => /(?:execSync|spawnSync|execFileSync)/.test(f.name),
    severity: "critical",
    explanation: "Synchronous child process spawn — freezes Node until the subprocess exits.",
    fix: "Use execa or util.promisify(exec) and await the result.",
  },
  {
    match: (f) => /(?:pbkdf2Sync|scryptSync|hashSync)/.test(f.name),
    severity: "critical",
    explanation: "Synchronous crypto hashing on the hot path — CPU-bound and blocks the event loop.",
    fix: "Use the async variant (pbkdf2, scrypt) or offload to a worker thread.",
  },
  {
    match: (f) => /(?:createHash|createHmac)/.test(f.name) && f.callCount > 20,
    severity: "warning",
    explanation: "Crypto digest called at high frequency.",
    fix: "Cache digests where the input is stable, or batch multiple calls.",
  },
  {
    match: (f) => /(?:JSON\.parse|JSON\.stringify|deserialize|serialize)/.test(f.name) && f.selfTimePct > 3,
    severity: "warning",
    explanation: "JSON serialization is consuming measurable CPU time.",
    fix: "Cache parsed results where possible, or use fast-json-stringify for hot outputs.",
  },
  {
    match: (f) => /RegExp|\.match\b|\.replace\b|\.test\b/.test(f.name) && f.callCount > 100,
    severity: "warning",
    explanation: "Regular expression executed at high frequency — check for catastrophic backtracking.",
    fix: "Pre-compile the regex outside the hot path (const RE = /…/). Audit with safe-regex.",
  },
  {
    match: (f) => /(?:\.sort\b|\.filter\b|\.map\b|\.reduce\b|\.flatMap\b)/.test(f.name) && f.callCount > 500,
    severity: "warning",
    explanation: "Array method called at very high frequency — likely inside a tight loop.",
    fix: "Hoist the operation outside the loop or replace with a single-pass reduce.",
  },
  {
    match: (f) => /(?:require|import|resolve|Module\._load)/.test(f.name) && f.selfTimePct > 2,
    severity: "warning",
    explanation: "Module loading visible in CPU profile — likely happening on the hot path.",
    fix: "Move require() calls to the top level so they are cached after first load.",
  },
  {
    match: (f) => /(?:deepEqual|deepClone|cloneDeep|structuredClone)/.test(f.name) && f.callCount > 10,
    severity: "warning",
    explanation: "Deep object cloning or comparison called repeatedly.",
    fix: "Clone only when mutation is necessary; use shallow copy where possible.",
  },
  {
    match: (f) => f.callCount > 1000 && f.selfTimePct > 3,
    severity: "warning",
    explanation: "Very high call count with non-trivial self-time — hot inner loop.",
    fix: "Profile the call site. Consider memoization, batching, or inlining the logic.",
  },
  {
    match: (f) => f.selfTimePct > 15,
    severity: "critical",
    explanation: "Accounts for a large share of total CPU time.",
    fix: "Investigate this function directly — it is the single biggest contributor to runtime.",
  },
  {
    match: (f) => f.selfTimePct > 5,
    severity: "warning",
    explanation: "Meaningful CPU time spent here.",
    fix: "Review the implementation for unnecessary work, repeated computation, or missing caching.",
  },
  {
    match: () => true,
    severity: "info",
    explanation: "Appears in the top CPU frames.",
    fix: "Review whether this work can be reduced, cached, or moved off the critical path.",
  },
];

const memoryRules: Rule[] = [
  {
    match: (f) => /(?:Buffer\.alloc|Buffer\.allocUnsafe|Buffer\.from)/.test(f.name) && f.selfTimePct > 5,
    severity: "critical",
    explanation: "Large or frequent Buffer allocations.",
    fix: "Reuse buffers with a pool (e.g. node-pool-allocator) or stream data instead of buffering.",
  },
  {
    match: (f) => /(?:JSON\.parse|JSON\.stringify)/.test(f.name) && f.selfTimePct > 5,
    severity: "warning",
    explanation: "JSON parsing is responsible for significant heap allocations.",
    fix: "Stream large JSON with a streaming parser (e.g. JSONStream) instead of parsing all at once.",
  },
  {
    match: (f) => /(?:concat|push|spread|\.\.\.)/.test(f.name) && f.selfTimePct > 5,
    severity: "warning",
    explanation: "Array concatenation or spread causing repeated allocations.",
    fix: "Pre-allocate arrays with known length, or accumulate with push and avoid spreads in loops.",
  },
  {
    match: (f) => f.selfTimePct > 15,
    severity: "critical",
    explanation: "Responsible for a large share of heap allocations.",
    fix: "Investigate this function — it is the top allocator in the profile.",
  },
  {
    match: (f) => f.selfTimePct > 5,
    severity: "warning",
    explanation: "Significant heap allocations originating here.",
    fix: "Review whether objects can be reused, pooled, or avoided.",
  },
  {
    match: () => true,
    severity: "info",
    explanation: "Appears in the top allocation frames.",
    fix: "Review whether allocations here can be reduced or reused.",
  },
];

const ioRules: Rule[] = [
  {
    match: (f) => /(?:fs\.readFile|fs\.writeFile|fs\.appendFile)/.test(f.name) && f.selfTimePct > 10,
    severity: "critical",
    explanation: "Filesystem I/O accounting for a large share of async wait time.",
    fix: "Batch reads/writes, use streams for large files, or cache results in memory.",
  },
  {
    match: (f) => /(?:dns|lookup|resolve)/.test(f.name) && f.callCount > 5,
    severity: "warning",
    explanation: "DNS resolution called repeatedly — each lookup adds latency.",
    fix: "Cache resolved addresses or use a connection pool that handles DNS internally.",
  },
  {
    match: (f) => f.selfTimePct > 20,
    severity: "critical",
    explanation: "Dominates total async I/O wait time.",
    fix: "Parallelise with Promise.all where operations are independent, or reduce call frequency.",
  },
  {
    match: (f) => f.selfTimePct > 8,
    severity: "warning",
    explanation: "Significant async I/O wait time.",
    fix: "Check whether this operation can be parallelised, cached, or reduced in frequency.",
  },
  {
    match: () => true,
    severity: "info",
    explanation: "Appears in the top async I/O operations.",
    fix: "Review whether this I/O can be batched, cached, or parallelised.",
  },
];

export function applyRules(frame: HotFrame, mode: ProfilingMode = "cpu"): RuleMatch {
  const rules = mode === "memory" ? memoryRules : mode === "io" ? ioRules : cpuRules;
  for (const rule of rules) {
    if (rule.match(frame)) {
      return { severity: rule.severity, explanation: rule.explanation, fix: rule.fix };
    }
  }
  return { severity: "info", explanation: "Appears in the top frames.", fix: "Review this code path." };
}

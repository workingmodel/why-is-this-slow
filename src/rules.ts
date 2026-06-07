import type { HotFrame, RuleMatch } from "./types.js";

interface Rule {
  match: (frame: HotFrame) => boolean;
  severity: RuleMatch["severity"];
  explanation: string;
  fix: string;
}

const rules: Rule[] = [
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
    fix: "Use execPromise / execa and await the result instead.",
  },
  {
    match: (f) => /(?:pbkdf2Sync|scryptSync|hashSync|createHmac|createHash)/.test(f.name) && f.callCount > 5,
    severity: "critical",
    explanation: "Synchronous crypto on a frequently-called path — CPU-bound and blocks the event loop.",
    fix: "Move to pbkdf2/scrypt (async), or offload to a worker thread.",
  },
  {
    match: (f) => /(?:JSON\.parse|JSON\.stringify)/.test(f.name) && f.selfTimePct > 3,
    severity: "warning",
    explanation: "JSON serialization is consuming measurable CPU time.",
    fix: "Cache parsed results where possible, or use a faster serializer (e.g. fast-json-stringify) for hot outputs.",
  },
  {
    match: (f) => /RegExp|\.match\(|\.replace\(|\.test\(/.test(f.name) && f.callCount > 100,
    severity: "warning",
    explanation: "Regular expression called at high frequency — check for catastrophic backtracking.",
    fix: "Pre-compile the regex outside the hot path (const RE = /…/). Audit for backtracking with a tool like safe-regex.",
  },
  {
    match: (f) => /(?:\.sort\(|\.filter\(|\.map\(|\.reduce\()/.test(f.name) && f.callCount > 200,
    severity: "warning",
    explanation: "Array operation called at very high frequency inside what may be a tight loop.",
    fix: "Check whether this operation can be hoisted outside the loop, or replaced with a single-pass reduce.",
  },
  {
    match: (f) => f.callCount > 500 && f.selfTimePct > 5,
    severity: "warning",
    explanation: "High call count with significant self-time — likely a hot inner loop.",
    fix: "Profile the call site to determine if the call can be batched, memoized, or reduced.",
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
    explanation: "Appears in the top frames by CPU time.",
    fix: "Review whether this work can be reduced, cached, or moved off the critical path.",
  },
];

export function applyRules(frame: HotFrame): RuleMatch {
  for (const rule of rules) {
    if (rule.match(frame)) {
      return {
        severity: rule.severity,
        explanation: rule.explanation,
        fix: rule.fix,
      };
    }
  }
  // unreachable — last rule is a catch-all
  return {
    severity: "info",
    explanation: "Appears in the top frames by CPU time.",
    fix: "Review whether this work can be reduced, cached, or moved off the critical path.",
  };
}

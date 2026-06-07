import { applyRules } from "./rules.js";
import type { DiagnosedFrame, HotFrame, ProfilingMode } from "./types.js";

interface AnalyzeOptions {
  topN: number;
  includeDeps: boolean;
  mode: ProfilingMode;
}

export function analyze(
  frames: HotFrame[],
  { topN, includeDeps, mode }: AnalyzeOptions
): DiagnosedFrame[] {
  const filtered = includeDeps ? frames : frames.filter((f) => f.isUserCode);
  const sorted = filtered.slice().sort((a, b) => b.selfTimePct - a.selfTimePct);
  return sorted.slice(0, topN).map((frame) => ({
    ...frame,
    diagnosis: applyRules(frame, mode),
  }));
}

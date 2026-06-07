import { applyRules } from "./rules.js";
import type { DiagnosedFrame, HotFrame } from "./types.js";

interface AnalyzeOptions {
  topN: number;
  includeDeps: boolean;
}

export function analyze(
  frames: HotFrame[],
  { topN, includeDeps }: AnalyzeOptions
): DiagnosedFrame[] {
  const filtered = includeDeps
    ? frames
    : frames.filter((f) => f.isUserCode);

  const sorted = filtered
    .slice()
    .sort((a, b) => b.selfTimePct - a.selfTimePct);

  const top = sorted.slice(0, topN);

  return top.map((frame) => ({
    ...frame,
    diagnosis: applyRules(frame),
  }));
}

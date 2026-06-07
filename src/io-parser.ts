import * as fs from "node:fs";
import type { HotFrame } from "./types.js";

interface IoEntry {
  name: string;
  type: string;
  durationMs: number;
  startTime: number;
}

export function parseIoReport(reportPath: string): {
  frames: HotFrame[];
  totalMs: number;
} {
  const raw = fs.readFileSync(reportPath, "utf8");
  const entries: IoEntry[] = JSON.parse(raw);

  // Aggregate by operation name
  const agg = new Map<string, { totalMs: number; count: number }>();
  for (const e of entries) {
    const existing = agg.get(e.name);
    if (existing) {
      existing.totalMs += e.durationMs;
      existing.count += 1;
    } else {
      agg.set(e.name, { totalMs: e.durationMs, count: 1 });
    }
  }

  const totalMs = [...agg.values()].reduce((s, v) => s + v.totalMs, 0);

  const frames: HotFrame[] = [];
  for (const [name, { totalMs: selfMs, count }] of agg) {
    frames.push({
      name,
      url: "",
      lineNumber: 0,
      selfTimeMs: selfMs,
      selfTimePct: totalMs > 0 ? (selfMs / totalMs) * 100 : 0,
      callCount: count,
      isUserCode: true,
    });
  }

  return { frames, totalMs };
}

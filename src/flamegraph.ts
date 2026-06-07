import * as fs from "node:fs";
import * as path from "node:path";
import type { DiagnosedFrame } from "./types.js";

// Speedscope file format: https://github.com/jlfwong/speedscope/blob/main/src/lib/file-format-spec.ts
interface SpeedscopeFrame {
  name: string;
  file?: string;
  line?: number;
}

interface SpeedscopeEvent {
  type: "O" | "C";
  frame: number;
  at: number;
}

interface SpeedscopeProfile {
  type: "evented";
  name: string;
  unit: "milliseconds";
  startValue: number;
  endValue: number;
  events: SpeedscopeEvent[];
  frames: SpeedscopeFrame[];
}

interface SpeedscopeFile {
  $schema: string;
  shared: { frames: SpeedscopeFrame[] };
  profiles: SpeedscopeProfile[];
  name: string;
  activeProfileIndex: number;
  exporter: string;
}

export function writeFlamegraph(
  frames: DiagnosedFrame[],
  durationMs: number,
  scriptName: string,
  outDir: string
): string {
  fs.mkdirSync(outDir, { recursive: true });

  const sharedFrames: SpeedscopeFrame[] = frames.map((f) => ({
    name: f.name,
    file: f.url || undefined,
    line: f.lineNumber || undefined,
  }));

  // Build synthetic evented profile from self-time data
  // Each frame gets an open/close event proportional to its self-time
  const events: SpeedscopeEvent[] = [];
  let cursor = 0;

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i]!;
    events.push({ type: "O", frame: i, at: cursor });
    cursor += frame.selfTimeMs;
    events.push({ type: "C", frame: i, at: cursor });
  }

  const profile: SpeedscopeProfile = {
    type: "evented",
    name: scriptName,
    unit: "milliseconds",
    startValue: 0,
    endValue: durationMs,
    events,
    frames: sharedFrames,
  };

  const file: SpeedscopeFile = {
    $schema: "https://www.speedscope.app/file-format-schema.json",
    shared: { frames: sharedFrames },
    profiles: [profile],
    name: scriptName,
    activeProfileIndex: 0,
    exporter: "wm-why-is-this-slow",
  };

  const outPath = path.join(outDir, "flamegraph.json");
  fs.writeFileSync(outPath, JSON.stringify(file, null, 2));
  return outPath;
}

import * as fs from "node:fs";
import type { HotFrame } from "./types.js";

interface V8ProfileNode {
  id: number;
  callFrame: {
    functionName: string;
    url: string;
    lineNumber: number;
    columnNumber: number;
  };
  hitCount?: number;
  children?: number[];
}

interface V8Profile {
  nodes: V8ProfileNode[];
  startTime: number;
  endTime: number;
  samples?: number[];
  timeDeltas?: number[];
}

export function parseProfile(profilePath: string): {
  frames: HotFrame[];
  durationMs: number;
} {
  const raw = fs.readFileSync(profilePath, "utf8");
  const profile: V8Profile = JSON.parse(raw);

  const durationMs = (profile.endTime - profile.startTime) / 1000;

  // Build a map of nodeId → node for quick lookup
  const nodeMap = new Map<number, V8ProfileNode>();
  for (const node of profile.nodes) {
    nodeMap.set(node.id, node);
  }

  // Count self-time hits per node from samples array
  const selfHits = new Map<number, number>();
  if (profile.samples) {
    for (const id of profile.samples) {
      selfHits.set(id, (selfHits.get(id) ?? 0) + 1);
    }
  } else {
    // Fall back to hitCount on nodes
    for (const node of profile.nodes) {
      if (node.hitCount && node.hitCount > 0) {
        selfHits.set(node.id, node.hitCount);
      }
    }
  }

  const totalSamples = profile.samples?.length
    ?? profile.nodes.reduce((s, n) => s + (n.hitCount ?? 0), 0);

  const sampleIntervalMs = totalSamples > 0 ? durationMs / totalSamples : 0;

  const frames: HotFrame[] = [];

  for (const [nodeId, hits] of selfHits) {
    const node = nodeMap.get(nodeId);
    if (!node) continue;

    const { functionName, url, lineNumber } = node.callFrame;

    // Skip V8 internals and idle frames
    if (!url && (functionName === "(idle)" || functionName === "(program)" || functionName === "(garbage collector)")) {
      continue;
    }

    const selfTimeMs = hits * sampleIntervalMs;
    const selfTimePct = totalSamples > 0 ? (hits / totalSamples) * 100 : 0;
    const isUserCode = Boolean(url) && !url.includes("node_modules") && !url.startsWith("node:");

    frames.push({
      name: functionName || "(anonymous)",
      url,
      lineNumber,
      selfTimeMs,
      selfTimePct,
      callCount: hits,
      isUserCode,
    });
  }

  return { frames, durationMs };
}

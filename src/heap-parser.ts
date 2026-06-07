import * as fs from "node:fs";
import type { HotFrame } from "./types.js";

interface SamplingHeapProfileNode {
  callFrame: {
    functionName: string;
    url: string;
    lineNumber: number;
  };
  selfSize: number;
  children: SamplingHeapProfileNode[];
  id: number;
}

interface SamplingHeapProfile {
  head: SamplingHeapProfileNode;
  samples: Array<{ nodeId: number; size: number }>;
  locations: unknown[];
}

function flattenNodes(
  node: SamplingHeapProfileNode,
  out: Map<number, SamplingHeapProfileNode>
): void {
  out.set(node.id, node);
  for (const child of node.children) {
    flattenNodes(child, out);
  }
}

export function parseHeapProfile(profilePath: string): {
  frames: HotFrame[];
  totalBytes: number;
} {
  const raw = fs.readFileSync(profilePath, "utf8");
  const profile: SamplingHeapProfile = JSON.parse(raw);

  const nodeMap = new Map<number, SamplingHeapProfileNode>();
  flattenNodes(profile.head, nodeMap);

  // Accumulate self-size per node from samples
  const selfBytes = new Map<number, number>();
  for (const sample of profile.samples) {
    selfBytes.set(sample.nodeId, (selfBytes.get(sample.nodeId) ?? 0) + sample.size);
  }

  const totalBytes = [...selfBytes.values()].reduce((s, v) => s + v, 0);

  const frames: HotFrame[] = [];

  for (const [nodeId, bytes] of selfBytes) {
    const node = nodeMap.get(nodeId);
    if (!node) continue;

    const { functionName, url, lineNumber } = node.callFrame;
    if (!functionName && !url) continue;

    const selfTimePct = totalBytes > 0 ? (bytes / totalBytes) * 100 : 0;
    const isUserCode = Boolean(url) && !url.includes("node_modules") && !url.startsWith("node:");

    frames.push({
      name: functionName || "(anonymous)",
      url,
      lineNumber,
      // Repurpose selfTimeMs as selfBytes for heap mode — renderer checks mode
      selfTimeMs: bytes,
      selfTimePct,
      callCount: 1,
      isUserCode,
    });
  }

  return { frames, totalBytes };
}

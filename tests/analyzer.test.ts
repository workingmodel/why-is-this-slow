import { describe, it, expect } from "vitest";
import { analyze } from "../src/analyzer.js";
import type { HotFrame } from "../src/types.js";

function makeFrame(overrides: Partial<HotFrame> = {}): HotFrame {
  return {
    name: "myFunction",
    url: "/app/src/server.ts",
    lineNumber: 10,
    selfTimeMs: 100,
    selfTimePct: 10,
    callCount: 50,
    isUserCode: true,
    ...overrides,
  };
}

describe("analyze", () => {
  it("returns at most topN frames", () => {
    const frames = Array.from({ length: 20 }, (_, i) =>
      makeFrame({ name: `fn${i}`, selfTimePct: 20 - i })
    );
    const result = analyze(frames, { topN: 5, includeDeps: false });
    expect(result).toHaveLength(5);
  });

  it("sorts by selfTimePct descending", () => {
    const frames = [
      makeFrame({ name: "slow", selfTimePct: 40 }),
      makeFrame({ name: "fast", selfTimePct: 5 }),
      makeFrame({ name: "medium", selfTimePct: 20 }),
    ];
    const result = analyze(frames, { topN: 10, includeDeps: false });
    expect(result[0]!.name).toBe("slow");
    expect(result[1]!.name).toBe("medium");
    expect(result[2]!.name).toBe("fast");
  });

  it("excludes node_modules frames by default", () => {
    const frames = [
      makeFrame({ name: "userFn", url: "/app/src/index.ts", isUserCode: true }),
      makeFrame({ name: "depFn", url: "/app/node_modules/lodash/index.js", isUserCode: false }),
    ];
    const result = analyze(frames, { topN: 10, includeDeps: false });
    expect(result.every((f) => f.isUserCode)).toBe(true);
    expect(result).toHaveLength(1);
  });

  it("includes node_modules frames when includeDeps is true", () => {
    const frames = [
      makeFrame({ name: "userFn", isUserCode: true }),
      makeFrame({ name: "depFn", isUserCode: false }),
    ];
    const result = analyze(frames, { topN: 10, includeDeps: true });
    expect(result).toHaveLength(2);
  });

  it("attaches a diagnosis to each frame", () => {
    const frames = [makeFrame()];
    const result = analyze(frames, { topN: 10, includeDeps: false });
    expect(result[0]!.diagnosis).toBeDefined();
    expect(result[0]!.diagnosis.severity).toMatch(/^(critical|warning|info)$/);
    expect(typeof result[0]!.diagnosis.explanation).toBe("string");
    expect(typeof result[0]!.diagnosis.fix).toBe("string");
  });
});

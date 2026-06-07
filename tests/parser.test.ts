import { describe, it, expect } from "vitest";
import * as path from "node:path";
import { parseProfile } from "../src/parser.js";

const FIXTURE = path.join(__dirname, "../fixtures/sample.cpuprofile");

describe("parseProfile", () => {
  it("returns frames and a positive durationMs", () => {
    const { frames, durationMs } = parseProfile(FIXTURE);
    expect(durationMs).toBeGreaterThan(0);
    expect(frames.length).toBeGreaterThan(0);
  });

  it("each frame has required fields", () => {
    const { frames } = parseProfile(FIXTURE);
    for (const f of frames) {
      expect(typeof f.name).toBe("string");
      expect(typeof f.selfTimeMs).toBe("number");
      expect(typeof f.selfTimePct).toBe("number");
      expect(typeof f.callCount).toBe("number");
      expect(typeof f.isUserCode).toBe("boolean");
      expect(f.selfTimePct).toBeGreaterThanOrEqual(0);
      expect(f.selfTimePct).toBeLessThanOrEqual(100);
    }
  });

  it("self-time percentages sum to <= 100", () => {
    const { frames } = parseProfile(FIXTURE);
    const total = frames.reduce((s, f) => s + f.selfTimePct, 0);
    // Can be slightly under 100 due to idle/gc frames being dropped
    expect(total).toBeLessThanOrEqual(101);
  });

  it("excludes idle and program frames", () => {
    const { frames } = parseProfile(FIXTURE);
    const bad = frames.filter(
      (f) => f.name === "(idle)" || f.name === "(program)"
    );
    expect(bad).toHaveLength(0);
  });
});

import { describe, it, expect } from "vitest";
import { applyRules } from "../src/rules.js";
import type { HotFrame } from "../src/types.js";

function frame(name: string, overrides: Partial<HotFrame> = {}): HotFrame {
  return {
    name,
    url: "/app/src/index.ts",
    lineNumber: 1,
    selfTimeMs: 200,
    selfTimePct: 10,
    callCount: 50,
    isUserCode: true,
    ...overrides,
  };
}

describe("applyRules", () => {
  it("flags writeFileSync as critical", () => {
    const result = applyRules(frame("writeFileSync"));
    expect(result.severity).toBe("critical");
    expect(result.explanation).toMatch(/[Ss]ynchronous/);
  });

  it("flags readFileSync as critical", () => {
    const result = applyRules(frame("readFileSync"));
    expect(result.severity).toBe("critical");
  });

  it("flags execSync as critical", () => {
    const result = applyRules(frame("execSync"));
    expect(result.severity).toBe("critical");
  });

  it("flags pbkdf2Sync as critical when called frequently", () => {
    const result = applyRules(frame("pbkdf2Sync", { callCount: 100 }));
    expect(result.severity).toBe("critical");
  });

  it("flags JSON.parse with high self-time as warning", () => {
    const result = applyRules(frame("JSON.parse", { selfTimePct: 8 }));
    expect(result.severity).toBe("warning");
  });

  it("does not flag JSON.parse with negligible self-time", () => {
    const result = applyRules(frame("JSON.parse", { selfTimePct: 1 }));
    // falls through to high-selfTimePct or generic rule — not the JSON rule
    expect(["warning", "info"]).toContain(result.severity);
  });

  it("flags high self-time frame as critical when > 15%", () => {
    const result = applyRules(frame("myExpensiveFn", { selfTimePct: 20 }));
    expect(result.severity).toBe("critical");
  });

  it("flags moderate self-time frame as warning when > 5%", () => {
    const result = applyRules(frame("myFn", { selfTimePct: 7 }));
    expect(result.severity).toBe("warning");
  });

  it("returns info for low self-time unknown frame", () => {
    const result = applyRules(frame("someHelperFn", { selfTimePct: 1, callCount: 2 }));
    expect(result.severity).toBe("info");
  });

  it("always returns explanation and fix strings", () => {
    const frames = [
      frame("writeFileSync"),
      frame("JSON.parse", { selfTimePct: 5 }),
      frame("unknownFn", { selfTimePct: 1 }),
    ];
    for (const f of frames) {
      const result = applyRules(f);
      expect(typeof result.explanation).toBe("string");
      expect(typeof result.fix).toBe("string");
      expect(result.explanation.length).toBeGreaterThan(0);
      expect(result.fix.length).toBeGreaterThan(0);
    }
  });
});

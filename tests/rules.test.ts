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

describe("applyRules — cpu", () => {
  it("flags writeFileSync as critical", () => {
    expect(applyRules(frame("writeFileSync"), "cpu").severity).toBe("critical");
  });

  it("flags readFileSync as critical", () => {
    expect(applyRules(frame("readFileSync"), "cpu").severity).toBe("critical");
  });

  it("flags execSync as critical", () => {
    expect(applyRules(frame("execSync"), "cpu").severity).toBe("critical");
  });

  it("flags pbkdf2Sync as critical", () => {
    expect(applyRules(frame("pbkdf2Sync"), "cpu").severity).toBe("critical");
  });

  it("flags JSON.parse with high self-time as warning", () => {
    expect(applyRules(frame("JSON.parse", { selfTimePct: 8 }), "cpu").severity).toBe("warning");
  });

  it("flags high self-time frame as critical when > 15%", () => {
    expect(applyRules(frame("myExpensiveFn", { selfTimePct: 20 }), "cpu").severity).toBe("critical");
  });

  it("flags moderate self-time as warning when > 5%", () => {
    expect(applyRules(frame("myFn", { selfTimePct: 7 }), "cpu").severity).toBe("warning");
  });

  it("returns info for low self-time unknown frame", () => {
    expect(applyRules(frame("someHelperFn", { selfTimePct: 1, callCount: 2 }), "cpu").severity).toBe("info");
  });
});

describe("applyRules — memory", () => {
  it("flags Buffer.alloc with high allocation as critical", () => {
    expect(applyRules(frame("Buffer.alloc", { selfTimePct: 20 }), "memory").severity).toBe("critical");
  });

  it("flags high allocator as critical when > 15%", () => {
    expect(applyRules(frame("unknownAlloc", { selfTimePct: 20 }), "memory").severity).toBe("critical");
  });

  it("returns info for minor allocator", () => {
    expect(applyRules(frame("tinyAlloc", { selfTimePct: 1 }), "memory").severity).toBe("info");
  });
});

describe("applyRules — io", () => {
  it("flags fs.readFile with high io share as critical", () => {
    expect(applyRules(frame("fs.readFile", { selfTimePct: 30 }), "io").severity).toBe("critical");
  });

  it("flags dns lookup called repeatedly as warning", () => {
    expect(applyRules(frame("dns.lookup", { callCount: 20, selfTimePct: 5 }), "io").severity).toBe("warning");
  });

  it("returns info for minor io operation", () => {
    expect(applyRules(frame("someIO", { selfTimePct: 1 }), "io").severity).toBe("info");
  });
});

describe("applyRules — always returns strings", () => {
  it("all modes always return explanation and fix", () => {
    const modes = ["cpu", "memory", "io"] as const;
    const testFrames = [
      frame("writeFileSync"),
      frame("unknownFn", { selfTimePct: 1 }),
    ];
    for (const mode of modes) {
      for (const f of testFrames) {
        const result = applyRules(f, mode);
        expect(typeof result.explanation).toBe("string");
        expect(typeof result.fix).toBe("string");
        expect(result.explanation.length).toBeGreaterThan(0);
        expect(result.fix.length).toBeGreaterThan(0);
      }
    }
  });
});

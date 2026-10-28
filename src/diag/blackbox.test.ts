import { describe, expect, it } from "vitest";
import { classifyPrevious, createBlackBox, type KeyValue } from "./blackbox";

function memoryStorage(): KeyValue {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
}

describe("black box", () => {
  it("a session killed inside a risky step is reported with its log on the next start", () => {
    const storage = memoryStorage();
    let now = 1_000;
    const first = createBlackBox(storage, "v1", () => now);
    expect(first.start().end).toBe("clean"); // very first launch
    first.record("model.load.start", { model: "gemma-3n-e2b" });
    first.beginRisk("model.describe");
    now += 40_000;
    first.record("model.describe.start", { attempt: 1 });
    // …Android kills the process here; nothing else runs.

    const second = createBlackBox(storage, "v1", () => now + 5_000);
    const { previous, previousLog, end } = second.start();
    expect(end).toBe("crash");
    expect(previous?.risk).toBe("model.describe");
    expect(previousLog.map((c) => c.s)).toEqual(["model.load.start", "model.describe.start"]);
    expect(second.log()).toEqual([]); // the new session starts with an empty log
  });

  it("finished risky steps and background kills are told apart", () => {
    expect(classifyPrevious(null)).toBe("clean");
    const base = { id: "A", started: 0, version: "v", riskSince: 1 };
    expect(classifyPrevious({ ...base, risk: null, visible: true })).toBe("clean");
    expect(classifyPrevious({ ...base, risk: "model.load", visible: true })).toBe("crash");
    expect(classifyPrevious({ ...base, risk: "model.load", visible: false })).toBe("killed-in-background");
  });

  it("keeps only the last 80 log lines and a stable install id", () => {
    const storage = memoryStorage();
    const bb = createBlackBox(storage, "v1");
    bb.start();
    for (let i = 0; i < 100; i++) bb.record(`step ${i}`);
    expect(bb.log()).toHaveLength(80);
    expect(bb.log()[0].s).toBe("step 20");
    expect(bb.installId()).toBe(createBlackBox(storage, "v1").installId());
  });
});

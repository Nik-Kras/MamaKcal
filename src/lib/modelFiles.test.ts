import { describe, expect, it } from "vitest";

import { downloadShare, gb, MODEL_BYTES, MODEL_PARTS } from "./modelFiles";

describe("model download", () => {
  it("adds the parts up to the model file", () => {
    expect(MODEL_BYTES).toBe(3_655_827_456);
    // GitHub refuses release files of 2 GiB or more.
    for (const p of MODEL_PARTS) expect(p.bytes).toBeLessThan(2 ** 31);
  });
  it("shows gigabytes with a decimal comma", () => {
    expect(gb(MODEL_BYTES)).toBe("3,7");
    expect(gb(1_234_000_000)).toBe("1,2");
    expect(gb(0)).toBe("0,0");
    expect(gb(-5)).toBe("0,0");
  });
  it("keeps the progress share between 0 and 1", () => {
    expect(downloadShare(0, 0)).toBe(0);
    expect(downloadShare(50, 100)).toBe(0.5);
    expect(downloadShare(150, 100)).toBe(1);
  });
});

import { describe, expect, it } from "vitest";

import { isNewer, parseVersion, releaseVersion } from "./update";

describe("update check", () => {
  it("reads versions with or without v", () => {
    expect(parseVersion("v1.2.3")).toEqual([1, 2, 3]);
    expect(parseVersion("1.2")).toEqual([1, 2, 0]);
    expect(parseVersion("model-gemma-3n-e2b-int4")).toBeNull();
    expect(parseVersion(undefined)).toBeNull();
  });
  it("compares versions part by part", () => {
    expect(isNewer("v1.1.0", "1.0.0")).toBe(true);
    expect(isNewer("v1.10.0", "1.9.9")).toBe(true);
    expect(isNewer("v1.0.0", "1.0.0")).toBe(false);
    expect(isNewer("v1.0.0", "1.1.0")).toBe(false);
    expect(isNewer("nonsense", "1.0.0")).toBe(false);
    expect(isNewer("v2.0.0", null)).toBe(false);
  });
  it("only trusts releases that carry MamaKcal.apk", () => {
    expect(releaseVersion({ tag_name: "v1.1.0", assets: [{ name: "MamaKcal.apk" }] })).toBe("v1.1.0");
    expect(releaseVersion({ tag_name: "v1.1.0", assets: [{ name: "other.apk" }] })).toBeNull();
    expect(releaseVersion({ tag_name: "model-gemma", assets: [{ name: "MamaKcal.apk" }] })).toBeNull();
    expect(releaseVersion({ message: "API rate limit exceeded" })).toBeNull();
    expect(releaseVersion(null)).toBeNull();
  });
});

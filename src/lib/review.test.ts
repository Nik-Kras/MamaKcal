import { describe, expect, it } from "vitest";

import type { Item } from "../types";
import {
  blocker,
  blockerLabel,
  hasPhotoGuess,
  lineState,
  orderLines,
  pushRemoved,
  removedName,
  restoreRemoved,
  UNDO_KEEP,
} from "./review";

const line = (key: string, over: Partial<Item> = {}): Item => ({
  key,
  foodId: `f-${key}`,
  name: `Name ${key}`,
  kcal100: 100,
  unit: "g",
  amount: "100",
  weighed: false,
  ...over,
});

describe("lineState", () => {
  it("tells unknown, empty, guessed and weighed lines apart", () => {
    expect(lineState(line("a", { unknown: true, amount: "150" }))).toBe("unknown");
    expect(lineState(line("a", { amount: "" }))).toBe("empty");
    expect(lineState(line("a", { amount: "0", weighed: true }))).toBe("empty");
    expect(lineState(line("a", { amount: "150" }))).toBe("guess");
    expect(lineState(line("a", { amount: "150", weighed: true }))).toBe("weighed");
  });
});

describe("orderLines", () => {
  it("puts unknown lines first and keeps the rest in order", () => {
    const items = [line("a"), line("b", { unknown: true }), line("c"), line("d", { unknown: true })];
    expect(orderLines(items, new Set()).map((it) => it.key)).toEqual(["b", "d", "a", "c"]);
  });
  it("keeps a line that was unknown first after she picks a food for it", () => {
    const items = [line("a"), line("b"), line("c")];
    expect(orderLines(items, new Set(["c"])).map((it) => it.key)).toEqual(["c", "a", "b"]);
  });
  it("returns the same list when nothing needs a pick", () => {
    const items = [line("a"), line("b")];
    expect(orderLines(items, new Set())).toBe(items);
  });
});

describe("blocker", () => {
  it("asks for a product on an empty meal", () => {
    expect(blocker([])).toEqual({ kind: "add" });
    expect(blockerLabel({ kind: "add" })).toBe("Додайте продукт");
  });
  it("sends her to the first unknown line before anything else", () => {
    const b = blocker([line("u1", { unknown: true }), line("e", { amount: "" }), line("u2", { unknown: true })]);
    expect(b).toEqual({ kind: "unknown", key: "u1", count: 2 });
    expect(blockerLabel(b!)).toBe("Оберіть 2 продукти");
    expect(blockerLabel({ kind: "unknown", key: "x", count: 1 })).toBe("Оберіть продукт");
    expect(blockerLabel({ kind: "unknown", key: "x", count: 5 })).toBe("Оберіть 5 продуктів");
  });
  it("blocks an empty or zero weight instead of dropping the line", () => {
    const b = blocker([line("a"), line("b", { amount: "0", weighed: true }), line("c", { amount: "" })]);
    expect(b).toEqual({ kind: "amount", key: "b", count: 2 });
    expect(blockerLabel(b!)).toBe("Впишіть вагу");
  });
  it("lets a complete meal be logged", () => {
    expect(blocker([line("a"), line("b", { unit: "pcs", amount: "2", pcGrams: 50 })])).toBeNull();
  });
});

describe("hasPhotoGuess", () => {
  it("is true only for an unweighed number the photo model gave", () => {
    expect(hasPhotoGuess([line("a", { aiName: "rice" })])).toBe(true);
    expect(hasPhotoGuess([line("a", { aiName: "rice", weighed: true })])).toBe(false);
    expect(hasPhotoGuess([line("a")])).toBe(false);
    expect(hasPhotoGuess([line("a", { aiName: "stew", unknown: true })])).toBe(false);
    expect(hasPhotoGuess([line("a", { aiName: "rice", amount: "" })])).toBe(false);
  });
});

describe("undo of removed lines", () => {
  it("keeps the newest few removals", () => {
    let stack = pushRemoved([], { item: line("a"), index: 0 });
    stack = pushRemoved(stack, { item: line("b"), index: 1 });
    expect(stack.map((r) => r.item.key)).toEqual(["a", "b"]);
    for (let i = 0; i < UNDO_KEEP + 2; i++) stack = pushRemoved(stack, { item: line(`x${i}`), index: 0 });
    expect(stack).toHaveLength(UNDO_KEEP);
    expect(stack[stack.length - 1].item.key).toBe(`x${UNDO_KEEP + 1}`);
  });
  it("puts lines back where they were, newest first", () => {
    const all = [line("a"), line("b"), line("c"), line("d")];
    // Remove b (index 1), then d (index 2 of what was left).
    const r1 = { item: all[1], index: 1 };
    const r2 = { item: all[3], index: 2 };
    const left = [all[0], all[2]];
    const back = restoreRemoved(restoreRemoved(left, r2), r1);
    expect(back.map((it) => it.key)).toEqual(["a", "b", "c", "d"]);
  });
  it("does not put a line back twice", () => {
    const items = [line("a"), line("b")];
    expect(restoreRemoved(items, { item: items[1], index: 0 })).toBe(items);
  });
  it("names the removed line in lower case, never in English", () => {
    expect(removedName(line("a", { name: "Печена картопля" }))).toBe("печена картопля");
    expect(removedName(line("a", { name: "Mixed vegetables", unknown: true }))).toBe("невідомий продукт");
  });
});

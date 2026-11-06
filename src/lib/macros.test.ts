import { describe, expect, it } from "vitest";

import { FOODS } from "../data/foods";
import type { Item, Meal } from "../types";
import { fmtG, macroShort } from "./format";
import { fillMacros, hasMacros, itemMacros, labelMacros, macroTargets, mealMacros } from "./nutrition";
import { dayMessage, dayReport, macroLine } from "./share";

/** "_" stands for a non-breaking space. */
const nb = (s: string) => s.replace(/_/g, " ");

const buckwheat = FOODS.find((f) => f.id === "buckwheat-cooked")!;

const line = (over: Partial<Item>): Item => ({
  key: "k",
  name: "x",
  kcal100: 100,
  unit: "g",
  amount: "100",
  weighed: true,
  ...over,
});

describe("macro targets follow her kcal norm", () => {
  it("splits the norm 20 / 30 / 50 % and gives 14 g fibre per 1 000 kcal", () => {
    expect(macroTargets(1800)).toEqual({ p: 90, f: 60, c: 225, fib: 25 });
    expect(macroTargets(1500)).toEqual({ p: 75, f: 50, c: 188, fib: 21 });
    expect(macroTargets(2400)).toEqual({ p: 120, f: 80, c: 300, fib: 34 });
  });
  it("adds back up to the norm", () => {
    for (const norm of [1000, 1650, 1800, 2200, 4000]) {
      const t = macroTargets(norm);
      expect(Math.abs(t.p * 4 + t.f * 9 + t.c * 4 - norm)).toBeLessThan(10);
    }
  });
});

describe("macros of a meal", () => {
  it("scales a food's per-100 g macros by the weight, grams or pieces", () => {
    const m = itemMacros(line({ macros100: { p: 10, f: 5, c: 20, fib: 2 }, amount: "250" }));
    expect(m).toEqual({ p: 25, f: 12.5, c: 50, fib: 5 });
    const pcs = itemMacros(line({ macros100: { p: 10, f: 5, c: 20, fib: 2 }, unit: "pcs", amount: "2", pcGrams: 50 }));
    expect(pcs).toEqual({ p: 10, f: 5, c: 20, fib: 2 });
  });
  it("counts a product without macros as zero", () => {
    const items = [line({ macros100: { p: 10, f: 0, c: 0, fib: 0 } }), line({})];
    expect(mealMacros(items)).toEqual({ p: 10, f: 0, c: 0, fib: 0 });
    expect(hasMacros(items)).toBe(true);
    expect(hasMacros([line({})])).toBe(false);
  });
});

describe("macro formatting", () => {
  it("shows whole grams from 10 up and one decimal below", () => {
    expect([0, 0.04, 0.5, 7, 7.44, 9.96, 10.4, 152.5].map(fmtG)).toEqual(["0", "0", "0,5", "7", "7,4", "10", "10", "153"]);
  });
  it("writes the short line, with or without fibre", () => {
    const m = { p: 24.2, f: 22, c: 34.4, fib: 0.5 };
    expect(macroShort(m)).toBe(nb("Б_24 · Ж_22 · В_34 · Кл_0,5_г"));
    expect(macroShort(m, false)).toBe(nb("Б_24 · Ж_22 · В_34_г"));
  });
});

describe("label macros of a new product", () => {
  it("is optional", () => {
    expect(labelMacros({ p: "", f: "", c: "", fib: "" })).toBeUndefined();
  });
  it("reads decimals, a blank among filled ones is 0", () => {
    expect(labelMacros({ p: "7", f: "1,5", c: "41", fib: "" })).toEqual({ p: 7, f: 1.5, c: 41, fib: 0 });
  });
  it("refuses more than 100 g in 100 g", () => {
    expect(labelMacros({ p: "50", f: "30", c: "30", fib: "" })).toBeNull();
  });
});

describe("meals logged before macros", () => {
  const meal = (items: Item[]): Meal => ({ id: "m", date: "2026-11-01", time: "13:00", dishName: "x", items, createdAt: 1 });
  const lookup = (id: string) => FOODS.find((f) => f.id === id)?.macros100;
  it("get their foods' macros from the list", () => {
    const [m] = fillMacros([meal([line({ foodId: "buckwheat-cooked" }), line({ foodId: "gone" }), line({})])], lookup);
    expect(m.items[0].macros100).toEqual(buckwheat.macros100);
    expect(m.items[1].macros100).toBeUndefined();
    expect(m.items[2].macros100).toBeUndefined();
  });
  it("leaves lines that have them, and returns the same list when nothing changes", () => {
    const own = { p: 1, f: 1, c: 1, fib: 1 };
    const meals = [meal([line({ foodId: "buckwheat-cooked", macros100: own })])];
    expect(fillMacros(meals, lookup)).toBe(meals);
  });
});

describe("the food list", () => {
  it("has protein, fat, carbs and fibre for every food, adding up to its kcal", () => {
    for (const f of FOODS) {
      const m = f.macros100!;
      expect(m, f.id).toBeDefined();
      for (const v of [m.p, m.f, m.c, m.fib]) expect(v >= 0 && v <= 100, f.id).toBe(true);
      expect(m.p + m.f + m.c, f.id).toBeLessThanOrEqual(100);
      // Atwater 4/9/4; USDA's carbs include fibre and some foods use specific factors, so allow 20 %.
      if (f.kcal100 >= 40) expect(Math.abs(m.p * 4 + m.f * 9 + m.c * 4 - f.kcal100) / f.kcal100, f.id).toBeLessThan(0.2);
    }
  });
  it("buckwheat matches USDA", () => {
    expect(buckwheat.macros100).toEqual({ p: 3.4, f: 0.6, c: 19.9, fib: 2.7 });
  });
});

describe("the shared day message", () => {
  const m100 = { p: 10, f: 5, c: 20, fib: 2 };
  it("adds the day's macros and each meal's", () => {
    const meals: Meal[] = [
      { id: "a", date: "2026-11-06", time: "08:20", dishName: "Каша", createdAt: 1, items: [line({ name: "Каша", macros100: m100, amount: "200" })] },
    ];
    const text = dayMessage(dayReport(meals, "2026-11-06", 1800));
    expect(text).toContain(`\n${macroLine({ p: 20, f: 10, c: 40, fib: 4 })}\n`);
    expect(text).toContain(nb("**Каша** — 200 ккал\nБ_20 · Ж_10 · В_40 · Кл_4_г\n"));
    expect(macroLine({ p: 58, f: 52, c: 152, fib: 14 })).toBe(nb("Білки 58_г · Жири 52_г · Вуглеводи 152_г · Клітковина 14_г"));
  });
  it("leaves them out when nothing has macros", () => {
    const meals: Meal[] = [{ id: "a", date: "2026-11-06", time: "08:20", dishName: "Своє", createdAt: 1, items: [line({ name: "Своє" })] }];
    const r = dayReport(meals, "2026-11-06", 1800);
    expect(r.macros).toBeNull();
    expect(dayMessage(r)).not.toContain("Білки");
  });
});

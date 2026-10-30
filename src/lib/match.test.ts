import { describe, expect, it } from "vitest";

import { FOODS } from "../data/foods";
import vectors from "./__fixtures__/match-vectors.json";
import { activeCorrections, learnFromMeal } from "./learn";
import { IGNORE, Matcher, nameKey } from "./match";
import { parseLines, toItems } from "./recognition";

let n = 0;
const key = () => "k" + n++;
const matcher = new Matcher(FOODS);

describe("matcher", () => {
  it("agrees with the benchmarked Python matcher on every name the model produced", () => {
    // Fixture: bench/match.py run over all model answers in bench/data/out (291 names).
    const diffs = Object.entries(vectors as Record<string, string | null>)
      .map(([name, want]) => [name, want, matcher.match(name)] as const)
      .filter(([, want, got]) => want !== got);
    expect(diffs).toEqual([]);
  });

  it("uses her earlier corrections first", () => {
    // The model calls her cutlets "chicken"; she corrected it once.
    const m = new Matcher(FOODS, { [nameKey("Fried chicken patty")]: "chicken-kyiv" });
    expect(new Matcher(FOODS).match("Fried chicken patty")).not.toBe("chicken-kyiv");
    expect(m.match("fried chicken patties")).toBe("chicken-kyiv");
    // A correction pointing at a food that no longer exists is ignored.
    expect(new Matcher(FOODS, { [nameKey("Rice")]: "gone" }).match("Rice")).toBe("white-rice-cooked");
  });

  it("suggests similar foods for a swap", () => {
    expect(matcher.similar("Pork chop")).toContain("pork-chop-cooked");
    expect(matcher.similar("Pork chop")).toContain("pork-sausage");
    expect(matcher.similar("zzz")).toEqual([]);
  });

  it("does not send a plain food word to a dish that only lists it as an alias", () => {
    expect(matcher.match("Fried potatoes")).toBe("potato-boiled");
    expect(matcher.match("Potatoes")).toBe("potato-boiled");
  });

  it("suggests pork foods before unrelated dishes for pork", () => {
    const s = matcher.similar("Pork chop");
    expect(s[0]).toBe("pork-chop-cooked");
    expect(s.slice(0, 3).every((id) => id.includes("pork"))).toBe(true);
  });

  it("falls back to foods sharing any word for an unknown name", () => {
    const s = matcher.similar("Mixed vegetables");
    expect(s).toContain("mixed-greens");
    expect(s.length).toBeGreaterThanOrEqual(3);
    expect(matcher.similar("Fried potatoes")[0]).toBe("potato-boiled");
  });
});

describe("parseLines", () => {
  it("reads the line format, with or without units, bullets and ranges", () => {
    expect(parseLines("Carrots | 150g\n* **Rice** | 100 grams\n2. Eggs: 30-40g\nnothing here\nTomato | Unknown")).toEqual([
      ["Carrots", 150],
      ["Rice", 100],
      ["Eggs", 35],
      ["Tomato", null],
    ]);
  });
});

describe("toItems", () => {
  it("maps names onto the list, in the food's own unit", () => {
    const r = toItems("Rice | 150g\nScrambled eggs | 100g\nBorscht | 300", FOODS, matcher, key);
    expect(r.isFood).toBe(true);
    expect(r.items.map((i) => [i.foodId, i.unit, i.amount, i.weighed, i.aiName])).toEqual([
      ["white-rice-cooked", "g", "150", false, "Rice"],
      ["eggs-whole", "pcs", "2", false, "Scrambled eggs"],
      ["borscht", "g", "300", false, "Borscht"],
    ]);
    expect(r.items[0].name).toBe("Білий рис (варений)");
  });

  it("keeps a name it can't place as a line she has to resolve", () => {
    const r = toItems("Mixed vegetables | 80g", FOODS, matcher, key);
    expect(r.items[0]).toMatchObject({ unknown: true, kcal100: 0, aiName: "Mixed vegetables", amount: "80" });
    expect(r.items[0].foodId).toBeUndefined();
  });

  it("drops seasonings and merges two lines for the same food", () => {
    const r = toItems("Red onion | 20g\nStrawberries | 30g\nRaspberries | 20g\nBlueberries | 10g", FOODS, matcher, key);
    expect(matcher.match("Red onion")).toBe(IGNORE);
    expect(r.items.map((i) => [i.foodId, i.amount])).toEqual([
      ["strawberries", "30"],
      ["berries-mix", "20"],
      ["blueberries", "10"],
    ]);
    const merged = toItems("Rice | 100\nWhite rice | 50", FOODS, matcher, key);
    expect(merged.items.map((i) => [i.foodId, i.amount])).toEqual([["white-rice-cooked", "150"]]);
  });

  it("rounds grams to 5, clamps them, and reports no food for an empty answer", () => {
    const r = toItems("Rice | 99999\nBread | 2", FOODS, matcher, key);
    expect(r.items.map((i) => i.amount)).toEqual(["2000", "5"]);
    expect(toItems("I can't see any food here.", FOODS, matcher, key)).toEqual({ isFood: false, items: [] });
  });
});

describe("review fixes", () => {
  it("keeps hyphenated names whole", () => {
    expect(parseLines("Deep-fried chicken | 120 g\nStir-fried rice - 200g\nEggs: 30-40g")).toEqual([
      ["Deep-fried chicken", 120],
      ["Stir-fried rice", 200],
      ["Eggs", 35],
    ]);
  });

  it("never sends a name without English words to one of her own products", () => {
    const custom = { id: "fmine1", name: "Мій пиріг", kcal100: 300, custom: true };
    const m = new Matcher([custom, ...FOODS]);
    expect(m.match("Борщ")).toBeNull();
    expect(m.match("|---|---|")).toBeNull();
    expect(m.match("123")).toBeNull();
    expect(toItems("Борщ | 300", [custom, ...FOODS], m, key).items[0]).toMatchObject({ unknown: true });
    // …but her correction can still point a model name at it.
    expect(new Matcher([custom, ...FOODS], { [nameKey("Pie")]: "fmine1" }).match("Pie")).toBe("fmine1");
  });

  it("adds grams before converting merged lines to pieces", () => {
    const r = toItems("Fried eggs | 10g\nEgg | 10g", FOODS, matcher, key);
    expect(r.items.map((i) => [i.foodId, i.unit, i.amount])).toEqual([["eggs-whole", "pcs", "1"]]);
  });

  it("records what the model's name was matched to", () => {
    const r = toItems("Rice | 100\nMixed vegetables | 50", FOODS, matcher, key);
    expect(r.items[0]).toMatchObject({ aiName: "Rice", aiFoodId: "white-rice-cooked", foodId: "white-rice-cooked" });
    expect(r.items[1].aiFoodId).toBeUndefined();
  });
});

describe("learning from her corrections", () => {
  const line = (aiName: string, aiFoodId: string | undefined, foodId: string) =>
    ({ key: "x", aiName, aiFoodId, foodId, name: "", kcal100: 0, unit: "g", amount: "100", weighed: true }) as const;

  it("applies a correction made in two logged meals in a row", () => {
    let learned = learnFromMeal({}, [line("Chicken", "chicken-breast-cooked", "pork-chop-cooked")]);
    expect(activeCorrections(learned)).toEqual({});
    learned = learnFromMeal(learned, [line("chicken", "chicken-breast-cooked", "pork-chop-cooked")]);
    expect(activeCorrections(learned)).toEqual({ chicken: "pork-chop-cooked" });
  });

  it("forgets a pending correction when she keeps the model's match", () => {
    let learned = learnFromMeal({}, [line("Chicken", "chicken-breast-cooked", "pork-chop-cooked")]);
    learned = learnFromMeal(learned, [line("Chicken", "chicken-breast-cooked", "chicken-breast-cooked")]);
    learned = learnFromMeal(learned, [line("Chicken", "chicken-breast-cooked", "pork-chop-cooked")]);
    expect(activeCorrections(learned)).toEqual({});
  });

  it("treats naming an unrecognised food like any other correction, and keeps an applied one she accepts", () => {
    let learned = learnFromMeal({}, [line("Mixed vegetables", undefined, "borscht")]);
    expect(activeCorrections(learned)).toEqual({});
    // A different pick the next time starts over.
    learned = learnFromMeal(learned, [line("Mixed vegetables", undefined, "mixed-greens")]);
    expect(activeCorrections(learned)).toEqual({});
    learned = learnFromMeal(learned, [line("Mixed vegetables", undefined, "mixed-greens")]);
    expect(activeCorrections(learned)).toEqual({ "mixed vegetable": "mixed-greens" });
    // Next time the matcher already gives mixed-greens; she keeps it.
    learned = learnFromMeal(learned, [line("Mixed vegetables", "mixed-greens", "mixed-greens")]);
    expect(activeCorrections(learned)).toEqual({ "mixed vegetable": "mixed-greens" });
  });

  it("ignores lines she added herself", () => {
    expect(learnFromMeal({}, [{ key: "x", foodId: "apple", name: "", kcal100: 0, unit: "g", amount: "1", weighed: true }])).toEqual({});
  });
});

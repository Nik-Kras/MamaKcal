import { describe, expect, it } from "vitest";

import { FOODS } from "../data/foods";
import { dayLabel, fmt, mealTitle, plural, todayISO } from "./format";
import { cleanAmount, convertAmount, itemKcal, mealKcal, parseAmount, stepPieces } from "./nutrition";
import { searchFoods } from "./search";

describe("format", () => {
  it("separates thousands with a non-breaking space", () => {
    expect(fmt(1800)).toBe("1 800");
    expect(fmt(984)).toBe("984");
    expect(fmt(12345.6)).toBe("12 346");
  });
  it("picks Ukrainian plural forms", () => {
    const f: [string, string, string] = ["продукт", "продукти", "продуктів"];
    expect([1, 2, 4, 5, 11, 12, 21, 22, 25].map((x) => plural(x, f))).toEqual([
      "продукт", "продукти", "продукти", "продуктів", "продуктів", "продуктів", "продукт", "продукти", "продуктів",
    ]);
  });
  it("labels the day and the meal", () => {
    const d = new Date(2026, 9, 28, 13, 20);
    expect(dayLabel(d)).toBe("Середа, 28 жовтня");
    expect(todayISO(d)).toBe("2026-10-28");
    expect(mealTitle("08:15")).toBe("Сніданок");
    expect(mealTitle("13:20")).toBe("Обід");
    expect(mealTitle("19:00")).toBe("Вечеря");
    expect(mealTitle("23:30")).toBe("Перекус");
  });
});

describe("nutrition", () => {
  it("counts grams and pieces", () => {
    expect(itemKcal({ unit: "g", amount: "200", kcal100: 192 })).toBe(384);
    expect(itemKcal({ unit: "pcs", amount: "2", kcal100: 196, pcGrams: 46 })).toBe(180);
    expect(itemKcal({ unit: "g", amount: "", kcal100: 192 })).toBe(0);
  });
  it("sums rounded rows so the total matches what is shown", () => {
    expect(
      mealKcal([
        { unit: "g", amount: "170", kcal100: 192 },
        { unit: "pcs", amount: "2", kcal100: 196, pcGrams: 46 },
        { unit: "g", amount: "130", kcal100: 270 },
        { unit: "g", amount: "100", kcal100: 15 },
      ]),
    ).toBe(326 + 180 + 351 + 15);
  });
  it("keeps typed amounts to 4 digits without junk", () => {
    expect(cleanAmount("150 г")).toBe("150");
    expect(cleanAmount("0150")).toBe("150");
    expect(cleanAmount("1 000")).toBe("1000");
    expect(cleanAmount("123456")).toBe("1234");
    expect(cleanAmount("")).toBe("");
  });
  it("keeps one decimal separator and one decimal digit", () => {
    expect(cleanAmount("1,5")).toBe("1,5");
    expect(cleanAmount("1.5")).toBe("1,5");
    expect(cleanAmount("0,5")).toBe("0,5");
    expect(cleanAmount(",5")).toBe("0,5");
    expect(cleanAmount("12,34")).toBe("12,3");
    expect(cleanAmount("150")).toBe("150");
    expect(cleanAmount("0150")).toBe("150");
    expect(cleanAmount("-5")).toBe("5");
    expect(cleanAmount("1,2,3")).toBe("1,2");
    expect(cleanAmount("12345,6")).toBe("1234,6");
  });
  it("reads decimals and counts them", () => {
    expect(parseAmount("1,5")).toBe(1.5);
    expect(parseAmount("0,5")).toBe(0.5);
    expect(parseAmount("150")).toBe(150);
    expect(parseAmount("")).toBe(0);
    expect(itemKcal({ unit: "g", amount: "12,5", kcal100: 100 })).toBe(13);
    expect(itemKcal({ unit: "pcs", amount: "1,5", kcal100: 196, pcGrams: 46 })).toBe(135);
  });
  it("steps from a fractional count to the next whole number", () => {
    expect(stepPieces("1,5", 1)).toBe("2");
    expect(stepPieces("1,5", -1)).toBe("1");
    expect(stepPieces("0,5", -1)).toBe("1");
    expect(stepPieces("", 1)).toBe("1");
  });
  it("steps pieces within 1…30", () => {
    expect(stepPieces("1", -1)).toBe("1");
    expect(stepPieces("2", 1)).toBe("3");
    expect(stepPieces("30", 1)).toBe("30");
  });
  it("converts between grams and pieces", () => {
    expect(convertAmount("100", { unit: "g" }, { unit: "pcs", pcGrams: 50 })).toBe("2");
    expect(convertAmount("3", { unit: "pcs", pcGrams: 50 }, { unit: "g" })).toBe("150");
    expect(convertAmount("150", { unit: "g" }, { unit: "g" })).toBe("150");
  });
});

describe("search", () => {
  it("finds by Ukrainian name, Ukrainian alias and English name", () => {
    expect(searchFoods(FOODS, "гречк")[0].id).toBe("buckwheat-cooked");
    expect(searchFoods(FOODS, "борщ")[0].id).toBe("borscht");
    expect(searchFoods(FOODS, "творог").map((f) => f.id)).toContain("tvorog-9");
    expect(searchFoods(FOODS, "olivier")[0].id).toBe("olivier-salad");
    expect(new Set(searchFoods(FOODS, "вареники").map((f) => f.id).slice(0, 3))).toEqual(new Set(["varenyky-potato", "varenyky-cottage-cheese", "varenyky-cherry"]));
  });
});

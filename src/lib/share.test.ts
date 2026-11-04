import { describe, expect, it } from "vitest";

import type { Item, Meal } from "../types";
import {
  addDays,
  amountsText,
  CAPTION_MAX,
  clipCaption,
  dayReport,
  dayText,
  emptyDaysText,
  normLine,
  overText,
  weekReport,
  weekText,
} from "./share";

const item = (name: string, kcal100: number, amount: string, unit: "g" | "pcs" = "g", pcGrams?: number): Item => ({
  key: name,
  foodId: name,
  name,
  kcal100,
  amount,
  unit,
  pcGrams,
  weighed: true,
});

/** "_" stands for a non-breaking space. */
const nb = (s: string) => s.replace(/_/g, "\u00a0");

let n = 0;
const meal = (date: string, time: string, dishName: string, items: Item[]): Meal => ({
  id: `m${++n}`,
  date,
  time,
  dishName,
  items,
  createdAt: n,
});

const syrnyky = [item("Сирники", 257, "3", "pcs", 50), item("Сметана 15%", 159, "30")]; // 386 + 48
const borshch = [item("Борщ червоний (з м'ясом)", 46, "400"), item("Хліб житній", 225, "60")]; // 184 + 135

describe("share: a day", () => {
  const meals = [
    meal("2026-11-04", "13:10", "Борщ з хлібом", borshch),
    meal("2026-11-04", "08:20", "Сирники зі сметаною", syrnyky),
    meal("2026-11-03", "19:00", "Вчорашня вечеря", [item("Кефір 2,5%", 50, "250")]),
  ];

  it("lists that day's meals in time order with their kcal", () => {
    const r = dayReport(meals, "2026-11-04", 1800);
    expect(r.label).toBe("Середа, 4 листопада");
    expect(r.meals.map((m) => [m.title, m.time, m.dish, m.kcal])).toEqual([
      ["Сніданок", "08:20", "Сирники зі сметаною", 434],
      ["Обід", "13:10", "Борщ з хлібом", 319],
    ]);
    expect(r.meals[0].amounts).toBe(nb("Сирники_3_шт_· Сметана 15%_30_г"));
    expect(r.eaten).toBe(753);
  });

  it("writes the caption", () => {
    expect(dayText(dayReport(meals, "2026-11-04", 1800))).toBe(
      [
        "Середа, 4 листопада: 753 з 1 800 ккал",
        "",
        "Сніданок 08:20 — Сирники зі сметаною, 434 ккал",
        "Обід 13:10 — Борщ з хлібом, 319 ккал",
      ].join("\n"),
    );
  });

  it("says so when nothing was logged", () => {
    const r = dayReport(meals, "2026-11-02", 1800);
    expect(r.meals).toEqual([]);
    expect(dayText(r)).toBe("Понеділок, 2 листопада: нічого не записано");
  });

  it("shows pieces and decimal amounts as she typed them", () => {
    expect(amountsText([item("Вареники з картоплею", 176, "1,5", "pcs", 25), item("Олія", 884, "10")])).toBe(
      nb("Вареники з картоплею_1,5_шт_· Олія_10_г"),
    );
  });

  it("states the gap to the target without judging it", () => {
    expect(normLine(1314, 1800)).toBe("До норми: 486 ккал");
    expect(normLine(2050, 1800)).toBe("Понад норму: 250 ккал");
  });
});

describe("share: a week", () => {
  const day = (date: string, kcal: number) => meal(date, "12:00", "Обід", [item("x", 100, String(kcal))]);
  const meals = [
    day("2026-10-29", 1650),
    day("2026-10-30", 1920),
    day("2026-11-01", 2050),
    day("2026-11-02", 1560),
    day("2026-11-03", 1207),
    day("2026-11-04", 1314),
    day("2026-10-28", 3000), // 8 days ago: not in this week
  ];
  const r = weekReport(meals, "2026-11-04", 1800);

  it("covers the 7 days ending today, across a month", () => {
    expect(r.label).toBe("29 жовтня – 4 листопада");
    expect(r.days.map((d) => d.short)).toEqual(["Чт", "Пт", "Сб", "Нд", "Пн", "Вт", "Ср"]);
    expect(r.days.map((d) => d.kcal)).toEqual([1650, 1920, 0, 2050, 1560, 1207, 1314]);
  });

  it("averages only the days with records", () => {
    expect(r.logged).toBe(6);
    expect(r.average).toBe(1617);
    expect(overText(r)).toBe("п’ятниця (+120), неділя (+250)");
    expect(emptyDaysText(r)).toBe("Субота");
  });

  it("writes the caption", () => {
    expect(weekText(r)).toBe(
      [
        "29 жовтня – 4 листопада: у середньому 1 617 ккал на день (норма 1 800)",
        "",
        "Чт, 29 жовтня — 1 650 ккал",
        "Пт, 30 жовтня — 1 920 ккал",
        "Сб, 31 жовтня — нічого не записано",
        "Нд, 1 листопада — 2 050 ккал",
        "Пн, 2 листопада — 1 560 ккал",
        "Вт, 3 листопада — 1 207 ккал",
        "Ср, 4 листопада — 1 314 ккал",
      ].join("\n"),
    );
  });

  it("shortens the range within one month, and handles an empty week", () => {
    const empty = weekReport([], "2026-11-10", 1800);
    expect(empty.label).toBe("4–10 листопада");
    expect(empty.average).toBeNull();
    expect(overText(empty)).toBe("");
    expect(weekText(empty)).toBe("4–10 листопада: нічого не записано");
  });
});

describe("share: dates and caption length", () => {
  it("steps days across clock changes, months and years", () => {
    expect(addDays("2026-10-26", -1)).toBe("2026-10-25");
    expect(addDays("2026-10-25", 1)).toBe("2026-10-26");
    expect(addDays("2026-03-29", 1)).toBe("2026-03-30");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("cuts a caption over Telegram's limit at a line break", () => {
    const long = Array.from({ length: 40 }, (_, i) => `Вечеря 19:${String(i).padStart(2, "0")} — Дуже довга назва страви, 500 ккал`).join("\n");
    const cut = clipCaption(long);
    expect(long.length).toBeGreaterThan(CAPTION_MAX);
    expect(cut.length).toBeLessThanOrEqual(CAPTION_MAX);
    expect(cut.endsWith("\n…")).toBe(true);
    expect(cut.split("\n").slice(0, -1).every((l) => long.split("\n").includes(l))).toBe(true);
    expect(clipCaption("коротко")).toBe("коротко");
  });
});

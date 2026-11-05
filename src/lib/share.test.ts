import { describe, expect, it } from "vitest";

import type { Item, Meal } from "../types";
import {
  addDays,
  amountText,
  boldParts,
  CAPTION_MAX,
  clipCaption,
  dayMessage,
  dayPhotos,
  dayReport,
  emptyDaysText,
  MESSAGE_MAX,
  normLine,
  overText,
  weekReport,
  plain,
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
const meal = (date: string, time: string, dishName: string, items: Item[], photo?: string): Meal => ({
  id: `m${++n}`,
  date,
  time,
  dishName,
  items,
  photo,
  createdAt: n,
});

const syrnyky = [item("Сирники", 257, "3", "pcs", 50), item("Сметана 15%", 159, "30")]; // 386 + 48
const borshch = [item("Борщ червоний (з м'ясом)", 46, "400"), item("Хліб житній", 225, "60")]; // 184 + 135

describe("share: a day", () => {
  const meals = [
    meal("2026-11-04", "13:10", "Борщ з хлібом", borshch, "file:///photos/b.jpg"),
    meal("2026-11-04", "08:20", "Сирники зі сметаною", syrnyky, "file:///photos/s.jpg"),
    meal("2026-11-04", "16:30", "Яблуко", [{ ...item("Яблуко", 52, "180"), weighed: false }]),
    meal("2026-11-04", "19:40", "Кефір", [item("Кефір 2,5%", 50, "250")], "file:///photos/k.jpg"),
    meal("2026-11-03", "19:00", "Вчорашня вечеря", [item("Кефір 2,5%", 50, "250")], "file:///photos/y.jpg"),
  ];

  it("lists that day's meals in time order, with a line and kcal per product", () => {
    const r = dayReport(meals, "2026-11-04", 1800);
    expect(r.label).toBe("Середа, 4 листопада");
    expect(r.meals.map((m) => [m.title, m.time, m.dish, m.kcal])).toEqual([
      ["Сніданок", "08:20", "Сирники зі сметаною", 434],
      ["Обід", "13:10", "Борщ з хлібом", 319],
      ["Вечеря", "16:30", "Яблуко", 94],
      ["Вечеря", "19:40", "Кефір", 125],
    ]);
    expect(r.meals[0].items).toEqual([
      { name: "Сирники", amount: nb("3_шт_(150_г)"), kcal: 386, guess: false },
      { name: "Сметана 15%", amount: nb("30_г"), kcal: 48, guess: false },
    ]);
    expect(r.eaten).toBe(972);
  });

  it("numbers the photos in album order, skipping meals without one", () => {
    const r = dayReport(meals, "2026-11-04", 1800);
    expect(r.meals.map((m) => m.photoNo)).toEqual([1, 2, undefined, 3]);
    expect(dayPhotos(r)).toEqual(["file:///photos/s.jpg", "file:///photos/b.jpg", "file:///photos/k.jpg"]);
  });

  it("writes the message: a rule between meals and a line per product", () => {
    expect(dayMessage(dayReport(meals, "2026-11-04", 1800))).toBe(
      nb(
        [
          "📅 **Середа, 4 листопада**",
          "З’їдено **972 ккал** з 1_800",
          "До норми: 828 ккал",
          "",
          "━━━━━━━━━━━━━━━━",
          "🍳 **Сніданок · 08:20** · фото 1",
          "**Сирники зі сметаною** — 434 ккал",
          "• Сирники — 3_шт_(150_г)_·_386_ккал",
          "• Сметана 15% — 30_г_·_48_ккал",
          "",
          "━━━━━━━━━━━━━━━━",
          "🍲 **Обід · 13:10** · фото 2",
          "**Борщ з хлібом** — 319 ккал",
          "• Борщ червоний (з м'ясом) — 400_г_·_184_ккал",
          "• Хліб житній — 60_г_·_135_ккал",
          "",
          "━━━━━━━━━━━━━━━━",
          "🍽️ **Вечеря · 16:30**",
          "**Яблуко** — 94 ккал",
          "• Яблуко — ≈180_г_·_94_ккал",
          "",
          "━━━━━━━━━━━━━━━━",
          "🍽️ **Вечеря · 19:40** · фото 3",
          "**Кефір** — 125 ккал",
          "• Кефір 2,5% — 250_г_·_125_ккал",
          "",
          "━━━━━━━━━━━━━━━━",
          "≈ вага на око, не зважено",
        ].join("\n"),
      ),
    );
  });

  it("says so when nothing was logged", () => {
    const r = dayReport(meals, "2026-11-02", 1800);
    expect(r.meals).toEqual([]);
    expect(dayPhotos(r)).toEqual([]);
    expect(dayMessage(r)).toBe("📅 **Понеділок, 2 листопада**\nНічого не записано");
  });

  it("shows pieces and decimal amounts as she typed them", () => {
    expect(amountText(item("Вареники з картоплею", 176, "1,5", "pcs", 25))).toBe(nb("1,5_шт_(38_г)"));
    expect(amountText(item("Яйце", 155, "2", "pcs"))).toBe(nb("2_шт"));
    expect(amountText({ ...item("Олія", 884, "10"), weighed: false })).toBe(nb("≈10_г"));
  });

  it("keeps her names from turning into Telegram formatting", () => {
    expect(plain("Салат **Олів'є** __домашній__ `x` ~~y~~ ||z||")).toBe("Салат Олів'є _домашній_ 'x' ~y~ |z|");
    const r = dayReport([meal("2026-11-04", "09:00", "**Каша**", [item("Каша__вівсяна", 88, "200")])], "2026-11-04", 1800);
    expect(dayMessage(r)).toContain("**Каша** — 176 ккал\n• Каша_вівсяна — ");
  });

  it("keeps a very long day within one Telegram message", () => {
    const many = Array.from({ length: 60 }, (_, i) =>
      meal("2026-11-05", `0${i % 10}:00`, `Страва ${i}`, [item("Дуже довга назва продукту номер один", 100, "100"), item("Ще одна довга назва", 100, "50")]),
    );
    const text = dayMessage(dayReport(many, "2026-11-05", 1800));
    expect(text.length).toBeLessThanOrEqual(MESSAGE_MAX);
    expect(text.endsWith("\n…")).toBe(true);
  });

  it("shows bold parts for the preview", () => {
    expect(boldParts("📅 **Середа** і **ще**")).toEqual([
      { text: "📅 ", bold: false },
      { text: "Середа", bold: true },
      { text: " і ", bold: false },
      { text: "ще", bold: true },
    ]);
    expect(boldParts("просто")).toEqual([{ text: "просто", bold: false }]);
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

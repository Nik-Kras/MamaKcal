import type { Item, Macros, Meal } from "../types";
import { dayLabel, fmt, fmtG, macroShort, mealTitle, MONTHS, todayISO, WEEKDAYS } from "./format";
import { addMacros, dayMeals, hasMacros, itemGrams, itemKcal, mealKcal, mealMacros, NO_MACROS } from "./nutrition";

/**
 * What «Поділитися» sends (D23, D24). A day (today or yesterday): the meal photos as
 * an album, then `dayMessage` as a separate text message (Telegram drops the text
 * when several photos are shared at once). The last 7 days: a picture
 * (src/components/ShareCard.tsx) with `weekText` as its caption.
 */
export type SharePeriod = "today" | "yesterday" | "week";

/** Telegram cuts a picture's caption at 1 024 characters. */
export const CAPTION_MAX = 1024;
/** Telegram splits a longer text message into several. */
export const MESSAGE_MAX = 4096;

const SHORT = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

/** "2026-11-04" → that local day, at noon so adding days never trips over a clock change. */
export function fromISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

export function addDays(iso: string, n: number): string {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return todayISO(d);
}

const dayMonth = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;

const NBSP = " ";

/** "3 шт (150 г)", "30 г"; "≈" marks the model's guess she didn't weigh. */
export function amountText(it: Pick<Item, "amount" | "unit" | "pcGrams" | "weighed">): string {
  const guess = it.weighed ? "" : "≈";
  if (it.unit === "g") return `${guess}${it.amount}${NBSP}г`;
  const grams = Math.round(itemGrams(it));
  return `${guess}${it.amount}${NBSP}шт${grams ? `${NBSP}(${fmt(grams)}${NBSP}г)` : ""}`;
}

/** Neutral either way: no praise for eating less. */
export function normLine(eaten: number, norm: number): string {
  return eaten > norm ? `Понад норму: ${fmt(eaten - norm)} ккал` : `До норми: ${fmt(norm - eaten)} ккал`;
}

export interface SharedItem {
  name: string;
  /** "3 шт (150 г)" */
  amount: string;
  kcal: number;
  /** The model's guess, not weighed. */
  guess: boolean;
}

export interface SharedMeal {
  id: string;
  /** "Сніданок" */
  title: string;
  time: string;
  dish: string;
  items: SharedItem[];
  kcal: number;
  /** null when none of its products has macros. */
  macros: Macros | null;
  photo?: string;
  /** Its place in the album (1, 2…); only meals with a photo have one. */
  photoNo?: number;
}

export interface DayReport {
  /** "Середа, 4 листопада" */
  label: string;
  meals: SharedMeal[];
  eaten: number;
  /** The day's protein, fat, carbs and fibre; null when no meal has any. */
  macros: Macros | null;
  norm: number;
}

export function dayReport(meals: Meal[], date: string, norm: number): DayReport {
  let photos = 0;
  const list = dayMeals(meals, date).map(
    (m): SharedMeal => ({
      id: m.id,
      title: mealTitle(m.time),
      time: m.time,
      dish: m.dishName,
      items: m.items.map((it) => ({ name: it.name, amount: amountText(it), kcal: itemKcal(it), guess: !it.weighed })),
      kcal: mealKcal(m.items),
      macros: hasMacros(m.items) ? mealMacros(m.items) : null,
      photo: m.photo,
      photoNo: m.photo ? ++photos : undefined,
    }),
  );
  const withMacros = list.filter((m) => m.macros);
  return {
    label: dayLabel(fromISO(date)),
    meals: list,
    eaten: list.reduce((s, m) => s + m.kcal, 0),
    macros: withMacros.length ? withMacros.reduce((s, m) => addMacros(s, m.macros ?? NO_MACROS), NO_MACROS) : null,
    norm,
  };
}

export interface WeekDay {
  date: string;
  /** "Чт" */
  short: string;
  /** "Четвер" */
  name: string;
  /** "29 жовтня" */
  dayMonth: string;
  kcal: number;
  logged: boolean;
}

export interface WeekReport {
  /** "29 жовтня – 4 листопада" */
  label: string;
  /** Oldest first, the last one is today. */
  days: WeekDay[];
  /** Over the days with anything logged; null when there are none. */
  average: number | null;
  logged: number;
  norm: number;
}

/** The 7 days ending today. */
export function weekReport(meals: Meal[], today: string, norm: number): WeekReport {
  const days = [-6, -5, -4, -3, -2, -1, 0].map((i): WeekDay => {
    const date = addDays(today, i);
    const list = dayMeals(meals, date);
    const d = fromISO(date);
    return {
      date,
      short: SHORT[d.getDay()],
      name: WEEKDAYS[d.getDay()],
      dayMonth: dayMonth(d),
      kcal: list.reduce((s, m) => s + mealKcal(m.items), 0),
      logged: list.length > 0,
    };
  });
  const logged = days.filter((d) => d.logged);
  const first = fromISO(days[0].date);
  const last = fromISO(today);
  const label =
    first.getMonth() === last.getMonth()
      ? `${first.getDate()}–${dayMonth(last)}`
      : `${dayMonth(first)} – ${dayMonth(last)}`;
  return {
    label,
    days,
    average: logged.length ? Math.round(logged.reduce((s, d) => s + d.kcal, 0) / logged.length) : null,
    logged: logged.length,
    norm,
  };
}

/** "п’ятниця (+120), неділя (+250)", or "" when no day went over. */
export function overText(r: WeekReport): string {
  return r.days
    .filter((d) => d.logged && d.kcal > r.norm)
    .map((d) => `${d.name.toLocaleLowerCase("uk")} (+${fmt(d.kcal - r.norm)})`)
    .join(", ");
}

/** "Субота, понеділок", or "" when every day has a record. */
export function emptyDaysText(r: WeekReport): string {
  const names = r.days.filter((d) => !d.logged).map((d) => d.name.toLocaleLowerCase("uk"));
  const s = names.join(", ");
  return s && s[0].toLocaleUpperCase("uk") + s.slice(1);
}

/** Cut a long caption at a line break, so Telegram keeps it under the picture. */
export function clipCaption(text: string, max = CAPTION_MAX): string {
  if (text.length <= max) return text;
  const cut = text.lastIndexOf("\n", max - 2);
  return `${text.slice(0, cut > 0 ? cut : max - 2)}\n…`;
}

/** The day's photos in album order (the same order as the meals in `dayMessage`). */
export function dayPhotos(r: DayReport): string[] {
  return r.meals.flatMap((m) => (m.photo ? [m.photo] : []));
}

const MEAL_ICON: Record<string, string> = { Сніданок: "🍳", Обід: "🍲", Вечеря: "🍽️", Перекус: "🍎" };
const RULE = "━━━━━━━━━━━━━━━━";

/**
 * Telegram reads **bold**, __italic__, ||spoiler||, ~~strike~~ and `code` in shared
 * text; a food or dish name she typed must never turn into one of those.
 */
export function plain(s: string): string {
  return s.replace(/\*/g, "").replace(/`/g, "'").replace(/([_|~])\1+/g, "$1");
}

/**
 * The day as one Telegram message: the total, then each meal between rules, with its
 * photo number in the album and a line per product.
 */
export function dayMessage(r: DayReport): string {
  const head = `📅 **${r.label}**`;
  if (!r.meals.length) return `${head}\nНічого не записано`;
  const lines = [head, `З’їдено **${fmt(r.eaten)} ккал** з ${fmt(r.norm)}`, normLine(r.eaten, r.norm)];
  if (r.macros) lines.push(macroLine(r.macros));
  for (const m of r.meals) {
    lines.push(
      "",
      RULE,
      `${MEAL_ICON[m.title] ?? "🍽️"} **${m.title} · ${m.time}**${m.photoNo ? ` · фото ${m.photoNo}` : ""}`,
      `**${plain(m.dish)}** — ${fmt(m.kcal)} ккал`,
      ...(m.macros ? [macroShort(m.macros)] : []),
      // Non-breaking spaces keep "· 184 ккал" together when a long name wraps.
      ...m.items.map((it) => `• ${plain(it.name)} — ${it.amount}${NBSP}·${NBSP}${fmt(it.kcal)}${NBSP}ккал`),
    );
  }
  lines.push("", RULE);
  if (r.meals.some((m) => m.items.some((it) => it.guess))) lines.push("≈ вага на око, не зважено");
  return clipCaption(lines.join("\n"), MESSAGE_MAX);
}

/** "Білки 58 г · Жири 52 г · Вуглеводи 152 г · Клітковина 14 г" */
export function macroLine(m: Macros): string {
  return [`Білки ${fmtG(m.p)}${NBSP}г`, `Жири ${fmtG(m.f)}${NBSP}г`, `Вуглеводи ${fmtG(m.c)}${NBSP}г`, `Клітковина ${fmtG(m.fib)}${NBSP}г`].join(" · ");
}

/** Split a preview line into plain and **bold** parts, as Telegram will show it. */
export function boldParts(line: string): { text: string; bold: boolean }[] {
  return line
    .split(/\*\*(.+?)\*\*/)
    .map((text, i) => ({ text, bold: i % 2 === 1 }))
    .filter((p) => p.text);
}

export function weekText(r: WeekReport): string {
  if (r.average === null) return `${r.label}: нічого не записано`;
  const head = `${r.label}: у середньому ${fmt(r.average)} ккал на день (норма ${fmt(r.norm)})`;
  const lines = r.days.map(
    (d) => `${d.short}, ${d.dayMonth} — ${d.logged ? `${fmt(d.kcal)} ккал` : "нічого не записано"}`,
  );
  return clipCaption([head, "", ...lines].join("\n"));
}

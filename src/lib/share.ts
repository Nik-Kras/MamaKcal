import type { Item, Meal } from "../types";
import { dayLabel, fmt, mealTitle, MONTHS, todayISO, WEEKDAYS } from "./format";
import { dayMeals, mealKcal } from "./nutrition";

/**
 * What «Поділитися» sends: a day (today or yesterday) or the last 7 days, as a
 * picture (src/components/ShareCard.tsx) with this caption under it.
 */
export type SharePeriod = "today" | "yesterday" | "week";

/** Telegram cuts a picture's caption at 1 024 characters. */
export const CAPTION_MAX = 1024;

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

/**
 * "Сирники 3 шт · Сметана 15% 30 г". Non-breaking spaces keep the last word, the amount and
 * the unit on one line ("житній 2 шт"), and the dot at the end of a line, not the start.
 */
export function amountsText(items: Pick<Item, "name" | "amount" | "unit">[]): string {
  return items.map((it) => `${it.name}${NBSP}${it.amount}${NBSP}${it.unit === "pcs" ? "шт" : "г"}`).join(`${NBSP}· `);
}

/** Neutral either way: no praise for eating less. */
export function normLine(eaten: number, norm: number): string {
  return eaten > norm ? `Понад норму: ${fmt(eaten - norm)} ккал` : `До норми: ${fmt(norm - eaten)} ккал`;
}

export interface SharedMeal {
  id: string;
  /** "Сніданок" */
  title: string;
  time: string;
  dish: string;
  amounts: string;
  kcal: number;
  photo?: string;
}

export interface DayReport {
  /** "Середа, 4 листопада" */
  label: string;
  meals: SharedMeal[];
  eaten: number;
  norm: number;
}

export function dayReport(meals: Meal[], date: string, norm: number): DayReport {
  const list = dayMeals(meals, date).map((m) => ({
    id: m.id,
    title: mealTitle(m.time),
    time: m.time,
    dish: m.dishName,
    amounts: amountsText(m.items),
    kcal: mealKcal(m.items),
    photo: m.photo,
  }));
  return { label: dayLabel(fromISO(date)), meals: list, eaten: list.reduce((s, m) => s + m.kcal, 0), norm };
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

export function dayText(r: DayReport): string {
  if (!r.meals.length) return `${r.label}: нічого не записано`;
  const head = `${r.label}: ${fmt(r.eaten)} з ${fmt(r.norm)} ккал`;
  const lines = r.meals.map((m) => `${m.title} ${m.time} — ${m.dish}, ${fmt(m.kcal)} ккал`);
  return clipCaption([head, "", ...lines].join("\n"));
}

export function weekText(r: WeekReport): string {
  if (r.average === null) return `${r.label}: нічого не записано`;
  const head = `${r.label}: у середньому ${fmt(r.average)} ккал на день (норма ${fmt(r.norm)})`;
  const lines = r.days.map(
    (d) => `${d.short}, ${d.dayMonth} — ${d.logged ? `${fmt(d.kcal)} ккал` : "нічого не записано"}`,
  );
  return clipCaption([head, "", ...lines].join("\n"));
}

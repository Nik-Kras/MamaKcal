import type { Item, Meal, Unit } from "../types";

/** Longest amount she can type: 4 digits (9 999 g). */
export const MAX_DIGITS = 4;
export const MAX_PCS = 30;

/**
 * What she types in the amount field: digits with at most one decimal separator
 * ("," or ".", shown as ","), up to 4 whole digits and 1 decimal, no leading
 * zeros ("0150" → "150"), a leading separator becomes "0," (",5" → "0,5").
 */
export function cleanAmount(text: string): string {
  const sep = text.search(/[.,]/);
  const whole = (sep < 0 ? text : text.slice(0, sep)).replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, MAX_DIGITS);
  if (sep < 0) return whole;
  const frac = text.slice(sep + 1).replace(/\D/g, "").slice(0, 1);
  return `${whole || "0"},${frac}`;
}

/** "1,5" → 1.5; empty or unreadable → 0. */
export function parseAmount(text: string): number {
  const n = parseFloat(cleanAmount(text).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function itemGrams(it: Pick<Item, "unit" | "amount" | "pcGrams">): number {
  const amount = parseAmount(it.amount);
  return it.unit === "pcs" ? amount * (it.pcGrams ?? 0) : amount;
}

/** Whole kcal for one line. Rows are rounded before summing so they add up on screen. */
export function itemKcal(it: Pick<Item, "unit" | "amount" | "pcGrams" | "kcal100">): number {
  return Math.round((it.kcal100 * itemGrams(it)) / 100);
}

export function mealKcal(items: Pick<Item, "unit" | "amount" | "pcGrams" | "kcal100">[]): number {
  return items.reduce((sum, it) => sum + itemKcal(it), 0);
}

/** "Картопля смажена, яйце смажене" — a meal name made from its products. */
export function listNames(items: Pick<Item, "name">[]): string {
  return items.map((it, i) => (i ? it.name.toLocaleLowerCase("uk") : it.name)).join(", ");
}

export function dayMeals(meals: Meal[], date: string): Meal[] {
  return meals
    .filter((m) => m.date === date)
    .sort((a, b) => (a.time === b.time ? a.createdAt - b.createdAt : a.time < b.time ? -1 : 1));
}

/** Step a piece count by ±1 from the whole number she has, staying within 1…MAX_PCS. A fraction steps to the next whole number. */
export function stepPieces(amount: string, delta: number): string {
  const n = parseAmount(amount);
  const base = Number.isInteger(n) ? n + delta : delta > 0 ? Math.floor(n) + delta : Math.ceil(n) + delta;
  return String(Math.min(MAX_PCS, Math.max(1, base)));
}

/** Convert an amount when a line switches between grams and pieces. */
export function convertAmount(
  amount: string,
  from: { unit: Unit; pcGrams?: number },
  to: { unit: Unit; pcGrams?: number },
): string {
  if (from.unit === to.unit) return amount;
  const n = parseAmount(amount);
  if (to.unit === "pcs") {
    const grams = from.unit === "g" ? n : n * (from.pcGrams ?? 0);
    return String(Math.min(MAX_PCS, Math.max(1, Math.round(grams / (to.pcGrams || 1)))));
  }
  return String(Math.round(n * (from.pcGrams ?? 0)));
}

import type { Item, Meal, Unit } from "../types";

/** Longest amount she can type: 4 digits (9 999 g). */
export const MAX_DIGITS = 4;
export const MAX_PCS = 30;

/** Digits only, at most 4, no leading zeros ("0150" → "150"). */
export function cleanAmount(text: string): string {
  return text.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, MAX_DIGITS);
}

export function parseAmount(text: string): number {
  const digits = text.replace(/\D/g, "");
  return digits ? parseInt(digits, 10) : 0;
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

/** Step a piece count by ±1, staying within 1…MAX_PCS. */
export function stepPieces(amount: string, delta: number): string {
  const next = Math.min(MAX_PCS, Math.max(1, parseAmount(amount) + delta));
  return String(next);
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

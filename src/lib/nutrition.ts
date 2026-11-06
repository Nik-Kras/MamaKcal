import type { Item, Macros, Meal, Unit } from "../types";

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

export const NO_MACROS: Macros = { p: 0, f: 0, c: 0, fib: 0 };

/** Grams of protein, fat, carbs and fibre in one line (unrounded); zeros when its food has no macros. */
export function itemMacros(it: Pick<Item, "unit" | "amount" | "pcGrams" | "macros100">): Macros {
  const m = it.macros100;
  if (!m) return NO_MACROS;
  const g = itemGrams(it) / 100;
  return { p: m.p * g, f: m.f * g, c: m.c * g, fib: m.fib * g };
}

export function addMacros(a: Macros, b: Macros): Macros {
  return { p: a.p + b.p, f: a.f + b.f, c: a.c + b.c, fib: a.fib + b.fib };
}

export function mealMacros(items: Pick<Item, "unit" | "amount" | "pcGrams" | "macros100">[]): Macros {
  return items.reduce((sum, it) => addMacros(sum, itemMacros(it)), NO_MACROS);
}

/** true when any line has macros to show (a meal of only her own products without them has none). */
export function hasMacros(items: Pick<Item, "macros100">[]): boolean {
  return items.some((it) => !!it.macros100);
}

/** Share of the daily kcal norm: protein 20 %, fat 30 %, carbs 50 % (4 / 9 / 4 kcal per gram). */
export const MACRO_SPLIT = { p: 0.2, f: 0.3, c: 0.5 } as const;
/** Fibre: 14 g per 1 000 kcal (the US Dietary Guidelines' rule; 25 g for 1 800 kcal). */
export const FIBRE_PER_1000 = 14;

/** The day's targets in grams, worked out from her kcal norm, so they change with it. */
export function macroTargets(norm: number): Macros {
  return {
    p: Math.round((norm * MACRO_SPLIT.p) / 4),
    f: Math.round((norm * MACRO_SPLIT.f) / 9),
    c: Math.round((norm * MACRO_SPLIT.c) / 4),
    fib: Math.round((norm * FIBRE_PER_1000) / 1000),
  };
}

/**
 * Macros from a product's label (per 100 g), as she typed them: each blank, or digits
 * with one decimal. All blank → undefined (no macros); a blank among filled ones is 0.
 * Returns null when they can't be right: protein + fat + carbs over 100 g, or fibre over carbs.
 */
export function labelMacros(t: { p: string; f: string; c: string; fib: string }): Macros | undefined | null {
  if (![t.p, t.f, t.c, t.fib].some((s) => s.trim())) return undefined;
  const m = { p: parseAmount(t.p), f: parseAmount(t.f), c: parseAmount(t.c), fib: parseAmount(t.fib) };
  if (m.p + m.f + m.c > 100 || m.fib > 100) return null;
  return m;
}

/**
 * Meals logged before macros existed (1.6.0) have only kcal: give each line its food's macros
 * from the list, by the same id. Lines whose food is gone or has none stay without.
 */
export function fillMacros(meals: Meal[], macrosOf: (foodId: string) => Macros | undefined): Meal[] {
  let changed = false;
  const out = meals.map((m) => {
    if (!m.items.some((it) => !it.macros100 && it.foodId)) return m;
    const items = m.items.map((it) => {
      const found = !it.macros100 && it.foodId ? macrosOf(it.foodId) : undefined;
      return found ? { ...it, macros100: found } : it;
    });
    if (items.some((it, i) => it !== m.items[i])) {
      changed = true;
      return { ...m, items };
    }
    return m;
  });
  return changed ? out : meals;
}

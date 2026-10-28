import type { Item } from "../types";
import { nameKey } from "./match";

/** One remembered correction: the photo model's name for a food → the food she meant. */
export interface Correction {
  id: string;
  /** Logged meals in a row where she made this same correction. */
  n: number;
}

/**
 * A correction takes effect after she makes it in two logged meals in a row: the
 * model calls real chicken "chicken" too, so one swap of "chicken" → pork must not
 * turn every chicken into pork. Naming an unrecognised food applies at once
 * (nothing else would match it anyway).
 */
export const LEARN_AFTER = 2;

/** Update the corrections with what she did to the lines of a meal she just logged. */
export function learnFromMeal(learned: Record<string, Correction>, items: Item[]): Record<string, Correction> {
  const next = { ...learned };
  for (const it of items) {
    if (!it.aiName || !it.foodId) continue;
    const key = nameKey(it.aiName);
    if (!key) continue;
    const prev = next[key];
    const again = prev?.id === it.foodId ? prev.n + 1 : 1;
    if (!it.aiFoodId) {
      // The name matched nothing and she said what it is.
      next[key] = { id: it.foodId, n: Math.max(again, LEARN_AFTER) };
    } else if (it.foodId !== it.aiFoodId) {
      next[key] = { id: it.foodId, n: again };
    } else if (prev && prev.id !== it.foodId) {
      // She kept the model's match: a different correction is no longer "in a row".
      delete next[key];
    }
  }
  return next;
}

/** The corrections strong enough to change matching. */
export function activeCorrections(learned: Record<string, Correction>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, c] of Object.entries(learned)) if (c && typeof c.id === "string" && c.n >= LEARN_AFTER) out[key] = c.id;
  return out;
}

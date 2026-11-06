import type { Food } from "../types";
import raw from "./foods.json";
import renamedRaw from "./renamed.json";

/**
 * The food list: Ukrainian home food, kcal and macros per 100 g as served, each value with its
 * source (USDA FoodData Central, a Ukrainian label, or a recipe calculation); see
 * bench/catalogue/ and regenerate with `pnpm foods`. She sees the Ukrainian names; the
 * photo model's English answers are matched against the English names and aliases.
 */

interface Row {
  id: string;
  name: string;
  nameEn: string;
  aliases: string[];
  aliasesUa: string[];
  kcal100: number;
  protein100: number;
  fat100: number;
  carbs100: number;
  fiber100: number;
  pcGrams?: number;
}

export const FOODS: Food[] = (raw as Row[]).map((r) => ({
  id: r.id,
  name: r.name,
  nameEn: r.nameEn,
  aliases: r.aliases,
  aliasesUa: r.aliasesUa,
  kcal100: r.kcal100,
  macros100: { p: r.protein100, f: r.fat100, c: r.carbs100, fib: r.fiber100 },
  pcGrams: r.pcGrams,
}));

/** Ids of the old (MacroTrack) list that changed → the closest food now (null: none). */
export const RENAMED: Record<string, string | null> = renamedRaw;

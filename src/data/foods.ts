import type { Food } from "../types";
import raw from "./foods.json";

/**
 * The food list: the MacroTrack spreadsheet (regenerate with `pnpm foods`),
 * kcal per 100 g as served. She sees the Ukrainian names; the photo model's
 * English answers are matched against the English names and aliases.
 */

/** Typical weight of one piece, for foods she counts rather than weighs. */
const PIECES: Record<string, number> = {
  "eggs-whole": 50,
  "varenyky-potato": 25,
  "varenyky-cottage-cheese": 25,
  "varenyky-cherry": 25,
  deruny: 60,
  syrnyky: 50,
  kotlety: 80,
  holubtsi: 120,
  mlyntsi: 50,
  pampushky: 40,
  banana: 120,
  apple: 170,
  orange: 160,
  pear: 170,
  kiwi: 75,
  peach: 150,
};

interface Row {
  id: string;
  name: string;
  name_ua: string;
  aliases: string[];
  aliases_ua: string[];
  kcal100: number;
}

export const FOODS: Food[] = (raw as Row[]).map((r) => ({
  id: r.id,
  name: r.name_ua || r.name,
  nameEn: r.name,
  aliases: r.aliases,
  aliasesUa: r.aliases_ua,
  kcal100: r.kcal100,
  pcGrams: PIECES[r.id],
}));

import type { Food, Item } from "../types";
import { IGNORE, type Matcher } from "./match";
import { convertAmount } from "./nutrition";

/**
 * Turn the photo model's answer ("Carrots | 150g" lines) into review-screen
 * lines. The answer is free text from a small model, so it's treated as
 * untrusted: odd lines are skipped and numbers are clamped. A name that fits no
 * food becomes an "unknown" line she resolves by picking a food.
 */

/** What the model is asked; the answer format below depends on it. Benchmarked in bench/. */
export const PROMPT =
  "What foods are on this plate? Answer with one line per food and nothing else, in the form:\n" +
  "<food name> | <grams>\n" +
  "Use a short English name (1 to 3 words) and your best estimate of its weight on the plate in grams. " +
  "Ignore the plate, cutlery and anything that is not food.";

const BULLET = /^\s*(?:[-*•]\s+|\d+[.)]\s*)?\|?\s*/;
const SPLIT = /^(.+?)(?:\s*:\s*|\s+[-–—]\s+)(.*)$/;
const NUM = /(\d+(?:[.,]\d+)?)(?:\s*[-–]\s*(\d+(?:[.,]\d+)?))?/;

const MAX_ITEMS = 12;
const DEFAULT_GRAMS = 100;

/** Split "name | grams" at the bar; failing that at a colon or a spaced dash ("Deep-fried chicken" stays whole). */
function splitLine(line: string): [string, string] | null {
  const s = line.replace(BULLET, "");
  const bar = s.indexOf("|");
  if (bar >= 0) return [s.slice(0, bar), s.slice(bar + 1)];
  const m = SPLIT.exec(s);
  return m ? [m[1], m[2]] : null;
}

/** "Carrots | 150g" lines → [name, grams | null]. A range "30-40" gives its middle. Mirrors bench/score.py parse(). */
export function parseLines(raw: string): [string, number | null][] {
  const out: [string, number | null][] = [];
  for (const line of raw.replace(/\*\*/g, "").split(/\r?\n/)) {
    const parts = splitLine(line);
    if (!parts) continue;
    const name = parts[0].trim().replace(/^[\s*]+|[\s*]+$/g, "");
    const n = NUM.exec(parts[1]);
    let grams: number | null = null;
    if (n) {
      const lo = parseFloat(n[1].replace(",", "."));
      const hi = n[2] ? parseFloat(n[2].replace(",", ".")) : lo;
      grams = (lo + hi) / 2;
    }
    if (name) out.push([name, grams]);
  }
  return out;
}

export interface Recognition {
  isFood: boolean;
  items: Item[];
}

/** Model answer → lines for the check screen, merging lines that land on the same food. */
export function toItems(raw: string, foods: Food[], matcher: Matcher, makeKey: () => string): Recognition {
  const byId = new Map(foods.map((f) => [f.id, f]));
  // In answer order: one entry per food (grams added up), or one per unknown name.
  const rows: { food?: Food; aiName: string; grams: number }[] = [];
  for (const [aiName, gramsRaw] of parseLines(raw)) {
    const grams = Math.min(2000, Math.max(5, Math.round((gramsRaw ?? DEFAULT_GRAMS) / 5) * 5));
    const fid = matcher.match(aiName);
    if (fid === IGNORE) continue;
    const food = fid ? byId.get(fid) : undefined;
    const same = food && rows.find((r) => r.food?.id === food.id);
    if (same) {
      // Two lines for one food ("Strawberries", "Berries"): one line, weights added.
      same.grams = Math.min(2000, same.grams + grams);
      continue;
    }
    if (rows.length >= MAX_ITEMS) break;
    rows.push({ food, aiName, grams });
  }
  const items: Item[] = rows.map(({ food, aiName, grams }) => {
    if (!food) {
      return { key: makeKey(), name: aiName.slice(0, 40), kcal100: 0, unit: "g", amount: String(grams), weighed: false, aiName, unknown: true };
    }
    const unit = food.pcGrams ? "pcs" : "g";
    return {
      key: makeKey(),
      foodId: food.id,
      name: food.name,
      kcal100: food.kcal100,
      pcGrams: food.pcGrams,
      unit,
      amount: unit === "pcs" ? convertAmount(String(grams), { unit: "g" }, { unit: "pcs", pcGrams: food.pcGrams }) : String(grams),
      weighed: false,
      aiName,
      aiFoodId: food.id,
    };
  });
  return { isFood: items.length > 0, items };
}

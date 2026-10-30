import type { Food } from "../types";

/**
 * Map the photo model's English food name ("Roasted squash cubes") onto a food
 * in the list. A port of bench/match.py (v2), the matcher that was benchmarked:
 * keep the two in step, and match.test.ts checks they agree on every name the
 * model produced in the benchmark.
 *
 * Order: her own earlier corrections → an exact name/alias → seasonings (not
 * logged) → a single generic word ("rice") → the food sharing the most words →
 * a generic word anywhere in the name. null = nothing fits; she picks.
 */

export const IGNORE = "ignore";

// Words that describe form or cooking, not the food: they break ties only.
const MINOR = [
  "cooked", "raw", "fresh", "sliced", "slices", "slice", "cubes", "cube", "cubed", "chunks", "chunk",
  "pieces", "piece", "florets", "floret", "wedges", "wedge", "strips", "strip", "diced", "chopped",
  "roasted", "grilled", "fried", "baked", "boiled", "steamed", "sauteed", "mashed", "scrambled",
  "whole", "plain", "small", "large", "mixed", "baby", "cherry", "red", "yellow",
  "white", "brown", "of", "and", "with", "in", "a", "the", "style", "patty", "fries",
];
// A bare generic word → the everyday food it most likely is.
const GENERIC: Record<string, string> = {
  rice: "white-rice-cooked", potato: "potato-boiled", chicken: "chicken-breast-cooked",
  fish: "cod-cooked", egg: "eggs-whole", bread: "white-bread", cheese: "cheddar-cheese",
  salad: "mixed-greens", greens: "mixed-greens", green: "mixed-greens", lettuce: "mixed-greens", squash: "zucchini",
  beef: "beef-steak-raw", pork: "pork-chop-cooked", berries: "berries-mix", berry: "berries-mix",
  yogurt: "greek-yogurt-full-fat", milk: "whole-milk", beans: "kidney-beans-cooked", bean: "kidney-beans-cooked",
  oil: "olive-oil", sausage: "pork-sausage", noodles: "pasta-cooked", spaghetti: "pasta-cooked",
  melon: "watermelon", cantaloupe: "watermelon", turkey: "turkey-breast-cooked", pepper: "bell-pepper",
  peppers: "bell-pepper", tomatoes: "tomato", carrot: "carrots-raw", nuts: "almonds",
  varenyky: "varenyky-potato", dumplings: "varenyky-potato", pancakes: "mlyntsi",
  raspberry: "berries-mix", raspberries: "berries-mix", blackberry: "berries-mix", blackberries: "berries-mix",
  arugula: "mixed-greens", rocket: "mixed-greens",
};
// Not logged: seasonings and herbs. A name made only of these maps to IGNORE.
const SEASONING = [
  "onion", "onions", "garlic", "parsley", "cilantro", "coriander", "dill", "basil", "chive", "chives",
  "herb", "herbs", "lemon", "lime", "salt", "mint", "thyme", "rosemary", "ginger", "scallion", "scallions",
];
const STOP = new Set(["of", "and", "with", "in", "a", "the"]);

export function stem(w: string): string {
  for (const [suf, rep] of [["ies", "y"], ["oes", "o"], ["es", "e"], ["s", ""]] as const) {
    if (w.length > 3 && w.endsWith(suf) && !w.endsWith("ss")) return w.slice(0, w.length - suf.length) + rep;
  }
  return w;
}

export function words(s: string): string[] {
  return (s.toLowerCase().match(/[a-z]+/g) ?? []).map(stem);
}

/** The key her corrections are stored under. */
export function nameKey(s: string): string {
  return words(s).join(" ");
}

interface Cand {
  id: string;
  /** From the English name or the id, not an alias: a better suggestion. */
  primary: boolean;
  core: Set<string>;
  minor: Set<string>;
}

export class Matcher {
  private ids: Set<string>;
  private exact = new Map<string, string>();
  private cands: Cand[] = [];
  private minor = new Set(MINOR.map(stem));
  private generic = new Map(Object.entries(GENERIC).map(([k, v]) => [stem(k), v]));
  private ignore = new Set(SEASONING.map(stem));

  constructor(
    foods: Pick<Food, "id" | "nameEn" | "aliases">[],
    private learned: Record<string, string> = {},
  ) {
    this.ids = new Set(foods.map((f) => f.id));
    for (const f of foods) {
      // Her own products have no English name: the model's answers reach them only
      // through her corrections (`learned`), never by matching.
      if (!f.nameEn) continue;
      const labels = [f.nameEn, f.id.replace(/-/g, " "), ...(f.aliases ?? [])];
      for (const [li, label] of labels.entries()) {
        const ws = words(label);
        const key = ws.join(" ");
        if (!key) continue;
        // Food on a plate is cooked: when raw and cooked share a name, cooked wins.
        const prev = this.exact.get(key);
        if (prev === undefined || (prev.endsWith("-raw") && f.id.includes("cooked"))) this.exact.set(key, f.id);
        const set = new Set(ws);
        this.cands.push({
          id: f.id,
          primary: li < 2,
          core: new Set([...set].filter((w) => !this.minor.has(w))),
          minor: new Set([...set].filter((w) => this.minor.has(w))),
        });
      }
    }
  }

  /** A food id, IGNORE for seasonings, or null when nothing fits. */
  match(name: string): string | null {
    const learned = this.learned[nameKey(name)];
    if (learned && this.ids.has(learned)) return learned;
    const asId = name.trim().toLowerCase().replace(/ /g, "-");
    if (this.ids.has(asId)) return asId;
    const ws = words(name);
    // No English words at all ("Борщ", "123", a table rule): nothing to match.
    if (!ws.length) return null;
    const exact = this.exact.get(ws.join(" "));
    if (exact !== undefined) return exact;
    const core = new Set(ws.filter((w) => !this.minor.has(w)));
    if (core.size === 0) return null;
    if ([...core].every((w) => this.ignore.has(w))) return IGNORE;
    // A name that is just one generic word means the everyday food, not
    // whichever dish happens to contain the word.
    const content = ws.filter((w) => !STOP.has(w));
    if (content.length === 1 && this.generic.has(content[0])) return this.generic.get(content[0])!;
    const ranked = this.rankCore(core, new Set(ws));
    // One food word with a generic default ("fried potatoes") must not land on a
    // dish that has more food words than the name, or only lists it as an alias
    // ("potato with beans", whose alias is "baked potato").
    if (core.size === 1 && ranked.length) {
      const w = [...core][0];
      const top = ranked[0];
      if (this.generic.has(w) && (top.core.size !== 1 || !top.primary)) return this.generic.get(w)!;
    }
    if (ranked.length && ranked[0].score >= 0.5) return ranked[0].id;
    for (const w of ws) if (core.has(w) && this.generic.has(w)) return this.generic.get(w)!;
    return ranked.length ? ranked[0].id : null;
  }

  /**
   * Foods that share words with the name, best first: suggestions when she swaps a line.
   * Food words first (other foods named like it before ones that only list it as an
   * alias), then the everyday food for any of its words, then foods sharing any word.
   */
  similar(name: string, n = 6): string[] {
    const ws = words(name);
    const core = new Set(ws.filter((w) => !this.minor.has(w)));
    const out: string[] = [];
    const add = (id?: string) => {
      if (id && this.ids.has(id) && !out.includes(id)) out.push(id);
    };
    const ranked = this.rankCore(core, new Set(ws));
    // Stable sort: ties keep the ranking order.
    for (const c of [...ranked].sort((a, b) => b.score + (b.primary ? 0.05 : 0) - (a.score + (a.primary ? 0.05 : 0)))) add(c.id);
    for (const w of ws) add(this.generic.get(w));
    if (out.length < n) {
      const any = new Set(ws.filter((w) => !STOP.has(w)));
      for (const primary of [true, false]) {
        for (const c of this.cands) {
          if (c.primary === primary && [...any].some((w) => c.core.has(w) || c.minor.has(w))) add(c.id);
        }
      }
    }
    return out.slice(0, n);
  }

  private rankCore(core: Set<string>, all: Set<string>): { id: string; score: number; core: Set<string>; primary: boolean }[] {
    const scored: { id: string; score: number; order: number; core: Set<string>; primary: boolean }[] = [];
    this.cands.forEach((c, order) => {
      let shared = 0;
      for (const w of core) if (c.core.has(w)) shared++;
      if (!shared) return;
      const union = new Set([...core, ...c.core]).size;
      let minor = 0;
      for (const w of all) if (c.minor.has(w)) minor++;
      // Share of both sides' food words, plus a little for matching form words;
      // raw versions lose ties against cooked ones.
      const score = shared / union + 0.1 * minor - (c.id.endsWith("-raw") ? 0.05 : 0);
      scored.push({ id: c.id, score, order, core: c.core, primary: c.primary });
    });
    // Highest score first; on a tie the earlier candidate wins, as in the Python original.
    return scored.sort((a, b) => b.score - a.score || a.order - b.order);
  }
}

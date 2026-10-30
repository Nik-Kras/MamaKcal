import type { Food } from "../types";

/** Normalise for matching: lower case, no apostrophes, ї/є/ґ/ё folded, single spaces. */
export function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’'`ʼ"«»]/g, "")
    .replace(/ё/g, "е")
    .replace(/ї/g, "і")
    .replace(/є/g, "е")
    .replace(/ґ/g, "г")
    .replace(/\s+/g, " ")
    .trim();
}

function score(food: Food, q: string): number {
  // Ukrainian name first; then her aliases, English name and English aliases.
  const names = [food.name, ...(food.aliasesUa ?? []), food.nameEn ?? "", ...(food.aliases ?? [])].filter(Boolean).map(norm);
  let best = Infinity;
  for (const [i, n] of names.entries()) {
    const alias = i > 0 ? 3 : 0;
    // Her exact word ("борщ") beats foods that only start with it ("Борщ пісний").
    if (n === q) best = Math.min(best, -1);
    else if (n.startsWith(q)) best = Math.min(best, 0 + alias);
    else if (n.split(" ").some((w) => w.startsWith(q))) best = Math.min(best, 1 + alias);
    else if (n.includes(q)) best = Math.min(best, 2 + alias);
  }
  return best;
}

/** Foods matching what she typed, best matches first. Empty query → all foods. */
export function searchFoods(foods: Food[], query: string): Food[] {
  const q = norm(query);
  if (!q) return foods;
  return foods
    .map((f) => ({ f, s: score(f, q) }))
    .filter((x) => x.s !== Infinity)
    .sort((a, b) => a.s - b.s || a.f.name.length - b.f.name.length)
    .map((x) => x.f);
}

import type { Item } from "../types";
import { plural } from "./format";
import { parseAmount } from "./nutrition";

/** How a line on the check screen stands: picked yet, weight typed, weighed or a guess. */
export type LineState = "unknown" | "empty" | "guess" | "weighed";

export function lineState(it: Pick<Item, "unknown" | "amount" | "weighed">): LineState {
  if (it.unknown) return "unknown";
  if (!(parseAmount(it.amount) > 0)) return "empty";
  return it.weighed ? "weighed" : "guess";
}

/**
 * Lines she has to pick a food for come first. A line that was unknown when the
 * screen opened (`pinned`) stays first after she picks, so the card doesn't jump
 * away from under her finger.
 */
export function orderLines<T extends Pick<Item, "key" | "unknown">>(items: T[], pinned: ReadonlySet<string>): T[] {
  const top = (it: T) => !!it.unknown || pinned.has(it.key);
  const first = items.filter(top);
  return first.length ? [...first, ...items.filter((it) => !top(it))] : items;
}

/** What stops the meal from being logged, and the line the big button takes her to. */
export type Blocker =
  | { kind: "add" }
  | { kind: "unknown"; key: string; count: number }
  | { kind: "amount"; key: string; count: number };

/** The first thing to fix, in the order the lines are shown; null when the meal can be logged. */
export function blocker(lines: Pick<Item, "key" | "unknown" | "amount" | "weighed">[]): Blocker | null {
  if (!lines.length) return { kind: "add" };
  const unknown = lines.filter((it) => it.unknown);
  if (unknown.length) return { kind: "unknown", key: unknown[0].key, count: unknown.length };
  const empty = lines.filter((it) => lineState(it) === "empty");
  if (empty.length) return { kind: "amount", key: empty[0].key, count: empty.length };
  return null;
}

export function blockerLabel(b: Blocker): string {
  switch (b.kind) {
    case "add":
      return "Додайте продукт";
    case "unknown":
      return b.count === 1 ? "Оберіть продукт" : `Оберіть ${b.count} ${plural(b.count, ["продукт", "продукти", "продуктів"])}`;
    case "amount":
      return "Впишіть вагу";
  }
}

/** A guessed number the photo model gave: worth the one-line "weigh it" hint. */
export function hasPhotoGuess(items: Pick<Item, "unknown" | "amount" | "weighed" | "aiName">[]): boolean {
  return items.some((it) => !!it.aiName && lineState(it) === "guess");
}

/** A removed line and where it was, so Повернути puts it back in place. */
export interface Removed {
  item: Item;
  index: number;
}

/** Removals that can still be undone, newest last. */
export const UNDO_KEEP = 5;

export function pushRemoved(stack: Removed[], r: Removed, max = UNDO_KEEP): Removed[] {
  return [...stack, r].slice(-max);
}

/** Put a removed line back where it was (once: a line already there is left alone). */
export function restoreRemoved(items: Item[], r: Removed): Item[] {
  if (items.some((it) => it.key === r.item.key)) return items;
  const next = [...items];
  next.splice(Math.min(r.index, next.length), 0, r.item);
  return next;
}

/** The name in «Прибрано: …», lower-cased like the meal name; never the model's English. */
export function removedName(it: Pick<Item, "name" | "unknown">): string {
  return it.unknown ? "невідомий продукт" : it.name.toLocaleLowerCase("uk");
}

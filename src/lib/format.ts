const NBSP = " ";

/** Ukrainian number format: "1 800" with a non-breaking space between thousands. */
export function fmt(n: number): string {
  return String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

/** Grams of a macro: whole grams from 10 up, one decimal below ("0,5", "7", "7,4"). */
export function fmtG(n: number): string {
  const a = Math.abs(n);
  if (a >= 10) return fmt(a);
  const r = Math.round(a * 10) / 10;
  return Number.isInteger(r) ? String(r) : String(r).replace(".", ",");
}

/** "Б 24 · Ж 22 · В 34 · Кл 0,5 г" (without fibre: "Б 24 · Ж 22 · В 34 г"). */
export function macroShort(m: { p: number; f: number; c: number; fib: number }, fibre = true): string {
  const parts = [`Б${NBSP}${fmtG(m.p)}`, `Ж${NBSP}${fmtG(m.f)}`, `В${NBSP}${fmtG(m.c)}`];
  if (fibre) parts.push(`Кл${NBSP}${fmtG(m.fib)}`);
  return `${parts.join(" · ")}${NBSP}г`;
}

/** Pick the Ukrainian plural form: [1 продукт, 2 продукти, 5 продуктів]. */
export function plural(n: number, forms: [string, string, string]): string {
  const a = n % 10;
  const b = n % 100;
  if (a === 1 && b !== 11) return forms[0];
  if (a >= 2 && a <= 4 && (b < 10 || b >= 20)) return forms[1];
  return forms[2];
}

const pad2 = (n: number) => (n < 10 ? "0" + n : String(n));

/** Local calendar day as YYYY-MM-DD. */
export function todayISO(d = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function timeHM(d = new Date()): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export const WEEKDAYS = ["Неділя", "Понеділок", "Вівторок", "Середа", "Четвер", "П’ятниця", "Субота"];
export const MONTHS = [
  "січня", "лютого", "березня", "квітня", "травня", "червня",
  "липня", "серпня", "вересня", "жовтня", "листопада", "грудня",
];

/** "Середа, 28 жовтня" */
export function dayLabel(d = new Date()): string {
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** Name a meal by the time it was logged. */
export function mealTitle(time: string): string {
  const h = parseInt(time.slice(0, 2), 10);
  if (h < 5) return "Перекус";
  if (h < 11) return "Сніданок";
  if (h < 16) return "Обід";
  if (h < 22) return "Вечеря";
  return "Перекус";
}

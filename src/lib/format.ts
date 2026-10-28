const NBSP = " ";

/** Ukrainian number format: "1 800" with a non-breaking space between thousands. */
export function fmt(n: number): string {
  return String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
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

const WEEKDAYS = ["Неділя", "Понеділок", "Вівторок", "Середа", "Четвер", "П’ятниця", "Субота"];
const MONTHS = [
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

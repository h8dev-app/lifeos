/** Local calendar dates as `YYYY-MM-DD` strings (tasks: planned_for, due_date). */

export function toLocalDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return toLocalDate(new Date(y, m - 1, d + days));
}

export const today = (now: Date = new Date()) => toLocalDate(now);

/** ISO UTC timestamp of the start of the local day (to compare with `done_at`). */
export function startOfDayIso(now: Date = new Date()): string {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
}

const WEEKDAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

const isValid = (y: number, m: number, d: number) => {
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
};

/**
 * French date word → `YYYY-MM-DD`, or null.
 * `auj`, `aujourdhui`, `demain`, `apres-demain`, `lundi`…`dimanche` (next one,
 * today included), `28/11` (this year, next year if past), `28/11/2026`, `2026-11-28`.
 */
export function parseDateWord(word: string, now: Date = new Date()): string | null {
  const w = word
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/['’]/g, "");
  const t = today(now);
  if (w === "auj" || w === "aujourdhui") return t;
  if (w === "demain") return addDays(t, 1);
  if (w === "apres-demain" || w === "apresdemain") return addDays(t, 2);

  const wd = WEEKDAYS.indexOf(w);
  if (wd !== -1) return addDays(t, (wd - now.getDay() + 7) % 7);

  let m = w.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return isValid(+m[1], +m[2], +m[3]) ? w : null;

  m = w.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
  if (m) {
    const d = +m[1], mo = +m[2];
    let y = m[3] ? +m[3] : now.getFullYear();
    if (!isValid(y, mo, d)) return null;
    let date = toLocalDate(new Date(y, mo - 1, d));
    if (!m[3] && date < t) date = toLocalDate(new Date(++y, mo - 1, d));
    return date;
  }
  return null;
}

/** `2026-11-28` → `ven. 28 nov.`; today/tomorrow/yesterday in words. */
export function formatDay(date: string, now: Date = new Date()): string {
  const t = today(now);
  if (date === t) return "aujourd'hui";
  if (date === addDays(t, 1)) return "demain";
  if (date === addDays(t, -1)) return "hier";
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("fr-FR", {
    weekday: "short", day: "numeric", month: "short",
  });
}

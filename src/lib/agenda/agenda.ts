/**
 * Agenda, pure part (tested): times, `/rdv` and `/memo` parsing, week and
 * month grids, overlap layout, reminder times.
 */
import { addDays, parseDateWord, toLocalDate } from "../dates";

export type EventKind = "event" | "memo";

export interface AgendaEvent {
  id: string;
  title: string;
  kind: EventKind;
  day: string;            // local YYYY-MM-DD
  allDay: boolean;
  startAt: string | null; // ISO
  endAt: string | null;   // ISO
  location: string | null;
  description: string | null;
  remindMinutes: number | null;
  remindedAt: string | null;
  noteId: string | null;
}

// ------------------------------------------------------------- times

/** `14h30`, `14h`, `14:30`, `9h05` → minutes since midnight, or null. */
export function parseTimeWord(word: string): number | null {
  const m = word.toLowerCase().match(/^(\d{1,2})(?:h|:)(\d{2})?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Local day + minutes → ISO UTC. */
export function atMinutes(day: string, minutes: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d, Math.floor(minutes / 60), minutes % 60).toISOString();
}

/** ISO → minutes since local midnight. */
export function minutesOf(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

export const formatMinutes = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

// ------------------------------------------------------------- parsing

export interface ParsedEvent {
  title: string;
  day: string;
  allDay: boolean;
  start: number | null; // minutes
  end: number | null;
  location: string | null;
}

/**
 * `/rdv Dentiste @demain 14h30` · `/rdv Réunion @lundi 9h-10h30 *Salle B12`
 * `/memo payer le loyer @vendredi` · `/memo appeler maman 18h`
 * - `@date`: day (default today); a time or `9h-10h30` range anywhere;
 * - `*lieu` (underscores = spaces) for appointments;
 * - appointments need a time unless written `@date` only for a memo.
 */
export function parseEventArgs(args: string, kind: EventKind, now = new Date()): ParsedEvent | { error: string } {
  let day: string | null = null;
  let start: number | null = null;
  let end: number | null = null;
  let location: string | null = null;
  const words: string[] = [];

  for (const token of args.trim().split(/\s+/).filter(Boolean)) {
    if (token.startsWith("@") && token.length > 1) {
      const d = parseDateWord(token.slice(1), now);
      if (!d) return { error: `Date « ${token} » non comprise (ex. @demain, @lundi, @28/11).` };
      day = d;
      continue;
    }
    if (token.startsWith("*") && token.length > 1) {
      location = token.slice(1).replace(/_/g, " ");
      continue;
    }
    const range = token.match(/^([^-]+)-([^-]+)$/);
    if (range && start === null) {
      const a = parseTimeWord(range[1]);
      const b = parseTimeWord(range[2]);
      if (a !== null && b !== null) {
        if (b <= a) return { error: `L'heure de fin doit être après le début (${token}).` };
        start = a;
        end = b;
        continue;
      }
    }
    const t: number | null = start === null ? parseTimeWord(token) : null;
    if (t !== null) { start = t; continue; }
    words.push(token);
  }

  const title = words.join(" ");
  if (!title) {
    return { error: kind === "event"
      ? "Usage : /rdv <titre> [@date] <heure ou 9h-10h> [*lieu]"
      : "Usage : /memo <texte> [@date] [heure]" };
  }
  if (kind === "event" && start === null) return { error: "Donne une heure au rendez-vous (ex. 14h30 ou 9h-10h)." };
  if (start !== null && end === null && kind === "event") end = Math.min(start + 60, 24 * 60 - 1); // 1 h by default
  return { title, day: day ?? toLocalDate(now), allDay: start === null, start, end, location };
}

// ------------------------------------------------------------- grids

/** Monday-based week containing `day` (7 local dates). */
export function weekDays(day: string): string[] {
  const [y, m, d] = day.split("-").map(Number);
  const offset = (new Date(y, m - 1, d).getDay() + 6) % 7;
  const monday = addDays(day, -offset);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** 6 weeks × 7 days covering the month of `day` (Monday first). */
export function monthGrid(day: string): string[][] {
  const first = `${day.slice(0, 7)}-01`;
  const start = weekDays(first)[0];
  return Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, i) => addDays(start, w * 7 + i)));
}

// ------------------------------------------------------------- layout

export interface Placed<T> {
  item: T;
  start: number;  // minutes
  end: number;
  col: number;    // 0-based column inside its overlap group
  cols: number;   // number of columns of the group
}

/**
 * Side-by-side layout of overlapping timed items in one day: each group of
 * overlapping items shares the width; an item takes the first free column.
 */
export function layoutDay<T>(items: { item: T; start: number; end: number }[]): Placed<T>[] {
  const sorted = [...items]
    .map((x) => ({ ...x, end: Math.max(x.end, x.start + 15) })) // min height 15 min
    .sort((a, b) => a.start - b.start || b.end - a.end);
  const out: Placed<T>[] = [];
  let group: Placed<T>[] = [];
  let groupEnd = -1;
  const flush = () => {
    const cols = Math.max(1, ...group.map((p) => p.col + 1));
    for (const p of group) p.cols = cols;
    out.push(...group);
    group = [];
  };
  for (const x of sorted) {
    if (group.length && x.start >= groupEnd) { flush(); groupEnd = -1; }
    const used = new Set(group.filter((p) => p.end > x.start).map((p) => p.col));
    let col = 0;
    while (used.has(col)) col++;
    group.push({ ...x, col, cols: 1 });
    groupEnd = Math.max(groupEnd, x.end);
  }
  if (group.length) flush();
  return out;
}

/** Snap minutes to a step (15 min by default), clamped to the day. */
export const snapMinutes = (min: number, step = 15) =>
  Math.min(24 * 60 - step, Math.max(0, Math.round(min / step) * step));

// ------------------------------------------------------------- reminders

/** Hour used for all-day reminders (memos without time): 9:00. */
export const ALL_DAY_REMIND_AT = 9 * 60;

/** When the notification should appear (ISO), or null when there is none. */
export function reminderTime(e: Pick<AgendaEvent, "day" | "allDay" | "startAt" | "remindMinutes">): string | null {
  if (e.remindMinutes === null) return null;
  const startMs = e.allDay || !e.startAt ? Date.parse(atMinutes(e.day, ALL_DAY_REMIND_AT)) : Date.parse(e.startAt);
  return new Date(startMs - e.remindMinutes * 60_000).toISOString();
}

/**
 * Reminders to show now: time reached, not shown yet, and not more than
 * `graceMin` late (LifeOS was off: no flood of old notifications).
 */
export function dueReminders<T extends AgendaEvent>(events: T[], now: Date, graceMin = 60): T[] {
  return events.filter((e) => {
    if (e.remindedAt) return false;
    const at = reminderTime(e);
    if (!at) return false;
    const t = Date.parse(at);
    return t <= now.getTime() && now.getTime() - t <= graceMin * 60_000;
  });
}

export const REMINDER_CHOICES: { value: number | null; label: string }[] = [
  { value: null, label: "Aucun rappel" },
  { value: 0, label: "À l'heure" },
  { value: 5, label: "5 min avant" },
  { value: 15, label: "15 min avant" },
  { value: 60, label: "1 h avant" },
  { value: 1440, label: "La veille" },
];

/** Default reminder: appointments 15 min before, memos at their time (9:00 if all-day). */
export const defaultReminder = (kind: EventKind) => (kind === "event" ? 15 : 0);

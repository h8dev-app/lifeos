/**
 * Streaks ("3 jours de sport d'affilée"), computed when reading.
 * Input: the local days (YYYY-MM-DD) on which a category has at least one entry.
 */
import { addDays } from "../dates";

export interface Streak {
  categoryId: string;
  /** Consecutive days up to today (or yesterday if nothing logged yet today). */
  current: number;
  /** Logged today? (false = the streak is still alive but needs today's entry) */
  doneToday: boolean;
  best: number;
}

export function streakFor(days: Iterable<string>, today: string): Omit<Streak, "categoryId"> {
  const set = new Set(days);
  const doneToday = set.has(today);
  let cursor = doneToday ? today : addDays(today, -1);
  let current = 0;
  while (set.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }

  let best = 0;
  for (const d of set) {
    if (set.has(addDays(d, -1))) continue; // not the start of a run
    let len = 1;
    while (set.has(addDays(d, len))) len++;
    best = Math.max(best, len);
  }
  return { current, doneToday, best };
}

/** Rows `{categoryId, day}` → streaks, longest current first; only current ≥ minDays. */
export function computeStreaks(
  rows: { categoryId: string; day: string }[],
  today: string,
  minDays = 2,
): Streak[] {
  const byCat = new Map<string, string[]>();
  for (const r of rows) byCat.set(r.categoryId, [...(byCat.get(r.categoryId) ?? []), r.day]);
  return [...byCat.entries()]
    .map(([categoryId, days]) => ({ categoryId, ...streakFor(days, today) }))
    .filter((s) => s.current >= minDays)
    .sort((a, b) => b.current - a.current);
}

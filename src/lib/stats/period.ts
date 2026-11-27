/**
 * Statistics block, pure part (tested): period bounds, per-day counts,
 * comparison with the previous period.
 */
import { addDays, toLocalDate } from "../dates";

export type StatsPeriod = "week" | "month";

export interface PeriodBounds {
  /** Local days of the period, oldest first (last = today). */
  days: string[];
  from: Date;
  to: Date;
  prevFrom: Date;
  prevTo: Date;
}

const startOf = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
};

/** Last 7 or 30 days (today included) and the same length just before. */
export function periodBounds(period: StatsPeriod, now: Date): PeriodBounds {
  const n = period === "month" ? 30 : 7;
  const todayStr = toLocalDate(now);
  const days = Array.from({ length: n }, (_, i) => addDays(todayStr, i - n + 1));
  const from = startOf(days[0]);
  const prevFrom = startOf(addDays(days[0], -n));
  return { days, from, to: now, prevFrom, prevTo: from };
}

/** Timestamps (ISO) → count per local day, in the order of `days`. */
export function countByDay(isoTimes: string[], days: string[]): number[] {
  const counts = new Map(days.map((d) => [d, 0]));
  for (const t of isoTimes) {
    const d = toLocalDate(new Date(t));
    if (counts.has(d)) counts.set(d, counts.get(d)! + 1);
  }
  return days.map((d) => counts.get(d)!);
}

/** Change vs the previous period: "+3", "−2", "=" ; and its direction. */
export function compare(current: number, previous: number): { text: string; dir: "up" | "down" | "same" } {
  const d = Math.round((current - previous) * 10) / 10;
  if (d === 0) return { text: "=", dir: "same" };
  return d > 0 ? { text: `+${d}`, dir: "up" } : { text: `−${Math.abs(d)}`, dir: "down" };
}

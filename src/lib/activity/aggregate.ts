/**
 * Pure aggregation of ActivityWatch events (no I/O, tested).
 *
 * - window events: { timestamp, duration (s), data: { app, title } }
 * - afk events:    { timestamp, duration (s), data: { status: "afk" | "not-afk" } }
 *
 * Window time only counts while the user is active (not-afk).
 */

export interface AwEvent<D = Record<string, unknown>> {
  timestamp: string;
  duration: number; // seconds
  data: D;
}
export type WindowData = { app?: string; title?: string };
export type AfkData = { status?: string };

/**
 * Readable app name: GNOME/Flatpak ids like `org.gnome.Ptyxis` or
 * `com.visualstudio.code` become `Ptyxis` / `Code`; plain names are capitalised.
 */
export function prettyApp(raw: string | undefined): string {
  const name = raw?.trim();
  if (!name) return "Inconnu";
  const last = /^[a-z0-9-]+(\.[A-Za-z0-9_-]+){2,}$/.test(name) ? name.split(".").pop()! : name;
  return last.charAt(0).toUpperCase() + last.slice(1);
}

/** A window event reduced to milliseconds, clipped to active periods. */
export interface Span {
  start: number;
  end: number;
  app: string;
  title: string;
}

interface Interval { start: number; end: number }

const toInterval = (e: AwEvent): Interval => {
  const start = Date.parse(e.timestamp);
  return { start, end: start + Math.max(0, e.duration) * 1000 };
};

/** Merge overlapping intervals (sorted output). */
function merge(intervals: Interval[]): Interval[] {
  const sorted = intervals.filter((i) => i.end > i.start).sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  for (const i of sorted) {
    const last = out[out.length - 1];
    if (last && i.start <= last.end) last.end = Math.max(last.end, i.end);
    else out.push({ ...i });
  }
  return out;
}

/** Active (not-afk) periods. */
export function activePeriods(afk: AwEvent<AfkData>[]): Interval[] {
  return merge(afk.filter((e) => e.data.status === "not-afk").map(toInterval));
}

/**
 * Window spans clipped to `[from, to]` and, when `afk` is given, to active
 * periods. Without afk data, all window time counts.
 */
export function activeSpans(
  windows: AwEvent<WindowData>[],
  afk: AwEvent<AfkData>[] | null,
  from: number,
  to: number,
): Span[] {
  const periods = afk ? activePeriods(afk) : [{ start: from, end: to }];
  const spans: Span[] = [];
  for (const e of windows) {
    const w = toInterval(e);
    const app = prettyApp(e.data.app);
    const title = e.data.title?.trim() ?? "";
    for (const p of periods) {
      const start = Math.max(w.start, p.start, from);
      const end = Math.min(w.end, p.end, to);
      if (end > start) spans.push({ start, end, app, title });
    }
  }
  return spans.sort((a, b) => a.start - b.start);
}

export interface AppTotal {
  app: string;
  seconds: number;
  titles: { title: string; seconds: number }[];
}

/** Time per app (and per title inside each app), longest first. */
export function totalsByApp(spans: Span[], maxTitles = 5): AppTotal[] {
  const apps = new Map<string, { seconds: number; titles: Map<string, number> }>();
  for (const s of spans) {
    const sec = (s.end - s.start) / 1000;
    const a = apps.get(s.app) ?? { seconds: 0, titles: new Map() };
    a.seconds += sec;
    if (s.title) a.titles.set(s.title, (a.titles.get(s.title) ?? 0) + sec);
    apps.set(s.app, a);
  }
  return [...apps.entries()]
    .map(([app, a]) => ({
      app,
      seconds: Math.round(a.seconds),
      titles: [...a.titles.entries()]
        .map(([title, seconds]) => ({ title, seconds: Math.round(seconds) }))
        .sort((x, y) => y.seconds - x.seconds)
        .slice(0, maxTitles),
    }))
    .sort((x, y) => y.seconds - x.seconds);
}

export const totalSeconds = (spans: Span[]) =>
  Math.round(spans.reduce((sum, s) => sum + (s.end - s.start) / 1000, 0));

export interface Block {
  start: number;
  end: number;
  app: string;
  seconds: number;
}

/**
 * Timeline blocks: consecutive spans of the same app are merged when the gap
 * between them is under `gapSec`; short app switches (under `minSec`) are
 * dropped so the timeline stays readable.
 */
export function timelineBlocks(spans: Span[], gapSec = 120, minSec = 120): Block[] {
  const mergeSameApp = (items: Block[]) => {
    const out: Block[] = [];
    for (const b of items) {
      const last = out[out.length - 1];
      if (last && last.app === b.app && b.start - last.end <= gapSec * 1000) {
        last.end = Math.max(last.end, b.end);
        last.seconds += b.seconds;
      } else {
        out.push({ ...b });
      }
    }
    return out;
  };
  const raw = mergeSameApp(spans.map((s) => ({ start: s.start, end: s.end, app: s.app, seconds: (s.end - s.start) / 1000 })));
  // Drop short switches, then merge again: Code | 30 s Firefox | Code → one Code block.
  return mergeSameApp(raw.filter((b) => b.seconds >= minSec)).map((b) => ({ ...b, seconds: Math.round(b.seconds) }));
}

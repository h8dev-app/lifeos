/** One timeline mixing manual/AI entries, GitHub pushes and ActivityWatch blocks. */
import type { Block } from "./aggregate";

export type TimelineItem =
  | { kind: "entry"; at: number; entryId: string; categoryId: string; source: string }
  | { kind: "activity"; at: number; end: number; app: string; seconds: number };

export function buildTimeline(
  entries: { id: string; categoryId: string; occurredAt: string; source: string }[],
  blocks: Block[],
): TimelineItem[] {
  const items: TimelineItem[] = [
    ...entries.map((e) => ({
      kind: "entry" as const, at: Date.parse(e.occurredAt), entryId: e.id, categoryId: e.categoryId, source: e.source,
    })),
    ...blocks.map((b) => ({ kind: "activity" as const, at: b.start, end: b.end, app: b.app, seconds: b.seconds })),
  ];
  return items.sort((a, b) => a.at - b.at);
}

/** `3725` → `1 h 02`, `340` → `5 min`, `20` → `< 1 min`. */
export function formatSeconds(sec: number): string {
  if (sec < 60) return "< 1 min";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;
}

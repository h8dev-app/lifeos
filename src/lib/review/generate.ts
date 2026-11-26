/** Weekly review: collect the week's data, ask the AI for the text, save a note. */
import { app } from "../app.svelte";
import { getProvider } from "../ai/registry";
import { loadAwDay } from "../activity/activitywatch";
import { totalSeconds, totalsByApp } from "../activity/aggregate";
import { listEntriesBetween } from "../db/entries";
import { listOpenTasks, listTasksDoneBetween } from "../db/tasks";
import { noteFileExists, upsertNoteFile, type NoteMeta } from "../db/notes";
import { addDays, today } from "../dates";
import {
  isoWeek, previousWeek, renderReviewNote, REVIEW_SYSTEM_PROMPT, reviewFileName, reviewUserPrompt,
  summarizeCategories, type Week, type WeekStats,
} from "./week";

const localDay = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };

async function collect(week: Week): Promise<WeekStats> {
  const from = localDay(week.start);
  const to = localDay(addDays(week.end, 1));
  const end = to.getTime() > Date.now() ? new Date() : to; // current week: up to now

  const [entries, done, open] = await Promise.all([
    listEntriesBetween(from.toISOString(), to.toISOString()),
    listTasksDoneBetween(from.toISOString(), to.toISOString()),
    listOpenTasks(),
  ]);

  // ActivityWatch, day by day (only days already started).
  let activity: WeekStats["activity"] = null;
  const spans = [];
  let trackedDays = 0;
  for (let i = 0; i < 7; i++) {
    const dayStart = localDay(addDays(week.start, i));
    if (dayStart.getTime() >= end.getTime()) break;
    const dayEnd = localDay(addDays(week.start, i + 1));
    const day = await loadAwDay(dayStart, dayEnd.getTime() > end.getTime() ? end : dayEnd);
    if (!day.ok) { if (i === 0) break; continue; }
    if (day.spans.length) trackedDays++;
    spans.push(...day.spans);
  }
  if (trackedDays > 0) {
    activity = {
      totalSeconds: totalSeconds(spans),
      days: trackedDays,
      topApps: totalsByApp(spans, 0).slice(0, 8).map((a) => ({ app: a.app, seconds: a.seconds })),
    };
  }

  const names = new Map(app.categories.map((c) => [c.id, c.name]));
  return {
    week,
    categories: summarizeCategories(entries, app.categories),
    tasksDone: done,
    tasksOpen: open.length,
    tasksOverdue: open.filter((t) => t.dueDate && t.dueDate < today()).map((t) => t.title),
    activity,
    streaks: app.streaks.map((s) => ({ name: names.get(s.categoryId) ?? "?", current: s.current })),
  };
}

export type ReviewResult = { note: NoteMeta; ai: boolean; reason?: string };

/** Generate (or regenerate) the review of `week`. */
export async function generateReview(week: Week): Promise<ReviewResult> {
  const stats = await collect(week);
  const provider = getProvider(app.settings);
  let aiText: string | null = null;
  let reason: string | undefined;
  const status = await provider.status();
  if (status.ok) {
    try {
      aiText = await provider.write(REVIEW_SYSTEM_PROMPT, reviewUserPrompt(stats));
    } catch (e) {
      reason = e instanceof Error ? e.message : String(e);
    }
  } else {
    reason = status.reason;
  }
  const content = renderReviewNote(stats, aiText, provider.label, new Date());
  const note = await upsertNoteFile(reviewFileName(week), content);
  return { note, ai: aiText !== null, reason };
}

/** `/bilan` → this week; `/bilan -1` or `/bilan derniere` → last week. */
export function weekFromArgs(args: string, now = new Date()): Week | null {
  const a = args.trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  const current = isoWeek(now);
  if (!a) return current;
  if (["-1", "derniere", "precedente", "passee"].includes(a)) return previousWeek(current);
  return null;
}

/**
 * Auto mode: from Monday on, generate last week's review once if it does not
 * exist yet. Returns the result, or null when nothing was done.
 */
export async function autoReviewIfDue(): Promise<ReviewResult | null> {
  const last = previousWeek(isoWeek(new Date()));
  if (await noteFileExists(reviewFileName(last))) return null;
  return generateReview(last);
}

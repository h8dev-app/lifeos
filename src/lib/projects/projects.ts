/**
 * Projects, pure part (tested): statuses, progress, milestones, time spent
 * from ActivityWatch spans, GitHub repo names, `+projet` lookup.
 */
import { slugify } from "../parsing/slash";
import type { IconName } from "../ui/iconNames";

export type ProjectStatus = "idea" | "active" | "paused" | "done";

export const PROJECT_STATUSES: { id: ProjectStatus; label: string }[] = [
  { id: "idea", label: "Idée" },
  { id: "active", label: "En cours" },
  { id: "paused", label: "En pause" },
  { id: "done", label: "Fini" },
];

export const statusLabel = (s: ProjectStatus) => PROJECT_STATUSES.find((x) => x.id === s)?.label ?? s;

export interface Project {
  id: string;
  name: string;
  slug: string;
  color: string;
  icon: IconName | null;
  status: ProjectStatus;
  description: string | null;
  dueDate: string | null; // YYYY-MM-DD
  notesFolder: string | null;
  folder: string | null; // local folder, for the Claude panel
  repo: string | null; // GitHub owner/name
  keywords: string[]; // matched in ActivityWatch titles / apps
}

export interface Milestone {
  id: string;
  projectId: string;
  title: string;
  dueDate: string | null;
  doneAt: string | null;
  position: number;
}

/** What progress needs from a task. */
export interface ProjectTaskLite {
  projectId: string | null;
  milestoneId: string | null;
  status: "todo" | "doing" | "done";
  dueDate: string | null;
}

export const PROJECT_COLORS = ["#7c9cff", "#5fc492", "#f0a35e", "#f28bb3", "#a78bfa", "#2dd4bf", "#ef6b6b", "#e5b450"];

export const PROJECT_ICONS: IconName[] = [
  "briefcase", "code", "graduation-cap", "book-open", "music", "dumbbell", "chef-hat", "heart",
  "plane", "car", "wallet", "gamepad-2", "sparkles", "file-text", "chart-column", "square-terminal",
];

export interface Progress {
  done: number;
  total: number;
  /** 0..100, rounded; 0 when there is no task. */
  pct: number;
}

export function progressOf(tasks: Pick<ProjectTaskLite, "status">[]): Progress {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "done").length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

/** Open tasks of the project whose due date is before `today`. */
export function overdueCount(tasks: ProjectTaskLite[], today: string): number {
  return tasks.filter((t) => t.status !== "done" && t.dueDate !== null && t.dueDate < today).length;
}

/** Next open milestone: the earliest dated one, else the first by position. */
export function nextMilestone(milestones: Milestone[]): Milestone | null {
  const open = milestones.filter((m) => !m.doneAt);
  const dated = open.filter((m) => m.dueDate).sort((a, b) => a.dueDate!.localeCompare(b.dueDate!));
  return dated[0] ?? [...open].sort((a, b) => a.position - b.position)[0] ?? null;
}

/** Milestones in display order: open first (by date, then position), done last. */
export function sortMilestones(milestones: Milestone[]): Milestone[] {
  const key = (m: Milestone) => `${m.doneAt ? 1 : 0}|${m.dueDate ?? "9999"}|${String(m.position).padStart(6, "0")}`;
  return [...milestones].sort((a, b) => key(a).localeCompare(key(b)));
}

// ------------------------------------------------------------ time spent

/** "lifeos, LifeOS app ,  bts" → ["lifeos", "lifeos app", "bts"] (lowercase, no duplicates). */
export function parseKeywords(raw: string | null | undefined): string[] {
  const out: string[] = [];
  for (const k of (raw ?? "").split(",")) {
    const v = k.trim().toLowerCase();
    if (v.length >= 2 && !out.includes(v)) out.push(v);
  }
  return out;
}

interface SpanLike {
  start: number;
  end: number;
  app: string;
  title: string;
}

export const spanMatches = (s: Pick<SpanLike, "app" | "title">, keywords: string[]) => {
  if (keywords.length === 0) return false;
  const hay = `${s.title} ${s.app}`.toLowerCase();
  return keywords.some((k) => hay.includes(k));
};

/**
 * Seconds spent on a project: window spans whose title or app contains a
 * keyword. `dayOf` turns a timestamp into its local day (YYYY-MM-DD).
 */
export function projectTime(
  spans: SpanLike[],
  keywords: string[],
  dayOf: (ms: number) => string,
): { total: number; byDay: Record<string, number> } {
  const byDay: Record<string, number> = {};
  let total = 0;
  for (const s of spans) {
    if (!spanMatches(s, keywords)) continue;
    const sec = Math.max(0, (s.end - s.start) / 1000);
    total += sec;
    const d = dayOf(s.start);
    byDay[d] = (byDay[d] ?? 0) + sec;
  }
  return { total: Math.round(total), byDay };
}

// ------------------------------------------------------------ GitHub, lookup

/** `owner/name`, a GitHub URL or `git@github.com:owner/name.git` → `owner/name`, or null. */
export function parseRepo(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim().replace(/\.git$/, "").replace(/\/+$/, "");
  const m = v.match(/^(?:https?:\/\/(?:www\.)?github\.com\/|git@github\.com:)?([A-Za-z0-9-]{1,39})\/([A-Za-z0-9._-]{1,100})$/);
  return m ? `${m[1]}/${m[2]}` : null;
}

/** Project for `+mot` (slug, accents and case ignored; singular/plural tolerated). */
export function findProject<T extends Pick<Project, "slug">>(word: string, projects: T[]): T | undefined {
  const s = slugify(word);
  if (!s) return undefined;
  return projects.find((p) => p.slug === s) ?? projects.find((p) => p.slug === s.replace(/s$/, "") || p.slug === `${s}s`);
}

/** Slug not used by `taken`: "lifeos", then "lifeos-2"… */
export function uniqueSlug(name: string, taken: string[]): string {
  const base = slugify(name) || "projet";
  if (!taken.includes(base)) return base;
  let i = 2;
  while (taken.includes(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

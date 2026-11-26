/**
 * Shared UI state (Svelte 5 runes in a module). Views read `app.*`
 * and call the reload functions after a change.
 */
import { listCategories } from "./db/categories";
import { entryDaysByCategory, listRecentEntries, type RecentEntry } from "./db/entries";
import { computeStreaks, type Streak } from "./stats/streaks";
import { today } from "./dates";
import { listTaskCategories, listTasks, type Task, type TaskCategory } from "./db/tasks";
import type { Category, EntryData } from "./types";
import { syncGithub, type GithubSyncState } from "./activity/sync";
import { DEFAULT_SETTINGS, loadSettings, type Settings } from "./settings";

export type View = "dashboard" | "tasks" | "notes" | "activity" | "claude" | "settings";

/** Entry proposed by the AI, waiting for the user's confirmation. */
export interface PendingEntry {
  categoryId: string;
  data: EntryData;
  occurredAt: string;
  text: string;
}
export type ToastKind = "ok" | "error" | "info";

export const app = $state({
  view: "dashboard" as View,
  categories: [] as Category[],
  recent: [] as RecentEntry[],
  streaks: [] as Streak[],
  tasks: [] as Task[],
  taskCategories: [] as TaskCategory[],
  /** Note to open when the Notes view shows (set by `/note <titre>`). */
  openNoteId: null as string | null,
  toast: { message: "", kind: "info" as ToastKind },
  settings: { ...DEFAULT_SETTINGS } as Settings,
  pending: null as PendingEntry | null,
  aiBusy: false,
  /** Last GitHub sync result, shown in Settings and Activity. */
  github: null as GithubSyncState,
  /** Claude panel: `session` changes to start a new terminal. */
  claude: { cwd: null as string | null, running: false, session: 0, opened: false },
});

export function say(message: string, kind: ToastKind = "info") {
  app.toast = { message, kind };
}

export async function reloadEntries() {
  const [categories, recent, days] = await Promise.all([listCategories(), listRecentEntries(10), entryDaysByCategory()]);
  app.categories = categories;
  app.recent = recent;
  app.streaks = computeStreaks(days, today());
}

export async function reloadTasks() {
  [app.tasks, app.taskCategories] = await Promise.all([listTasks(), listTaskCategories()]);
}

/** Run a DB action and show the error in the toast instead of failing silently. */
export async function guard<T>(action: () => Promise<T>): Promise<T | undefined> {
  try {
    return await action();
  } catch (e) {
    say(`Erreur : ${e}`, "error");
    return undefined;
  }
}

export async function reloadSettings() {
  app.settings = await loadSettings();
}

/** One GitHub sync, result stored in `app.github`. Silent when no username. */
export async function runGithubSync(): Promise<void> {
  const user = app.settings.githubUser;
  if (!user) return;
  try {
    const { added } = await syncGithub(user);
    app.github = { at: new Date().toISOString(), added };
    if (added) await reloadEntries();
  } catch (e) {
    app.github = { at: new Date().toISOString(), error: e instanceof Error ? e.message : String(e) };
  }
}

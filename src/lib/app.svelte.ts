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
import { DEFAULT_SETTINGS, loadScreenWidgets, loadSettings, saveScreenWidgets, type Settings } from "./settings";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { applyAppearance } from "./theme";

export type View = "dashboard" | "tasks" | "agenda" | "notes" | "activity" | "claude" | "settings";

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
  /** Bumped when agenda items change, so views reload. */
  agendaVersion: 0,
  /** Note categories (folders), for #autocompletion. */
  noteFolders: [] as string[],
  /** /help dialog: null = closed, "" = all commands, "tache" = that command. */
  help: null as string | null,
  /** Last GitHub sync result, shown in Settings and Activity. */
  github: null as GithubSyncState,
  /** Claude panel: `session` changes to start a new terminal. */
  claude: { cwd: null as string | null, running: false, session: 0, opened: false },
  /** Widgets pinned on the screen (see src-tauri/src/widgets.rs). */
  screenWidgets: [] as string[],
});

// ------------------------------------------------------------ screen widgets

/** Pin or unpin a home block as a screen widget. */
export async function toggleScreenWidget(kind: string): Promise<void> {
  const on = !app.screenWidgets.includes(kind);
  await guard(async () => {
    await invoke(on ? "widget_open" : "widget_close", { kind });
    app.screenWidgets = on ? [...app.screenWidgets, kind] : app.screenWidgets.filter((k) => k !== kind);
    await saveScreenWidgets(app.screenWidgets);
    say(on ? "Widget épinglé : il reste à l'écran quand LifeOS est masqué." : "Widget retiré de l'écran.");
  });
}

/** At start-up: reopen the pinned widgets; follow the ones closed by their ✕. */
export async function restoreScreenWidgets(): Promise<void> {
  app.screenWidgets = await loadScreenWidgets();
  for (const kind of app.screenWidgets) invoke("widget_open", { kind }).catch((e) => console.error("widget", e));
  await listen<string>("widget://closed", (e) => {
    app.screenWidgets = app.screenWidgets.filter((k) => k !== e.payload);
    saveScreenWidgets(app.screenWidgets).catch(() => {});
  });
}

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
  applyAppearance(app.settings);
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

export async function reloadNoteFolders() {
  const { listFolders } = await import("./db/notes");
  app.noteFolders = await listFolders();
}

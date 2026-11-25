/**
 * Shared UI state (Svelte 5 runes in a module). Views read `app.*`
 * and call the reload functions after a change.
 */
import { listCategories } from "./db/categories";
import { listRecentEntries, type RecentEntry } from "./db/entries";
import { listTasks, type Task } from "./db/tasks";
import type { Category, EntryData } from "./types";
import { DEFAULT_SETTINGS, loadSettings, type Settings } from "./settings";

export type View = "dashboard" | "tasks" | "notes" | "settings";

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
  tasks: [] as Task[],
  /** Note to open when the Notes view shows (set by `/note <titre>`). */
  openNoteId: null as string | null,
  toast: { message: "", kind: "info" as ToastKind },
  settings: { ...DEFAULT_SETTINGS } as Settings,
  pending: null as PendingEntry | null,
  aiBusy: false,
});

export function say(message: string, kind: ToastKind = "info") {
  app.toast = { message, kind };
}

export async function reloadEntries() {
  [app.categories, app.recent] = await Promise.all([listCategories(), listRecentEntries(10)]);
}

export async function reloadTasks() {
  app.tasks = await listTasks();
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

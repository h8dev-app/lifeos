/**
 * Navigation tabs: which ones are shown and in what order (Réglages → Onglets).
 * Saved as a comma separated list of views. Pure, tested.
 */
import type { IconName } from "./iconNames";

export type TabView = "dashboard" | "tasks" | "projects" | "agenda" | "notes" | "activity" | "claude" | "settings";

export const ALL_TABS: { view: TabView; label: string; icon: IconName }[] = [
  { view: "dashboard", label: "Accueil", icon: "house" },
  { view: "tasks", label: "Tâches", icon: "list-checks" },
  { view: "projects", label: "Projets", icon: "briefcase" },
  { view: "agenda", label: "Agenda", icon: "calendar" },
  { view: "notes", label: "Notes", icon: "notebook-pen" },
  { view: "activity", label: "Activité", icon: "activity" },
  { view: "claude", label: "Claude", icon: "square-terminal" },
  { view: "settings", label: "Réglages", icon: "settings" },
];

export const DEFAULT_TABS = ALL_TABS.map((t) => t.view).join(",");

/** Always shown: the home screen, and Réglages (to bring the others back). */
export const LOCKED_TABS: TabView[] = ["dashboard", "settings"];

const isTab = (v: string): v is TabView => ALL_TABS.some((t) => t.view === v);

/** Saved list → visible tabs in order (unknown and duplicate names dropped, locked ones added). */
export function parseTabs(raw: string | null | undefined): TabView[] {
  const out: TabView[] = [];
  for (const v of (raw ?? DEFAULT_TABS).split(",").map((s) => s.trim())) {
    if (isTab(v) && !out.includes(v)) out.push(v);
  }
  if (!out.includes("dashboard")) out.unshift("dashboard");
  if (!out.includes("settings")) out.push("settings");
  return out;
}

/** Show or hide a tab (locked ones stay). Hidden tabs come back at their usual place. */
export function toggleTab(tabs: TabView[], view: TabView): TabView[] {
  if (LOCKED_TABS.includes(view)) return tabs;
  if (tabs.includes(view)) return tabs.filter((t) => t !== view);
  const order = ALL_TABS.map((t) => t.view);
  const next = [...tabs];
  const after = order.slice(0, order.indexOf(view)).reverse().find((v) => next.includes(v));
  next.splice(after ? next.indexOf(after) + 1 : 0, 0, view);
  return next;
}

/** Move a visible tab one place left (-1) or right (+1). */
export function moveTab(tabs: TabView[], view: TabView, dir: -1 | 1): TabView[] {
  const i = tabs.indexOf(view);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= tabs.length) return tabs;
  const next = [...tabs];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

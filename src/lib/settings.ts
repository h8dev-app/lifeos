/**
 * Non-sensitive settings, saved in `<app data>/settings.json` (store plugin).
 * API keys are NOT here: they live in the system keyring (see secrets.ts).
 */
import { load, type Store } from "@tauri-apps/plugin-store";

export type ProviderId = "ollama" | "anthropic" | "openai";

export interface Settings {
  aiProvider: ProviderId;
  ollamaModel: string;
  anthropicModel: string;
  openaiModel: string;
  /** GitHub username for push tracking; empty = off. */
  githubUser: string;
  /** Generate last week's review automatically from Monday. */
  weeklyReviewAuto: boolean;
  /** Veil over the background (wallpaper or windows), 0 (clear) to 0.95. */
  overlayOpacity: number;
  /** Visible navigation tabs, in order (comma separated, see ui/tabs.ts). */
  tabs: string;
  /** Look of the panels: "sobre" (flat) or "glass" (liquid glass). */
  style: string;
  /** Color theme (theme.ts), "auto" follows the system. */
  theme: string;
  /** Accent color (theme.ts), "theme" = the theme's own. */
  accent: string;
  /** What is behind the panels: the wallpaper, or the real windows (transparent). */
  backgroundMode: "wallpaper" | "transparent";
  /** Panel opacity, 0 (see-through) to 1 (opaque). */
  panelOpacity: number;
  /** Blur behind panels, in pixels (visible in wallpaper mode only). */
  glassBlur: number;
}

export const DEFAULT_SETTINGS: Settings = {
  aiProvider: "ollama",
  ollamaModel: "qwen2.5:3b",
  anthropicModel: "claude-opus-5-5",
  openaiModel: "gpt-5-mini",
  githubUser: "",
  weeklyReviewAuto: true,
  overlayOpacity: 0.3,
  tabs: "dashboard,tasks,projects,agenda,notes,activity,claude,settings",
  style: "sobre",
  theme: "graphite",
  accent: "theme",
  backgroundMode: "transparent",
  panelOpacity: 0.94,
  glassBlur: 0,
};

let store: Promise<Store> | null = null;
const getStore = () =>
  (store ??= load("settings.json", { autoSave: true, defaults: { ...DEFAULT_SETTINGS } }));

export async function loadSettings(): Promise<Settings> {
  const s = await getStore();
  const out = { ...DEFAULT_SETTINGS };
  const bag = out as unknown as Record<string, string | boolean | number>;
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    const value = await s.get<string | boolean | number>(key);
    if (typeof DEFAULT_SETTINGS[key] === "boolean") {
      if (typeof value === "boolean") bag[key] = value;
    } else if (typeof DEFAULT_SETTINGS[key] === "number") {
      if (typeof value === "number" && Number.isFinite(value)) bag[key] = value;
    } else if (typeof value === "string" && (value.trim() || key === "githubUser")) {
      bag[key] = value.trim();
    }
  }
  return out;
}

export async function saveSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
  const s = await getStore();
  await s.set(key, value);
}

/** Home screen layout of older versions (raw JSON, validated by normalizeLayout). */
export async function loadDashboardLayout(): Promise<unknown> {
  return (await getStore()).get("dashboardFree");
}

/** The layout of settings.json was copied to SQLite (db/blocks.ts) once. */
export async function isBlocksImported(): Promise<boolean> {
  return (await (await getStore()).get("blocksInDb")) === true;
}

export async function markBlocksImported(): Promise<void> {
  await (await getStore()).set("blocksInDb", true);
}

/** Widgets pinned on the screen (kinds), reopened at start-up. */
export async function loadScreenWidgets(): Promise<string[]> {
  const v = await (await getStore()).get("screenWidgets");
  return Array.isArray(v) ? v.filter((k): k is string => typeof k === "string") : [];
}

export async function saveScreenWidgets(kinds: string[]): Promise<void> {
  await (await getStore()).set("screenWidgets", kinds);
}

/**
 * Re-read settings.json from disk. Needed in a screen widget process: its
 * store keeps its own copy, and only the main process writes the file.
 */
export async function reloadStoreFromDisk(): Promise<void> {
  await (await getStore()).reload();
}

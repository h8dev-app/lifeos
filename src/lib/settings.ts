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
  /** Dark veil over the wallpaper, 0 (clear) to 0.95 (almost opaque). */
  overlayOpacity: number;
}

export const DEFAULT_SETTINGS: Settings = {
  aiProvider: "ollama",
  ollamaModel: "qwen2.5:3b",
  anthropicModel: "claude-opus-5-5",
  openaiModel: "gpt-5-mini",
  githubUser: "",
  weeklyReviewAuto: true,
  overlayOpacity: 0.35,
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

/** Home screen layout (raw JSON, validated by normalizeLayout). */
export async function loadDashboardLayout(): Promise<unknown> {
  return (await getStore()).get("dashboardFree");
}

export async function saveDashboardLayout(layout: unknown): Promise<void> {
  await (await getStore()).set("dashboardFree", layout);
}

/** Apply the dark veil over the wallpaper (CSS variable). */
export function applyOverlayOpacity(opacity: number): void {
  const o = Math.min(Math.max(opacity, 0), 0.95);
  document.documentElement.style.setProperty("--overlay-tint", String(o));
}

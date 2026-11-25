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
}

export const DEFAULT_SETTINGS: Settings = {
  aiProvider: "ollama",
  ollamaModel: "qwen2.5:3b",
  anthropicModel: "claude-opus-5-5",
  openaiModel: "gpt-5-mini",
  githubUser: "",
};

let store: Promise<Store> | null = null;
const getStore = () =>
  (store ??= load("settings.json", { autoSave: true, defaults: { ...DEFAULT_SETTINGS } }));

export async function loadSettings(): Promise<Settings> {
  const s = await getStore();
  const out = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    const value = await s.get<string>(key);
    if (typeof value === "string" && (value.trim() || key === "githubUser")) (out as Record<string, string>)[key] = value.trim();
  }
  return out;
}

export async function saveSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
  const s = await getStore();
  await s.set(key, value);
}

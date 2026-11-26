/**
 * Themes and appearance. Colors live here (one source for the page and the
 * previews in Réglages); app.css derives the rest (surfaces, panels…) with
 * color-mix(). Applied as CSS variables on <html>.
 */
import { invoke } from "@tauri-apps/api/core";

export interface Palette {
  dark: boolean;
  /** Veil over the background, and fallback background. */
  veil: string;
  /** Panels (home blocks, columns, bars). Their opacity is a setting. */
  panel: string;
  /** Dialogs and pop-up lists: always opaque. */
  popup: string;
  text: string;
  muted: string;
  border: string;
  accent: string;
}

export type ThemeId = "graphite" | "nuit" | "foret" | "clair" | "sable";
export type ThemeChoice = ThemeId | "auto";
export type AccentId = "theme" | "bleu" | "violet" | "vert" | "orange" | "rose" | "gris";

export const THEMES: Record<ThemeId, { label: string } & Palette> = {
  graphite: {
    label: "Graphite", dark: true, veil: "#0e0f11", panel: "#18191c", popup: "#1f2024",
    text: "#ececef", muted: "#9a9ca3", border: "rgba(255, 255, 255, 0.09)", accent: "#7c9cff",
  },
  nuit: {
    label: "Nuit", dark: true, veil: "#090d15", panel: "#111725", popup: "#172033",
    text: "#e8edf6", muted: "#8e9ab0", border: "rgba(160, 185, 255, 0.11)", accent: "#5aa9ff",
  },
  foret: {
    label: "Forêt", dark: true, veil: "#0a0f0c", panel: "#131a16", popup: "#19221d",
    text: "#e6efe9", muted: "#8fa398", border: "rgba(180, 255, 210, 0.09)", accent: "#5fc492",
  },
  clair: {
    label: "Clair", dark: false, veil: "#f2f2f4", panel: "#ffffff", popup: "#ffffff",
    text: "#1b1c1f", muted: "#6c6e76", border: "rgba(0, 0, 0, 0.09)", accent: "#3b63f3",
  },
  sable: {
    label: "Sable", dark: false, veil: "#f1ece4", panel: "#fbf8f3", popup: "#fffdf9",
    text: "#2a2520", muted: "#85796b", border: "rgba(60, 40, 20, 0.11)", accent: "#c0703f",
  },
};

export const THEME_CHOICES: ThemeChoice[] = ["auto", "graphite", "nuit", "foret", "clair", "sable"];

/** Accent colors, one shade for dark themes and one for light themes (contrast). */
export const ACCENTS: Record<Exclude<AccentId, "theme">, { label: string; dark: string; light: string }> = {
  bleu: { label: "Bleu", dark: "#7c9cff", light: "#3b63f3" },
  violet: { label: "Violet", dark: "#a78bfa", light: "#7c4ddb" },
  vert: { label: "Vert", dark: "#5fc492", light: "#1f9d61" },
  orange: { label: "Orange", dark: "#f0a35e", light: "#c8661c" },
  rose: { label: "Rose", dark: "#f28bb3", light: "#c83d76" },
  gris: { label: "Gris", dark: "#b8bac0", light: "#4b4d55" },
};

export const ACCENT_CHOICES: AccentId[] = ["theme", "bleu", "violet", "vert", "orange", "rose", "gris"];

const isThemeId = (v: string): v is ThemeId => v in THEMES;

/** "auto" follows the system (dark: Graphite, light: Clair). */
export function resolveTheme(choice: string, systemDark: boolean): ThemeId {
  if (isThemeId(choice)) return choice;
  return systemDark ? "graphite" : "clair";
}

export function paletteOf(theme: ThemeId, accent: string): Palette {
  const base = THEMES[theme];
  const a = accent in ACCENTS ? ACCENTS[accent as keyof typeof ACCENTS] : null;
  return { ...base, accent: a ? (base.dark ? a.dark : a.light) : base.accent };
}

/** CSS variables for a palette (pure, tested). */
export function themeTokens(p: Palette): Record<string, string> {
  return {
    "--veil": p.veil,
    "--panel": p.panel,
    "--popup": p.popup,
    "--text": p.text,
    "--text-muted": p.muted,
    "--border": p.border,
    "--accent": p.accent,
    "--on-accent": p.dark ? p.veil : "#ffffff",
    "--ok": p.dark ? "#5cc98a" : "#1f9d55",
    "--error": p.dark ? "#ef6b6b" : "#d64545",
    "--warn": p.dark ? "#e5b450" : "#b7791f",
    "--shadow": p.dark ? "0 12px 32px rgba(0, 0, 0, 0.35)" : "0 12px 32px rgba(20, 20, 30, 0.12)",
    "--backdrop": p.dark ? "rgba(0, 0, 0, 0.45)" : "rgba(30, 30, 40, 0.2)",
    /** Text drawn straight over the desktop (hints, toolbars). */
    "--loose-shadow": p.dark ? "0 1px 3px rgba(0, 0, 0, 0.6)" : "0 1px 3px rgba(255, 255, 255, 0.8)",
  };
}

export interface Appearance {
  theme: string;
  accent: string;
  backgroundMode: "wallpaper" | "transparent";
  overlayOpacity: number;
  panelOpacity: number;
  glassBlur: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;

let current: Partial<Appearance> = {};
let systemListener = false;
const listeners = new Set<(p: Palette) => void>();

/** Called with the new palette each time the theme changes (terminal colors). */
export function onThemeChange(fn: (p: Palette) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function currentPalette(): Palette {
  const dark = matchMedia("(prefers-color-scheme: dark)").matches;
  return paletteOf(resolveTheme(current.theme ?? "auto", dark), current.accent ?? "theme");
}

/** Apply appearance settings; a partial object = live preview of one value. */
export function applyAppearance(s: Partial<Appearance>): void {
  current = { ...current, ...s };
  const root = document.documentElement;
  if (s.theme !== undefined || s.accent !== undefined) {
    const p = currentPalette();
    for (const [k, v] of Object.entries(themeTokens(p))) root.style.setProperty(k, v);
    root.style.colorScheme = p.dark ? "dark" : "light";
    root.dataset.theme = p.dark ? "dark" : "light";
    listeners.forEach((fn) => fn(p));
    if (!systemListener) {
      systemListener = true;
      matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
        if (current.theme === "auto") applyAppearance({ theme: "auto" });
      });
    }
  }
  if (s.backgroundMode !== undefined) {
    const transparent = s.backgroundMode === "transparent";
    root.dataset.bg = transparent ? "transparent" : "wallpaper";
    // Rust picks full screen or maximized window (Wayland hides what is under full screen windows).
    invoke("overlay_set_transparent", { transparent }).catch((e) => console.error("overlay mode", e));
  }
  if (s.overlayOpacity !== undefined) root.style.setProperty("--overlay-tint", pct(clamp(s.overlayOpacity, 0, 0.95)));
  if (s.panelOpacity !== undefined) root.style.setProperty("--panel-opacity", pct(clamp(s.panelOpacity, 0, 1)));
  if (s.glassBlur !== undefined) root.style.setProperty("--glass-blur", `${clamp(s.glassBlur, 0, 40)}px`);
}

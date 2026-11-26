/** Frontend side of the overlay: calls the Rust commands from `overlay.rs`. */
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export const hideOverlay = () => invoke<void>("overlay_hide");
export const toggleOverlay = () => invoke<void>("overlay_toggle");

/** Runs `cb` every time Rust shows the overlay. */
export function onOverlayShown(cb: () => void): Promise<UnlistenFn> {
  return listen("overlay://shown", cb);
}

/** Work to finish before the overlay hides (e.g. save the open note). */
const beforeHide = new Set<() => Promise<void> | void>();

export function onBeforeHide(fn: () => Promise<void> | void): () => void {
  beforeHide.add(fn);
  return () => beforeHide.delete(fn);
}

const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const root = () => document.getElementById("app");

/** Escape key: flush pending work, fade out, then hide. */
export async function closeOverlay(): Promise<void> {
  await Promise.allSettled([...beforeHide].map((fn) => fn()));
  const el = root();
  if (el && !reducedMotion()) {
    await el.animate([{ opacity: 1 }, { opacity: 0, transform: "scale(0.985)" }],
      { duration: 140, easing: "cubic-bezier(0.4, 0, 1, 1)", fill: "forwards" }).finished.catch(() => {});
  }
  await hideOverlay();
}

/**
 * Entry animation each time the overlay appears. While hidden, the page is
 * kept transparent so it never flashes at full opacity before fading in.
 */
export function setupOverlayAnimation(): Promise<UnlistenFn[]> {
  return Promise.all([
    listen("overlay://hidden", () => {
      const el = root();
      if (!el) return;
      el.getAnimations().forEach((a) => a.cancel());
      el.style.opacity = "0";
    }),
    listen("overlay://shown", () => {
      const el = root();
      if (!el) return;
      el.getAnimations().forEach((a) => a.cancel());
      el.style.opacity = "";
      if (reducedMotion()) return;
      el.animate([{ opacity: 0, transform: "scale(0.985)" }, { opacity: 1, transform: "none" }],
        { duration: 240, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" });
    }),
  ]);
}

/**
 * Escape handlers of the views (e.g. clear a selection). The most recent
 * handler runs first; if one returns true, Escape is consumed and the
 * overlay stays open.
 */
const escapeHandlers: (() => boolean)[] = [];

export function onEscape(fn: () => boolean): () => void {
  escapeHandlers.push(fn);
  return () => {
    const i = escapeHandlers.lastIndexOf(fn);
    if (i !== -1) escapeHandlers.splice(i, 1);
  };
}

export function consumeEscape(): boolean {
  for (let i = escapeHandlers.length - 1; i >= 0; i--) if (escapeHandlers[i]()) return true;
  return false;
}

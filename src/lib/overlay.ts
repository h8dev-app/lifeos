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

/** Escape key: flush pending work, then hide. */
export async function closeOverlay(): Promise<void> {
  await Promise.allSettled([...beforeHide].map((fn) => fn()));
  await hideOverlay();
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

/** Frontend side of the overlay: calls the Rust commands from `overlay.rs`. */
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export const hideOverlay = () => invoke<void>("overlay_hide");
export const toggleOverlay = () => invoke<void>("overlay_toggle");

/** Runs `cb` every time Rust shows the overlay. */
export function onOverlayShown(cb: () => void): Promise<UnlistenFn> {
  return listen("overlay://shown", cb);
}

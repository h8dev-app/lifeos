/**
 * Desktop wallpaper drawn behind the overlay (glass effect). Rust reads the
 * image configured on the desktop; here it becomes a blob URL in the CSS
 * variable `--wallpaper`. No wallpaper (Windows, other desktops): a gradient.
 */
import { invoke } from "@tauri-apps/api/core";

let current: string | null = null;
let lastSize = -1;

function mimeOf(bytes: Uint8Array): string {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[8] === 0x57) return "image/webp";
  return "image/svg+xml";
}

/** Load (or reload, when it changed) the wallpaper into `--wallpaper`. */
export async function loadWallpaper(): Promise<void> {
  const buf = await invoke<ArrayBuffer>("wallpaper_image");
  const bytes = new Uint8Array(buf);
  if (bytes.length === lastSize) return; // same image, keep the current URL
  lastSize = bytes.length;
  if (current) URL.revokeObjectURL(current);
  current = bytes.length ? URL.createObjectURL(new Blob([bytes], { type: mimeOf(bytes) })) : null;
  document.documentElement.style.setProperty("--wallpaper", current ? `url("${current}")` : "none");
}

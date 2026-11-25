/** Frontend side of the Claude panel PTY (src-tauri/src/pty.rs). */
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export const CLAUDE_INSTALL_URL = "https://code.claude.com/docs/en/setup";

export const claudeInstalled = () => invoke<boolean>("command_exists", { name: "claude" });

/** Starts `claude` (interactive, no argument) in `cwd`; returns the session id. */
export const ptySpawn = (cwd: string | null, cols: number, rows: number) =>
  invoke<number>("pty_spawn", { cwd, cols, rows });
export const ptyWrite = (id: number, data: string) => invoke<void>("pty_write", { id, data });
export const ptyResize = (id: number, cols: number, rows: number) => invoke<void>("pty_resize", { id, cols, rows });
export const ptyKill = (id: number) => invoke<void>("pty_kill", { id });

export function onPtyData(cb: (e: { id: number; data: string }) => void): Promise<UnlistenFn> {
  return listen<{ id: number; data: string }>("pty://data", (e) => cb(e.payload));
}
export function onPtyExit(cb: (e: { id: number; code: number | null }) => void): Promise<UnlistenFn> {
  return listen<{ id: number; code: number | null }>("pty://exit", (e) => cb(e.payload));
}

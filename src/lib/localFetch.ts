/**
 * Calls to the local servers through Rust (`local_fetch`): Ollama (11434)
 * and ActivityWatch (5600). Rust sends no `Origin` header, which those
 * servers refuse from the webview (403).
 */
import { invoke } from "@tauri-apps/api/core";

export const OLLAMA_PORT = 11434;
export const AW_PORT = 5600;

export interface LocalResponse {
  status: number;
  body: string;
}

export function localFetch(
  port: typeof OLLAMA_PORT | typeof AW_PORT,
  path: string,
  method: "GET" | "POST" = "GET",
  body?: unknown,
): Promise<LocalResponse> {
  return invoke<LocalResponse>("local_fetch", {
    port,
    path,
    method,
    body: body === undefined ? null : JSON.stringify(body),
  });
}

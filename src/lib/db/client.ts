/**
 * SQLite connection (tauri-plugin-sql). Opened once, lazily.
 * Rust gives the exact connection string so migrations run (see src-tauri/src/db.rs).
 */
import { invoke } from "@tauri-apps/api/core";
import Database from "@tauri-apps/plugin-sql";

let db: Promise<Database> | null = null;

export function getDb(): Promise<Database> {
  db ??= invoke<string>("db_url").then((url) => Database.load(url));
  return db;
}

export const nowIso = () => new Date().toISOString();
export const newId = () => crypto.randomUUID();

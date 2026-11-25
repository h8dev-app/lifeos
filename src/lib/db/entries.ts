import type { EntryData, EntrySource } from "../types";
import { getDb, newId, nowIso } from "./client";

export interface RecentEntry {
  id: string;
  categoryId: string;
  occurredAt: string;
  data: EntryData;
  source: EntrySource;
}

interface EntryRow {
  id: string;
  category_id: string;
  occurred_at: string;
  data: string;
  source: EntrySource;
}

export async function addEntry(
  categoryId: string,
  data: EntryData,
  source: EntrySource = "manual",
  occurredAt: string = nowIso(),
): Promise<string> {
  const db = await getDb();
  const id = newId();
  const now = nowIso();
  await db.execute(
    `INSERT INTO entries (id, category_id, occurred_at, data, source, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $6)`,
    [id, categoryId, occurredAt, JSON.stringify(data), source, now],
  );
  return id;
}

export async function listRecentEntries(limit = 10): Promise<RecentEntry[]> {
  const db = await getDb();
  const rows = await db.select<EntryRow[]>(
    `SELECT id, category_id, occurred_at, data, source FROM entries
     WHERE deleted_at IS NULL ORDER BY occurred_at DESC LIMIT $1`,
    [limit],
  );
  return rows.map((r) => ({
    id: r.id,
    categoryId: r.category_id,
    occurredAt: r.occurred_at,
    data: JSON.parse(r.data) as EntryData,
    source: r.source,
  }));
}

/** Soft delete: the row stays, for the future sync. */
export async function deleteEntry(id: string): Promise<void> {
  const db = await getDb();
  const now = nowIso();
  await db.execute("UPDATE entries SET deleted_at = $1, updated_at = $1 WHERE id = $2", [now, id]);
}

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

/** Entries whose `occurred_at` is in `[fromIso, toIso)`, oldest first. */
export async function listEntriesBetween(fromIso: string, toIso: string): Promise<RecentEntry[]> {
  const db = await getDb();
  const rows = await db.select<EntryRow[]>(
    `SELECT id, category_id, occurred_at, data, source FROM entries
     WHERE deleted_at IS NULL AND occurred_at >= $1 AND occurred_at < $2 ORDER BY occurred_at`,
    [fromIso, toIso],
  );
  return rows.map((r) => ({
    id: r.id, categoryId: r.category_id, occurredAt: r.occurred_at, data: JSON.parse(r.data) as EntryData, source: r.source,
  }));
}

/** Insert entries coming from an external source; already known `external_id`s are skipped. Returns how many were added. */
export async function addExternalEntries(
  categoryId: string,
  source: EntrySource,
  items: { externalId: string; occurredAt: string; data: EntryData }[],
): Promise<number> {
  const db = await getDb();
  let added = 0;
  for (const it of items) {
    const now = nowIso();
    const r = await db.execute(
      `INSERT INTO entries (id, category_id, occurred_at, data, source, external_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7) ON CONFLICT(external_id) DO NOTHING`,
      [newId(), categoryId, it.occurredAt, JSON.stringify(it.data), source, it.externalId, now],
    );
    added += r.rowsAffected;
  }
  return added;
}

/** Which of these `external_id`s are already in the DB (deleted rows included). */
export async function knownExternalIds(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const db = await getDb();
  const params = ids.map((_, i) => `$${i + 1}`).join(", ");
  const rows = await db.select<{ external_id: string }[]>(
    `SELECT external_id FROM entries WHERE external_id IN (${params})`,
    ids,
  );
  return new Set(rows.map((r) => r.external_id));
}

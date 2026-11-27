/**
 * Home blocks in SQLite. Geometry (position, size, stacking) and content
 * (title, options) are saved separately, so moving blocks in the main window
 * never overwrites a post-it typed in a screen widget, and the reverse.
 */
import { normalizeLayout, type Block, type BlockOptions } from "../dashboard/layout";
import { getDb, nowIso } from "./client";

interface BlockRow {
  id: string;
  type: string;
  title: string | null;
  options: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const parseOptions = (raw: string): unknown => {
  try { return JSON.parse(raw); } catch { return {}; }
};

/** Blocks in stacking order (last = on top), validated. */
export async function listBlocks(): Promise<Block[]> {
  const db = await getDb();
  const rows = await db.select<BlockRow[]>("SELECT id, type, title, options, x, y, w, h FROM home_blocks ORDER BY z");
  return normalizeLayout(rows.map((r) => ({ ...r, options: parseOptions(r.options) })));
}

export async function countBlocks(): Promise<number> {
  const db = await getDb();
  const [{ n }] = await db.select<{ n: number }[]>("SELECT COUNT(*) AS n FROM home_blocks");
  return n;
}

/**
 * Save the layout: position, size and order of every block; new blocks are
 * inserted with their content; blocks no longer in the list are removed.
 * The content of existing blocks is left as stored.
 */
export async function saveLayout(blocks: Block[]): Promise<void> {
  const db = await getDb();
  const now = nowIso();
  for (const [z, b] of blocks.entries()) {
    await db.execute(
      `INSERT INTO home_blocks (id, type, title, options, x, y, w, h, z, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT(id) DO UPDATE SET x = excluded.x, y = excluded.y, w = excluded.w, h = excluded.h,
         z = excluded.z, updated_at = excluded.updated_at`,
      [b.id, b.type, b.title, JSON.stringify(b.options), b.x, b.y, b.w, b.h, z, now],
    );
  }
  const keep = blocks.map((_, i) => `$${i + 1}`).join(", ");
  await db.execute(
    blocks.length ? `DELETE FROM home_blocks WHERE id NOT IN (${keep})` : "DELETE FROM home_blocks",
    blocks.map((b) => b.id),
  );
}

/** Save the title and options of one block (settings, post-it text). */
export async function saveBlockContent(id: string, title: string | null, options: BlockOptions): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE home_blocks SET title = $1, options = $2, updated_at = $3 WHERE id = $4",
    [title, JSON.stringify(options), nowIso(), id]);
}

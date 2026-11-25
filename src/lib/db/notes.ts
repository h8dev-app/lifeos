/**
 * Markdown notes: the `.md` files in `<app data>/notes/` are the source of
 * truth; the `notes` + `notes_fts` tables are an index for the list and the
 * full-text search. Files edited outside the app are re-indexed by `syncNotes`.
 */
import { BaseDirectory, exists, mkdir, readDir, readTextFile, rename, writeTextFile } from "@tauri-apps/plugin-fs";
import { buildFtsQuery, contentHash, fileNameFor, titleFromContent } from "../notes/markdown";
import { getDb, newId, nowIso } from "./client";

const DIR = "notes";
const TRASH = `${DIR}/.trash`;
const opts = { baseDir: BaseDirectory.AppData };

export interface NoteMeta {
  id: string;
  path: string; // relative to app data, e.g. notes/idee.md
  title: string;
  updatedAt: string;
}

interface NoteRow {
  id: string;
  path: string;
  title: string | null;
  content_hash: string | null;
  updated_at: string;
}

const toMeta = (r: NoteRow): NoteMeta => ({
  id: r.id, path: r.path, title: r.title ?? "Sans titre", updatedAt: r.updated_at,
});

async function ensureDir(): Promise<void> {
  if (!(await exists(DIR, opts))) await mkdir(DIR, { ...opts, recursive: true });
}

async function indexNote(id: string, title: string, body: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM notes_fts WHERE note_id = $1", [id]);
  await db.execute("INSERT INTO notes_fts (note_id, title, body) VALUES ($1, $2, $3)", [id, title, body]);
}

export async function listNotes(search = ""): Promise<NoteMeta[]> {
  const db = await getDb();
  const q = buildFtsQuery(search);
  const rows = q
    ? await db.select<NoteRow[]>(
        `SELECT n.* FROM notes_fts f JOIN notes n ON n.id = f.note_id
         WHERE notes_fts MATCH $1 AND n.deleted_at IS NULL ORDER BY rank`,
        [q],
      )
    : await db.select<NoteRow[]>(
        "SELECT * FROM notes WHERE deleted_at IS NULL ORDER BY updated_at DESC",
      );
  return rows.map(toMeta);
}

export async function readNote(path: string): Promise<string> {
  return readTextFile(path, opts);
}

export async function createNote(title: string): Promise<NoteMeta> {
  await ensureDir();
  const db = await getDb();
  // Avoid names used in the DB (even deleted rows: path is UNIQUE) and files
  // not indexed yet, so an existing file is never overwritten.
  const taken = new Set((await db.select<{ path: string }[]>("SELECT path FROM notes")).map((r) => r.path.slice(DIR.length + 1)));
  for (const e of await readDir(DIR, opts)) taken.add(e.name);
  const name = fileNameFor(title, taken);
  const path = `${DIR}/${name}`;
  const content = `# ${title}\n\n`;
  await writeTextFile(path, content, opts);

  const id = newId();
  const now = nowIso();
  await db.execute(
    `INSERT INTO notes (id, path, title, content_hash, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $5)`,
    [id, path, title, contentHash(content), now],
  );
  await indexNote(id, title, content);
  return { id, path, title, updatedAt: now };
}

/** Write the file and refresh the index. The file name never changes. */
export async function saveNote(note: NoteMeta, content: string): Promise<NoteMeta> {
  await writeTextFile(note.path, content, opts);
  const title = titleFromContent(content);
  const now = nowIso();
  const db = await getDb();
  await db.execute(
    "UPDATE notes SET title = $1, content_hash = $2, updated_at = $3 WHERE id = $4",
    [title, contentHash(content), now, note.id],
  );
  await indexNote(note.id, title, content);
  return { ...note, title, updatedAt: now };
}

/** Soft delete: the file moves to `notes/.trash/`, nothing is erased. */
export async function deleteNote(note: NoteMeta): Promise<void> {
  if (!(await exists(TRASH, opts))) await mkdir(TRASH, { ...opts, recursive: true });
  const target = `${TRASH}/${Date.now()}-${note.path.slice(DIR.length + 1)}`;
  await rename(note.path, target, { oldPathBaseDir: BaseDirectory.AppData, newPathBaseDir: BaseDirectory.AppData });
  const db = await getDb();
  const now = nowIso();
  await db.execute("UPDATE notes SET deleted_at = $1, updated_at = $1 WHERE id = $2", [now, note.id]);
  await db.execute("DELETE FROM notes_fts WHERE note_id = $1", [note.id]);
}

/**
 * Align the index with the folder: new `.md` files are added, changed ones
 * re-indexed, missing ones marked deleted.
 */
export async function syncNotes(): Promise<void> {
  await ensureDir();
  const db = await getDb();
  const rows = await db.select<NoteRow[]>("SELECT * FROM notes WHERE deleted_at IS NULL");
  const byPath = new Map(rows.map((r) => [r.path, r]));
  const seen = new Set<string>();

  for (const entry of await readDir(DIR, opts)) {
    if (!entry.isFile || !entry.name.endsWith(".md")) continue;
    const path = `${DIR}/${entry.name}`;
    seen.add(path);
    const content = await readTextFile(path, opts);
    const hash = contentHash(content);
    const row = byPath.get(path);
    const title = titleFromContent(content);
    const now = nowIso();

    if (!row) {
      // A soft-deleted row may hold this path (UNIQUE): revive it.
      const old = await db.select<{ id: string }[]>("SELECT id FROM notes WHERE path = $1", [path]);
      const id = old[0]?.id ?? newId();
      await db.execute(
        `INSERT INTO notes (id, path, title, content_hash, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $5)
         ON CONFLICT(path) DO UPDATE SET title = $3, content_hash = $4, updated_at = $5, deleted_at = NULL`,
        [id, path, title, hash, now],
      );
      await indexNote(id, title, content);
    } else if (row.content_hash !== hash) {
      await db.execute(
        "UPDATE notes SET title = $1, content_hash = $2, updated_at = $3 WHERE id = $4",
        [title, hash, now, row.id],
      );
      await indexNote(row.id, title, content);
    }
  }

  for (const row of rows) {
    if (seen.has(row.path)) continue;
    const now = nowIso();
    await db.execute("UPDATE notes SET deleted_at = $1, updated_at = $1 WHERE id = $2", [now, row.id]);
    await db.execute("DELETE FROM notes_fts WHERE note_id = $1", [row.id]);
  }
}

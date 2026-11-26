/**
 * Markdown notes: the `.md` files in `<app data>/notes/` are the source of
 * truth; the `notes` + `notes_fts` tables are an index for the list and the
 * full-text search. Files edited outside the app are re-indexed by `syncNotes`.
 *
 * Categories are sub-folders: `notes/Cours/maths.md` is in "Cours",
 * `notes/idee.md` has no category. Weekly reviews live in `notes/Bilans/`.
 */
import { BaseDirectory, exists, mkdir, readDir, readTextFile, rename, writeTextFile } from "@tauri-apps/plugin-fs";
import {
  buildFtsQuery, contentHash, excerptFromContent, fileNameFor, isReviewFile, notePath,
  REVIEW_FOLDER, sanitizeFolderName, splitNotePath, titleFromContent,
} from "../notes/markdown";
import { getDb, newId, nowIso } from "./client";

const DIR = "notes";
const TRASH = `${DIR}/.trash`;
const opts = { baseDir: BaseDirectory.AppData };
const renameOpts = { oldPathBaseDir: BaseDirectory.AppData, newPathBaseDir: BaseDirectory.AppData };

export interface NoteMeta {
  id: string;
  path: string; // relative to app data, e.g. notes/Cours/maths.md
  folder: string; // "" = no category
  title: string;
  excerpt: string;
  updatedAt: string;
}

interface NoteRow {
  id: string;
  path: string;
  title: string | null;
  content_hash: string | null;
  updated_at: string;
  body?: string | null;
}

const toMeta = (r: NoteRow): NoteMeta => ({
  id: r.id,
  path: r.path,
  folder: splitNotePath(r.path).folder,
  title: r.title ?? "Sans titre",
  excerpt: excerptFromContent(r.body ?? ""),
  updatedAt: r.updated_at,
});

const folderDir = (folder: string) => (folder ? `${DIR}/${folder}` : DIR);

async function ensureDir(folder = ""): Promise<void> {
  const dir = folderDir(folder);
  if (!(await exists(dir, opts))) await mkdir(dir, { ...opts, recursive: true });
}

async function indexNote(id: string, title: string, body: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM notes_fts WHERE note_id = $1", [id]);
  await db.execute("INSERT INTO notes_fts (note_id, title, body) VALUES ($1, $2, $3)", [id, title, body]);
}

/** File names already used in `folder` (DB rows, even deleted, + files on disk). */
async function takenNames(folder: string): Promise<Set<string>> {
  const db = await getDb();
  const taken = new Set<string>();
  for (const r of await db.select<{ path: string }[]>("SELECT path FROM notes")) {
    const p = splitNotePath(r.path);
    if (p.folder === folder) taken.add(p.file);
  }
  for (const e of await readDir(folderDir(folder), opts)) taken.add(e.name);
  return taken;
}

const SELECT = `SELECT n.id, n.path, n.title, n.content_hash, n.updated_at, substr(f.body, 1, 600) AS body
  FROM notes n LEFT JOIN notes_fts f ON f.note_id = n.id`;

export async function listNotes(search = ""): Promise<NoteMeta[]> {
  const db = await getDb();
  const q = buildFtsQuery(search);
  const rows = q
    ? await db.select<NoteRow[]>(
        `${SELECT} WHERE notes_fts MATCH $1 AND n.deleted_at IS NULL ORDER BY rank`,
        [q],
      )
    : await db.select<NoteRow[]>(`${SELECT} WHERE n.deleted_at IS NULL ORDER BY n.updated_at DESC`);
  return rows.map(toMeta);
}

/** Categories = sub-folders of `notes/` (hidden ones such as `.trash` excluded). */
export async function listFolders(): Promise<string[]> {
  await ensureDir();
  return (await readDir(DIR, opts))
    .filter((e) => e.isDirectory && !e.name.startsWith("."))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, "fr"));
}

/** Create a category. Returns the sanitized name, or throws if invalid. */
export async function createFolder(name: string): Promise<string> {
  const folder = sanitizeFolderName(name);
  if (!folder) throw new Error("Nom de catégorie invalide.");
  await ensureDir(folder);
  return folder;
}

export async function readNote(path: string): Promise<string> {
  return readTextFile(path, opts);
}

export async function createNote(title: string, folder = ""): Promise<NoteMeta> {
  folder = sanitizeFolderName(folder);
  await ensureDir(folder);
  const db = await getDb();
  // Never overwrite an existing file, even one not indexed yet.
  const path = notePath(folder, fileNameFor(title, await takenNames(folder)));
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
  return { id, path, folder, title, excerpt: "", updatedAt: now };
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
  return { ...note, title, excerpt: excerptFromContent(content), updatedAt: now };
}

/** Move a note to another category (file moved, same id). */
export async function moveNote(note: NoteMeta, folder: string): Promise<NoteMeta> {
  folder = sanitizeFolderName(folder);
  if (folder === note.folder) return note;
  await ensureDir(folder);
  const { file } = splitNotePath(note.path);
  const taken = await takenNames(folder);
  const target = notePath(folder, taken.has(file) ? fileNameFor(note.title, taken) : file);
  await rename(note.path, target, renameOpts);
  const db = await getDb();
  const now = nowIso();
  await db.execute("UPDATE notes SET path = $1, updated_at = $2 WHERE id = $3", [target, now, note.id]);
  return { ...note, path: target, folder, updatedAt: now };
}

/** Soft delete: the file moves to `notes/.trash/`, nothing is erased. */
export async function deleteNote(note: NoteMeta): Promise<void> {
  if (!(await exists(TRASH, opts))) await mkdir(TRASH, { ...opts, recursive: true });
  const { folder, file } = splitNotePath(note.path);
  const target = `${TRASH}/${Date.now()}-${folder ? `${folder}-` : ""}${file}`;
  await rename(note.path, target, renameOpts);
  const db = await getDb();
  const now = nowIso();
  await db.execute("UPDATE notes SET deleted_at = $1, updated_at = $1 WHERE id = $2", [now, note.id]);
  await db.execute("DELETE FROM notes_fts WHERE note_id = $1", [note.id]);
}

/** All `.md` paths: root + one level of category folders. */
async function listFiles(): Promise<string[]> {
  const paths: string[] = [];
  for (const e of await readDir(DIR, opts)) {
    if (e.isFile && e.name.endsWith(".md")) paths.push(notePath("", e.name));
    else if (e.isDirectory && !e.name.startsWith(".")) {
      for (const f of await readDir(`${DIR}/${e.name}`, opts)) {
        if (f.isFile && f.name.endsWith(".md")) paths.push(notePath(e.name, f.name));
      }
    }
  }
  return paths;
}

/** Old weekly reviews were saved at the root: move them into "Bilans". */
async function moveRootReviews(): Promise<void> {
  const db = await getDb();
  for (const e of await readDir(DIR, opts)) {
    if (!e.isFile || !isReviewFile(e.name)) continue;
    await ensureDir(REVIEW_FOLDER);
    const target = notePath(REVIEW_FOLDER, e.name);
    if (await exists(target, opts)) continue;
    const from = notePath("", e.name);
    await rename(from, target, renameOpts);
    await db.execute("UPDATE notes SET path = $1 WHERE path = $2", [target, from]);
  }
}

/**
 * Align the index with the folders: new `.md` files are added, changed ones
 * re-indexed, missing ones marked deleted.
 */
export async function syncNotes(): Promise<void> {
  await ensureDir();
  await moveRootReviews();
  const db = await getDb();
  const rows = await db.select<NoteRow[]>("SELECT * FROM notes WHERE deleted_at IS NULL");
  const byPath = new Map(rows.map((r) => [r.path, r]));
  const seen = new Set<string>();

  for (const path of await listFiles()) {
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

/**
 * Write a note with a fixed file name in a category (weekly reviews): created
 * the first time, overwritten next times.
 */
export async function upsertNoteFile(fileName: string, content: string, folder = REVIEW_FOLDER): Promise<NoteMeta> {
  await ensureDir(folder);
  const path = notePath(folder, fileName);
  const db = await getDb();
  const rows = await db.select<NoteRow[]>("SELECT * FROM notes WHERE path = $1", [path]);
  const title = titleFromContent(content);
  const now = nowIso();
  await writeTextFile(path, content, opts);
  const id = rows[0]?.id ?? newId();
  await db.execute(
    `INSERT INTO notes (id, path, title, content_hash, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $5)
     ON CONFLICT(path) DO UPDATE SET title = $3, content_hash = $4, updated_at = $5, deleted_at = NULL`,
    [id, path, title, contentHash(content), now],
  );
  await indexNote(id, title, content);
  return { id, path, folder, title, excerpt: excerptFromContent(content), updatedAt: now };
}

/** Does this review/note file exist (root or given category, not deleted)? */
export async function noteFileExists(fileName: string, folder = REVIEW_FOLDER): Promise<boolean> {
  const db = await getDb();
  const rows = await db.select<{ n: number }[]>(
    "SELECT COUNT(*) AS n FROM notes WHERE path IN ($1, $2) AND deleted_at IS NULL",
    [notePath(folder, fileName), notePath("", fileName)],
  );
  return rows[0]?.n > 0;
}

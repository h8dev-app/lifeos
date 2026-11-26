/** Pure helpers for Markdown notes. */
import { slugify } from "../parsing/slash";

/** Title = first `# heading`, else first non-empty line, else "Sans titre". */
export function titleFromContent(content: string): string {
  const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);
  const heading = lines.find((l) => /^#\s+/.test(l));
  const title = (heading ?? lines[0] ?? "").replace(/^#+\s*/, "").trim();
  return title.slice(0, 120) || "Sans titre";
}

/** Unique file name in `notes/`: `reunion-bts.md`, then `reunion-bts-2.md`… */
export function fileNameFor(title: string, existing: Set<string>): string {
  const base = slugify(title).slice(0, 60) || "note";
  let name = `${base}.md`;
  for (let i = 2; existing.has(name); i++) name = `${base}-${i}.md`;
  return name;
}

/**
 * User search → safe FTS5 query: each word becomes a quoted prefix
 * (`"rev"*`), all words required. Quotes in the input are removed, so
 * FTS5 operators typed by the user cannot break the query.
 */
export function buildFtsQuery(input: string): string {
  return input
    .replace(/"/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => `"${w}"*`)
    .join(" ");
}

/** Short stable hash (FNV-1a 32 bit) to detect files changed outside the app. */
export function contentHash(content: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < content.length; i++) {
    h ^= content.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

// ------------------------------------------------------------- categories

/** Category of notes = sub-folder of `notes/`. Root = no category (""). */
export const REVIEW_FOLDER = "Bilans";

/**
 * Folder name typed by the user → safe on Linux and Windows. Keeps accents
 * and capitals ("Économie"), removes characters forbidden in file names and
 * leading dots (hidden folders, `.trash`). Empty string if nothing is left.
 */
export function sanitizeFolderName(name: string): string {
  return name
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 40)
    .trim();
}

/** `notes/Cours/x.md` → `{ folder: "Cours", file: "x.md" }`; `notes/x.md` → folder "". */
export function splitNotePath(path: string): { folder: string; file: string } {
  const parts = path.split("/").slice(1); // drop "notes"
  const file = parts.pop() ?? "";
  return { folder: parts.join("/"), file };
}

export const notePath = (folder: string, file: string) => (folder ? `notes/${folder}/${file}` : `notes/${file}`);

/** Weekly review files, moved into the "Bilans" category. */
export const isReviewFile = (name: string) => /^bilan-\d{4}-s\d{2}\.md$/.test(name);

/** Short plain-text preview: no title line, no Markdown markers. */
export function excerptFromContent(content: string, max = 160): string {
  const lines = content.split("\n");
  const firstHeading = lines.findIndex((l) => /^#\s+/.test(l.trim()));
  if (firstHeading !== -1) lines.splice(firstHeading, 1);
  const text = lines
    .join(" ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")          // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")        // links → text
    .replace(/^\s*[-*+]\s+\[[ xX]\]\s+/gm, "")      // task boxes
    .replace(/[#>*_`~|]+/g, " ")
    .replace(/(^|\s)-\s+\[[ xX]\]\s+/g, "$1")
    .replace(/(^|\s)[-+]\s+/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** `/note Réunion BTS #Cours` → `{ title: "Réunion BTS", folder: "Cours" }`. */
export function parseNoteArgs(args: string): { title: string; folder: string } {
  let folder = "";
  const words: string[] = [];
  for (const token of args.trim().split(/\s+/).filter(Boolean)) {
    if (token.startsWith("#") && token.length > 1 && !folder) folder = sanitizeFolderName(token.slice(1).replace(/_/g, " "));
    else words.push(token);
  }
  return { title: words.join(" "), folder };
}

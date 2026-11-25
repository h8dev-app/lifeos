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

/**
 * `/tache` arguments: the title, plus an optional due date written `@date`
 * anywhere in the text (see `parseDateWord`).
 *
 *   /tache rendre le dossier @vendredi   → { title: "rendre le dossier", dueDate: "2026-11-27" }
 */
import { parseDateWord } from "../dates";

export function parseTaskArgs(
  args: string,
  now: Date = new Date(),
): { title: string; dueDate: string | null } | { error: string } {
  let dueDate: string | null = null;
  const words: string[] = [];
  for (const token of args.trim().split(/\s+/).filter(Boolean)) {
    if (token.startsWith("@") && token.length > 1) {
      const date = parseDateWord(token.slice(1), now);
      if (!date) return { error: `Date « ${token} » non comprise (ex. @demain, @vendredi, @28/11).` };
      dueDate = date;
    } else {
      words.push(token);
    }
  }
  const title = words.join(" ");
  if (!title) return { error: "Usage : /tache <titre> [@échéance]" };
  return { title, dueDate };
}

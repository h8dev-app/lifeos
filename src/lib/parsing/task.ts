/**
 * `/tache` arguments, in any order inside the text:
 *   @date      due date (see `parseDateWord`)
 *   #Catégorie category (created if needed; `_` = space)
 *   !priorité  !haute / !moyenne / !basse (or !1 !2 !3, !urgent)
 *   +projet    project (its slug, see Projects)
 *
 *   /tache rendre le dossier #Cours !haute @vendredi +lifeos
 */
import { parseDateWord } from "../dates";
import { parsePriorityWord, type Priority } from "../tasks/board";

export interface ParsedTask {
  title: string;
  dueDate: string | null;
  category: string | null;
  priority: Priority | null;
  /** Word after `+`, to look up among the projects. */
  project: string | null;
}

export function parseTaskArgs(args: string, now: Date = new Date()): ParsedTask | { error: string } {
  let dueDate: string | null = null;
  let category: string | null = null;
  let priority: Priority | null = null;
  let project: string | null = null;
  const words: string[] = [];
  for (const token of args.trim().split(/\s+/).filter(Boolean)) {
    if (token.startsWith("@") && token.length > 1) {
      const date = parseDateWord(token.slice(1), now);
      if (!date) return { error: `Date « ${token} » non comprise (ex. @demain, @vendredi, @28/11).` };
      dueDate = date;
    } else if (token.startsWith("#") && token.length > 1) {
      category = token.slice(1).replace(/_/g, " ").trim();
    } else if (token.startsWith("+") && token.length > 1) {
      project = token.slice(1);
    } else if (token.startsWith("!") && token.length > 1) {
      const p = parsePriorityWord(token.slice(1));
      if (!p) return { error: `Priorité « ${token} » inconnue (!haute, !moyenne, !basse).` };
      priority = p;
    } else {
      words.push(token);
    }
  }
  const title = words.join(" ");
  if (!title) return { error: "Usage : /tache <titre> [#catégorie] [!haute|!moyenne|!basse] [@échéance] [+projet]" };
  return { title, dueDate, category, priority, project };
}

/** Kanban logic (pure, tested): statuses, priorities, sorting. */

export type TaskStatus = "todo" | "doing" | "done";
export type Priority = 1 | 2 | 3;

export const STATUSES: { id: TaskStatus; label: string }[] = [
  { id: "todo", label: "À faire" },
  { id: "doing", label: "En cours" },
  { id: "done", label: "Fait" },
];

/** `color`: CSS color of the priority dot (theme tokens). */
export const PRIORITIES: { id: Priority; label: string; color: string }[] = [
  { id: 1, label: "Haute", color: "var(--error)" },
  { id: 2, label: "Moyenne", color: "var(--warn)" },
  { id: 3, label: "Basse", color: "var(--text-muted)" },
];

export const priorityOf = (p: number) => PRIORITIES.find((x) => x.id === p) ?? PRIORITIES[1];

/** Haute → Moyenne → Basse → Haute (click on the badge). */
export const nextPriority = (p: Priority): Priority => (p === 3 ? 1 : ((p + 1) as Priority));

interface Sortable {
  status: TaskStatus;
  priority: number;
  dueDate: string | null;
  doneAt: string | null;
  position: number | null;
  createdAt: string;
}

/**
 * Order inside a column. Open tasks: priority, then due date (earliest
 * first, none last), then creation order. Done tasks: most recent first.
 */
export function compareTasks(a: Sortable, b: Sortable): number {
  if (a.status === "done" && b.status === "done") return (b.doneAt ?? "").localeCompare(a.doneAt ?? "");
  if (a.priority !== b.priority) return a.priority - b.priority;
  const da = a.dueDate ?? "9999-12-31";
  const db = b.dueDate ?? "9999-12-31";
  if (da !== db) return da.localeCompare(db);
  return (a.position ?? 0) - (b.position ?? 0) || a.createdAt.localeCompare(b.createdAt);
}

export function groupByStatus<T extends Sortable>(tasks: T[]): Record<TaskStatus, T[]> {
  const out: Record<TaskStatus, T[]> = { todo: [], doing: [], done: [] };
  for (const t of tasks) out[t.status].push(t);
  for (const k of Object.keys(out) as TaskStatus[]) out[k].sort(compareTasks);
  return out;
}

const PRIORITY_WORDS: Record<string, Priority> = {
  "1": 1, haute: 1, haut: 1, urgent: 1, urgente: 1,
  "2": 2, moyenne: 2, moyen: 2, normale: 2, normal: 2,
  "3": 3, basse: 3, bas: 3,
};

/** `!haute`, `!1`, `!urgent`… → priority, or null. */
export function parsePriorityWord(word: string): Priority | null {
  const w = word.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  return PRIORITY_WORDS[w] ?? null;
}

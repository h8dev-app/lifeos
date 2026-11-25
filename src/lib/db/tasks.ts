import { addDays, startOfDayIso, today } from "../dates";
import { getDb, newId, nowIso } from "./client";

export interface Task {
  id: string;
  title: string;
  plannedFor: string | null; // YYYY-MM-DD
  dueDate: string | null;    // YYYY-MM-DD
  doneAt: string | null;     // ISO timestamp
}

interface TaskRow {
  id: string;
  title: string;
  planned_for: string | null;
  due_date: string | null;
  done_at: string | null;
}

const toTask = (r: TaskRow): Task => ({
  id: r.id, title: r.title, plannedFor: r.planned_for, dueDate: r.due_date, doneAt: r.done_at,
});

export async function addTask(title: string, dueDate: string | null, plannedFor = today()): Promise<void> {
  const db = await getDb();
  const now = nowIso();
  await db.execute(
    `INSERT INTO tasks (id, title, planned_for, due_date, position, created_at, updated_at)
     VALUES ($1, $2, $3, $4, (SELECT COALESCE(MAX(position), 0) + 1 FROM tasks), $5, $5)`,
    [newId(), title, plannedFor, dueDate, now],
  );
}

/**
 * Open tasks + tasks done today. Undone tasks planned in the past stay in
 * "today" (they carry over automatically).
 */
export async function listTasks(): Promise<Task[]> {
  const db = await getDb();
  const rows = await db.select<TaskRow[]>(
    `SELECT id, title, planned_for, due_date, done_at FROM tasks
     WHERE deleted_at IS NULL AND (done_at IS NULL OR done_at >= $1)
     ORDER BY done_at IS NOT NULL, COALESCE(due_date, '9999'), position`,
    [startOfDayIso()],
  );
  return rows.map(toTask);
}

async function update(id: string, set: string, values: unknown[]): Promise<void> {
  const db = await getDb();
  const now = nowIso();
  await db.execute(`UPDATE tasks SET ${set}, updated_at = $1 WHERE id = $2`, [now, id, ...values]);
}

export const setTaskDone = (id: string, done: boolean) =>
  update(id, "done_at = $3", [done ? nowIso() : null]);

/** "Reporter": plan the task for tomorrow. */
export const postponeTask = (id: string) => update(id, "planned_for = $3", [addDays(today(), 1)]);

export const deleteTask = (id: string) => update(id, "deleted_at = $1", []);

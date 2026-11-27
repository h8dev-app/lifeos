import { addDays, startOfDayIso, today } from "../dates";
import type { Priority, TaskStatus } from "../tasks/board";
import { getDb, newId, nowIso } from "./client";

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  categoryId: string | null;
  projectId: string | null;
  milestoneId: string | null;
  plannedFor: string | null; // YYYY-MM-DD
  dueDate: string | null;    // YYYY-MM-DD
  doneAt: string | null;     // ISO timestamp
  position: number | null;
  createdAt: string;
}

export interface TaskCategory {
  id: string;
  name: string;
  color: string;
}

interface TaskRow {
  id: string;
  title: string;
  status: TaskStatus;
  priority: number;
  category_id: string | null;
  project_id: string | null;
  milestone_id: string | null;
  planned_for: string | null;
  due_date: string | null;
  done_at: string | null;
  position: number | null;
  created_at: string;
}

const COLUMNS =
  "id, title, status, priority, category_id, project_id, milestone_id, planned_for, due_date, done_at, position, created_at";

const toTask = (r: TaskRow): Task => ({
  id: r.id,
  title: r.title,
  status: r.status,
  priority: (r.priority as Priority) ?? 2,
  categoryId: r.category_id,
  projectId: r.project_id,
  milestoneId: r.milestone_id,
  plannedFor: r.planned_for,
  dueDate: r.due_date,
  doneAt: r.done_at,
  position: r.position,
  createdAt: r.created_at,
});

export interface NewTask {
  title: string;
  dueDate?: string | null;
  categoryId?: string | null;
  projectId?: string | null;
  milestoneId?: string | null;
  priority?: Priority;
  status?: TaskStatus;
  plannedFor?: string | null;
}

export async function addTask(t: NewTask): Promise<void> {
  const db = await getDb();
  const now = nowIso();
  const status = t.status ?? "todo";
  await db.execute(
    `INSERT INTO tasks (id, title, status, priority, category_id, project_id, milestone_id, planned_for, due_date, done_at,
       position, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, (SELECT COALESCE(MAX(position), 0) + 1 FROM tasks), $11, $11)`,
    [newId(), t.title, status, t.priority ?? 2, t.categoryId ?? null, t.projectId ?? null, t.milestoneId ?? null,
     t.plannedFor ?? today(), t.dueDate ?? null, status === "done" ? now : null, now],
  );
}

/**
 * Board content: every open task + tasks done in the last 7 days.
 * (The dashboard keeps showing only today's open tasks + done today.)
 */
export async function listTasks(): Promise<Task[]> {
  const db = await getDb();
  const since = new Date(Date.parse(startOfDayIso()) - 6 * 86_400_000).toISOString();
  const rows = await db.select<TaskRow[]>(
    `SELECT ${COLUMNS} FROM tasks
     WHERE deleted_at IS NULL AND (status != 'done' OR done_at >= $1)`,
    [since],
  );
  return rows.map(toTask);
}

/** Update several tasks at once with the same change. */
async function updateMany(ids: string[], set: string, values: unknown[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDb();
  const now = nowIso();
  const first = values.length + 2; // $1 = now, $2..$n = values, then ids
  const placeholders = ids.map((_, i) => `$${first + i}`).join(", ");
  await db.execute(
    `UPDATE tasks SET ${set}, updated_at = $1 WHERE id IN (${placeholders})`,
    [now, ...values, ...ids],
  );
}

/** Change status; `done` stamps `done_at`, other statuses clear it. */
export function setTasksStatus(ids: string[], status: TaskStatus): Promise<void> {
  return status === "done"
    ? updateMany(ids, "status = 'done', done_at = $1", [])
    : updateMany(ids, "status = $2, done_at = NULL", [status]);
}

export const setTaskDone = (id: string, done: boolean) => setTasksStatus([id], done ? "done" : "todo");
export const setTasksPriority = (ids: string[], p: Priority) => updateMany(ids, "priority = $2", [p]);
export const setTasksCategory = (ids: string[], categoryId: string | null) =>
  updateMany(ids, "category_id = $2", [categoryId]);
export const deleteTasks = (ids: string[]) => updateMany(ids, "deleted_at = $1", []);
export const deleteTask = (id: string) => deleteTasks([id]);

/** "Reporter": plan the task for tomorrow. */
export const postponeTask = (id: string) => updateMany([id], "planned_for = $2", [addDays(today(), 1)]);

export async function updateTask(
  id: string,
  t: {
    title: string; dueDate: string | null; categoryId: string | null; priority: Priority;
    projectId: string | null; milestoneId: string | null;
  },
): Promise<void> {
  await updateMany([id], "title = $2, due_date = $3, category_id = $4, priority = $5, project_id = $6, milestone_id = $7",
    [t.title, t.dueDate, t.categoryId, t.priority, t.projectId, t.milestoneId]);
}

export const setTasksProject = (ids: string[], projectId: string | null) =>
  updateMany(ids, "project_id = $2, milestone_id = NULL", [projectId]);

/** Every task of the projects (done ones included, whatever their age): progress and project pages. */
export async function listProjectTasks(projectId?: string): Promise<Task[]> {
  const db = await getDb();
  const rows = await db.select<TaskRow[]>(
    `SELECT ${COLUMNS} FROM tasks WHERE deleted_at IS NULL AND project_id ${projectId ? "= $1" : "IS NOT NULL"}
     ORDER BY position`,
    projectId ? [projectId] : [],
  );
  return rows.map(toTask);
}

// ---------------------------------------------------------- categories

const PALETTE = ["#60a5fa", "#4ade80", "#f472b6", "#fbbf24", "#a78bfa", "#2dd4bf", "#fb923c", "#f87171"];

export async function listTaskCategories(): Promise<TaskCategory[]> {
  const db = await getDb();
  const rows = await db.select<{ id: string; name: string; color: string | null }[]>(
    "SELECT id, name, color FROM task_categories WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE",
  );
  return rows.map((r) => ({ id: r.id, name: r.name, color: r.color ?? PALETTE[0] }));
}

/** Find a category by name (case-insensitive) or create it. Returns its id. */
export async function ensureTaskCategory(name: string): Promise<string> {
  const clean = name.trim().slice(0, 40);
  if (!clean) throw new Error("Nom de catégorie vide.");
  const db = await getDb();
  const found = await db.select<{ id: string }[]>(
    "SELECT id FROM task_categories WHERE deleted_at IS NULL AND name = $1 COLLATE NOCASE",
    [clean],
  );
  if (found[0]) return found[0].id;
  const [{ n }] = await db.select<{ n: number }[]>("SELECT COUNT(*) AS n FROM task_categories");
  const id = newId();
  const now = nowIso();
  await db.execute(
    "INSERT INTO task_categories (id, name, color, created_at, updated_at) VALUES ($1, $2, $3, $4, $4)",
    [id, clean, PALETTE[n % PALETTE.length], now],
  );
  return id;
}

/** Soft delete; its tasks become "sans catégorie". */
export async function deleteTaskCategory(id: string): Promise<void> {
  const db = await getDb();
  const now = nowIso();
  await db.execute("UPDATE task_categories SET deleted_at = $1, updated_at = $1 WHERE id = $2", [now, id]);
  await db.execute("UPDATE tasks SET category_id = NULL, updated_at = $1 WHERE category_id = $2", [now, id]);
}

// ---------------------------------------------------------- reviews

/** Titles of tasks done in `[fromIso, toIso)`. */
export async function listTasksDoneBetween(fromIso: string, toIso: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db.select<{ title: string }[]>(
    `SELECT title FROM tasks WHERE deleted_at IS NULL AND done_at >= $1 AND done_at < $2 ORDER BY done_at`,
    [fromIso, toIso],
  );
  return rows.map((r) => r.title);
}

/** Open tasks (not done, not deleted). */
export async function listOpenTasks(): Promise<Task[]> {
  const db = await getDb();
  const rows = await db.select<TaskRow[]>(
    `SELECT ${COLUMNS} FROM tasks WHERE deleted_at IS NULL AND status != 'done'`,
  );
  return rows.map(toTask);
}

/** Projects and milestones (SQLite). Pure logic: lib/projects/projects.ts. */
import { isIconName } from "../ui/iconNames";
import { parseKeywords, PROJECT_COLORS, uniqueSlug, type Milestone, type Project, type ProjectStatus } from "../projects/projects";
import { getDb, newId, nowIso } from "./client";

interface ProjectRow {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  icon: string | null;
  status: ProjectStatus;
  description: string | null;
  due_date: string | null;
  notes_folder: string | null;
  folder: string | null;
  repo: string | null;
  keywords: string | null;
}

const toProject = (r: ProjectRow): Project => ({
  id: r.id,
  name: r.name,
  slug: r.slug,
  color: r.color ?? PROJECT_COLORS[0],
  icon: r.icon && isIconName(r.icon) ? r.icon : null,
  status: r.status,
  description: r.description,
  dueDate: r.due_date,
  notesFolder: r.notes_folder,
  folder: r.folder,
  repo: r.repo,
  keywords: parseKeywords(r.keywords),
});

export async function listProjects(): Promise<Project[]> {
  const db = await getDb();
  const rows = await db.select<ProjectRow[]>(
    `SELECT * FROM projects WHERE deleted_at IS NULL
     ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'idea' THEN 1 WHEN 'paused' THEN 2 ELSE 3 END, name COLLATE NOCASE`,
  );
  return rows.map(toProject);
}

/** Everything the dialog edits. */
export type ProjectInput = Omit<Project, "id" | "slug">;

export async function createProject(p: Pick<ProjectInput, "name"> & Partial<ProjectInput>): Promise<Project> {
  const db = await getDb();
  const taken = (await db.select<{ slug: string }[]>("SELECT slug FROM projects WHERE deleted_at IS NULL")).map((r) => r.slug);
  const [{ n }] = await db.select<{ n: number }[]>("SELECT COUNT(*) AS n FROM projects");
  const id = newId();
  const now = nowIso();
  const name = p.name.trim().slice(0, 60);
  await db.execute(
    `INSERT INTO projects (id, name, slug, color, icon, status, description, due_date, notes_folder, folder, repo, keywords,
       created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13)`,
    [id, name, uniqueSlug(name, taken), p.color ?? PROJECT_COLORS[n % PROJECT_COLORS.length], p.icon ?? null,
     p.status ?? "active", p.description ?? null, p.dueDate ?? null, p.notesFolder ?? null, p.folder ?? null,
     p.repo ?? null, (p.keywords ?? [name.toLowerCase()]).join(", "), now],
  );
  const [row] = await db.select<ProjectRow[]>("SELECT * FROM projects WHERE id = $1", [id]);
  return toProject(row);
}

export async function updateProject(id: string, p: ProjectInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE projects SET name = $1, color = $2, icon = $3, status = $4, description = $5, due_date = $6,
       notes_folder = $7, folder = $8, repo = $9, keywords = $10, updated_at = $11 WHERE id = $12`,
    [p.name.trim().slice(0, 60), p.color, p.icon, p.status, p.description, p.dueDate, p.notesFolder, p.folder,
     p.repo, p.keywords.join(", "), nowIso(), id],
  );
}

export async function setProjectStatus(id: string, status: ProjectStatus): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE projects SET status = $1, updated_at = $2 WHERE id = $3", [status, nowIso(), id]);
}

/** Soft delete. Its tasks and events stay, without project. */
export async function deleteProject(id: string): Promise<void> {
  const db = await getDb();
  const now = nowIso();
  await db.execute("UPDATE projects SET deleted_at = $1, updated_at = $1 WHERE id = $2", [now, id]);
  await db.execute("UPDATE tasks SET project_id = NULL, milestone_id = NULL, updated_at = $1 WHERE project_id = $2", [now, id]);
  await db.execute("UPDATE events SET project_id = NULL, updated_at = $1 WHERE project_id = $2", [now, id]);
  await db.execute("UPDATE milestones SET deleted_at = $1, updated_at = $1 WHERE project_id = $2", [now, id]);
}

// ------------------------------------------------------------ milestones

interface MilestoneRow {
  id: string;
  project_id: string;
  title: string;
  due_date: string | null;
  done_at: string | null;
  position: number;
}

const toMilestone = (r: MilestoneRow): Milestone => ({
  id: r.id, projectId: r.project_id, title: r.title, dueDate: r.due_date, doneAt: r.done_at, position: r.position,
});

/** Milestones of every project (cards) or of one. */
export async function listMilestones(projectId?: string): Promise<Milestone[]> {
  const db = await getDb();
  const rows = await db.select<MilestoneRow[]>(
    `SELECT id, project_id, title, due_date, done_at, position FROM milestones
     WHERE deleted_at IS NULL ${projectId ? "AND project_id = $1" : ""} ORDER BY position`,
    projectId ? [projectId] : [],
  );
  return rows.map(toMilestone);
}

export async function addMilestone(projectId: string, title: string, dueDate: string | null): Promise<void> {
  const db = await getDb();
  const now = nowIso();
  await db.execute(
    `INSERT INTO milestones (id, project_id, title, due_date, position, created_at, updated_at)
     VALUES ($1, $2, $3, $4, (SELECT COALESCE(MAX(position), 0) + 1 FROM milestones WHERE project_id = $2), $5, $5)`,
    [newId(), projectId, title.trim().slice(0, 80), dueDate, now],
  );
}

export async function updateMilestone(id: string, title: string, dueDate: string | null): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE milestones SET title = $1, due_date = $2, updated_at = $3 WHERE id = $4",
    [title.trim().slice(0, 80), dueDate, nowIso(), id]);
}

export async function setMilestoneDone(id: string, done: boolean): Promise<void> {
  const db = await getDb();
  const now = nowIso();
  await db.execute("UPDATE milestones SET done_at = $1, updated_at = $2 WHERE id = $3", [done ? now : null, now, id]);
}

/** Soft delete; its tasks stay in the project, without milestone. */
export async function deleteMilestone(id: string): Promise<void> {
  const db = await getDb();
  const now = nowIso();
  await db.execute("UPDATE milestones SET deleted_at = $1, updated_at = $1 WHERE id = $2", [now, id]);
  await db.execute("UPDATE tasks SET milestone_id = NULL, updated_at = $1 WHERE milestone_id = $2", [now, id]);
}

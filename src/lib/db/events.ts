/** Agenda items (appointments and memos). */
import type { AgendaEvent, EventKind } from "../agenda/agenda";
import { getDb, newId, nowIso } from "./client";

interface EventRow {
  id: string;
  title: string;
  kind: EventKind;
  day: string;
  all_day: number;
  start_at: string | null;
  end_at: string | null;
  location: string | null;
  description: string | null;
  remind_minutes: number | null;
  reminded_at: string | null;
  note_id: string | null;
  project_id: string | null;
}

const toEvent = (r: EventRow): AgendaEvent => ({
  id: r.id,
  title: r.title,
  kind: r.kind,
  day: r.day,
  allDay: r.all_day === 1,
  startAt: r.start_at,
  endAt: r.end_at,
  location: r.location,
  description: r.description,
  remindMinutes: r.remind_minutes,
  remindedAt: r.reminded_at,
  noteId: r.note_id,
  projectId: r.project_id,
});

export type EventInput = Omit<AgendaEvent, "id" | "remindedAt">;

/** Items whose day is in `[fromDay, toDay]` (local dates, inclusive). */
export async function listEvents(fromDay: string, toDay: string): Promise<AgendaEvent[]> {
  const db = await getDb();
  const rows = await db.select<EventRow[]>(
    `SELECT * FROM events WHERE deleted_at IS NULL AND day >= $1 AND day <= $2
     ORDER BY all_day DESC, start_at`,
    [fromDay, toDay],
  );
  return rows.map(toEvent);
}

export async function createEvent(e: EventInput): Promise<string> {
  const db = await getDb();
  const id = newId();
  const now = nowIso();
  await db.execute(
    `INSERT INTO events (id, title, kind, day, all_day, start_at, end_at, location, description,
       remind_minutes, note_id, project_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13)`,
    [id, e.title, e.kind, e.day, e.allDay ? 1 : 0, e.startAt, e.endAt, e.location, e.description,
     e.remindMinutes, e.noteId, e.projectId, now],
  );
  return id;
}

/** Full update. Changing the time re-arms the reminder. */
export async function updateEvent(id: string, e: EventInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE events SET title = $1, kind = $2, day = $3, all_day = $4, start_at = $5, end_at = $6,
       location = $7, description = $8, remind_minutes = $9, note_id = $10, project_id = $11, reminded_at = NULL,
       updated_at = $12
     WHERE id = $13`,
    [e.title, e.kind, e.day, e.allDay ? 1 : 0, e.startAt, e.endAt, e.location, e.description,
     e.remindMinutes, e.noteId, e.projectId, nowIso(), id],
  );
}

/** Drag and drop: new day/times, reminder re-armed. */
export async function moveEvent(id: string, day: string, startAt: string | null, endAt: string | null): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE events SET day = $1, start_at = $2, end_at = $3, all_day = $4, reminded_at = NULL, updated_at = $5
     WHERE id = $6`,
    [day, startAt, endAt, startAt ? 0 : 1, nowIso(), id],
  );
}

export async function setEventNote(id: string, noteId: string | null): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE events SET note_id = $1, updated_at = $2 WHERE id = $3", [noteId, nowIso(), id]);
}

export async function markReminded(id: string): Promise<void> {
  const db = await getDb();
  const now = nowIso();
  await db.execute("UPDATE events SET reminded_at = $1, updated_at = $1 WHERE id = $2", [now, id]);
}

export async function deleteEvent(id: string): Promise<void> {
  const db = await getDb();
  const now = nowIso();
  await db.execute("UPDATE events SET deleted_at = $1, updated_at = $1 WHERE id = $2", [now, id]);
}

/** Tasks with a due date in the range (for the agenda). */
export async function listTasksDueBetween(fromDay: string, toDay: string) {
  const db = await getDb();
  return db.select<{ id: string; title: string; due_date: string; status: string; priority: number }[]>(
    `SELECT id, title, due_date, status, priority FROM tasks
     WHERE deleted_at IS NULL AND due_date >= $1 AND due_date <= $2 ORDER BY priority`,
    [fromDay, toDay],
  );
}

/** Notes created or modified in `[fromIso, toIso)`, with the local day of their last change. */
export async function listNotesTouchedBetween(fromIso: string, toIso: string) {
  const db = await getDb();
  return db.select<{ id: string; title: string | null; updated_at: string; created_at: string }[]>(
    `SELECT id, title, updated_at, created_at FROM notes
     WHERE deleted_at IS NULL AND ((updated_at >= $1 AND updated_at < $2) OR (created_at >= $1 AND created_at < $2))`,
    [fromIso, toIso],
  );
}

/** Upcoming items of a project, from `fromDay` on. */
export async function listProjectEvents(projectId: string, fromDay: string, limit = 8): Promise<AgendaEvent[]> {
  const db = await getDb();
  const rows = await db.select<EventRow[]>(
    `SELECT * FROM events WHERE deleted_at IS NULL AND project_id = $1 AND day >= $2
     ORDER BY day, all_day DESC, start_at LIMIT $3`,
    [projectId, fromDay, limit],
  );
  return rows.map(toEvent);
}

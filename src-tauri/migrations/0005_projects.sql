-- Projects: a card per project, milestones, and links from tasks and events.

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,              -- `+slug` in /tache and /rdv
  color TEXT,
  icon TEXT,                       -- Lucide icon name
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('idea', 'active', 'paused', 'done')),
  description TEXT,
  due_date TEXT,                   -- YYYY-MM-DD
  notes_folder TEXT,               -- folder of its notes in Notes
  folder TEXT,                     -- local folder (Claude panel)
  repo TEXT,                       -- GitHub "owner/name"
  keywords TEXT,                   -- comma separated, matched in ActivityWatch window titles
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX idx_projects_slug ON projects(slug);

CREATE TABLE milestones (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  title TEXT NOT NULL,
  due_date TEXT,                   -- YYYY-MM-DD
  done_at TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX idx_milestones_project ON milestones(project_id);

ALTER TABLE tasks ADD COLUMN project_id TEXT REFERENCES projects(id);
ALTER TABLE tasks ADD COLUMN milestone_id TEXT REFERENCES milestones(id);
CREATE INDEX idx_tasks_project ON tasks(project_id);

ALTER TABLE events ADD COLUMN project_id TEXT REFERENCES projects(id);
CREATE INDEX idx_events_project ON events(project_id);

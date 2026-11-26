-- Tasks kanban: status column, priority, free categories.

CREATE TABLE task_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

-- todo | doing | done. `done_at` stays the moment the task was finished.
ALTER TABLE tasks ADD COLUMN status TEXT NOT NULL DEFAULT 'todo'
  CHECK (status IN ('todo', 'doing', 'done'));
-- 1 = haute, 2 = moyenne, 3 = basse.
ALTER TABLE tasks ADD COLUMN priority INTEGER NOT NULL DEFAULT 2
  CHECK (priority IN (1, 2, 3));
ALTER TABLE tasks ADD COLUMN category_id TEXT REFERENCES task_categories(id);

UPDATE tasks SET status = 'done' WHERE done_at IS NOT NULL;
CREATE INDEX idx_tasks_status ON tasks(status);

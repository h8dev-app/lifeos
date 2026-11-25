-- LifeOS schema v1.
-- UUID text ids + updated_at + deleted_at (soft delete) everywhere,
-- to prepare a future Supabase sync. Dates are ISO 8601 UTC strings.

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  fields_schema TEXT,              -- JSON, see src/lib/parsing/schema.ts
  is_system INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE entries (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES categories(id),
  occurred_at TEXT NOT NULL,
  data TEXT NOT NULL,              -- JSON object, fields from fields_schema
  source TEXT NOT NULL CHECK (source IN ('manual', 'ai', 'activitywatch', 'github')),
  external_id TEXT UNIQUE,         -- dedup of GitHub events
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX idx_entries_occurred ON entries(occurred_at);
CREATE INDEX idx_entries_category ON entries(category_id);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  planned_for TEXT,
  due_date TEXT,
  done_at TEXT,
  position INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  path TEXT UNIQUE NOT NULL,
  title TEXT,
  content_hash TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE VIRTUAL TABLE notes_fts USING fts5(note_id UNINDEXED, title, body);

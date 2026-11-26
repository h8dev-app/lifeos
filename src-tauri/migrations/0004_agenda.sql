-- Agenda: appointments ("event") and reminders ("memo", pense-bête).
-- `day` = local date (YYYY-MM-DD) of the item, used for range queries.
-- Timed items also have `start_at` / `end_at` (ISO UTC, same day).
-- All-day items (all_day = 1) have no times.

CREATE TABLE events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'event' CHECK (kind IN ('event', 'memo')),
  day TEXT NOT NULL,
  all_day INTEGER NOT NULL DEFAULT 0,
  start_at TEXT,
  end_at TEXT,
  location TEXT,
  description TEXT,
  remind_minutes INTEGER,          -- NULL = no notification
  reminded_at TEXT,                -- set once the notification was shown
  note_id TEXT REFERENCES notes(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX idx_events_day ON events(day);

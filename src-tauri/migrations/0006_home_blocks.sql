-- Home screen blocks, moved from settings.json to SQLite: the main window
-- and the screen widgets (separate processes) can both save them safely.
CREATE TABLE home_blocks (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT,
  options TEXT NOT NULL DEFAULT '{}',  -- JSON (filters, post-it text…)
  x REAL NOT NULL,
  y REAL NOT NULL,
  w REAL NOT NULL,
  h REAL NOT NULL,
  z INTEGER NOT NULL DEFAULT 0,        -- stacking order, higher = on top
  updated_at TEXT NOT NULL
);

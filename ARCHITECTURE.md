# Architecture

## Principle

Rust stays small: it only does what the webview cannot do (tray, global shortcut,
single instance, autostart; later: keyring, HTTP with secrets, PTY).
All app logic is TypeScript in `src/`.

## Overlay flow (milestone 1)

```
Ctrl+Alt+Space ─┐
tray click ─────┤
lifeos --toggle ┼─► overlay::toggle() ─► show(): fullscreen + on top + focus
 (2nd process → │                          └─ emits "overlay://shown"
  single-instance)                               └─ App.svelte focuses CommandBar
Escape ─► invoke("overlay_hide") ─► overlay::hide()
Close (Alt+F4) ─► hidden, not quit. Quit = tray menu.
```

## Modules

| Path | Role |
|---|---|
| `src-tauri/src/lib.rs` | Plugins, tray, shortcut, autostart, `--toggle` |
| `src-tauri/src/overlay.rs` | Show / hide / toggle + commands `overlay_toggle`, `overlay_hide` |
| `src/App.svelte` | Root: Escape handling, focus, layout |
| `src/components/CommandBar.svelte` | Single input bar |
| `src/views/Dashboard.svelte` | Home screen (clock for now) |
| `src/lib/overlay.ts` | TS wrappers around the overlay commands/events |
| `src-tauri/src/db.rs` | DB file location + migrations list, command `db_url` |
| `src-tauri/migrations/*.sql` | Versioned schema (`0001_init`) and seed categories (`0002_seed`) |
| `src/lib/types.ts` | Domain types: `Category`, `FieldDef`, `EntryData`… |
| `src/lib/parsing/units.ts` | Duration / distance / money / number tokens (tested) |
| `src/lib/parsing/slash.ts` | Command bar parsing + `/cat` arguments (tested) |
| `src/lib/parsing/schema.ts` | zod validation of `fields_schema` |
| `src/lib/db/*.ts` | SQL queries (connection, categories, entries, tasks, notes) |
| `src/lib/dates.ts` | Local dates, French date words for `@échéance` (tested) |
| `src/lib/parsing/task.ts` | `/tache` arguments (tested) |
| `src/lib/notes/markdown.ts` | Note title, file name, FTS query, hash (tested) |
| `src/lib/app.svelte.ts` | Shared UI state (runes): view, categories, entries, tasks, toast |
| `src/lib/format.ts` | French display of entry values |
| `src/components/` | `CommandBar`, `Nav`, `RecentEntries`, `CategoryChips`, `TaskList`, `NoteEditor`, `Toast` |
| `src/views/` | `Dashboard`, `Tasks`, `Notes` |
| `src/lib/clock.ts` | Date/time formatting (tested) |

## User data location

- Windows: `%APPDATA%\com.henri.lifeos\` (`lifeos.db`, `notes/`)
- Fedora: `~/.local/share/com.henri.lifeos/`

## Data model

Generic: no table per habit.

```
categories (id, slug, name, icon, color, fields_schema JSON, is_system, …)
    1 ─── n
entries (id, category_id, occurred_at, data JSON, source, external_id, …)
tasks (…), notes (…) + notes_fts (FTS5)
```

- Ids are UUID text; every table has `created_at`, `updated_at`, `deleted_at`
  (soft delete) to prepare a Supabase sync.
- Dates are ISO 8601 UTC strings; the UI shows local time.
- Numbers in `entries.data` use base units: km, minutes, euros.
- Migrations run automatically when the frontend opens the DB.
  Never edit a released migration: add `0003_….sql` and list it in `db.rs`.

## Command bar parsing

`parseInput()` in `src/lib/parsing/slash.ts`, driven by `fields_schema`:

1. tokens with a unit (`5km`, `28min`, `1h20`, `18,50€`, `30pages`, or `18 €`)
   fill the unit fields, in schema order;
2. remaining words fill text fields: `take: "word"` = one word, `take: "rest"` = all;
3. leftovers go to `note`.

Slash commands are saved directly (deterministic). Free text (no `/`) goes to
the AI with a preview and confirmation (milestone 4).

## Tasks

- `planned_for` (local `YYYY-MM-DD`) = the day the task is shown; "Reporter"
  moves it to tomorrow. Undone tasks planned in the past show in "today".
- `due_date` = optional deadline, shown red when passed.
- The list holds open tasks + tasks done today.

## Notes

- The `.md` files in `<app data>/notes/` are the source of truth. `notes` and
  `notes_fts` (FTS5) are only an index.
- `syncNotes()` runs when the Notes view opens: new files are indexed,
  changed files (hash) re-indexed, missing files marked deleted.
- The file name is fixed at creation; the title comes from the first `# heading`.
- Delete = move to `notes/.trash/` + soft delete. Nothing is erased.
- File access is limited to `$APPDATA/notes/**` (capabilities/default.json),
  no `remove` permission.
- Pending edits are saved 0.6 s after typing, on blur and before Escape hides
  the overlay (`onBeforeHide`).

## Adding a category

- **From the app**: `/cat lecture 📖 livre:texte pages:nombre durée:durée`
  then `/lecture dune 30pages 45min`.
  Types: `texte`, `distance`, `durée`, `euros`, `nombre` (unit = field name).
- **Shipped with the app**: add a row in a new migration, same JSON format as
  `0002_seed.sql`.

## Coming next

Adding an AI provider is documented here at milestone 4. Full plan: `docs/`.

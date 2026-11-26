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
| `src-tauri/src/secrets.rs` | Keyring: `secret_set` / `secret_delete` / `secret_exists` (no read command) |
| `src-tauri/src/local_fetch.rs` | HTTP to Ollama / ActivityWatch on 127.0.0.1 without `Origin` header (tested) |
| `src-tauri/src/pty.rs` | PTY for the Claude panel: `command_exists`, `pty_spawn/write/resize/kill`, events `pty://data` / `pty://exit` (tested) |
| `src-tauri/src/secure_fetch.rs` | HTTPS with a keyring secret, 3 allowed hosts, each tied to one secret (tested) |
| `src/lib/ai/` | `provider.ts` (interface), `ollama.ts`, `anthropic.ts`, `openai.ts`, `registry.ts`, `prompt.ts`, `entrySchema.ts` (tested) |
| `src/lib/activity/aggregate.ts` | ActivityWatch events → active spans, totals per app/title, timeline blocks (tested) |
| `src/lib/activity/activitywatch.ts` | Reads AW buckets/events for a day (via `local_fetch`) |
| `src/lib/activity/github.ts` | GitHub events → `code` entries, commit count via compare API (tested) |
| `src/lib/activity/sync.ts` | GitHub sync (every 10 min, dedup by `external_id`) |
| `src/lib/activity/timeline.ts` | Mixed timeline + duration format (tested) |
| `src/lib/settings.ts` | Non-sensitive settings (store plugin, `settings.json`) |
| `src/lib/secrets.ts` | TS side of the keyring + `secureFetch` |
| `src/lib/app.svelte.ts` | Shared UI state (runes): view, categories, entries, tasks, toast |
| `src/lib/format.ts` | French display of entry values |
| `src/components/` | `CommandBar`, `Nav`, `RecentEntries`, `CategoryChips`, `TaskList`, `NoteEditor`, `Toast` |
| `src/views/` | `Dashboard`, `Tasks`, `Notes`, `Activity`, `Claude`, `Settings` |
| `src/components/Terminal.svelte`, `src/lib/pty.ts` | xterm.js terminal bound to one PTY session |
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

- Kanban (migration `0003_task_board.sql`): `status` todo/doing/done,
  `priority` 1–3, `category_id` → `task_categories` (free, coloured).
  `done_at` is set when the status becomes `done` (used by the dashboard and
  weekly reviews). Sorting in a column: `compareTasks` (`src/lib/tasks/board.ts`, tested).
- Drag and drop is HTML5; the window has `dragDropEnabled: false`, otherwise
  Tauri's native file-drop handler swallows the events (Windows).
- Bulk updates use one `UPDATE … WHERE id IN (…)`.
- Escape priority: open dialog/editor (stopPropagation) → view handlers
  registered with `onEscape` (clear selection) → close the overlay.

- `planned_for` (local `YYYY-MM-DD`) = the day the task is shown; "Reporter"
  moves it to tomorrow. Undone tasks planned in the past show in "today".
- `due_date` = optional deadline, shown red when passed.
- The list holds open tasks + tasks done today.

## Notes

- The `.md` files in `<app data>/notes/` are the source of truth. `notes` and
  `notes_fts` (FTS5) are only an index.
- `syncNotes()` runs when the Notes view opens: new files are indexed,
  changed files (hash) re-indexed, missing files marked deleted.
- Categories are sub-folders of `notes/` (one level). Moving a note renames
  the file into the folder and updates `notes.path` (same id). Folder names keep
  accents/case but lose characters forbidden on Windows (`sanitizeFolderName`).
- Weekly reviews are written to `notes/Bilans/`; old ones at the root are moved
  there by `syncNotes`.
- The file name is fixed at creation; the title comes from the first `# heading`.
- The card excerpt comes from the FTS body (first 600 chars, Markdown stripped).
- Delete = move to `notes/.trash/` + soft delete. Nothing is erased.
- File access is limited to `$APPDATA/notes/**` (capabilities/default.json),
  no `remove` permission. On Unix `**` does not match dot-folders, so
  `notes/.trash` is listed explicitly in the scope.
- Pending edits are saved 0.6 s after typing, on blur and before Escape hides
  the overlay (`onBeforeHide`).

## Adding a category

- **From the app**: `/cat lecture 📖 livre:texte pages:nombre durée:durée`
  then `/lecture dune 30pages 45min`.
  Types: `texte`, `distance`, `durée`, `euros`, `nombre` (unit = field name).
- **Shipped with the app**: add a row in a new migration, same JSON format as
  `0002_seed.sql`.

## AI for free text

```
free text ─► provider.parseEntry(text, categories)
               ├─ buildSystemPrompt (categories, fields, units, current time)
               ├─ backend.complete(system, text, buildResponseSchema)  ← strict JSON schema
               └─ validateAiEntry: zod + unit conversion + date check
            ─► EntryPreview (Enter = save with source 'ai', Escape = cancel)
```

- The answer shape is fixed (`category`, `occurred_at`, `fields: [{key, value}]`)
  so one strict schema works for every provider and category.
- Values are converted with the same unit parsers as slash commands; unknown
  keys or bad values go to `note`. Dates in the future or older than 30 days → now.
- Ollama and ActivityWatch are called through the Rust command `local_fetch`
  (only `127.0.0.1`, ports 11434 and 5600). The webview can't call them
  directly: it sends an `Origin` header and ActivityWatch answers 403 to any web
  origin (Ollama too for the Windows origin). This replaces `tauri-plugin-http`
  planned in the addendum. Anthropic/OpenAI go through `secure_fetch` in Rust.

### Adding an AI provider

1. `src/lib/ai/<name>.ts`: `makeProvider({ id, label, status, complete })`.
   `complete(system, user, schema)` returns the raw JSON text.
2. Add a case in `registry.ts` and the id in `ProviderId` (`settings.ts`).
3. If it needs a key: add the secret name in `secrets.rs` (`ALLOWED`) and the
   host/secret pair in `secure_fetch.rs`, then a field in the Settings view.

## Security of API keys

- Keys are written once from the Settings view, then only Rust reads them.
- `secure_fetch` refuses non-https URLs, other hosts, and a secret sent to the
  wrong host (`api.openai.com` never receives the Anthropic key).
- Keys never go to SQLite, `settings.json` or logs.

## Activity

- **ActivityWatch** is read live, never copied to SQLite (v1). For a day: the
  most recently updated `currentwindow` bucket + `afkstatus` bucket. Window time
  counts only inside not-afk periods (all of it if there is no afk bucket).
  Timeline blocks merge the same app across gaps < 2 min and hide switches < 2 min.
- **GitHub**: `GET /users/{user}/events` every 10 min. `PushEvent` → entry in
  the system category `code` (source `github`, `external_id = github:<id>`,
  `ON CONFLICT DO NOTHING`). GitHub removed commit lists from push events, so
  new pushes get `total_commits` from `/repos/{repo}/compare/{before}...{head}`.
  Username and repo/SHA are validated before building URLs.

## Claude Code panel

```
/claude [dir] ─► pty_spawn(cwd, cols, rows) ─► portable-pty runs `claude` (no args)
xterm.onData ─► pty_write          reader thread ─► "pty://data" ─► xterm.write
ResizeObserver ─► fit ─► pty_resize         EOF ─► "pty://exit" ─► "[session terminée]"
```

- Compliance (brief §4): the program is a constant (`claude`), the command is
  built with no argument (unit test checks argv length = 1), no headless mode,
  no access to Claude credentials. `command_exists` only answers for `claude`.
- `claude` is searched in PATH plus `~/.local/bin`, `~/.claude/local`,
  `~/.npm-global/bin`, `%APPDATA%\npm` (desktop-launched apps have a short PATH).
  On Windows a `claude.cmd` runs through `cmd.exe /c` (still no argument to claude).
- Output is sent as UTF-8 text; incomplete multi-byte sequences are kept until
  the next read.
- The panel stays mounted once opened, so the session survives view changes
  and hiding the overlay. All sessions are killed on `RunEvent::Exit`.
- Escape inside the terminal goes to Claude; Shift+Escape closes the overlay.

## Dashboard and streaks

- Streaks are computed when reading (`src/lib/stats/streaks.ts`, tested): the
  local days with at least one entry per category over 120 days. Current streak
  = consecutive days up to today, or up to yesterday when nothing is logged yet
  today (shown as pending). Only streaks of 2+ days are displayed.
- Today's activity summary reuses the ActivityWatch loader (top 5 apps).

## Weekly review

```
/bilan or Monday auto ─► collect(week): entries, tasks, ActivityWatch day by day, streaks
                       ─► summarizeCategories / renderStatsMarkdown   (pure, tested)
                       ─► provider.write(REVIEW_SYSTEM_PROMPT, reviewUserPrompt)  (text only)
                       ─► upsertNoteFile("bilan-YYYY-sNN.md")  → Notes
```

- All numbers are computed by code; the AI only writes prose from them. The
  stats section is appended under the AI text, so the note stays correct even
  if the model misreads a number.
- ISO weeks (Monday start, ISO year of the Thursday).
- Auto mode: on startup and each time the overlay shows, if last week's note
  does not exist yet. Without AI, the note is still created with the numbers.
- `AiProvider.write(system, user)` = same backends without JSON schema.

## Out of scope v1 (architecture ready)

- Supabase sync: UUID text ids, `updated_at`, `deleted_at` on every table;
  SQLite stays the source of truth.
- Google Calendar / Gmail, screenpipe. `AiProvider.chat` stays reserved for a
  future conversation mode.

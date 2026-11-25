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
| `src/lib/clock.ts` | Date/time formatting (tested) |

## User data location

- Windows: `%APPDATA%\com.henri.lifeos\` (`lifeos.db`, `notes/`)
- Fedora: `~/.local/share/com.henri.lifeos/`

## Coming next

Data model (generic `categories` / `entries`), adding a category and adding an
AI provider are documented here from milestones 2 and 4. Full plan: `docs/`.

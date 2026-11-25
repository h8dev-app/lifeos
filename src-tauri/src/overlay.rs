//! Overlay window helpers: show, hide and toggle the main window.
//!
//! The same functions are used by the global shortcut, the tray icon,
//! the `--toggle` CLI flag and the frontend (Escape key).

use tauri::{AppHandle, Emitter, Manager, WebviewWindow};

/// Label of the overlay window, as declared in `tauri.conf.json`.
pub const MAIN_WINDOW: &str = "main";

/// Event sent to the frontend each time the overlay becomes visible,
/// so it can put the focus in the command bar.
pub const SHOWN_EVENT: &str = "overlay://shown";

fn main_window(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window(MAIN_WINDOW)
}

/// Show the overlay full screen, on top, and give it the keyboard focus.
pub fn show(app: &AppHandle) {
    let Some(window) = main_window(app) else { return };
    // `let _ =` ignores errors on purpose: a failed call must never crash the app.
    let _ = window.set_fullscreen(true);
    let _ = window.show();
    let _ = window.unminimize();
    let _ = window.set_always_on_top(true);
    let _ = window.set_focus();
    let _ = app.emit(SHOWN_EVENT, ());
}

/// Hide the overlay. The app keeps running in the tray.
pub fn hide(app: &AppHandle) {
    if let Some(window) = main_window(app) {
        let _ = window.hide();
    }
}

/// Show the overlay if hidden, hide it if visible.
pub fn toggle(app: &AppHandle) {
    let visible = main_window(app)
        .and_then(|w| w.is_visible().ok())
        .unwrap_or(false);
    if visible { hide(app) } else { show(app) }
}

// ---- Tauri commands, callable from TypeScript with `invoke(...)` ----

#[tauri::command]
pub fn overlay_toggle(app: AppHandle) {
    toggle(&app);
}

#[tauri::command]
pub fn overlay_hide(app: AppHandle) {
    hide(&app);
}

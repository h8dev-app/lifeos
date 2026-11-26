//! Overlay window helpers: show, hide and toggle the main window.
//!
//! The same functions are used by the global shortcut, the tray icon,
//! the `--toggle` CLI flag and the frontend (Escape key).

use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Emitter, Manager, WebviewWindow};

/// "Transparent" background mode (Réglages): windows behind must show through.
/// Wayland forbids that for full screen windows (xdg-shell: the compositor
/// must hide everything under a full screen surface), so this mode uses a
/// maximized window instead. Set by the frontend from the settings.
static TRANSPARENT: AtomicBool = AtomicBool::new(false);

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
    apply_mode(&window);
    let _ = window.show();
    let _ = window.unminimize();
    let _ = window.set_always_on_top(true);
    let _ = window.set_focus();
    let _ = app.emit(SHOWN_EVENT, ());
}

/// Full screen (wallpaper mode) or maximized (transparent mode, see TRANSPARENT).
fn apply_mode(window: &WebviewWindow) {
    if TRANSPARENT.load(Ordering::Relaxed) {
        let _ = window.set_fullscreen(false);
        let _ = window.maximize();
    } else {
        let _ = window.set_fullscreen(true);
    }
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

/// Switch between wallpaper mode (full screen) and transparent mode (maximized).
#[tauri::command]
pub fn overlay_set_transparent(app: AppHandle, transparent: bool) {
    TRANSPARENT.store(transparent, Ordering::Relaxed);
    if let Some(window) = main_window(&app) {
        if window.is_visible().unwrap_or(false) {
            apply_mode(&window);
        }
    }
}

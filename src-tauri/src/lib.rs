//! LifeOS backend entry point.
//!
//! Rust is kept small on purpose: it only does what the webview cannot do
//! (system tray, global shortcut, single instance, autostart, SQLite setup).
//! All app logic lives in TypeScript under `src/`.

mod db;
mod overlay;

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    App, AppHandle, WindowEvent,
};

/// CLI flag that shows/hides the overlay of the running instance.
/// Used by the GNOME custom shortcut on Wayland.
const TOGGLE_FLAG: &str = "--toggle";

/// Global shortcut. Works on Windows and X11; GNOME Wayland usually blocks it.
const SHORTCUT: &str = "Ctrl+Alt+Space";

pub fn run() {
    tauri::Builder::default()
        // Must be registered first. When a second `lifeos` process starts,
        // it exits right away and this callback runs in the first instance.
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if args.iter().any(|a| a == TOGGLE_FLAG) {
                overlay::toggle(app);
            } else {
                overlay::show(app);
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            overlay::overlay_toggle,
            overlay::overlay_hide,
            db::db_url
        ])
        .setup(|app| {
            db::setup(app)?;
            setup_tray(app)?;
            setup_shortcut(app.handle());
            setup_autostart(app.handle());

            // `lifeos --toggle` launched while no instance runs: show directly.
            if std::env::args().any(|a| a == TOGGLE_FLAG) {
                overlay::show(app.handle());
            }
            Ok(())
        })
        // Closing the window (Alt+F4…) only hides it; "Quit" is in the tray menu.
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running LifeOS");
}

/// Tray icon: left click toggles the overlay, the menu offers Show/Quit.
fn setup_tray(app: &App) -> tauri::Result<()> {
    let toggle = MenuItem::with_id(app, "toggle", "Afficher / masquer", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quitter LifeOS", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&toggle, &quit])?;

    TrayIconBuilder::with_id("main")
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("LifeOS")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "toggle" => overlay::toggle(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                overlay::toggle(tray.app_handle());
            }
        })
        .build(app)?;
    Ok(())
}

/// Register Ctrl+Alt+Space. A failure is only logged: on Wayland,
/// `lifeos --toggle` + a GNOME shortcut is the fallback (see README).
fn setup_shortcut(app: &AppHandle) {
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

    // On Wayland the GNOME shortcut already calls `--toggle`. Registering here
    // too (through XWayland) could toggle twice when an X11 window has focus.
    if cfg!(target_os = "linux") && std::env::var_os("WAYLAND_DISPLAY").is_some() {
        eprintln!("[lifeos] Wayland session: use a GNOME shortcut for `lifeos --toggle`");
        return;
    }

    let result = app
        .global_shortcut()
        .on_shortcut(SHORTCUT, |app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                overlay::toggle(app);
            }
        });
    if let Err(e) = result {
        eprintln!("[lifeos] global shortcut {SHORTCUT} unavailable: {e}");
    }
}

/// Start LifeOS with the system, in release builds only
/// (a dev build would register the debug binary).
fn setup_autostart(app: &AppHandle) {
    use tauri_plugin_autostart::ManagerExt;

    if cfg!(debug_assertions) {
        return;
    }
    let autolaunch = app.autolaunch();
    if !autolaunch.is_enabled().unwrap_or(false) {
        if let Err(e) = autolaunch.enable() {
            eprintln!("[lifeos] autostart could not be enabled: {e}");
        }
    }
}

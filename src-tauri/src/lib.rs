//! LifeOS backend entry point.
//!
//! Rust is kept small on purpose: it only does what the webview cannot do
//! (system tray, global shortcut, single instance, autostart, SQLite setup,
//! keyring secrets, HTTP calls, and the pseudo-terminal of the Claude panel).
//! All app logic lives in TypeScript under `src/`.

mod db;
mod local_fetch;
mod overlay;
mod wallpaper;
mod pty;
mod secrets;
mod secure_fetch;
mod widgets;

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    App, AppHandle, Emitter, RunEvent, WindowEvent,
};

/// CLI flag that shows/hides the overlay of the running instance.
/// Used by the GNOME custom shortcut on Wayland.
const TOGGLE_FLAG: &str = "--toggle";

/// Global shortcut. Works on Windows and X11; GNOME Wayland usually blocks it.
const SHORTCUT: &str = "Ctrl+Alt+Space";

pub fn run() {
    let context = tauri::generate_context!();
    let args: Vec<String> = std::env::args().collect();
    match widgets::widget_arg(&args) {
        Some(kind) => run_widget(context, kind),
        None => run_main(context),
    }
}

/// A screen widget process (`lifeos --widget agenda`, see widgets.rs):
/// one small window, the database, the settings; no tray, no shortcut.
fn run_widget(mut context: tauri::Context, kind: String) {
    // The overlay window of tauri.conf.json is not created here.
    context.config_mut().app.windows.clear();
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            db::db_url,
            local_fetch::local_fetch,
            widgets::widget_ready,
            widgets::widget_quit,
            widgets::widget_open_app
        ])
        .setup(move |app| {
            db::setup(app)?;
            widgets::setup_widget(app, &kind)?;
            Ok(())
        })
        .run(context)
        .expect("error while running a LifeOS widget");
}

fn run_main(context: tauri::Context) {
    tauri::Builder::default()
        // Must be registered first. When a second `lifeos` process starts,
        // it exits right away and this callback runs in the first instance.
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if args.iter().any(|a| a == TOGGLE_FLAG) {
                overlay::toggle(app);
            } else if let Some(view) = widgets::open_arg(&args) {
                // A widget asks to open LifeOS on its view.
                overlay::show(app);
                let _ = app.emit("overlay://view", view);
            } else {
                overlay::show(app);
            }
        }))
        .plugin(tauri_plugin_opener::init())
        // File access for Markdown notes. Scope limited to `<app data>/notes/`
        // in capabilities/default.json.
        .plugin(tauri_plugin_fs::init())
        // Non-sensitive settings (provider, model names) in settings.json.
        .plugin(tauri_plugin_store::Builder::default().build())
        // System notifications for agenda reminders.
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(pty::PtyState::default())
        .manage(widgets::Widgets::default())
        .invoke_handler(tauri::generate_handler![
            overlay::overlay_toggle,
            overlay::overlay_hide,
            overlay::overlay_set_transparent,
            wallpaper::wallpaper_image,
            db::db_url,
            secrets::secret_set,
            secrets::secret_delete,
            secrets::secret_exists,
            secure_fetch::secure_fetch,
            local_fetch::local_fetch,
            widgets::widget_open,
            widgets::widget_close,
            pty::command_exists,
            pty::pty_spawn,
            pty::pty_write,
            pty::pty_resize,
            pty::pty_kill
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
        .build(context)
        .expect("error while building LifeOS")
        .run(|app, event| {
            // Quitting LifeOS also stops any `claude` started in the panel.
            if let RunEvent::Exit = event {
                pty::kill_all(app);
            }
        });
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

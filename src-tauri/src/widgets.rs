//! Screen widgets: small always-on-top windows (agenda, tasks…) that stay
//! on screen while LifeOS is hidden, e.g. the agenda in a corner over YouTube.
//!
//! Each widget runs in its own `lifeos --widget <kind>` process:
//! - on a GNOME Wayland session that process uses XWayland, because Wayland
//!   lets no app keep a window above the others or choose where it goes;
//!   X11 does (and the main overlay keeps its native Wayland transparency);
//! - the main process talks to it through its stdin: `hide` while the
//!   overlay is shown, `show` after. End of stdin (main process gone or
//!   widget unpinned) closes the widget, so none is ever left behind.
//! A widget closed by its own ✕ exits with code 0: the main process then
//! tells the frontend, which unpins it.

use std::collections::HashMap;
use std::io::{BufRead, Write};
use std::process::{ChildStdin, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

/// `lifeos --widget agenda`: run as a widget process.
pub const WIDGET_FLAG: &str = "--widget";
/// Started while the overlay is visible: stay hidden until `show`.
const BEHIND_FLAG: &str = "--behind";
/// `lifeos --open agenda`: show the overlay on a view (sent by a widget).
pub const OPEN_FLAG: &str = "--open";
/// Exit code of a widget closed by the user (its ✕).
const CLOSED_BY_USER: i32 = 0;
/// Exit code when stdin ends (unpinned, or the main process quit).
const CLOSED_BY_MAIN: i32 = 3;

pub const KINDS: [&str; 6] = ["clock", "streaks", "agenda", "tasks", "recent", "activity"];

pub fn is_kind(kind: &str) -> bool {
    KINDS.contains(&kind)
}

/// Default size (logical pixels) of a widget window.
pub fn default_size(kind: &str) -> (f64, f64) {
    match kind {
        "clock" => (260.0, 140.0),
        "streaks" => (360.0, 150.0),
        "activity" => (330.0, 300.0),
        "recent" => (380.0, 300.0),
        _ => (330.0, 380.0),
    }
}

/// `--widget <kind>` in the command line, if valid.
pub fn widget_arg(args: &[String]) -> Option<String> {
    let i = args.iter().position(|a| a == WIDGET_FLAG)?;
    args.get(i + 1).filter(|k| is_kind(k)).cloned()
}

/// `--open <view>` in the command line.
pub fn open_arg(args: &[String]) -> Option<String> {
    let i = args.iter().position(|a| a == OPEN_FLAG)?;
    let view = args.get(i + 1)?;
    const VIEWS: [&str; 8] = ["dashboard", "tasks", "projects", "agenda", "notes", "activity", "claude", "settings"];
    VIEWS.contains(&view.as_str()).then(|| view.clone())
}

// ------------------------------------------------------------ main process

/// Running widgets: their stdin (dropping it closes the widget).
#[derive(Default)]
pub struct Widgets(Mutex<HashMap<String, (u32, ChildStdin)>>);

/// Send `hide`/`show` to every widget (overlay shown/hidden).
pub fn broadcast(app: &AppHandle, line: &str) {
    if let Some(state) = app.try_state::<Widgets>() {
        for (_, (_, stdin)) in state.0.lock().unwrap().iter_mut() {
            let _ = writeln!(stdin, "{line}");
            let _ = stdin.flush();
        }
    }
}

/// Pin a widget on the screen (start its process). No-op if it runs.
#[tauri::command]
pub fn widget_open(app: AppHandle, state: tauri::State<Widgets>, kind: String) -> Result<(), String> {
    if !is_kind(&kind) {
        return Err(format!("widget inconnu : {kind}"));
    }
    let mut running = state.0.lock().unwrap();
    if running.contains_key(&kind) {
        return Ok(());
    }
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let mut cmd = Command::new(exe);
    cmd.args([WIDGET_FLAG, &kind]).stdin(Stdio::piped()).stdout(Stdio::null()).stderr(Stdio::null());
    let overlay_visible = app
        .get_webview_window(crate::overlay::MAIN_WINDOW)
        .and_then(|w| w.is_visible().ok())
        .unwrap_or(false);
    if overlay_visible {
        cmd.arg(BEHIND_FLAG);
    }
    // XWayland: always-on-top and positions work there (see module doc).
    if cfg!(target_os = "linux")
        && std::env::var_os("WAYLAND_DISPLAY").is_some()
        && std::env::var_os("DISPLAY").is_some()
    {
        cmd.env("GDK_BACKEND", "x11");
    }
    let mut child = cmd.spawn().map_err(|e| e.to_string())?;
    let stdin = child.stdin.take().ok_or("stdin indisponible")?;
    let pid = child.id();
    running.insert(kind.clone(), (pid, stdin));
    drop(running);

    // Reap the process; tell the frontend when the user closed it.
    let handle = app.clone();
    std::thread::spawn(move || {
        let status = child.wait();
        if let Some(state) = handle.try_state::<Widgets>() {
            let mut running = state.0.lock().unwrap();
            if running.get(&kind).is_some_and(|(p, _)| *p == pid) {
                running.remove(&kind);
            }
        }
        if status.ok().and_then(|s| s.code()) == Some(CLOSED_BY_USER) {
            let _ = handle.emit("widget://closed", kind);
        }
    });
    Ok(())
}

/// Unpin a widget: closing its stdin makes it exit.
#[tauri::command]
pub fn widget_close(state: tauri::State<Widgets>, kind: String) {
    state.0.lock().unwrap().remove(&kind);
}

// ---------------------------------------------------------- widget process

static OVERLAY_VISIBLE: AtomicBool = AtomicBool::new(false);
static READY: AtomicBool = AtomicBool::new(false);

fn widget_window(app: &AppHandle) -> Option<tauri::WebviewWindow> {
    app.webview_windows().into_values().next()
}

/// Visible once placed by the frontend, and while the overlay is hidden.
fn sync_visibility(app: &AppHandle) {
    let Some(window) = widget_window(app) else { return };
    if READY.load(Ordering::Relaxed) && !OVERLAY_VISIBLE.load(Ordering::Relaxed) {
        let _ = window.show();
        let _ = window.set_always_on_top(true);
    } else {
        let _ = window.hide();
    }
}

/// Called by the widget page once it has restored its position and size.
#[tauri::command]
pub fn widget_ready(app: AppHandle) {
    READY.store(true, Ordering::Relaxed);
    sync_visibility(&app);
}

/// The widget's ✕: exit with the "closed by the user" code.
#[tauri::command]
pub fn widget_quit(app: AppHandle) {
    app.exit(CLOSED_BY_USER);
}

/// Open LifeOS on a view (asks the main instance through `--open`).
#[tauri::command]
pub fn widget_open_app(view: String) -> Result<(), String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    Command::new(exe)
        .args([OPEN_FLAG, &view])
        .env_remove("GDK_BACKEND")
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

/// Build the widget window and listen to the main process.
pub fn setup_widget(app: &tauri::App, kind: &str) -> tauri::Result<()> {
    OVERLAY_VISIBLE.store(std::env::args().any(|a| a == BEHIND_FLAG), Ordering::Relaxed);
    let (w, h) = default_size(kind);
    WebviewWindowBuilder::new(app, format!("widget-{kind}"), WebviewUrl::App("index.html".into()))
        .title(format!("LifeOS · {kind}"))
        .inner_size(w, h)
        .min_inner_size(160.0, 80.0)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .visible_on_all_workspaces(true)
        .resizable(true)
        .focused(false)
        .visible(false)
        .build()?;

    let handle = app.handle().clone();
    std::thread::spawn(move || {
        for line in std::io::stdin().lock().lines() {
            match line.as_deref().map(str::trim) {
                Ok("hide") => OVERLAY_VISIBLE.store(true, Ordering::Relaxed),
                Ok("show") => OVERLAY_VISIBLE.store(false, Ordering::Relaxed),
                Ok(_) => continue,
                Err(_) => break,
            }
            let h = handle.clone();
            let _ = handle.run_on_main_thread(move || sync_visibility(&h));
        }
        // stdin closed: unpinned, or the main process is gone.
        handle.exit(CLOSED_BY_MAIN);
    });
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn args(v: &[&str]) -> Vec<String> {
        v.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn reads_widget_and_open_flags() {
        assert_eq!(widget_arg(&args(&["lifeos", "--widget", "agenda"])), Some("agenda".into()));
        assert_eq!(widget_arg(&args(&["lifeos", "--widget", "nope"])), None);
        assert_eq!(widget_arg(&args(&["lifeos", "--widget"])), None);
        assert_eq!(open_arg(&args(&["lifeos", "--open", "tasks"])), Some("tasks".into()));
        assert_eq!(open_arg(&args(&["lifeos", "--open", "rm -rf"])), None);
    }
}

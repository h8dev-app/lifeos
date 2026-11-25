//! Terminal panel: runs the official `claude` CLI in a pseudo-terminal.
//!
//! Compliance rules (brief §4):
//! - the only program ever started is `claude`, interactive, with NO argument
//!   (no `-p`, no headless mode); the user types in the terminal;
//! - nothing here reads Claude credentials or tokens.
//!
//! Flow: `pty_spawn` returns an id; output arrives as `pty://data` events,
//! keystrokes come back with `pty_write`; `pty://exit` is sent at the end.

use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Mutex;

use portable_pty::{native_pty_system, ChildKiller, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};

/// The one program the panel can start.
const PROGRAM: &str = "claude";

struct Session {
    writer: Box<dyn Write + Send>,
    master: Box<dyn MasterPty + Send>,
    killer: Box<dyn ChildKiller + Send + Sync>,
}

#[derive(Default)]
pub struct PtyState {
    sessions: Mutex<HashMap<u32, Session>>,
    next_id: AtomicU32,
}

#[derive(Clone, Serialize)]
struct DataEvent {
    id: u32,
    data: String,
}

#[derive(Clone, Serialize)]
struct ExitEvent {
    id: u32,
    code: Option<u32>,
}

/// Folders searched in addition to PATH: an app started by the desktop
/// (autostart, shortcut) often has a shorter PATH than a terminal.
fn extra_dirs() -> Vec<PathBuf> {
    let Some(home) = home_dir() else { return vec![] };
    vec![
        home.join(".local/bin"),
        home.join(".claude/local"),
        home.join(".npm-global/bin"),
        home.join("AppData/Roaming/npm"),
    ]
}

fn home_dir() -> Option<PathBuf> {
    std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
}

/// Full path of `name` in PATH (+ extra dirs). On Windows, also tries
/// `.exe` and `.cmd` (npm installs `claude.cmd`).
fn find_program(name: &str) -> Option<PathBuf> {
    let path_var = std::env::var_os("PATH").unwrap_or_default();
    let mut dirs: Vec<PathBuf> = std::env::split_paths(&path_var).collect();
    dirs.extend(extra_dirs());
    let names: Vec<String> = if cfg!(windows) {
        vec![format!("{name}.exe"), format!("{name}.cmd"), name.to_string()]
    } else {
        vec![name.to_string()]
    };
    dirs.iter()
        .flat_map(|d| names.iter().map(move |n| d.join(n)))
        .find(|p| p.is_file())
}

/// `~` and `~/x` → home folder. Default: `~/projets`, else home.
fn resolve_cwd(cwd: Option<String>) -> Result<PathBuf, String> {
    let home = home_dir().ok_or("home folder not found")?;
    let raw = cwd.map(|c| c.trim().to_string()).filter(|c| !c.is_empty());
    let path = match raw.as_deref() {
        None => {
            let projets = home.join("projets");
            if projets.is_dir() { projets } else { home.clone() }
        }
        Some("~") => home.clone(),
        Some(p) if p.starts_with("~/") || p.starts_with("~\\") => home.join(&p[2..]),
        Some(p) => PathBuf::from(p),
    };
    if !path.is_dir() {
        return Err(format!("dossier introuvable : {}", path.display()));
    }
    Ok(path)
}

/// Build the command: `claude` with no argument. On Windows a `.cmd`
/// must go through `cmd.exe /c`; still no argument reaches `claude`.
fn claude_command(program: &Path, cwd: &Path) -> CommandBuilder {
    let is_cmd = program
        .extension()
        .is_some_and(|e| e.eq_ignore_ascii_case("cmd"));
    let mut cmd = if is_cmd {
        let mut c = CommandBuilder::new("cmd.exe");
        c.arg("/c");
        c.arg(program);
        c
    } else {
        CommandBuilder::new(program)
    };
    cmd.cwd(cwd);
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");
    cmd
}

#[tauri::command]
pub fn command_exists(name: String) -> bool {
    // Only the program the panel may run can be checked.
    name == PROGRAM && find_program(PROGRAM).is_some()
}

#[tauri::command]
pub fn pty_spawn(
    app: AppHandle,
    state: State<PtyState>,
    cwd: Option<String>,
    cols: u16,
    rows: u16,
) -> Result<u32, String> {
    let program = find_program(PROGRAM).ok_or("claude n'est pas installé")?;
    let cwd = resolve_cwd(cwd)?;

    let pair = native_pty_system()
        .openpty(PtySize { rows: rows.max(5), cols: cols.max(20), pixel_width: 0, pixel_height: 0 })
        .map_err(|e| e.to_string())?;
    let mut child = pair
        .slave
        .spawn_command(claude_command(&program, &cwd))
        .map_err(|e| e.to_string())?;
    drop(pair.slave); // the child owns it now

    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;
    let killer = child.clone_killer();

    let id = state.next_id.fetch_add(1, Ordering::Relaxed) + 1;
    state.sessions.lock().unwrap().insert(id, Session { writer, master: pair.master, killer });

    // Reader thread: forward output until the process ends.
    let app_handle = app.clone();
    std::thread::spawn(move || {
        let mut buf = [0u8; 8192];
        let mut pending: Vec<u8> = Vec::new(); // incomplete UTF-8 sequence
        loop {
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    pending.extend_from_slice(&buf[..n]);
                    let valid = match std::str::from_utf8(&pending) {
                        Ok(_) => pending.len(),
                        Err(e) => e.valid_up_to(),
                    };
                    if valid == 0 && pending.len() < 4 {
                        continue; // wait for the rest of the character
                    }
                    let cut = if valid == 0 { pending.len() } else { valid };
                    let data = String::from_utf8_lossy(&pending[..cut]).into_owned();
                    pending.drain(..cut);
                    let _ = app_handle.emit("pty://data", DataEvent { id, data });
                }
            }
        }
        let code = child.wait().ok().map(|s| s.exit_code());
        if let Some(state) = app_handle.try_state::<PtyState>() {
            state.sessions.lock().unwrap().remove(&id);
        }
        let _ = app_handle.emit("pty://exit", ExitEvent { id, code });
    });

    Ok(id)
}

#[tauri::command]
pub fn pty_write(state: State<PtyState>, id: u32, data: String) -> Result<(), String> {
    let mut sessions = state.sessions.lock().unwrap();
    let session = sessions.get_mut(&id).ok_or("session terminée")?;
    session.writer.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
    session.writer.flush().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn pty_resize(state: State<PtyState>, id: u32, cols: u16, rows: u16) -> Result<(), String> {
    let sessions = state.sessions.lock().unwrap();
    let session = sessions.get(&id).ok_or("session terminée")?;
    session
        .master
        .resize(PtySize { rows: rows.max(5), cols: cols.max(20), pixel_width: 0, pixel_height: 0 })
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn pty_kill(state: State<PtyState>, id: u32) -> Result<(), String> {
    if let Some(mut session) = state.sessions.lock().unwrap().remove(&id) {
        let _ = session.killer.kill();
    }
    Ok(())
}

/// Called when LifeOS quits: no `claude` process is left behind.
pub fn kill_all(app: &AppHandle) {
    if let Some(state) = app.try_state::<PtyState>() {
        for (_, mut session) in state.sessions.lock().unwrap().drain() {
            let _ = session.killer.kill();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn command_has_no_argument() {
        let cmd = claude_command(Path::new("/usr/bin/claude"), Path::new("/tmp"));
        let argv = cmd.get_argv();
        assert_eq!(argv.len(), 1, "claude must start without any argument");
        assert_eq!(argv[0], "/usr/bin/claude");
    }

    #[test]
    fn only_claude_can_be_checked() {
        assert!(!command_exists("bash".into()));
        assert!(!command_exists("sh".into()));
    }

    #[test]
    fn cwd_resolution() {
        assert!(resolve_cwd(Some("/definitely/not/here".into())).is_err());
        assert!(resolve_cwd(Some("~".into())).is_ok());
        assert!(resolve_cwd(None).is_ok());
    }
}

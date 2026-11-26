//! SQLite setup: database location and versioned migrations.
//!
//! Queries are written in TypeScript (`src/lib/db/`). Rust only decides
//! where the file lives and which `.sql` migrations to run at load time.

use tauri::{App, Manager};
use tauri_plugin_sql::{Migration, MigrationKind};

/// Connection string given to the SQL plugin, shared with the frontend
/// through the `db_url` command. It must match exactly on both sides,
/// otherwise the migrations would not run.
pub struct DbUrl(pub String);

/// Migrations, in order. Never edit a released migration: add a new file.
fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "init",
            sql: include_str!("../migrations/0001_init.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "seed",
            sql: include_str!("../migrations/0002_seed.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "task_board",
            sql: include_str!("../migrations/0003_task_board.sql"),
            kind: MigrationKind::Up,
        },
    ]
}

/// Register the SQL plugin with `lifeos.db` in the app data directory:
/// `%APPDATA%\com.henri.lifeos\` (Windows), `~/.local/share/com.henri.lifeos/` (Linux).
pub fn setup(app: &App) -> Result<(), Box<dyn std::error::Error>> {
    let dir = app.path().app_data_dir()?;
    std::fs::create_dir_all(&dir)?;
    // An absolute path replaces the plugin's default folder (app config dir).
    let url = format!("sqlite:{}", dir.join("lifeos.db").display());

    app.handle().plugin(
        tauri_plugin_sql::Builder::default()
            .add_migrations(&url, migrations())
            .build(),
    )?;
    app.manage(DbUrl(url));
    Ok(())
}

#[tauri::command]
pub fn db_url(state: tauri::State<DbUrl>) -> String {
    state.0.clone()
}

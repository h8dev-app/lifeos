//! API keys in the system keyring (Windows Credential Manager, Secret Service on Linux).
//!
//! Security rule: a key never goes back to JavaScript. The frontend can only
//! store, delete, or check that a key exists. Reading is done in Rust only,
//! by `secure_fetch`.

use keyring::Entry;

const SERVICE: &str = "com.henri.lifeos";

/// The only secret names accepted. Anything else is refused.
pub const ALLOWED: &[&str] = &["anthropic_api_key", "openai_api_key", "github_token"];

fn entry(name: &str) -> Result<Entry, String> {
    if !ALLOWED.contains(&name) {
        return Err(format!("unknown secret name: {name}"));
    }
    Entry::new(SERVICE, name).map_err(|e| e.to_string())
}

/// Read a secret. `Ok(None)` when it is not set. Rust-only (not a command).
pub fn read(name: &str) -> Result<Option<String>, String> {
    match entry(name)?.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn secret_set(name: String, value: String) -> Result<(), String> {
    let value = value.trim();
    if value.is_empty() {
        return Err("empty value".into());
    }
    entry(&name)?.set_password(value).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn secret_delete(name: String) -> Result<(), String> {
    match entry(&name)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn secret_exists(name: String) -> Result<bool, String> {
    Ok(read(&name)?.is_some())
}

//! Desktop wallpaper, drawn blurred behind the overlay (glass effect).
//!
//! The webview cannot read arbitrary files, so Rust reads the image the
//! desktop is configured with and returns its raw bytes. The path never comes
//! from JS: only from the desktop settings (GNOME `gsettings` on Linux).

use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::ipc::Response;

const MAX_BYTES: u64 = 40 * 1024 * 1024;
const IMAGE_EXT: [&str; 5] = ["jpg", "jpeg", "png", "webp", "svg"];

fn gsettings(schema: &str, key: &str) -> Option<String> {
    let out = Command::new("gsettings").args(["get", schema, key]).output().ok()?;
    if !out.status.success() {
        return None;
    }
    let raw = String::from_utf8_lossy(&out.stdout).trim().to_string();
    let value = raw.trim_matches('\'').to_string();
    (!value.is_empty()).then_some(value)
}

/// `file:///home/me/My%20Pic.jpg` → `/home/me/My Pic.jpg`.
pub fn uri_to_path(uri: &str) -> Option<PathBuf> {
    let rest = uri.strip_prefix("file://").unwrap_or(uri);
    if !rest.starts_with('/') {
        return None;
    }
    let bytes = rest.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(b) = u8::from_str_radix(std::str::from_utf8(&bytes[i + 1..i + 3]).ok()?, 16) {
                out.push(b);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    Some(PathBuf::from(String::from_utf8(out).ok()?))
}

/// GNOME slideshow (`.xml`): take the first `<file>` that is an image.
pub fn first_file_in_xml(xml: &str) -> Option<PathBuf> {
    let mut rest = xml;
    while let Some(start) = rest.find("<file>") {
        let after = &rest[start + 6..];
        let end = after.find("</file>")?;
        let path = PathBuf::from(after[..end].trim());
        if is_image(&path) {
            return Some(path);
        }
        rest = &after[end..];
    }
    None
}

fn is_image(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .is_some_and(|e| IMAGE_EXT.contains(&e.to_ascii_lowercase().as_str()))
}

fn wallpaper_path() -> Option<PathBuf> {
    let dark = gsettings("org.gnome.desktop.interface", "color-scheme")
        .is_some_and(|v| v == "prefer-dark");
    let keys = if dark { ["picture-uri-dark", "picture-uri"] } else { ["picture-uri", "picture-uri-dark"] };
    let path = keys
        .iter()
        .filter_map(|k| gsettings("org.gnome.desktop.background", k))
        .find_map(|uri| uri_to_path(&uri))?;
    if path.extension().is_some_and(|e| e == "xml") {
        return first_file_in_xml(&std::fs::read_to_string(&path).ok()?);
    }
    is_image(&path).then_some(path)
}

/// Raw bytes of the wallpaper image; empty when there is none (or not GNOME).
#[tauri::command]
pub fn wallpaper_image() -> Response {
    let bytes = wallpaper_path()
        .filter(|p| std::fs::metadata(p).is_ok_and(|m| m.len() <= MAX_BYTES))
        .and_then(|p| std::fs::read(p).ok())
        .unwrap_or_default();
    Response::new(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decodes_file_uris() {
        assert_eq!(uri_to_path("file:///home/me/My%20Pic.jpg"), Some(PathBuf::from("/home/me/My Pic.jpg")));
        assert_eq!(uri_to_path("/tmp/a.png"), Some(PathBuf::from("/tmp/a.png")));
        assert_eq!(uri_to_path("https://example.com/a.png"), None);
    }

    #[test]
    fn reads_slideshow_xml() {
        let xml = "<background><static><file>/usr/share/a.xml</file></static>\
                   <static><file> /usr/share/day.jxl.png </file></static></background>";
        assert_eq!(first_file_in_xml(xml), Some(PathBuf::from("/usr/share/day.jxl.png")));
        assert_eq!(first_file_in_xml("<background/>"), None);
    }
}

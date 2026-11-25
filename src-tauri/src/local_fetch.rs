//! HTTP calls to the local servers (Ollama, ActivityWatch), made from Rust.
//!
//! Why not from the webview: the webview adds an `Origin` header, and the
//! ActivityWatch server answers 403 to any web origin (Ollama does the same
//! for the Windows origin `http://tauri.localhost`). Rust sends no `Origin`.
//! Only two ports on 127.0.0.1 are reachable, nothing else.

use reqwest::Url;
use serde::Serialize;

/// Ollama and ActivityWatch.
const ALLOWED_PORTS: &[u16] = &[11434, 5600];

#[derive(Serialize)]
pub struct LocalResponse {
    status: u16,
    body: String,
}

fn build_url(port: u16, path: &str) -> Result<Url, String> {
    if !ALLOWED_PORTS.contains(&port) {
        return Err(format!("port not allowed: {port}"));
    }
    if !path.starts_with('/') || path.starts_with("//") || path.contains("://") || path.contains('@') {
        return Err("invalid path".into());
    }
    let url = Url::parse(&format!("http://127.0.0.1:{port}{path}")).map_err(|e| e.to_string())?;
    // Paranoia: the parsed URL must still point to 127.0.0.1 on that port.
    if url.host_str() != Some("127.0.0.1") || url.port() != Some(port) {
        return Err("invalid path".into());
    }
    Ok(url)
}

#[tauri::command]
pub async fn local_fetch(
    port: u16,
    path: String,
    method: String,
    body: Option<String>,
) -> Result<LocalResponse, String> {
    let url = build_url(port, &path)?;
    let client = reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(2))
        // Model answers can be slow on CPU.
        .timeout(std::time::Duration::from_secs(180))
        .build()
        .map_err(|e| e.to_string())?;
    let request = match method.to_uppercase().as_str() {
        "GET" => client.get(url),
        "POST" => client
            .post(url)
            .header("content-type", "application/json")
            .body(body.unwrap_or_default()),
        other => return Err(format!("method not allowed: {other}")),
    };
    let response = request.send().await.map_err(|e| e.to_string())?;
    let status = response.status().as_u16();
    let body = response.text().await.map_err(|e| e.to_string())?;
    Ok(LocalResponse { status, body })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_allowed_ports_and_paths() {
        assert!(build_url(5600, "/api/0/buckets/").is_ok());
        assert!(build_url(11434, "/api/chat").is_ok());
    }

    #[test]
    fn refuses_other_ports_and_tricky_paths() {
        assert!(build_url(22, "/").is_err());
        assert!(build_url(5600, "api").is_err());
        assert!(build_url(5600, "@evil.com/").is_err());
        assert!(build_url(5600, "//evil.com/x").is_err());
    }
}

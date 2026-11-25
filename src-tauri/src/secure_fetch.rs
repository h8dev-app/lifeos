//! HTTPS requests that need an API key.
//!
//! The frontend sends the URL, method and body plus the *name* of the secret.
//! Rust reads the key from the keyring and adds the right header. The key
//! never reaches JavaScript, and only three hosts are accepted, each with its
//! own secret, so a key can't be sent to the wrong service.

use serde::Serialize;
use reqwest;

use crate::secrets;

/// (host, secret name allowed for this host)
const ALLOWED: &[(&str, &str)] = &[
    ("api.anthropic.com", "anthropic_api_key"),
    ("api.openai.com", "openai_api_key"),
    ("api.github.com", "github_token"),
];

#[derive(Serialize)]
pub struct FetchResponse {
    status: u16,
    body: String,
}

/// Check the URL and secret pair. Returns the host on success.
fn check(url: &reqwest::Url, secret_name: Option<&str>) -> Result<String, String> {
    if url.scheme() != "https" {
        return Err("only https is allowed".into());
    }
    let host = url.host_str().unwrap_or_default().to_string();
    let (_, allowed_secret) = ALLOWED
        .iter()
        .find(|(h, _)| *h == host)
        .ok_or_else(|| format!("host not allowed: {host}"))?;
    if let Some(name) = secret_name {
        if name != *allowed_secret {
            return Err(format!("secret {name} can't be sent to {host}"));
        }
    }
    Ok(host)
}

#[tauri::command]
pub async fn secure_fetch(
    url: String,
    method: String,
    body: Option<String>,
    secret_name: Option<String>,
) -> Result<FetchResponse, String> {
    let url = reqwest::Url::parse(&url).map_err(|e| e.to_string())?;
    let host = check(&url, secret_name.as_deref())?;
    let method = match method.to_uppercase().as_str() {
        "GET" => reqwest::Method::GET,
        "POST" => reqwest::Method::POST,
        other => return Err(format!("method not allowed: {other}")),
    };

    let mut request = reqwest::Client::new()
        .request(method, url)
        .header("user-agent", "LifeOS")
        .timeout(std::time::Duration::from_secs(60));
    if let Some(body) = body {
        request = request.header("content-type", "application/json").body(body);
    }

    // Each service wants its key in a different header.
    if let Some(name) = &secret_name {
        let key = secrets::read(name)?.ok_or_else(|| format!("secret {name} is not set"))?;
        request = match host.as_str() {
            "api.anthropic.com" => request.header("x-api-key", key),
            "api.github.com" => request
                .header("authorization", format!("Bearer {key}"))
                .header("accept", "application/vnd.github+json"),
            _ => request.header("authorization", format!("Bearer {key}")),
        };
    }
    if host == "api.anthropic.com" {
        request = request
            .header("anthropic-version", "2026-10-21")
            // Enables `fallbacks` in the body (retry on another model after a refusal).
            .header("anthropic-beta", "server-side-fallback-2026-07-01");
    }

    let response = request.send().await.map_err(|e| e.to_string())?;
    let status = response.status().as_u16();
    let body = response.text().await.map_err(|e| e.to_string())?;
    Ok(FetchResponse { status, body })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn url(s: &str) -> reqwest::Url {
        reqwest::Url::parse(s).unwrap()
    }

    #[test]
    fn accepts_matching_host_and_secret() {
        assert!(check(&url("https://api.anthropic.com/v1/messages"), Some("anthropic_api_key")).is_ok());
        assert!(check(&url("https://api.github.com/users/x/events"), None).is_ok());
    }

    #[test]
    fn refuses_other_hosts_http_and_wrong_secret() {
        assert!(check(&url("https://evil.example.com/"), Some("anthropic_api_key")).is_err());
        assert!(check(&url("http://api.anthropic.com/v1/messages"), Some("anthropic_api_key")).is_err());
        assert!(check(&url("https://api.openai.com/v1/chat"), Some("anthropic_api_key")).is_err());
        // Look-alike host.
        assert!(check(&url("https://api.anthropic.com.evil.io/"), Some("anthropic_api_key")).is_err());
    }
}

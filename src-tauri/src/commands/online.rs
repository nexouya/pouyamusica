use serde::Serialize;
use std::path::PathBuf;
use tauri::State;

use crate::stream_core::StreamCore;

#[derive(Debug, Serialize)]
pub struct StreamCoreStatus {
    pub running: bool,
    pub port: u16,
    pub base_url: String,
    pub node_ok: bool,
}

fn node_available() -> bool {
    StreamCore::find_node_public().is_some()
}

fn probe_health(port: u16) -> bool {
    let url = format!("http://127.0.0.1:{port}/healthz");
    crate::stream_core::probe_http_ok(&url)
}

fn status_for(core: &StreamCore) -> StreamCoreStatus {
    let port = StreamCore::port();
    // Trust the HTTP endpoint — a reused/orphan server counts as running.
    let running = core.is_running() || probe_health(port);
    StreamCoreStatus {
        running,
        port,
        base_url: StreamCore::base_url(),
        node_ok: node_available(),
    }
}

#[tauri::command]
pub fn start_stream_core(core: State<'_, StreamCore>) -> Result<StreamCoreStatus, String> {
    let _port = core.start(0)?;
    Ok(status_for(&core))
}

#[tauri::command]
pub fn stop_stream_core(core: State<'_, StreamCore>) -> StreamCoreStatus {
    core.stop();
    StreamCoreStatus {
        running: false,
        port: StreamCore::port(),
        base_url: StreamCore::base_url(),
        node_ok: node_available(),
    }
}

#[tauri::command]
pub fn get_stream_core_status(core: State<'_, StreamCore>) -> StreamCoreStatus {
    status_for(&core)
}

/// Download a YouTube track via the local stream core into a target folder.
/// Uses `/api/export` so yt-dlp writes the file once and we just copy it —
/// no fragile multi-MB HTTP body parsing in Rust.
#[tauri::command]
pub async fn download_yt_track(
    video_id: String,
    title: String,
    dest_dir: String,
) -> Result<String, String> {
    let base = StreamCore::base_url().trim_end_matches('/').to_string();
    // Keep Unicode letters (Persian etc.); replace other unsafe path chars.
    let safe_title: String = title
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == ' ' || c == '-' || c == '_' || c == '.' || c == '(' || c == ')' {
                c
            } else {
                '_'
            }
        })
        .collect::<String>()
        .replace("__", "_")
        .trim()
        .trim_matches('_')
        .to_string();
    let safe_title = if safe_title.is_empty() {
        video_id.clone()
    } else {
        safe_title
    };

    let export_url = format!("{base}/api/export/{video_id}");
    let body = tauri::async_runtime::spawn_blocking({
        let url = export_url.clone();
        move || crate::stream_core::http_get_text(&url)
    })
    .await
    .map_err(|e| e.to_string())??;

    // Response may include an HTTP status line from the minimal client.
    let json_str = extract_json_body(&body)?;
    let parsed: serde_json::Value =
        serde_json::from_str(&json_str).map_err(|e| format!("invalid export response: {e}"))?;
    if parsed.get("ok").and_then(|v| v.as_bool()) != Some(true) {
        let err = parsed
            .get("error")
            .and_then(|v| v.as_str())
            .unwrap_or("export failed");
        return Err(err.to_string());
    }

    let src = parsed
        .get("path")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "export missing path".to_string())?
        .to_string();
    let bytes = parsed
        .get("bytes")
        .and_then(|v| v.as_u64())
        .unwrap_or(0);
    if bytes < 50 * 1024 {
        return Err(format!("exported file is only {bytes} bytes"));
    }
    let src_path = PathBuf::from(&src);
    if !src_path.exists() {
        return Err(format!("exported path missing: {src}"));
    }

    let ext = src_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("m4a");
    let filename = format!("{safe_title}.{ext}");
    let dest = PathBuf::from(&dest_dir).join(&filename);
    let dest_out = dest.clone();

    tauri::async_runtime::spawn_blocking(move || {
        std::fs::create_dir_all(PathBuf::from(&dest_dir)).map_err(|e| e.to_string())?;
        std::fs::copy(&src_path, &dest).map_err(|e| format!("copy failed: {e}"))?;
        Ok::<(), String>(())
    })
    .await
    .map_err(|e| e.to_string())??;

    Ok(dest_out.to_string_lossy().to_string())
}

/// Pull the JSON object out of an HTTP response that may include headers.
fn extract_json_body(raw: &str) -> Result<String, String> {
    if let Some(idx) = raw.find("\r\n\r\n") {
        return Ok(raw[idx + 4..].to_string());
    }
    if let Some(idx) = raw.find("\n\n") {
        return Ok(raw[idx + 2..].to_string());
    }
    if raw.trim_start().starts_with('{') {
        return Ok(raw.to_string());
    }
    Err("empty export response".into())
}

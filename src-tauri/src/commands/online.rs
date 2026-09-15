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
    for name in ["node", "node.exe"] {
        if let Ok(out) = std::process::Command::new(name).arg("--version").output() {
            if out.status.success() {
                return true;
            }
        }
    }
    PathBuf::from(r"C:\Program Files\nodejs\node.exe").exists()
}

#[tauri::command]
pub fn start_stream_core(core: State<'_, StreamCore>) -> Result<StreamCoreStatus, String> {
    let port = core.start(0)?;
    Ok(StreamCoreStatus {
        running: core.is_running(),
        port,
        base_url: crate::stream_core::StreamCore::base_url(),
        node_ok: node_available(),
    })
}

#[tauri::command]
pub fn stop_stream_core(core: State<'_, StreamCore>) -> StreamCoreStatus {
    core.stop();
    StreamCoreStatus {
        running: false,
        port: crate::stream_core::StreamCore::port(),
        base_url: crate::stream_core::StreamCore::base_url(),
        node_ok: node_available(),
    }
}

#[tauri::command]
pub fn get_stream_core_status(core: State<'_, StreamCore>) -> StreamCoreStatus {
    StreamCoreStatus {
        running: core.is_running(),
        port: crate::stream_core::StreamCore::port(),
        base_url: crate::stream_core::StreamCore::base_url(),
        node_ok: node_available(),
    }
}

/// Download a YouTube track via the local stream core into a target folder.
#[tauri::command]
pub async fn download_yt_track(
    video_id: String,
    title: String,
    dest_dir: String,
) -> Result<String, String> {
    let base = StreamCore::base_url();
    let safe_title: String = title
        .chars()
        .map(|c| if c.is_alphanumeric() || c == ' ' || c == '-' || c == '_' { c } else { '_' })
        .collect::<String>()
        .trim()
        .to_string();
    let safe_title = if safe_title.is_empty() {
        video_id.clone()
    } else {
        safe_title
    };
    let filename = format!("{safe_title}.mp3");
    let dest = PathBuf::from(&dest_dir).join(&filename);

    let url = format!(
        "{base}/download/{video_id}?title={}",
        urlencoding_encode(&safe_title)
    );

    tauri::async_runtime::spawn_blocking({
        let dest2 = dest.clone();
        let url2 = url.clone();
        move || download_to_file(&url2, &dest2)
    })
    .await
    .map_err(|e| e.to_string())??;

    Ok(dest.to_string_lossy().to_string())
}

fn urlencoding_encode(s: &str) -> String {
    let mut out = String::new();
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char)
            }
            b' ' => out.push_str("%20"),
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}

fn download_to_file(url: &str, dest: &PathBuf) -> Result<(), String> {
    use std::io::{Read, Write};

    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let without_scheme = url
        .strip_prefix("http://")
        .or_else(|| url.strip_prefix("https://"))
        .ok_or_else(|| "invalid url".to_string())?
        .to_string();
    let (host_port, path) = match without_scheme.split_once('/') {
        Some((hp, p)) => (hp.to_string(), format!("/{p}")),
        None => (without_scheme, "/".to_string()),
    };
    let (host, port) = match host_port.split_once(':') {
        Some((h, p)) => (h.to_string(), p.parse::<u16>().map_err(|e| e.to_string())?),
        None => (host_port, 80u16),
    };

    let mut stream = std::net::TcpStream::connect((host.as_str(), port))
        .map_err(|e| format!("stream core not reachable: {e}"))?;
    stream
        .set_read_timeout(Some(std::time::Duration::from_secs(180)))
        .ok();
    let req = format!(
        "GET {path} HTTP/1.1\r\nHost: {host}:{port}\r\nConnection: close\r\n\r\n"
    );
    stream.write_all(req.as_bytes()).map_err(|e| e.to_string())?;

    let mut raw: Vec<u8> = Vec::new();
    stream.read_to_end(&mut raw).map_err(|e| e.to_string())?;

    // Split headers / body
    let split = raw
        .windows(4)
        .position(|w| w == b"\r\n\r\n")
        .ok_or_else(|| "invalid HTTP response".to_string())?;
    let header = String::from_utf8_lossy(&raw[..split]).to_string();
    let status_line = header.lines().next().unwrap_or("");
    if !status_line.contains("200") && !status_line.contains("302") && !status_line.contains("301") {
        return Err(format!("download failed: {status_line}"));
    }
    let body = &raw[split + 4..];
    // Handle chunked transfer if present
    let body = if header.to_ascii_lowercase().contains("transfer-encoding: chunked") {
        dechunk(body)
    } else {
        body.to_vec()
    };

    std::fs::write(dest, &body).map_err(|e| e.to_string())?;
    if body.len() < 1024 {
        return Err("downloaded file is empty or too small".into());
    }
    Ok(())
}

fn dechunk(data: &[u8]) -> Vec<u8> {
    let mut out = Vec::new();
    let mut i = 0;
    while i < data.len() {
        // read chunk size line
        let Some(nl) = data[i..].windows(2).position(|w| w == b"\r\n") else {
            break;
        };
        let size_str = String::from_utf8_lossy(&data[i..i + nl]);
        let size = usize::from_str_radix(size_str.trim(), 16).unwrap_or(0);
        if size == 0 {
            break;
        }
        let start = i + nl + 2;
        let end = (start + size).min(data.len());
        out.extend_from_slice(&data[start..end]);
        i = end + 2; // skip trailing CRLF
    }
    out
}

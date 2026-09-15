use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

use crate::library::scanner::read_track;

use super::AppState;

#[derive(Debug, Serialize)]
pub struct PlaybackStatus {
    pub playing: bool,
    pub position_secs: f64,
    pub duration_secs: f64,
    pub volume: f32,
    pub path: Option<String>,
}

fn engine_err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

#[tauri::command]
pub fn load_track(
    app: AppHandle,
    state: State<'_, AppState>,
    path: String,
) -> Result<crate::library::TrackMeta, String> {
    let meta = read_track(std::path::Path::new(&path)).map_err(|e| {
        let msg = e.to_string();
        let _ = app.emit("engine-error", serde_json::json!({ "message": msg.clone() }));
        msg
    })?;
    if let Err(e) = state.engine.load_track(&path) {
        let msg = engine_err(e);
        let _ = app.emit("engine-error", serde_json::json!({ "message": msg.clone() }));
        return Err(msg);
    }
    Ok(meta)
}

#[tauri::command]
pub fn play(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    state.engine.play().map_err(|e| {
        let msg = engine_err(e);
        let _ = app.emit("engine-error", serde_json::json!({ "message": msg.clone() }));
        msg
    })
}

#[tauri::command]
pub fn pause(state: State<'_, AppState>) -> Result<(), String> {
    state.engine.pause().map_err(engine_err)
}

#[tauri::command]
pub fn toggle_play(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    state.engine.toggle().map_err(|e| {
        let msg = engine_err(e);
        let _ = app.emit("engine-error", serde_json::json!({ "message": msg.clone() }));
        msg
    })
}

#[tauri::command]
pub fn seek(state: State<'_, AppState>, position: f64) -> Result<(), String> {
    state.engine.seek(position).map_err(engine_err)
}

#[tauri::command]
pub fn set_volume(state: State<'_, AppState>, level: f32) -> Result<(), String> {
    let v = level.clamp(0.0, 1.0);
    state.engine.set_volume(v).map_err(|e| e.to_string())?;
    state.set_user_volume(v);
    state.persist();
    Ok(())
}

/// Mute/unmute the native engine without writing settings (Sound Lab handoff).
/// Unmute restores the session user volume, not a stale settings-file value.
#[tauri::command]
pub fn set_engine_muted(state: State<'_, AppState>, muted: bool) -> Result<(), String> {
    let target = if muted {
        0.0
    } else {
        let v = state.user_volume();
        if v > 0.0 {
            v
        } else {
            0.8
        }
    };
    state.engine.set_volume(target).map_err(|e| e.to_string())
}

/// Read a local audio file as base64 for the Web Audio path (asset-protocol fallback).
#[tauri::command]
pub async fn read_audio_b64(path: String) -> Result<String, String> {
    use base64::Engine as _;
    const MAX_BYTES: u64 = 180 * 1024 * 1024;
    let bytes = tauri::async_runtime::spawn_blocking(move || {
        let meta = std::fs::metadata(&path).map_err(|e| format!("stat failed: {e}"))?;
        if meta.len() > MAX_BYTES {
            return Err(format!(
                "audio file too large for base64 load ({} bytes)",
                meta.len()
            ));
        }
        std::fs::read(&path).map_err(|e| format!("read failed: {e}"))
    })
    .await
    .map_err(|e| e.to_string())??;
    if bytes.is_empty() {
        return Err("empty audio file".into());
    }
    Ok(base64::engine::general_purpose::STANDARD.encode(bytes))
}

#[tauri::command]
pub fn get_playback_status(state: State<'_, AppState>) -> PlaybackStatus {
    PlaybackStatus {
        playing: state.engine.is_playing(),
        position_secs: state.engine.position_secs(),
        duration_secs: state.engine.duration_secs(),
        volume: state.user_volume(),
        path: state
            .engine
            .current_path()
            .map(|p| p.to_string_lossy().to_string()),
    }
}

#[tauri::command]
pub async fn get_waveform(state: State<'_, AppState>, path: String) -> Result<Vec<f32>, String> {
    let engine = state.engine.clone();
    tauri::async_runtime::spawn_blocking(move || engine.peaks(&path, 240).map_err(|e| e.to_string()))
        .await
        .map_err(|e| e.to_string())?
}

/// Active play order: explicit queue if set, otherwise full library order.
fn play_order(state: &AppState) -> Vec<String> {
    let queue = state.queue.lock().clone();
    if !queue.is_empty() {
        return queue;
    }
    state.library.lock().iter().map(|t| t.path.clone()).collect()
}

fn find_track(state: &AppState, path: &str) -> Option<crate::library::TrackMeta> {
    state
        .library
        .lock()
        .iter()
        .find(|t| t.path == path)
        .cloned()
        .or_else(|| read_track(std::path::Path::new(path)).ok())
}

#[tauri::command]
pub fn play_track(
    app: AppHandle,
    state: State<'_, AppState>,
    path: String,
) -> Result<crate::library::TrackMeta, String> {
    let path_ref = std::path::Path::new(&path);
    if !path_ref.exists() {
        let msg = format!("file not found: {path}");
        let _ = app.emit("engine-error", serde_json::json!({ "message": msg.clone() }));
        return Err(msg);
    }
    let meta = read_track(path_ref).map_err(|e| {
        let msg = e.to_string();
        let _ = app.emit("engine-error", serde_json::json!({ "message": msg.clone() }));
        msg
    })?;
    state.engine.load_track(&path).map_err(|e| {
        let msg = e.to_string();
        let _ = app.emit("engine-error", serde_json::json!({ "message": msg.clone() }));
        msg
    })?;
    state.engine.play().map_err(|e| {
        let msg = e.to_string();
        let _ = app.emit("engine-error", serde_json::json!({ "message": msg.clone() }));
        msg
    })?;
    let order = play_order(&state);
    let idx = order.iter().position(|p| p == &path);
    *state.current_index.lock() = idx;
    state.persist();
    Ok(meta)
}

#[tauri::command]
pub fn next_track(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Option<crate::library::TrackMeta>, String> {
    let order = play_order(&state);
    if order.is_empty() {
        return Ok(None);
    }
    let mut idx = state.current_index.lock();
    let next = match *idx {
        Some(i) if i + 1 < order.len() => i + 1,
        // End of explicit queue: stop. Library fallback also stops at the end.
        Some(_) => {
            *idx = None;
            return Ok(None);
        }
        None => 0,
    };
    let path = order[next].clone();
    *idx = Some(next);
    drop(idx);
    let Some(track) = find_track(&state, &path) else {
        return Ok(None);
    };
    state
        .engine
        .load_track(&track.path)
        .map_err(|e| e.to_string())?;
    state.engine.play().map_err(|e| e.to_string())?;
    let _ = app.emit("track-changed", track.clone());
    Ok(Some(track))
}

#[tauri::command]
pub fn prev_track(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Option<crate::library::TrackMeta>, String> {
    let order = play_order(&state);
    if order.is_empty() {
        return Ok(None);
    }
    let mut idx = state.current_index.lock();
    let prev = match *idx {
        Some(0) | None => order.len() - 1,
        Some(i) => i - 1,
    };
    let path = order[prev].clone();
    *idx = Some(prev);
    drop(idx);
    let Some(track) = find_track(&state, &path) else {
        return Ok(None);
    };
    state
        .engine
        .load_track(&track.path)
        .map_err(|e| e.to_string())?;
    state.engine.play().map_err(|e| e.to_string())?;
    let _ = app.emit("track-changed", track.clone());
    Ok(Some(track))
}

#[tauri::command]
pub fn set_queue(paths: Vec<String>, state: State<'_, AppState>) {
    *state.queue.lock() = paths;
}

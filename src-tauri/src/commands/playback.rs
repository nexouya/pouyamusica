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
    state.engine.set_volume(level).map_err(|e| e.to_string())?;
    state.persist();
    Ok(())
}

#[tauri::command]
pub fn get_playback_status(state: State<'_, AppState>) -> PlaybackStatus {
    PlaybackStatus {
        playing: state.engine.is_playing(),
        position_secs: state.engine.position_secs(),
        duration_secs: state.engine.duration_secs(),
        volume: state.engine.volume(),
        path: state
            .engine
            .current_path()
            .map(|p| p.to_string_lossy().to_string()),
    }
}

#[tauri::command]
pub fn get_waveform(state: State<'_, AppState>, path: String) -> Result<Vec<f32>, String> {
    state.engine.peaks(&path, 240).map_err(|e| e.to_string())
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
    let idx = state.library.lock().iter().position(|t| t.path == path);
    *state.current_index.lock() = idx;
    state.persist();
    Ok(meta)
}

#[tauri::command]
pub fn next_track(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Option<crate::library::TrackMeta>, String> {
    let lib = state.library.lock().clone();
    if lib.is_empty() {
        return Ok(None);
    }
    let mut idx = state.current_index.lock();
    let next = match *idx {
        Some(i) if i + 1 < lib.len() => i + 1,
        Some(_) => 0,
        None => 0,
    };
    *idx = Some(next);
    let track = lib[next].clone();
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
    let lib = state.library.lock().clone();
    if lib.is_empty() {
        return Ok(None);
    }
    let mut idx = state.current_index.lock();
    let prev = match *idx {
        Some(0) | None => lib.len() - 1,
        Some(i) => i - 1,
    };
    *idx = Some(prev);
    let track = lib[prev].clone();
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

use tauri::State;

use crate::library::playlists::{self, Playlist};

use super::AppState;

#[tauri::command]
pub fn list_playlists() -> Vec<Playlist> {
    playlists::load_playlists()
}

#[tauri::command]
pub fn create_playlist(name: String, description: Option<String>) -> Result<Playlist, String> {
    if name.trim().is_empty() {
        return Err("Playlist name is required".into());
    }
    playlists::create_playlist(&name, description.as_deref().unwrap_or(""))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn rename_playlist(
    id: String,
    name: String,
    description: Option<String>,
) -> Result<Playlist, String> {
    playlists::rename_playlist(&id, &name, description.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_playlist(id: String) -> Result<(), String> {
    playlists::delete_playlist(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_tracks_to_playlist(
    id: String,
    paths: Vec<String>,
    state: State<'_, AppState>,
) -> Result<Playlist, String> {
    // Only accept files that exist in the scanned library (or on disk)
    let lib = state.library.lock();
    let filtered: Vec<String> = paths
        .into_iter()
        .filter(|p| lib.iter().any(|t| &t.path == p) || std::path::Path::new(p).exists())
        .collect();
    drop(lib);
    playlists::add_tracks(&id, &filtered).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn remove_track_from_playlist(id: String, path: String) -> Result<Playlist, String> {
    playlists::remove_track(&id, &path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn reorder_playlist(id: String, order: Vec<String>) -> Result<Playlist, String> {
    playlists::reorder(&id, order).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn move_playlist_track(id: String, from: usize, to: usize) -> Result<Playlist, String> {
    playlists::move_track(&id, from, to).map_err(|e| e.to_string())
}

/// Move by path so UI indices stay valid when some playlist tracks are missing from the library.
#[tauri::command]
pub fn move_playlist_track_by_path(
    id: String,
    path: String,
    to: usize,
) -> Result<Playlist, String> {
    playlists::move_track_by_path(&id, &path, to).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_playlist(id: String) -> Option<Playlist> {
    playlists::get_playlist(&id)
}

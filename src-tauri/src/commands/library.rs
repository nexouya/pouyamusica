use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};

use crate::library::color_extract::{extract_palette, hex_to_rgb, pick_accent};
use crate::library::scanner::{default_music_dir, read_track, scan_folder, TrackMeta};

use super::AppState;

#[derive(Debug, Serialize, Deserialize)]
pub struct ColorPalette {
    pub accent: String,
    pub accent_rgb: String,
    pub palette: Vec<String>,
}

#[tauri::command]
pub fn get_library(state: State<'_, AppState>) -> Vec<TrackMeta> {
    state.library.lock().clone()
}

#[tauri::command]
pub fn scan_library(app: AppHandle, state: State<'_, AppState>) -> Result<Vec<TrackMeta>, String> {
    let root = state.music_root.lock().clone();
    let tracks = scan_folder(&root).map_err(|e| e.to_string())?;
    *state.library.lock() = tracks.clone();
    let _ = app.emit("library-updated", tracks.clone());
    Ok(tracks)
}

#[tauri::command]
pub fn set_music_root(
    app: AppHandle,
    state: State<'_, AppState>,
    path: String,
) -> Result<Vec<TrackMeta>, String> {
    let root = std::path::PathBuf::from(&path);
    if !root.exists() {
        return Err(format!("folder does not exist: {}", root.display()));
    }
    *state.music_root.lock() = root;
    state.persist();
    let tracks = scan_folder(&state.music_root.lock().clone()).map_err(|e| e.to_string())?;
    *state.library.lock() = tracks.clone();
    let _ = app.emit("library-updated", tracks.clone());
    Ok(tracks)
}

#[tauri::command]
pub fn get_music_root(state: State<'_, AppState>) -> String {
    state.music_root.lock().to_string_lossy().to_string()
}

#[tauri::command]
pub fn refresh_track(path: String, state: State<'_, AppState>) -> Option<TrackMeta> {
    let meta = read_track(std::path::Path::new(&path)).ok()?;
    let mut lib = state.library.lock();
    if let Some(existing) = lib.iter_mut().find(|t| t.path == meta.path) {
        *existing = meta.clone();
    } else {
        lib.push(meta.clone());
    }
    Some(meta)
}

#[tauri::command]
pub fn get_color_palette(path: String) -> Result<ColorPalette, String> {
    let meta = read_track(std::path::Path::new(&path)).map_err(|e| e.to_string())?;
    let rgb = hex_to_rgb(&meta.accent).unwrap_or([124, 156, 255]);
    Ok(ColorPalette {
        accent: meta.accent.clone(),
        accent_rgb: format!("{}, {}, {}", rgb[0], rgb[1], rgb[2]),
        palette: meta.palette,
    })
}

#[tauri::command]
pub fn palette_from_image(path: String) -> Result<ColorPalette, String> {
    let img = image::open(&path).map_err(|e| e.to_string())?;
    let palette = extract_palette(&img, 4);
    let accent = pick_accent(&palette);
    let rgb = hex_to_rgb(&accent).unwrap_or([124, 156, 255]);
    Ok(ColorPalette {
        accent,
        accent_rgb: format!("{}, {}, {}", rgb[0], rgb[1], rgb[2]),
        palette,
    })
}

#[tauri::command]
pub fn find_demo_library() -> Option<String> {
    let cwd = std::env::current_dir().ok()?;
    let mut candidates = vec![
        cwd.join("demo-library"),
        cwd.join("..").join("demo-library"),
        cwd.join("..").join("..").join("demo-library"),
        cwd.join("..").join("..").join("..").join("demo-library"),
    ];
    if let Some(home) = dirs::home_dir() {
        candidates.push(home.join("Music").join("pouya-demo"));
    }
    for c in candidates {
        if c.is_dir() {
            return Some(c.canonicalize().ok()?.to_string_lossy().to_string());
        }
    }
    None
}

#[tauri::command]
pub fn pick_folder(app: AppHandle, state: State<'_, AppState>) -> Result<Option<Vec<TrackMeta>>, String> {
    use tauri_plugin_dialog::DialogExt;
    use std::sync::mpsc::channel;
    let (tx, rx) = channel();
    app.dialog().file().pick_folder(move |folder| {
        let _ = tx.send(folder);
    });
    let folder = rx.recv().map_err(|e| e.to_string())?;
    if let Some(path) = folder {
        let path_str = path.to_string();
        let tracks = set_music_root(app, state, path_str)?;
        Ok(Some(tracks))
    } else {
        Ok(None)
    }
}

// Silence unused default_music_dir if not referenced here in future edits
#[allow(unused)]
fn _default() -> std::path::PathBuf {
    default_music_dir()
}

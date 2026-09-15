use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State};

use crate::library::color_extract::{extract_palette, hex_to_rgb, pick_accent};
use crate::library::scanner::{read_track, scan_folder, watch_folder, TrackMeta};

use super::AppState;

#[derive(Debug, Serialize, Deserialize)]
pub struct ColorPalette {
    pub accent: String,
    pub accent_rgb: String,
    pub palette: Vec<String>,
}

/// Scan the current music root and replace the in-memory library.
/// Bumps scan generation so concurrent/stale scans cannot overwrite.
pub fn apply_scan(app: &AppHandle, state: &AppState, root: std::path::PathBuf) -> Result<Vec<TrackMeta>, String> {
    let gen = state.next_scan_gen();
    let tracks = scan_folder(&root).map_err(|e| e.to_string())?;
    if !state.is_current_scan_gen(gen) {
        return Ok(tracks);
    }
    *state.library.lock() = tracks.clone();
    let _ = app.emit("library-updated", tracks.clone());
    Ok(tracks)
}

/// Start (or restart) the folder watcher for `root`.
pub fn retarget_watcher(app: &AppHandle, state: &AppState, root: std::path::PathBuf) {
    let handle = app.clone();
    let pending = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
    let dirty = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
    let pending_flag = pending.clone();
    let dirty_flag = dirty.clone();

    match watch_folder(root, move |_path| {
        dirty_flag.store(true, std::sync::atomic::Ordering::SeqCst);
        // Collapse a burst of FS events into one debounced rescan; if another
        // burst arrives while scanning, keep dirty so we rescan once more.
        if pending_flag.swap(true, std::sync::atomic::Ordering::SeqCst) {
            return;
        }
        let handle_inner = handle.clone();
        let flag = pending_flag.clone();
        let dirty_inner = dirty_flag.clone();
        std::thread::spawn(move || loop {
            std::thread::sleep(std::time::Duration::from_millis(350));
            dirty_inner.store(false, std::sync::atomic::Ordering::SeqCst);
            let app_state = handle_inner.state::<AppState>();
            let root = app_state.music_root.lock().clone();
            if let Err(e) = apply_scan(&handle_inner, &app_state, root) {
                eprintln!("watch rescan failed: {e}");
            }
            // Clear pending, then re-arm if an event raced the dirty check.
            flag.store(false, std::sync::atomic::Ordering::SeqCst);
            if dirty_inner.load(std::sync::atomic::Ordering::SeqCst)
                && flag
                    .compare_exchange(
                        false,
                        true,
                        std::sync::atomic::Ordering::SeqCst,
                        std::sync::atomic::Ordering::SeqCst,
                    )
                    .is_ok()
            {
                continue;
            }
            break;
        });
    }) {
        Ok(watcher) => {
            *state.watcher.lock() = Some(watcher);
        }
        Err(e) => {
            eprintln!("failed to watch music folder: {e:#}");
            *state.watcher.lock() = None;
        }
    }
}

#[tauri::command]
pub fn get_library(state: State<'_, AppState>) -> Vec<TrackMeta> {
    state.library.lock().clone()
}

#[tauri::command]
pub async fn scan_library(app: AppHandle, state: State<'_, AppState>) -> Result<Vec<TrackMeta>, String> {
    let root = state.music_root.lock().clone();
    let gen = state.next_scan_gen();
    let tracks = tauri::async_runtime::spawn_blocking(move || scan_folder(&root).map_err(|e| e.to_string()))
        .await
        .map_err(|e| e.to_string())??;
    if state.is_current_scan_gen(gen) {
        *state.library.lock() = tracks.clone();
        let _ = app.emit("library-updated", tracks.clone());
    }
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
    *state.music_root.lock() = root.clone();
    state.persist();
    retarget_watcher(&app, &state, root.clone());
    let tracks = apply_scan(&app, &state, root)?;
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
pub fn get_color_palette(path: String, state: State<'_, AppState>) -> Result<ColorPalette, String> {
    // Prefer the cached library entry (avoid re-decoding the file).
    if let Some(meta) = state.library.lock().iter().find(|t| t.path == path) {
        let rgb = hex_to_rgb(&meta.accent).unwrap_or([124, 156, 255]);
        return Ok(ColorPalette {
            accent: meta.accent.clone(),
            accent_rgb: format!("{}, {}, {}", rgb[0], rgb[1], rgb[2]),
            palette: meta.palette.clone(),
        });
    }
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
pub fn pick_folder(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Option<Vec<TrackMeta>>, String> {
    use tauri_plugin_dialog::DialogExt;
    let folder = app.dialog().file().blocking_pick_folder();
    let Some(folder) = folder else {
        return Ok(None);
    };
    let path = folder
        .into_path()
        .map_err(|e| format!("invalid folder path: {e}"))?;
    let path_str = path.to_string_lossy().to_string();
    let tracks = set_music_root(app, state, path_str)?;
    Ok(Some(tracks))
}

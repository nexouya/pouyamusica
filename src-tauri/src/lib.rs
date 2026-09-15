mod audio;
mod commands;
mod library;
mod settings;

use tauri::{Emitter, Manager};

use crate::audio::shared::FftFrame;
use crate::commands::AppState;
use crate::library::scanner::{default_music_dir, scan_folder};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let state = match AppState::new() {
        Ok(state) => state,
        Err(err) => {
            eprintln!("failed to init app state: {err:#}");
            std::process::exit(1);
        }
    };

    if let Err(err) = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(state)
        .setup(|app| {
            let handle = app.handle().clone();

            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }

            let state = app.state::<AppState>();
            let handle_fft = handle.clone();
            state.engine.spawn_fft(move |frame: FftFrame| {
                let _ = handle_fft.emit("fft-data", &frame);
            });

            let handle_progress = handle.clone();
            std::thread::spawn(move || loop {
                let app_state = handle_progress.state::<AppState>();
                let playing = app_state.engine.is_playing();
                let pos = app_state.engine.position_secs();
                let dur = app_state.engine.duration_secs();
                // Report user-facing volume, not the Sound Lab-muted engine gain.
                let volume = app_state.user_volume();
                let ended = app_state.engine.take_ended();
                let _ = handle_progress.emit(
                    "playback-progress",
                    serde_json::json!({
                        "playing": playing,
                        "position_secs": pos,
                        "duration_secs": dur,
                        "volume": volume,
                    }),
                );
                if ended {
                    let _ = handle_progress.emit("playback-ended", true);
                }
                std::thread::sleep(std::time::Duration::from_millis(250));
            });

            let handle_scan = handle.clone();
            std::thread::spawn(move || {
                let app_state = handle_scan.state::<AppState>();
                let root = {
                    let configured = app_state.music_root.lock().clone();
                    if configured.as_os_str().len() > 0 && configured.exists() {
                        configured
                    } else {
                        let d = default_music_dir();
                        *app_state.music_root.lock() = d.clone();
                        d
                    }
                };
                if let Ok(tracks) = scan_folder(&root) {
                    let gen = app_state.next_scan_gen();
                    if app_state.is_current_scan_gen(gen) {
                        *app_state.library.lock() = tracks.clone();
                        let _ = handle_scan.emit("library-updated", tracks);
                    }
                }

                // Live folder watch owned by AppState so set_music_root can retarget.
                commands::retarget_watcher(&handle_scan, &app_state, root);
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_library,
            commands::scan_library,
            commands::set_music_root,
            commands::get_music_root,
            commands::pick_folder,
            commands::load_track,
            commands::play,
            commands::pause,
            commands::toggle_play,
            commands::seek,
            commands::set_volume,
            commands::set_engine_muted,
            commands::read_audio_b64,
            commands::get_playback_status,
            commands::get_waveform,
            commands::get_color_palette,
            commands::play_track,
            commands::next_track,
            commands::prev_track,
            commands::set_queue,
            commands::toggle_like,
            commands::get_liked,
            commands::refresh_track,
            commands::palette_from_image,
            commands::list_playlists,
            commands::create_playlist,
            commands::rename_playlist,
            commands::delete_playlist,
            commands::add_tracks_to_playlist,
            commands::remove_track_from_playlist,
            commands::reorder_playlist,
            commands::move_playlist_track,
            commands::move_playlist_track_by_path,
            commands::get_playlist,
        ])
        .run(tauri::generate_context!())
    {
        eprintln!("error while running pouya music: {err}");
        std::process::exit(1);
    }
}

#[cfg(test)]
mod tests {
    use crate::library::color_extract::{extract_palette, pick_accent};
    use crate::library::scanner::{read_track, scan_folder};
    use std::path::PathBuf;

    #[test]
    fn scans_demo_library() {
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../demo-library");
        if !root.exists() {
            eprintln!("demo-library missing at {}", root.display());
            return;
        }
        let tracks = scan_folder(&root).expect("scan");
        assert!(!tracks.is_empty(), "expected demo tracks");
        assert!(
            tracks[0].cover_data_url.is_some(),
            "expected sidecar cover"
        );
        assert!(tracks[0].accent.starts_with('#'));
    }

    #[test]
    fn palette_from_cover() {
        let cover =
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../demo-library/nova-drive.png");
        if !cover.exists() {
            return;
        }
        let img = image::open(&cover).expect("open cover");
        let palette = extract_palette(&img, 4);
        assert!(!palette.is_empty());
        let accent = pick_accent(&palette);
        assert!(accent.starts_with('#'));
        let meta = read_track(
            &PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../demo-library/nova-drive.wav"),
        )
        .expect("read track");
        assert_eq!(meta.title, "nova-drive");
    }

    #[test]
    fn settings_roundtrip_allows_mute() {
        let s = crate::settings::AppSettings {
            liked: vec!["a".into()],
            music_root: None,
            volume: 0.0,
            last_track: None,
        };
        let json = serde_json::to_string_pretty(&s).unwrap();
        let back: crate::settings::AppSettings = serde_json::from_str(&json).unwrap();
        assert_eq!(back.volume, 0.0);
    }
}

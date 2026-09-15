//! Domain IPC surface. Add a new command file here and register in lib.rs.

pub mod library;
pub mod online;
pub mod playback;
pub mod playlists;
pub mod system;

// Re-export all commands so `generate_handler!` can list `commands::foo`.
pub use library::*;
pub use online::*;
pub use playback::*;
pub use playlists::*;
pub use system::*;

use notify::RecommendedWatcher;
use parking_lot::Mutex;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};

use crate::audio::AudioEngine;
use crate::library::scanner::TrackMeta;
use crate::settings::{load_settings, save_settings, AppSettings};

pub struct AppState {
    pub engine: AudioEngine,
    pub library: Mutex<Vec<TrackMeta>>,
    pub queue: Mutex<Vec<String>>,
    pub current_index: Mutex<Option<usize>>,
    pub music_root: Mutex<PathBuf>,
    pub liked: Mutex<Vec<String>>,
    /// User-facing volume (survives Sound Lab mute handoff). 0 is intentional mute.
    pub user_volume: Mutex<f32>,
    /// Incremented on every library scan request; stale results are discarded.
    pub scan_gen: AtomicU64,
    /// Owned folder watcher — replaced when music_root changes.
    pub watcher: Mutex<Option<RecommendedWatcher>>,
}

impl AppState {
    pub fn new() -> anyhow::Result<Self> {
        let settings = load_settings();
        let root = settings
            .music_root
            .as_ref()
            .map(PathBuf::from)
            .filter(|p| p.exists())
            .unwrap_or_else(crate::library::scanner::default_music_dir);
        let engine = AudioEngine::start()?;
        let volume = settings.volume.clamp(0.0, 1.0);
        // Do not fail startup if the audio thread is still probing devices.
        let _ = engine.set_volume(volume);
        // Load last track paused so the UI can restore metadata on hydrate.
        if let Some(last) = settings.last_track.clone() {
            let p = PathBuf::from(&last);
            if p.exists() {
                if let Err(e) = engine.load_track(&last) {
                    eprintln!("restore last_track failed: {e}");
                }
            }
        }
        Ok(Self {
            engine,
            library: Mutex::new(Vec::new()),
            queue: Mutex::new(Vec::new()),
            current_index: Mutex::new(None),
            music_root: Mutex::new(root),
            liked: Mutex::new(settings.liked),
            user_volume: Mutex::new(volume),
            scan_gen: AtomicU64::new(0),
            watcher: Mutex::new(None),
        })
    }

    pub fn next_scan_gen(&self) -> u64 {
        self.scan_gen.fetch_add(1, Ordering::SeqCst) + 1
    }

    pub fn is_current_scan_gen(&self, gen: u64) -> bool {
        self.scan_gen.load(Ordering::SeqCst) == gen
    }

    pub fn set_user_volume(&self, v: f32) {
        *self.user_volume.lock() = v.clamp(0.0, 1.0);
    }

    pub fn user_volume(&self) -> f32 {
        *self.user_volume.lock()
    }

    pub fn persist(&self) {
        let settings = AppSettings {
            liked: self.liked.lock().clone(),
            music_root: Some(self.music_root.lock().to_string_lossy().to_string()),
            volume: self.user_volume(),
            last_track: self
                .engine
                .current_path()
                .map(|p| p.to_string_lossy().to_string()),
        };
        if let Err(e) = save_settings(&settings) {
            eprintln!("persist settings failed: {e}");
        }
    }
}

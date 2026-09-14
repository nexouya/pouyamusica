//! Domain IPC surface. Add a new command file here and register in lib.rs.

pub mod library;
pub mod playback;
pub mod playlists;
pub mod system;

// Re-export all commands so `generate_handler!` can list `commands::foo`.
pub use library::*;
pub use playback::*;
pub use playlists::*;
pub use system::*;

use parking_lot::Mutex;
use std::path::PathBuf;

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
        engine.set_volume(settings.volume.clamp(0.0, 1.0))?;
        Ok(Self {
            engine,
            library: Mutex::new(Vec::new()),
            queue: Mutex::new(Vec::new()),
            current_index: Mutex::new(None),
            music_root: Mutex::new(root),
            liked: Mutex::new(settings.liked),
        })
    }

    pub fn persist(&self) {
        let settings = AppSettings {
            liked: self.liked.lock().clone(),
            music_root: Some(self.music_root.lock().to_string_lossy().to_string()),
            volume: self.engine.volume(),
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

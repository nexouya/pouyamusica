use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppSettings {
    #[serde(default)]
    pub liked: Vec<String>,
    #[serde(default)]
    pub music_root: Option<String>,
    #[serde(default = "default_volume")]
    pub volume: f32,
    #[serde(default)]
    pub last_track: Option<String>,
}

fn default_volume() -> f32 {
    0.8
}

pub fn settings_path() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("pouya-music")
        .join("settings.json")
}

pub fn load_settings() -> AppSettings {
    let path = settings_path();
    if let Ok(raw) = std::fs::read_to_string(&path) {
        if let Ok(mut s) = serde_json::from_str::<AppSettings>(&raw) {
            // A stored volume of exactly 0 is almost always an accidental mute
            // (or a failed engine init that never restored volume). Restore
            // an audible default so "it doesn't play" isn't just silence.
            if s.volume <= 0.0 {
                s.volume = default_volume();
            }
            return s;
        }
    }
    AppSettings::default()
}

pub fn save_settings(settings: &AppSettings) -> Result<()> {
    let path = settings_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let json = serde_json::to_string_pretty(settings)?;
    let tmp_path = path.with_extension("tmp");
    std::fs::write(&tmp_path, json)?;
    std::fs::rename(&tmp_path, &path)?;
    Ok(())
}

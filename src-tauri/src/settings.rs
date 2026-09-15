use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    #[serde(default)]
    pub liked: Vec<String>,
    #[serde(default)]
    pub music_root: Option<String>,
    /// User volume. 0.0 is a valid intentional mute.
    #[serde(default = "default_volume")]
    pub volume: f32,
    #[serde(default)]
    pub last_track: Option<String>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            liked: Vec::new(),
            music_root: None,
            volume: default_volume(),
            last_track: None,
        }
    }
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
        if let Ok(s) = serde_json::from_str::<AppSettings>(&raw) {
            // Only clamp absurd values; volume 0 is intentional mute.
            let mut s = s;
            if !s.volume.is_finite() || s.volume < 0.0 {
                s.volume = 0.0;
            } else if s.volume > 1.0 {
                s.volume = 1.0;
            }
            return s;
        }
    }
    AppSettings::default()
}

/// Atomic write: temp file in the same directory, then rename.
pub fn write_json_atomic(path: &std::path::Path, json: &str) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).with_context(|| format!("create {}", parent.display()))?;
    }
    let tmp = path.with_extension("json.tmp");
    std::fs::write(&tmp, json).with_context(|| format!("write {}", tmp.display()))?;
    std::fs::rename(&tmp, path).with_context(|| format!("rename into {}", path.display()))?;
    Ok(())
}

pub fn save_settings(settings: &AppSettings) -> Result<()> {
    let path = settings_path();
    let json = serde_json::to_string_pretty(settings)?;
    write_json_atomic(&path, &json)
}

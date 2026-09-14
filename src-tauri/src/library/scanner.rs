use anyhow::Result;
use lofty::file::TaggedFileExt;
use lofty::picture::PictureType;
use lofty::prelude::AudioFile;
use lofty::probe::Probe;
use lofty::tag::ItemKey;
use notify::{Event, RecommendedWatcher, RecursiveMode, Watcher};
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;

use super::color_extract::{encode_cover_jpeg, extract_palette, pick_accent};

const AUDIO_EXTS: &[&str] = &["mp3", "flac", "wav", "ogg", "m4a", "aac", "opus"];

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackMeta {
    pub id: String,
    pub path: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration_secs: f64,
    pub track_number: u32,
    pub cover_data_url: Option<String>,
    pub palette: Vec<String>,
    pub accent: String,
}

fn is_audio(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| AUDIO_EXTS.contains(&e.to_ascii_lowercase().as_str()))
        .unwrap_or(false)
}

fn make_id(path: &Path) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut h = DefaultHasher::new();
    path.hash(&mut h);
    format!("{:x}", h.finish())
}

pub fn read_track(path: &Path) -> Result<TrackMeta> {
    let mut title = path
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "Unknown".into());
    let mut artist = "Unknown Artist".to_string();
    let mut album = "Unknown Album".to_string();
    let mut duration_secs = 0.0;
    let mut track_number = 0u32;
    let mut cover_bytes: Option<Vec<u8>> = None;

    if let Ok(tagged) = Probe::open(path).and_then(|p| p.read()) {
        let props = tagged.properties();
        duration_secs = props.duration().as_secs_f64();
        if let Some(tag) = tagged.primary_tag().or_else(|| tagged.first_tag()) {
            if let Some(t) = tag.get_string(&ItemKey::TrackTitle) {
                title = t.to_string();
            }
            if let Some(a) = tag.get_string(&ItemKey::TrackArtist) {
                artist = a.to_string();
            }
            if let Some(al) = tag.get_string(&ItemKey::AlbumTitle) {
                album = al.to_string();
            }
            if let Some(n) = tag.get_string(&ItemKey::TrackNumber) {
                track_number = n.split('/').next().and_then(|s| s.parse().ok()).unwrap_or(0);
            }
            for pic in tag.pictures() {
                if pic.pic_type() == PictureType::CoverFront {
                    cover_bytes = Some(pic.data().to_vec());
                    break;
                }
            }
            if cover_bytes.is_none() {
                if let Some(pic) = tag.pictures().first() {
                    cover_bytes = Some(pic.data().to_vec());
                }
            }
        }
    }

    let mut cover_data_url = None;
    let mut palette = Vec::new();
    let mut accent = "#7C9CFF".to_string();

    if cover_bytes.is_none() {
        // Sidecar covers: <stem>.png|jpg or cover.png next to the audio file.
        let stem = path.file_stem().map(|s| s.to_string_lossy().to_string());
        let parent = path.parent().map(|p| p.to_path_buf());
        if let (Some(stem), Some(parent)) = (stem, parent) {
            for name in [
                format!("{stem}.png"),
                format!("{stem}.jpg"),
                format!("{stem}.jpeg"),
                "cover.png".into(),
                "cover.jpg".into(),
                "folder.jpg".into(),
            ] {
                let candidate = parent.join(name);
                if candidate.exists() {
                    if let Ok(bytes) = std::fs::read(&candidate) {
                        cover_bytes = Some(bytes);
                        break;
                    }
                }
            }
        }
    }

    if let Some(bytes) = cover_bytes {
        if let Ok(img) = image::load_from_memory(&bytes) {
            palette = extract_palette(&img, 4);
            accent = pick_accent(&palette);
            let b64 = encode_cover_jpeg(&img, 256);
            cover_data_url = Some(format!("data:image/jpeg;base64,{b64}"));
        }
    }

    if palette.is_empty() {
        // Fallback pseudo-palette from path hash for variety without images
        let id = make_id(path);
        let n = u32::from_str_radix(&id[0..6], 16).unwrap_or(0x7C9CFF);
        accent = format!("#{:06X}", (n | 0x405080) & 0xBFCFEF);
        palette = vec![accent.clone(), "#2A3344".into()];
    }

    Ok(TrackMeta {
        id: make_id(path),
        path: path.to_string_lossy().to_string(),
        title,
        artist,
        album,
        duration_secs,
        track_number,
        cover_data_url,
        palette,
        accent,
    })
}

pub fn scan_folder(dir: &Path) -> Result<Vec<TrackMeta>> {
    let mut tracks = Vec::new();
    if !dir.exists() {
        return Ok(tracks);
    }
    let mut stack = vec![dir.to_path_buf()];
    while let Some(d) = stack.pop() {
        let entries = match std::fs::read_dir(&d) {
            Ok(e) => e,
            Err(_) => continue,
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                stack.push(path);
            } else if is_audio(&path) {
                if let Ok(t) = read_track(&path) {
                    tracks.push(t);
                }
            }
        }
    }
    tracks.sort_by(|a, b| {
        a.artist
            .cmp(&b.artist)
            .then(a.album.cmp(&b.album))
            .then(a.track_number.cmp(&b.track_number))
    });
    Ok(tracks)
}

#[allow(dead_code)]
pub type Library = Arc<Mutex<Vec<TrackMeta>>>;

/// Watch a music root; invoke `on_change` when audio files appear/change.
pub fn watch_folder(dir: PathBuf, on_change: impl Fn(PathBuf) + Send + 'static) -> Result<RecommendedWatcher> {
    let mut watcher: RecommendedWatcher = notify::recommended_watcher(
        move |res: notify::Result<Event>| {
            if let Ok(event) = res {
                if matches!(
                    event.kind,
                    notify::EventKind::Create(_)
                        | notify::EventKind::Modify(_)
                        | notify::EventKind::Remove(_)
                ) {
                    for path in event.paths {
                        if is_audio(&path) || path.is_dir() {
                            on_change(path.clone());
                        }
                    }
                }
            }
        },
    )?;
    watcher.watch(&dir, RecursiveMode::Recursive)?;
    Ok(watcher)
}

pub fn default_music_dir() -> PathBuf {
    dirs::audio_dir()
        .or_else(dirs::home_dir)
        .map(|p| p.join("Music"))
        .unwrap_or_else(|| PathBuf::from("."))
}

#[allow(dead_code)]
pub fn debounce_demo() -> Duration {
    Duration::from_millis(250)
}

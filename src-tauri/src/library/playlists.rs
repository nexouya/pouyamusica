use anyhow::Result;
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Playlist {
    pub id: String,
    pub name: String,
    pub description: String,
    /// Ordered track file paths
    pub tracks: Vec<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

/// Process-wide lock so concurrent load-modify-save cannot lose updates.
static PLAYLIST_LOCK: Mutex<()> = Mutex::new(());

fn now_secs() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

pub fn playlists_path() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("pouya-music")
        .join("playlists.json")
}

pub fn load_playlists() -> Vec<Playlist> {
    let path = playlists_path();
    if let Ok(raw) = std::fs::read_to_string(&path) {
        if let Ok(list) = serde_json::from_str::<Vec<Playlist>>(&raw) {
            return list;
        }
    }
    Vec::new()
}

pub fn save_playlists(list: &[Playlist]) -> Result<()> {
    let path = playlists_path();
    let json = serde_json::to_string_pretty(list)?;
    crate::settings::write_json_atomic(&path, &json)
}

fn with_lock<T>(f: impl FnOnce() -> Result<T>) -> Result<T> {
    let _g = PLAYLIST_LOCK.lock();
    f()
}

pub fn create_playlist(name: &str, description: &str) -> Result<Playlist> {
    with_lock(|| {
        let mut list = load_playlists();
        let pl = Playlist {
            id: Uuid::new_v4().to_string(),
            name: name.trim().to_string(),
            description: description.trim().to_string(),
            tracks: Vec::new(),
            created_at: now_secs(),
            updated_at: now_secs(),
        };
        list.push(pl.clone());
        save_playlists(&list)?;
        Ok(pl)
    })
}

pub fn rename_playlist(id: &str, name: &str, description: Option<&str>) -> Result<Playlist> {
    with_lock(|| {
        let mut list = load_playlists();
        let pl = list
            .iter_mut()
            .find(|p| p.id == id)
            .ok_or_else(|| anyhow::anyhow!("playlist not found"))?;
        pl.name = name.trim().to_string();
        if let Some(d) = description {
            pl.description = d.trim().to_string();
        }
        pl.updated_at = now_secs();
        let out = pl.clone();
        save_playlists(&list)?;
        Ok(out)
    })
}

pub fn delete_playlist(id: &str) -> Result<()> {
    with_lock(|| {
        let mut list = load_playlists();
        list.retain(|p| p.id != id);
        save_playlists(&list)
    })
}

pub fn add_tracks(id: &str, paths: &[String]) -> Result<Playlist> {
    with_lock(|| {
        let mut list = load_playlists();
        let pl = list
            .iter_mut()
            .find(|p| p.id == id)
            .ok_or_else(|| anyhow::anyhow!("playlist not found"))?;
        for p in paths {
            if !pl.tracks.contains(p) {
                pl.tracks.push(p.clone());
            }
        }
        pl.updated_at = now_secs();
        let out = pl.clone();
        save_playlists(&list)?;
        Ok(out)
    })
}

pub fn remove_track(id: &str, path: &str) -> Result<Playlist> {
    with_lock(|| {
        let mut list = load_playlists();
        let pl = list
            .iter_mut()
            .find(|p| p.id == id)
            .ok_or_else(|| anyhow::anyhow!("playlist not found"))?;
        pl.tracks.retain(|t| t != path);
        pl.updated_at = now_secs();
        let out = pl.clone();
        save_playlists(&list)?;
        Ok(out)
    })
}

pub fn reorder(id: &str, order: Vec<String>) -> Result<Playlist> {
    with_lock(|| {
        let mut list = load_playlists();
        let pl = list
            .iter_mut()
            .find(|p| p.id == id)
            .ok_or_else(|| anyhow::anyhow!("playlist not found"))?;
        let set: std::collections::HashSet<&str> = pl.tracks.iter().map(|s| s.as_str()).collect();
        let mut next: Vec<String> = order
            .into_iter()
            .filter(|p| set.contains(p.as_str()))
            .collect();
        for t in &pl.tracks {
            if !next.contains(t) {
                next.push(t.clone());
            }
        }
        pl.tracks = next;
        pl.updated_at = now_secs();
        let out = pl.clone();
        save_playlists(&list)?;
        Ok(out)
    })
}

pub fn move_track(id: &str, from: usize, to: usize) -> Result<Playlist> {
    with_lock(|| {
        let mut list = load_playlists();
        let pl = list
            .iter_mut()
            .find(|p| p.id == id)
            .ok_or_else(|| anyhow::anyhow!("playlist not found"))?;
        if from >= pl.tracks.len() || to >= pl.tracks.len() {
            return Err(anyhow::anyhow!("index out of range"));
        }
        let item = pl.tracks.remove(from);
        pl.tracks.insert(to, item);
        pl.updated_at = now_secs();
        let out = pl.clone();
        save_playlists(&list)?;
        Ok(out)
    })
}

pub fn move_track_by_path(id: &str, path: &str, to: usize) -> Result<Playlist> {
    with_lock(|| {
        let mut list = load_playlists();
        let pl = list
            .iter_mut()
            .find(|p| p.id == id)
            .ok_or_else(|| anyhow::anyhow!("playlist not found"))?;
        let from = pl
            .tracks
            .iter()
            .position(|t| t == path)
            .ok_or_else(|| anyhow::anyhow!("track not in playlist"))?;
        if to >= pl.tracks.len() {
            return Err(anyhow::anyhow!("index out of range"));
        }
        if from != to {
            let item = pl.tracks.remove(from);
            pl.tracks.insert(to, item);
        }
        pl.updated_at = now_secs();
        let out = pl.clone();
        save_playlists(&list)?;
        Ok(out)
    })
}

pub fn get_playlist(id: &str) -> Option<Playlist> {
    load_playlists().into_iter().find(|p| p.id == id)
}

import { invoke } from "@tauri-apps/api/core";
import type { ColorPalette, Playlist, TrackMeta } from "../../types";

/** Typed IPC facade — add new commands here only. */
export const api = {
  // library
  getLibrary: () => invoke<TrackMeta[]>("get_library"),
  scanLibrary: () => invoke<TrackMeta[]>("scan_library"),
  setMusicRoot: (path: string) => invoke<TrackMeta[]>("set_music_root", { path }),
  getMusicRoot: () => invoke<string>("get_music_root"),
  refreshTrack: (path: string) => invoke<TrackMeta | null>("refresh_track", { path }),
  pickFolder: () => invoke<TrackMeta[] | null>("pick_folder"),

  // playback
  loadTrack: (path: string) => invoke<TrackMeta>("load_track", { path }),
  play: () => invoke<void>("play"),
  pause: () => invoke<void>("pause"),
  togglePlay: () => invoke<void>("toggle_play"),
  seek: (position: number) => invoke<void>("seek", { position }),
  setVolume: (level: number) => invoke<void>("set_volume", { level }),
  setEngineMuted: (muted: boolean) => invoke<void>("set_engine_muted", { muted }),
  readAudioB64: (path: string) => invoke<string>("read_audio_b64", { path }),
  playTrack: (path: string) => invoke<TrackMeta>("play_track", { path }),
  nextTrack: () => invoke<TrackMeta | null>("next_track"),
  prevTrack: () => invoke<TrackMeta | null>("prev_track"),
  getPlaybackStatus: () =>
    invoke<{
      playing: boolean;
      position_secs: number;
      duration_secs: number;
      volume: number;
      path: string | null;
    }>("get_playback_status"),

  // media analysis
  getWaveform: (path: string) => invoke<number[]>("get_waveform", { path }),
  getColorPalette: (path: string) => invoke<ColorPalette>("get_color_palette", { path }),
  paletteFromImage: (path: string) => invoke<ColorPalette>("palette_from_image", { path }),

  // social / prefs
  toggleLike: (path: string) => invoke<string[]>("toggle_like", { path }),
  getLiked: () => invoke<string[]>("get_liked"),
  setQueue: (paths: string[]) => invoke<void>("set_queue", { paths }),

  // playlists
  listPlaylists: () => invoke<Playlist[]>("list_playlists"),
  createPlaylist: (name: string, description?: string) =>
    invoke<Playlist>("create_playlist", { name, description: description ?? "" }),
  renamePlaylist: (id: string, name: string, description?: string) =>
    invoke<Playlist>("rename_playlist", { id, name, description: description ?? "" }),
  deletePlaylist: (id: string) => invoke<void>("delete_playlist", { id }),
  addToPlaylist: (id: string, paths: string[]) =>
    invoke<Playlist>("add_tracks_to_playlist", { id, paths }),
  removeFromPlaylist: (id: string, path: string) =>
    invoke<Playlist>("remove_track_from_playlist", { id, path }),
  movePlaylistTrack: (id: string, from: number, to: number) =>
    invoke<Playlist>("move_playlist_track", { id, from, to }),
  movePlaylistTrackByPath: (id: string, path: string, to: number) =>
    invoke<Playlist>("move_playlist_track_by_path", { id, path, to }),
  getPlaylist: (id: string) => invoke<Playlist | null>("get_playlist", { id }),
};

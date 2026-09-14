export type TrackMeta = {
  id: string;
  path: string;
  title: string;
  artist: string;
  album: string;
  duration_secs: number;
  track_number: number;
  cover_data_url: string | null;
  palette: string[];
  accent: string;
};

export type FftFrame = {
  bands: number[];
  rms: number;
  sample_rate: number;
};

export type PlaybackProgress = {
  playing: boolean;
  position_secs: number;
  duration_secs: number;
  volume?: number;
};

export type ColorPalette = {
  accent: string;
  accent_rgb: string;
  palette: string[];
};

export type ViewId =
  | "home"
  | "explore"
  | "library"
  | "liked"
  | "search"
  | "playlists";

export type Playlist = {
  id: string;
  name: string;
  description: string;
  tracks: string[];
  created_at: number;
  updated_at: number;
};

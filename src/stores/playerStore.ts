import { create } from "zustand";
import type { TrackMeta } from "../types";
import { api } from "../core/api";
import { useLibraryStore } from "./libraryStore";

type RepeatMode = "off" | "all" | "one";

type PlayerState = {
  current: TrackMeta | null;
  playing: boolean;
  position: number;
  duration: number;
  volume: number;
  shuffle: boolean;
  repeat: RepeatMode;
  waveform: number[];
  liked: string[];
  queueOpen: boolean;
  focusMode: boolean;
  fft: number[];
  setPlaying: (v: boolean) => void;
  setPosition: (v: number) => void;
  setDuration: (v: number) => void;
  setVolume: (v: number) => void;
  setFft: (bands: number[]) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  toggleQueue: () => void;
  toggleFocus: () => void;
  hydrate: () => Promise<void>;
  /** Load + start a track (IPC play_track). */
  playTrack: (track: TrackMeta) => Promise<void>;
  /** Adopt metadata when backend already loaded the track (no second IPC load). */
  adoptTrack: (track: TrackMeta) => Promise<void>;
  togglePlay: () => Promise<void>;
  next: () => Promise<void>;
  prev: () => Promise<void>;
  seek: (secs: number) => Promise<void>;
  applyVolume: (level: number) => Promise<void>;
  toggleLikeCurrent: () => Promise<void>;
};

async function loadWaveform(path: string): Promise<number[]> {
  return api.getWaveform(path).catch(() => []);
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  current: null,
  playing: false,
  position: 0,
  duration: 0,
  volume: 0.8,
  shuffle: false,
  repeat: "off",
  waveform: [],
  liked: [],
  queueOpen: false,
  focusMode: false,
  fft: new Array(32).fill(0),

  setPlaying: (v) => set({ playing: v }),
  setPosition: (v) => set({ position: v }),
  setDuration: (v) => set({ duration: v }),
  setVolume: (v) => set({ volume: v }),
  setFft: (bands) => set({ fft: bands }),
  toggleShuffle: () => set((s) => ({ shuffle: !s.shuffle })),
  cycleRepeat: () =>
    set((s) => ({
      repeat: s.repeat === "off" ? "all" : s.repeat === "all" ? "one" : "off",
    })),
  toggleQueue: () => set((s) => ({ queueOpen: !s.queueOpen })),
  toggleFocus: () => set((s) => ({ focusMode: !s.focusMode })),

  hydrate: async () => {
    try {
      const liked = await api.getLiked();
      set({ liked });
    } catch {
      /* ignore */
    }
  },

  playTrack: async (track) => {
    try {
      const paths = useLibraryStore.getState().tracks.map((t) => t.path);
      if (paths.length) void api.setQueue(paths).catch(() => undefined);
      const meta = await api.playTrack(track.path);
      // Un-mute if the engine is currently silent so playback is audible.
      if (get().volume <= 0) {
        void get().applyVolume(0.8);
      }
      const waveform = await loadWaveform(track.path);
      set({
        current: meta || track,
        playing: true,
        position: 0,
        duration: (meta || track).duration_secs || 0,
        waveform,
      });
    } catch (e) {
      console.error("playTrack failed", e);
      useLibraryStore.setState({ error: `Playback failed: ${e}` });
    }
  },

  adoptTrack: async (track) => {
    const waveform = await loadWaveform(track.path);
    set({
      current: track,
      playing: true,
      position: 0,
      duration: track.duration_secs || 0,
      waveform,
    });
  },

  togglePlay: async () => {
    const { current, playing } = get();
    if (!current) return;
    try {
      await api.togglePlay();
      set({ playing: !playing });
    } catch (e) {
      console.error("togglePlay failed", e);
    }
  },

  next: async () => {
    const { current, shuffle, repeat } = get();
    const tracks = useLibraryStore.getState().tracks;
    if (!tracks.length) return;
    const idx = tracks.findIndex((t) => t.id === current?.id);
    let nextIdx: number;

    if (shuffle && tracks.length > 1) {
      nextIdx = Math.floor(Math.random() * tracks.length);
      if (nextIdx === idx) nextIdx = (nextIdx + 1) % tracks.length;
    } else {
      if (idx < 0) nextIdx = 0;
      else nextIdx = idx + 1;
      if (nextIdx >= tracks.length) {
        if (repeat === "all") nextIdx = 0;
        else return; // stop at end
      }
    }
    await get().playTrack(tracks[nextIdx]);
  },

  prev: async () => {
    const { current, shuffle } = get();
    const tracks = useLibraryStore.getState().tracks;
    if (!tracks.length) return;
    const idx = tracks.findIndex((t) => t.id === current?.id);
    let prevIdx: number;
    if (shuffle && tracks.length > 1) {
      prevIdx = Math.floor(Math.random() * tracks.length);
      if (prevIdx === idx) prevIdx = (prevIdx + tracks.length - 1) % tracks.length;
    } else {
      prevIdx = idx <= 0 ? tracks.length - 1 : idx - 1;
    }
    await get().playTrack(tracks[prevIdx]);
  },

  seek: async (secs) => {
    set({ position: secs });
    try {
      await api.seek(secs);
    } catch (e) {
      console.error("seek failed", e);
    }
  },

  applyVolume: async (level) => {
    const v = Math.min(1, Math.max(0, level));
    set({ volume: v });
    try {
      await api.setVolume(v);
    } catch (e) {
      console.error("setVolume failed", e);
    }
  },

  toggleLikeCurrent: async () => {
    const current = get().current;
    if (!current) return;
    try {
      const liked = await api.toggleLike(current.path);
      set({ liked });
    } catch (e) {
      console.error("like failed", e);
    }
  },
}));

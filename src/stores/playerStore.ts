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

/** Lazy import — soundLabStore also reads playerStore (avoid cycle at module init). */
async function soundLabWeb() {
  const m = await import("./soundLabStore");
  return m;
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

      const lab = await soundLabWeb();
      const labState = lab.useSoundLabStore.getState();
      const wantWeb = lab.labWantsWeb(labState);

      // If Sound Lab should own audio, mute native BEFORE starting rodio
      if (wantWeb) {
        try {
          await api.setEngineMuted(true);
        } catch {
          /* ignore */
        }
      }

      const meta = await api.playTrack(track.path).catch((e) => {
        console.warn("playTrack IPC", e);
        return track;
      });

      if (get().volume <= 0) {
        void get().applyVolume(0.8);
      }
      const waveform = await loadWaveform(track.path);

      if (wantWeb) {
        try {
          await api.pause();
          const dur = await lab.webPlayTrack(track.path, get().volume);
          set({
            current: meta || track,
            playing: true,
            position: 0,
            duration: dur || (meta || track).duration_secs || 0,
            waveform,
          });
          return;
        } catch (e) {
          console.error("web playTrack failed", e);
          // Fall back to native so the user still hears music
          try {
            await api.setEngineMuted(false);
            await api.play();
          } catch {
            /* ignore */
          }
          useLibraryStore.setState({
            error: `Sound Lab DSP failed to load track — playing clean native. ${e}`,
          });
        }
      }

      set({
        current: meta || track,
        playing: true,
        position: 0,
        duration: (meta || track).duration_secs || 0,
        waveform,
      });
    } catch (e) {
      console.error("playTrack failed", e);
      set({ playing: false });
      useLibraryStore.setState({ error: `Playback failed: ${e}` });
    }
  },

  adoptTrack: async (track) => {
    const waveform = await loadWaveform(track.path);
    set({
      current: track,
      position: 0,
      duration: track.duration_secs || 0,
      waveform,
    });
  },

  togglePlay: async () => {
    const { current } = get();
    if (!current) return;
    try {
      const lab = await soundLabWeb();
      const labState = lab.useSoundLabStore.getState();
      // If DSP is selected but web path never engaged, try engage now
      if (lab.labWantsWeb(labState) && !labState.webPath) {
        await lab.useSoundLabStore.getState().syncPlaybackPath();
      }
      if (lab.useSoundLabStore.getState().webPath) {
        const playing = await lab.webTogglePlay();
        set({ playing, position: lab.webPos() });
        return;
      }
      await api.togglePlay();
      // Trust the engine, not a local flip — progress events can race.
      const status = await api.getPlaybackStatus().catch(() => null);
      if (status) {
        set({
          playing: status.playing,
          position: status.position_secs,
          duration: status.duration_secs || get().duration,
          volume: status.volume,
        });
      } else {
        set({ playing: !get().playing });
      }
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
        else {
          set({ playing: false });
          return;
        }
      }
    }
    await get().playTrack(tracks[nextIdx]);
  },

  prev: async () => {
    const { current, shuffle, position } = get();
    const tracks = useLibraryStore.getState().tracks;
    if (!tracks.length || !current) return;
    // Standard transport: >3s restarts current track; otherwise previous.
    if (position > 3) {
      await get().seek(0);
      try {
        const lab = await soundLabWeb();
        if (lab.useSoundLabStore.getState().webPath) {
          await (await import("./soundLabStore")).webTogglePlay();
        } else {
          await api.play();
        }
        set({ playing: true });
      } catch {
        /* ignore */
      }
      return;
    }
    const idx = tracks.findIndex((t) => t.id === current.id);
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
      const lab = await soundLabWeb();
      if (lab.useSoundLabStore.getState().webPath) {
        lab.webSeek(secs);
        return;
      }
      await api.seek(secs);
    } catch (e) {
      console.error("seek failed", e);
    }
  },

  applyVolume: async (level) => {
    const v = Math.min(1, Math.max(0, level));
    set({ volume: v });
    try {
      const lab = await soundLabWeb();
      if (lab.useSoundLabStore.getState().webPath) {
        lab.webVolume(v);
        // Keep native muted while web path is live (no settings write)
        await api.setEngineMuted(true).catch(() => undefined);
        return;
      }
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

import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { TrackMeta, YtSong } from "../types";
import { usePlayerStore } from "./playerStore";
import { useLibraryStore } from "./libraryStore";
import { updateAudioVisualData } from "../core/events/audioVisualBus";

const CORE_PORT = 17321;

type StreamCoreStatus = {
  running: boolean;
  port: number;
  base_url: string;
  node_ok: boolean;
};

type OnlineState = {
  core: StreamCoreStatus | null;
  coreError: string | null;
  query: string;
  results: YtSong[];
  searching: boolean;
  searchError: string | null;
  currentId: string | null;
  playing: boolean;
  position: number;
  duration: number;
  downloading: Record<string, boolean>;
  downloadNote: string | null;
  audio: HTMLAudioElement | null;
  setQuery: (q: string) => void;
  ensureCore: () => Promise<void>;
  search: (q?: string) => Promise<void>;
  playSong: (song: YtSong) => Promise<void>;
  toggleOnlinePlay: () => Promise<void>;
  seekOnline: (secs: number) => void;
  downloadSong: (song: YtSong) => Promise<void>;
  dispose: () => void;
};

let audioEl: HTMLAudioElement | null = null;
let progressTimer: number | null = null;
let spectrumRaf = 0;

function baseUrl(core: OnlineState["core"]): string {
  if (core?.running && core.base_url) return core.base_url.replace(/\/$/, "");
  return `http://127.0.0.1:${core?.port || CORE_PORT}`;
}

function parseDuration(d?: string | number): number {
  if (typeof d === "number" && Number.isFinite(d)) return d;
  if (typeof d === "string") {
    const parts = d.split(":").map((p) => parseInt(p, 10) || 0);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
  }
  return 0;
}

function ytToTrack(song: YtSong, baseUrlStr: string): TrackMeta {
  return {
    id: `yt:${song.videoId}`,
    path: `${baseUrlStr}/play/${song.videoId}`,
    title: song.title,
    artist: song.artist || "YouTube",
    album: "YouTube",
    duration_secs: parseDuration(song.duration),
    track_number: 0,
    cover_data_url: song.thumbnail || null,
    palette: ["#FF0033", "#222222"],
    accent: "#FF4D6D",
  };
}

export const useOnlineStore = create<OnlineState>((set, get) => ({
  core: null,
  coreError: null,
  query: "",
  results: [],
  searching: false,
  searchError: null,
  currentId: null,
  playing: false,
  position: 0,
  duration: 0,
  downloading: {},
  downloadNote: null,
  audio: null,

  setQuery: (q) => set({ query: q }),

  ensureCore: async () => {
    try {
      let status = await invoke<StreamCoreStatus>("get_stream_core_status");
      if (!status.running) {
        status = await invoke<StreamCoreStatus>("start_stream_core");
      }
      set({ core: status, coreError: null });
    } catch (e) {
      set({ coreError: String(e), core: null });
    }
  },

  search: async (q) => {
    const query = (q ?? get().query).trim();
    if (!query) return;
    await get().ensureCore();
    const core = get().core;
    if (!core?.running) {
      set({
        searchError: get().coreError || "Stream core is not running. Install Node.js 18+.",
      });
      return;
    }
    set({ searching: true, searchError: null, query });
    try {
      const url = `${baseUrl(core)}/api/search?q=${encodeURIComponent(query)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`search failed (${res.status})`);
      const data = (await res.json()) as { songs?: YtSong[] };
      set({ results: data.songs || [], searching: false });
    } catch (e) {
      set({ searching: false, searchError: String(e), results: [] });
    }
  },

  playSong: async (song) => {
    const core = get().core;
    if (!core?.running) await get().ensureCore();
    const base = baseUrl(get().core);
    const track = ytToTrack(song, base);

    // Stop local files so only one engine is audible.
    try {
      const { api } = await import("../core/api");
      await api.pause();
    } catch {
      /* ignore */
    }
    try {
      const lab = await import("./soundLabStore");
      if (lab.useSoundLabStore.getState().webPath) {
        lab.useSoundLabStore.getState().dispose();
        lab.useSoundLabStore.setState({ webPath: false });
      }
    } catch {
      /* ignore */
    }

    if (audioEl) {
      try {
        audioEl.pause();
      } catch {
        /* ignore */
      }
      audioEl.src = "";
    }

    const el = new Audio();
    el.crossOrigin = "anonymous";
    el.preload = "auto";
    el.src = `${base}/play/${song.videoId}`;
    el.volume = Math.max(0, Math.min(1, usePlayerStore.getState().volume || 0.8));

    audioEl = el;
    set({ audio: el, currentId: song.videoId, position: 0, duration: parseDuration(song.duration) });

    usePlayerStore.setState({
      current: track,
      playing: true,
      position: 0,
      duration: parseDuration(song.duration),
      waveform: [],
      queue: [track],
    });

    el.onloadedmetadata = () => {
      const dur = el.duration && Number.isFinite(el.duration) ? el.duration : 0;
      if (dur > 0) {
        set({ duration: dur });
        usePlayerStore.setState({ duration: dur });
      }
    };
    el.onended = () => {
      set({ playing: false });
      usePlayerStore.setState({ playing: false });
      cancelAnimationFrame(spectrumRaf);
    };
    el.onerror = () => {
      set({ playing: false, searchError: "Stream failed — try another result or check network/proxy." });
      usePlayerStore.setState({ playing: false });
      useLibraryStore.setState({ error: "YouTube stream failed" });
    };

    const tickProgress = () => {
      if (!audioEl) return;
      set({ position: audioEl.currentTime, playing: !audioEl.paused });
      usePlayerStore.setState({
        position: audioEl.currentTime,
        playing: !audioEl.paused,
      });
      progressTimer = window.setTimeout(tickProgress, 250);
    };
    if (progressTimer) window.clearTimeout(progressTimer);
    tickProgress();

    // Fake-ish live spectrum from volume envelope so FocusMode stays alive.
    const paint = () => {
      if (!audioEl || audioEl.paused) {
        updateAudioVisualData(new Array(32).fill(0), 0);
        spectrumRaf = requestAnimationFrame(paint);
        return;
      }
      const t = audioEl.currentTime;
      const bands = new Array(32).fill(0).map((_, i) => {
        const x = Math.sin(t * (2 + i * 0.13) + i) * 0.5 + 0.5;
        const y = Math.sin(t * (0.7 + i * 0.05)) * 0.5 + 0.5;
        return Math.max(0, Math.min(1, x * 0.55 + y * 0.45));
      });
      const rms = Math.sqrt(bands.reduce((a, b) => a + b * b, 0) / bands.length);
      updateAudioVisualData(bands, rms);
      spectrumRaf = requestAnimationFrame(paint);
    };
    cancelAnimationFrame(spectrumRaf);
    paint();

    try {
      await el.play();
      set({ playing: true });
    } catch (e) {
      set({ playing: false, searchError: `Autoplay blocked: ${e}` });
    }
  },

  toggleOnlinePlay: async () => {
    const el = get().audio;
    if (!el) return;
    if (el.paused) {
      await el.play();
      set({ playing: true });
      usePlayerStore.setState({ playing: true });
    } else {
      el.pause();
      set({ playing: false });
      usePlayerStore.setState({ playing: false });
    }
  },

  seekOnline: (secs) => {
    const el = get().audio;
    if (!el) return;
    el.currentTime = Math.max(0, secs);
    set({ position: el.currentTime });
    usePlayerStore.setState({ position: el.currentTime });
  },

  downloadSong: async (song) => {
    await get().ensureCore();
    if (!get().core?.running) {
      set({ downloadNote: "Stream core not running" });
      return;
    }
    set((s) => ({ downloading: { ...s.downloading, [song.videoId]: true }, downloadNote: null }));
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const dir = await open({ directory: true, multiple: false, title: "Save track to folder" });
      if (!dir || Array.isArray(dir)) {
        set((s) => ({ downloading: { ...s.downloading, [song.videoId]: false } }));
        return;
      }
      const path = await invoke<string>("download_yt_track", {
        videoId: song.videoId,
        title: `${song.artist ? song.artist + " - " : ""}${song.title}`,
        destDir: dir,
      });
      set((s) => ({
        downloading: { ...s.downloading, [song.videoId]: false },
        downloadNote: `Saved: ${path}`,
      }));
    } catch (e) {
      set((s) => ({
        downloading: { ...s.downloading, [song.videoId]: false },
        downloadNote: `Download failed: ${e}`,
      }));
    }
  },

  dispose: () => {
    if (progressTimer) window.clearTimeout(progressTimer);
    cancelAnimationFrame(spectrumRaf);
    if (audioEl) {
      try {
        audioEl.pause();
        audioEl.src = "";
      } catch {
        /* ignore */
      }
    }
    audioEl = null;
    set({ audio: null, playing: false, currentId: null });
  },
}));

/** Bridge player bar play/pause/seek/volume when an online track is active. */
export function isOnlineTrack(path?: string | null): boolean {
  return !!path && (path.includes("/play/") || path.startsWith("http://127.0.0.1"));
}

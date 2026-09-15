import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { TrackMeta, YtSong } from "../types";
import { usePlayerStore } from "./playerStore";
import { useLibraryStore } from "./libraryStore";
import { useUiStore } from "./uiStore";
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
  buffering: boolean;
  cookieHint: string | null;
  signedIn: boolean;
  downloading: Record<string, boolean>;
  downloadNote: string | null;
  audio: HTMLAudioElement | null;
  setQuery: (q: string) => void;
  ensureCore: () => Promise<boolean>;
  search: (q?: string) => Promise<void>;
  playSong: (song: YtSong) => Promise<void>;
  toggleOnlinePlay: () => Promise<void>;
  seekOnline: (secs: number) => void;
  downloadSong: (song: YtSong) => Promise<void>;
  importCookies: (json: string) => Promise<void>;
  dispose: () => void;
};

let audioEl: HTMLAudioElement | null = null;
let progressTimer: number | null = null;
let spectrumRaf = 0;
let audioCtx: AudioContext | null = null;
let mediaSource: MediaElementAudioSourceNode | null = null;
let analyser: AnalyserNode | null = null;
let smoothBands = new Float32Array(32);
/** Monotonic id so a slower search never overwrites a newer one. */
let searchSeq = 0;

function mergeSongs(primary: YtSong[], extra: YtSong[] | null | undefined): YtSong[] {
  const seen = new Set(primary.map((s) => s.videoId));
  const out = primary.slice();
  for (const s of extra || []) {
    if (!s?.videoId || seen.has(s.videoId)) continue;
    seen.add(s.videoId);
    out.push(s);
  }
  return out;
}

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
    palette: ["#FF0033", "#1a1a1a"],
    accent: "#FF4D6D",
  };
}

function teardownGraph() {
  cancelAnimationFrame(spectrumRaf);
  try {
    mediaSource?.disconnect();
  } catch {
    /* ignore */
  }
  try {
    analyser?.disconnect();
  } catch {
    /* ignore */
  }
  mediaSource = null;
  analyser = null;
}

function attachRealAnalyser(el: HTMLAudioElement) {
  teardownGraph();
  try {
    if (!audioCtx) {
      audioCtx = new AudioContext({ latencyHint: "playback" });
    }
    if (audioCtx.state === "suspended") void audioCtx.resume();
    // CORS is enabled on stream-core — MediaElementSource works.
    mediaSource = audioCtx.createMediaElementSource(el);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.82;
    mediaSource.connect(analyser);
    // Do NOT connect to destination twice — element already outputs.
    // Analyser is a tap only if we also connect analyser → destination.
    // createMediaElementSource routes element output into the graph, so we
    // MUST reconnect to destination or audio becomes silent.
    analyser.connect(audioCtx.destination);

    const freq = new Uint8Array(analyser.frequencyBinCount);
    const paint = () => {
      if (!analyser || !audioEl || audioEl.paused) {
        for (let i = 0; i < 32; i++) {
          smoothBands[i] *= 0.88;
        }
      } else {
        analyser.getByteFrequencyData(freq);
        const n = freq.length;
        for (let i = 0; i < 32; i++) {
          const a = Math.floor(Math.pow(i / 32, 1.55) * n * 0.72);
          const b = Math.max(a + 1, Math.floor(Math.pow((i + 1) / 32, 1.55) * n * 0.72));
          let peak = 0;
          for (let j = a; j < b && j < n; j++) peak = Math.max(peak, freq[j]);
          const target = Math.min(1, (peak / 255) * 1.15);
          // Heavy smoothing — kills flicker.
          smoothBands[i] += (target - smoothBands[i]) * 0.18;
        }
      }
      const bands = Array.from(smoothBands);
      const rms = Math.sqrt(bands.reduce((a, b) => a + b * b, 0) / bands.length);
      updateAudioVisualData(bands, rms);
      spectrumRaf = requestAnimationFrame(paint);
    };
    cancelAnimationFrame(spectrumRaf);
    paint();
  } catch (e) {
    console.warn("[online] analyser attach failed", e);
  }
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
  buffering: false,
  cookieHint: null,
  signedIn: false,
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
      // Verify HTTP health, not just process alive.
      const base = (status.base_url || `http://127.0.0.1:${status.port}`).replace(/\/$/, "");
      const health = await fetch(`${base}/healthz`).then((r) => r.json()).catch(() => null);
      if (!health?.ok) {
        set({
          core: status,
          coreError: "Stream core process is up but /healthz failed. Retrying…",
        });
        return false;
      }
      set({ core: { ...status, base_url: base }, coreError: null });
      // Probe cookie / sign-in state.
      try {
        const ck = await fetch(`${base}/api/cookie-status`).then((r) => r.json());
        set({
          signedIn: !!ck.signedIn,
          cookieHint: ck.hint || null,
        });
        // Sign-in is helpful but not required — do not block search UI.
        if (!ck.signedIn && ck.hint) {
          set({ cookieHint: ck.hint });
        }
      } catch {
        /* ignore */
      }
      return true;
    } catch (e) {
      set({ coreError: String(e), core: null });
      return false;
    }
  },

  search: async (q) => {
    const query = (q ?? get().query).trim();
    if (!query) return;
    const ok = await get().ensureCore();
    const core = get().core;
    if (!ok || !core?.running) {
      set({
        searchError: get().coreError || "Stream core is not running. Install Node.js 18+.",
        searching: false,
      });
      return;
    }

    const seq = ++searchSeq;
    set({ searching: true, searchError: null, query });
    const base = baseUrl(core);

    try {
      // Parallel lanes: backend already fans out engines; frontend also asks
      // two query shapes so thin first hits still fill quickly.
      const [a, b] = await Promise.all([
        fetch(`${base}/api/search?q=${encodeURIComponent(query)}&limit=25`).then(async (res) => {
          if (!res.ok) {
            const body = await res.text();
            throw new Error(`search failed (${res.status}) ${body.slice(0, 140)}`);
          }
          return (await res.json()) as { songs?: YtSong[] };
        }),
        fetch(`${base}/api/search?q=${encodeURIComponent(query + " official audio")}&limit=15`)
          .then(async (res) => {
            if (!res.ok) return null;
            return (await res.json()) as { songs?: YtSong[] };
          })
          .catch(() => null),
      ]);

      if (seq !== searchSeq) return; // stale — a newer search already started

      let songs = mergeSongs(a.songs || [], b?.songs);
      set({ results: songs, searching: false, searchError: null });

      // Warm disk cache for the first few hits so Play/Download are near-instant.
      // /api/export downloads once into the shared yt-dlp disk cache.
      for (const song of songs.slice(0, 2)) {
        void fetch(`${base}/api/export/${song.videoId}`).catch(() => undefined);
      }
    } catch (e) {
      if (seq !== searchSeq) return;
      set({ searching: false, searchError: String(e) });
    }
  },

  playSong: async (song) => {
    const ok = await get().ensureCore();
    if (!ok) {
      set({ searchError: get().coreError || "Stream core unavailable" });
      return;
    }
    const base = baseUrl(get().core);
    const track = ytToTrack(song, base);
    const results = get().results;
    const queue = results.length
      ? results.map((s) => ytToTrack(s, base))
      : [track];

    // Stop local / Sound Lab engines.
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

    teardownGraph();
    if (progressTimer) window.clearTimeout(progressTimer);
    if (audioEl) {
      try {
        audioEl.onended = null;
        audioEl.onerror = null;
        audioEl.onplaying = null;
        audioEl.onwaiting = null;
        audioEl.oncanplay = null;
        audioEl.onloadedmetadata = null;
        audioEl.pause();
        audioEl.removeAttribute("src");
        audioEl.load();
      } catch {
        /* ignore */
      }
    }

    const el = new Audio();
    // CORS required for MediaElementSource analyser (stream-core sends ACAO).
    el.crossOrigin = "anonymous";
    el.preload = "auto";
    el.src = `${base}/play/${song.videoId}`;
    el.volume = Math.max(0, Math.min(1, usePlayerStore.getState().volume || 0.8));

    audioEl = el;
    set({
      audio: el,
      currentId: song.videoId,
      position: 0,
      duration: parseDuration(song.duration),
      buffering: true,
    });

    usePlayerStore.setState({
      current: track,
      playing: true,
      position: 0,
      duration: parseDuration(song.duration),
      waveform: [],
      queue,
    });
    useUiStore.getState().setAccent("#FF4D6D");

    el.onloadedmetadata = () => {
      const dur = el.duration && Number.isFinite(el.duration) ? el.duration : 0;
      if (dur > 0) {
        set({ duration: dur });
        usePlayerStore.setState({ duration: dur });
      }
    };
    el.oncanplay = () => set({ buffering: false });
    el.onwaiting = () => set({ buffering: true });
    el.onplaying = () => {
      set({ buffering: false, playing: true });
      usePlayerStore.setState({ playing: true });
    };
    el.onended = () => {
      set({ playing: false });
      usePlayerStore.setState({ playing: false });
      for (let i = 0; i < 32; i++) smoothBands[i] = 0;
      // Auto-advance within the online search queue.
      const q = usePlayerStore.getState().queue;
      const idx = q.findIndex((t) => t.id === track.id);
      if (idx >= 0 && idx + 1 < q.length) {
        const next = q[idx + 1];
        const nextId = next.id?.startsWith("yt:") ? next.id.slice(3) : null;
        const nextSong = results.find((s) => s.videoId === nextId);
        if (nextSong) void get().playSong(nextSong);
      }
    };
    el.onerror = () => {
      set({
        playing: false,
        buffering: false,
        searchError:
          "Stream failed. If YouTube asked for sign-in: close Google Chrome completely, then click the track again. Full tracks only — no 30s previews.",
      });
      usePlayerStore.setState({ playing: false });
      useLibraryStore.setState({ error: "YouTube stream failed — close Chrome and retry" });
    };

    const tickProgress = () => {
      if (!audioEl || audioEl !== el) return;
      set({ position: el.currentTime, playing: !el.paused });
      usePlayerStore.setState({
        position: el.currentTime,
        playing: !el.paused,
      });
      progressTimer = window.setTimeout(tickProgress, 200);
    };
    if (progressTimer) window.clearTimeout(progressTimer);
    tickProgress();

    try {
      // Wait briefly for enough data so play() is reliable on slow networks.
      if (el.readyState < 2) {
        await new Promise<void>((resolve) => {
          const done = () => {
            el.removeEventListener("canplay", done);
            el.removeEventListener("loadeddata", done);
            el.removeEventListener("error", done);
            resolve();
          };
          el.addEventListener("canplay", done);
          el.addEventListener("loadeddata", done);
          el.addEventListener("error", done);
          setTimeout(done, 12000);
        });
      }
      if (el.error) {
        set({
          playing: false,
          buffering: false,
          searchError: `Stream failed (media error ${el.error.code}). Retry, or import YouTube cookies if this keeps happening.`,
        });
        return;
      }
      await el.play();
      attachRealAnalyser(el);
      set({ playing: true });
    } catch (e) {
      set({ playing: false, searchError: `Playback failed: ${e}` });
      // Analyser after play() if attach-before failed due to autoplay policy.
      try {
        attachRealAnalyser(el);
      } catch {
        /* ignore */
      }
    }
  },

  toggleOnlinePlay: async () => {
    const el = get().audio;
    if (!el) return;
    if (el.paused) {
      try {
        if (audioCtx?.state === "suspended") await audioCtx.resume();
        await el.play();
      } catch (e) {
        set({ searchError: String(e) });
        return;
      }
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
    try {
      el.currentTime = Math.max(0, secs);
    } catch {
      /* ignore */
    }
    set({ position: el.currentTime });
    usePlayerStore.setState({ position: el.currentTime });
  },

  downloadSong: async (song) => {
    const ok = await get().ensureCore();
    if (!ok) {
      set({ downloadNote: get().coreError || "Stream core not running" });
      return;
    }
    set((s) => ({
      downloading: { ...s.downloading, [song.videoId]: true },
      downloadNote: null,
    }));
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const dir = await open({
        directory: true,
        multiple: false,
        title: "Save track to folder",
      });
      if (!dir || Array.isArray(dir)) {
        set((s) => ({
          downloading: { ...s.downloading, [song.videoId]: false },
        }));
        return;
      }

      set({ downloadNote: `Saving ${song.title}…` });
      // download_yt_track asks stream-core /api/export (yt-dlp disk cache)
      // then copies the file — no fragile multi-MB HTTP body in Rust.
      const path = await invoke<string>("download_yt_track", {
        videoId: song.videoId,
        title: `${song.artist ? song.artist + " - " : ""}${song.title}`,
        destDir: String(dir),
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

  importCookies: async (json: string) => {
    try {
      await get().ensureCore();
      const base = baseUrl(get().core);
      const payload = JSON.parse(json);
      const res = await fetch(`${base}/api/import-cookies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "import failed");
      set({
        signedIn: !!data.signedIn,
        cookieHint: data.signedIn
          ? "Cookies imported — signed in"
          : "Imported, but no SID cookie found",
        searchError: data.signedIn ? null : "No SID cookie in import — export while signed into youtube.com",
        coreError: null,
      });
    } catch (e) {
      set({ searchError: `Cookie import failed: ${e}` });
    }
  },

  dispose: () => {
    if (progressTimer) window.clearTimeout(progressTimer);
    teardownGraph();
    if (audioEl) {
      try {
        audioEl.pause();
        audioEl.removeAttribute("src");
        audioEl.load();
      } catch {
        /* ignore */
      }
    }
    audioEl = null;
    smoothBands = new Float32Array(32);
    set({ audio: null, playing: false, currentId: null, buffering: false });
  },
}));

/** Bridge player bar play/pause/seek/volume when an online track is active. */
export function isOnlineTrack(path?: string | null): boolean {
  return !!path && (path.includes("/play/") || path.startsWith("http://127.0.0.1"));
}

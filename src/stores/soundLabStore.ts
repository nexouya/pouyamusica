import { create } from "zustand";
import type { SoundLabPresetId } from "../audio/soundLab/types";
import {
  disposeWebAudio,
  engageWebAudio,
  getLastError,
  isWebPlaying,
  liveSpectrum,
  pauseWeb,
  playWeb,
  seekWeb,
  setEq,
  setWebPlaybackHandlers,
  setWebVolume,
  updatePreset,
  updateSpatial,
  webDuration,
  webPosition,
} from "../audio/soundLab/webSource";
import { api } from "../core/api";
import { usePlayerStore } from "./playerStore";
import { useLibraryStore } from "./libraryStore";
import { updateAudioVisualData } from "../core/events/audioVisualBus";

type SoundLabStore = {
  preset: SoundLabPresetId;
  spatial: boolean;
  orbitPeriod: number;
  /** Web Audio owns the audible path. */
  webPath: boolean;
  /** 10-band EQ gains (dB). Non-flat forces web path. */
  eqGains: number[];
  spectrum: number[];
  lastEngageError: string | null;
  setPreset: (id: SoundLabPresetId) => Promise<void>;
  setSpatial: (on: boolean) => Promise<void>;
  setOrbitPeriod: (period: number) => Promise<void>;
  setEqGains: (gains: number[]) => Promise<void>;
  pollSpectrum: () => void;
  syncPlaybackPath: () => Promise<void>;
  /** True when a preset, 8D, or non-flat EQ wants the Web Audio path. */
  wantsWeb: () => boolean;
  dispose: () => void;
};

export function labWantsWeb(s: {
  preset: SoundLabPresetId;
  spatial: boolean;
  eqGains?: number[];
}) {
  const eqOn = (s.eqGains ?? []).some((g) => Math.abs(g) > 0.05);
  return s.preset !== "off" || s.spatial || eqOn;
}

/** Mute native engine while Web Audio owns output (never persists volume 0). */
async function muteNative(mute: boolean) {
  try {
    await api.setEngineMuted(mute);
  } catch (e) {
    console.warn("setEngineMuted failed", e);
  }
}

function bindHandlers() {
  setWebPlaybackHandlers(
    (position, duration, playing) => {
      const st = usePlayerStore.getState();
      st.setPosition(position);
      if (duration > 0) st.setDuration(duration);
      st.setPlaying(playing);
    },
    () => {
      const st = usePlayerStore.getState();
      if (st.repeat === "one") {
        void st.seek(0).then(async () => {
          await playWeb();
          st.setPlaying(true);
        });
      } else {
        void st.next();
      }
    },
  );
}

export const useSoundLabStore = create<SoundLabStore>((set, get) => ({
  preset: "off",
  spatial: false,
  orbitPeriod: 10,
  webPath: false,
  eqGains: new Array(10).fill(0),
  spectrum: new Array(32).fill(0),
  lastEngageError: null,

  wantsWeb: () => labWantsWeb(get()),

  setEqGains: async (gains) => {
    const next = gains.slice(0, 10).map((g) => Math.max(-12, Math.min(12, g)));
    while (next.length < 10) next.push(0);
    set({ eqGains: next });
    if (get().webPath) {
      setEq(next);
      return;
    }
    await get().syncPlaybackPath();
  },

  setPreset: async (id) => {
    set({ preset: id, lastEngageError: null });
    const lab = get();
    if (!labWantsWeb(lab)) {
      await get().syncPlaybackPath();
      return;
    }
    if (lab.webPath) {
      // Already on web — just rewire wet chain
      try {
        await updatePreset(id);
      } catch (e) {
        set({ lastEngageError: String(e) });
        useLibrarySetError(`Sound Lab preset failed: ${e}`);
      }
      return;
    }
    // Not on web yet — engage now (handles "selected preset before play")
    await get().syncPlaybackPath();
  },

  setSpatial: async (on) => {
    set({ spatial: on, lastEngageError: null });
    const lab = get();
    if (!labWantsWeb(lab)) {
      await get().syncPlaybackPath();
      return;
    }
    if (lab.webPath) {
      try {
        await updateSpatial(on, lab.orbitPeriod);
      } catch (e) {
        set({ lastEngageError: String(e) });
      }
      return;
    }
    await get().syncPlaybackPath();
  },

  setOrbitPeriod: async (period) => {
    const p = Math.min(14, Math.max(8, period));
    set({ orbitPeriod: p });
    if (get().webPath) {
      await updateSpatial(get().spatial, p);
    }
  },

  pollSpectrum: () => {
    if (!get().webPath) return;
    const bands = liveSpectrum();
    set({ spectrum: bands });
    const rms =
      bands.reduce((a, b) => a + b * b, 0) / Math.max(1, bands.length);
    // Feed FocusMode / AmbientAura which listen to the shared visual bus.
    updateAudioVisualData(bands, Math.sqrt(rms));
  },

  syncPlaybackPath: async () => {
    const lab = get();
    const player = usePlayerStore.getState();
    const wantWeb = labWantsWeb(lab);
    const currentPath = player.current?.path;

    // Engage → web
    if (wantWeb && !lab.webPath) {
      if (!currentPath) {
        // Keep preset selected; engage on next playTrack
        set({ webPath: false });
        return;
      }
      try {
        bindHandlers();
        // Pause + mute native BEFORE starting web so no unprocessed blip
        await api.pause();
        await muteNative(true);
        const autoplay = player.playing;
        await engageWebAudio(
          currentPath,
          player.position,
          player.volume,
          lab.preset,
          lab.spatial,
          lab.orbitPeriod,
          autoplay,
        );
        // Re-apply EQ after engage (graph may be fresh).
        setEq(lab.eqGains);
        set({ webPath: true, lastEngageError: null });
        usePlayerStore.setState({
          playing: autoplay,
          duration: webDuration() || player.duration,
        });
      } catch (e) {
        const msg = String(e);
        console.error("Sound Lab engage failed", e);
        set({
          lastEngageError: msg,
          // Do NOT wipe user's preset choice — just fail the audio path
          webPath: false,
        });
        useLibrarySetError(
          `Sound Lab failed (native path kept). ${msg}. Try playing the track again.`,
        );
        try {
          await muteNative(false);
          if (player.playing) await api.play();
        } catch {
          /* ignore */
        }
      }
      return;
    }

    // Disengage → native rodio
    if (!wantWeb && lab.webPath) {
      const pos = webPosition();
      const playing = isWebPlaying();
      pauseWeb();
      setWebPlaybackHandlers(null, null);
      try {
        await muteNative(false);
        if (currentPath) {
          await api.seek(pos);
          if (playing) await api.play();
        }
      } catch (e) {
        console.error("Sound Lab disengage failed", e);
      }
      set({ webPath: false, spectrum: new Array(32).fill(0) });
      usePlayerStore.setState({ playing, position: pos });
    }
  },

  dispose: () => {
    disposeWebAudio();
    set({ webPath: false, spectrum: new Array(32).fill(0) });
  },
}));

function useLibrarySetError(msg: string) {
  useLibraryStore.setState({ error: msg });
}

// --- transport helpers used by playerStore ---

export async function webPlayTrack(path: string, volume: number) {
  const lab = useSoundLabStore.getState();
  bindHandlers();
  await muteNative(true);
  await engageWebAudio(
    path,
    0,
    volume,
    lab.preset,
    lab.spatial,
    lab.orbitPeriod,
    true,
  );
  setEq(lab.eqGains);
  useSoundLabStore.setState({ webPath: true, lastEngageError: null });
  return webDuration();
}

export async function webTogglePlay(): Promise<boolean> {
  if (isWebPlaying()) {
    pauseWeb();
    return false;
  }
  await playWeb();
  return true;
}

export function webSeek(secs: number) {
  seekWeb(secs);
}

export function webVolume(v: number) {
  setWebVolume(v);
}

export function webIsPlaying() {
  return isWebPlaying();
}

export function webPos() {
  return webPosition();
}

export function webDur() {
  return webDuration();
}

export function webLastError() {
  return getLastError();
}

import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import type { FftFrame, PlaybackProgress, TrackMeta } from "../../types";
import { usePlayerStore } from "../../stores/playerStore";
import { useLibraryStore } from "../../stores/libraryStore";
import { api } from "../api";
import { updateAudioVisualData } from "./audioVisualBus";

/**
 * Single place that maps Tauri events → store updates.
 * Features can add listeners via `subscribeAppEvent` below.
 */
export type AppEventMap = {
  "fft-data": FftFrame;
  "playback-progress": PlaybackProgress;
  "playback-ended": boolean;
  "library-updated": TrackMeta[];
  "track-changed": TrackMeta;
  "engine-error": { message: string };
};

type Unsub = () => void;

/** Extra listeners for feature modules. */
const extras: Array<(name: keyof AppEventMap, payload: unknown) => void> = [];

export function subscribeAppEvent(
  fn: (name: keyof AppEventMap, payload: unknown) => void,
): Unsub {
  extras.push(fn);
  return () => {
    const i = extras.indexOf(fn);
    if (i >= 0) extras.splice(i, 1);
  };
}

function fanout<K extends keyof AppEventMap>(name: K, payload: AppEventMap[K]) {
  for (const fn of extras) fn(name, payload);
}

export function useAppEvents() {
  useEffect(() => {
    const unsubs: Array<Promise<Unsub> | Unsub> = [];

    unsubs.push(
      listen<FftFrame>("fft-data", (e) => {
        if (e.payload?.bands) {
          updateAudioVisualData(e.payload.bands, e.payload.rms);
        }
        fanout("fft-data", e.payload);
      }),
    );

    unsubs.push(
      listen<PlaybackProgress>("playback-progress", (e) => {
        const p = e.payload;
        if (!p) return;
        const st = usePlayerStore.getState();
        st.setPosition(p.position_secs);
        if (p.duration_secs > 0) st.setDuration(p.duration_secs);
        st.setPlaying(p.playing);
        if (typeof p.volume === "number") st.setVolume(p.volume);
        fanout("playback-progress", p);
      }),
    );

    unsubs.push(
      listen("playback-ended", (e) => {
        const st = usePlayerStore.getState();
        if (st.repeat === "one") {
          void st.seek(0).then(() => api.play()).then(() => st.setPlaying(true));
        } else {
          void st.next();
        }
        fanout("playback-ended", Boolean(e.payload));
      }),
    );

    unsubs.push(
      listen<TrackMeta[]>("library-updated", (e) => {
        if (Array.isArray(e.payload)) {
          useLibraryStore.setState({ tracks: e.payload, loading: false });
          fanout("library-updated", e.payload);
        }
      }),
    );

    unsubs.push(
      listen<TrackMeta>("track-changed", (e) => {
        if (!e.payload) return;
        const st = usePlayerStore.getState();
        if (st.current?.path === e.payload.path) return;
        void st.adoptTrack(e.payload);
        fanout("track-changed", e.payload);
      }),
    );

    unsubs.push(
      listen<{ message: string }>("engine-error", (e) => {
        if (e.payload?.message) console.error("[engine]", e.payload.message);
        fanout("engine-error", e.payload);
      }),
    );

    return () => {
      for (const u of unsubs) Promise.resolve(u).then((fn) => fn());
    };
  }, []);
}

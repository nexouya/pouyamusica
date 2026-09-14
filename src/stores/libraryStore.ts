import { create } from "zustand";
import type { TrackMeta } from "../types";
import { api } from "../core/api";

type LibraryState = {
  tracks: TrackMeta[];
  root: string;
  loading: boolean;
  error: string | null;
  query: string;
  setQuery: (q: string) => void;
  clearError: () => void;
  refresh: () => Promise<void>;
  init: () => Promise<void>;
  setRoot: (path: string) => Promise<void>;
};

export const useLibraryStore = create<LibraryState>((set) => ({
  tracks: [],
  root: "",
  loading: false,
  error: null,
  query: "",
  setQuery: (q) => set({ query: q }),
  clearError: () => set({ error: null }),

  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const tracks = await api.scanLibrary();
      set({ tracks, loading: false });
    } catch (e) {
      set({ loading: false, error: String(e) });
    }
  },

  init: async () => {
    set({ loading: true });
    try {
      // No demo fallback — user picks a folder (or default Music is scanned).
      const root = await api.getMusicRoot().catch(() => "");
      let tracks = await api.getLibrary().catch(() => [] as TrackMeta[]);
      if (!tracks.length) {
        tracks = await api.scanLibrary().catch(() => [] as TrackMeta[]);
      }
      set({ tracks, root, loading: false });
    } catch (e) {
      set({ loading: false, error: String(e) });
    }
  },

  setRoot: async (path) => {
    try {
      const tracks = await api.setMusicRoot(path);
      set({ tracks, root: path, error: null });
    } catch (e) {
      set({ error: String(e) });
    }
  },
}));

export function filterTracks(tracks: TrackMeta[], query: string): TrackMeta[] {
  const q = query.trim().toLowerCase();
  if (!q) return tracks;
  return tracks.filter(
    (t) =>
      t.title.toLowerCase().includes(q) ||
      t.artist.toLowerCase().includes(q) ||
      t.album.toLowerCase().includes(q),
  );
}

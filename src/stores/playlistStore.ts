import { create } from "zustand";
import type { Playlist, TrackMeta } from "../types";
import { api } from "../core/api";
import { useLibraryStore } from "./libraryStore";
import { usePlayerStore } from "./playerStore";

type PlaylistState = {
  playlists: Playlist[];
  selectedId: string | null;
  loading: boolean;
  error: string | null;
  addPickerOpen: boolean;
  addPickerIds: string[];
  refresh: () => Promise<void>;
  select: (id: string | null) => void;
  create: (name: string, description?: string) => Promise<Playlist | null>;
  rename: (id: string, name: string, description?: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  addTracks: (id: string, paths: string[]) => Promise<void>;
  removeTrack: (id: string, path: string) => Promise<void>;
  moveTrack: (id: string, from: number, to: number) => Promise<void>;
  playPlaylist: (id: string) => Promise<void>;
  setAddPickerOpen: (open: boolean) => void;
  toggleAddPickerId: (path: string) => void;
  confirmAddSelected: () => Promise<void>;
  tracksFor: (playlist: Playlist | null) => TrackMeta[];
};

export const usePlaylistStore = create<PlaylistState>((set, get) => ({
  playlists: [],
  selectedId: null,
  loading: false,
  error: null,
  addPickerOpen: false,
  addPickerIds: [],

  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const playlists = await api.listPlaylists();
      const selectedId = get().selectedId;
      set({
        playlists,
        loading: false,
        selectedId: playlists.some((p) => p.id === selectedId)
          ? selectedId
          : (playlists[0]?.id ?? null),
      });
    } catch (e) {
      set({ loading: false, error: String(e) });
    }
  },

  select: (id) => set({ selectedId: id }),

  create: async (name, description) => {
    try {
      const pl = await api.createPlaylist(name, description);
      await get().refresh();
      set({ selectedId: pl.id, addPickerOpen: true, addPickerIds: [] });
      return pl;
    } catch (e) {
      set({ error: String(e) });
      return null;
    }
  },

  rename: async (id, name, description) => {
    try {
      await api.renamePlaylist(id, name, description);
      await get().refresh();
    } catch (e) {
      set({ error: String(e) });
    }
  },

  remove: async (id) => {
    try {
      await api.deletePlaylist(id);
      await get().refresh();
    } catch (e) {
      set({ error: String(e) });
    }
  },

  addTracks: async (id, paths) => {
    try {
      await api.addToPlaylist(id, paths);
      await get().refresh();
    } catch (e) {
      set({ error: String(e) });
    }
  },

  removeTrack: async (id, path) => {
    try {
      await api.removeFromPlaylist(id, path);
      await get().refresh();
    } catch (e) {
      set({ error: String(e) });
    }
  },

  moveTrack: async (id, from, to) => {
    try {
      await api.movePlaylistTrack(id, from, to);
      await get().refresh();
    } catch (e) {
      set({ error: String(e) });
    }
  },

  playPlaylist: async (id) => {
    const pl = get().playlists.find((p) => p.id === id);
    if (!pl || !pl.tracks.length) return;
    const lib = useLibraryStore.getState().tracks;
    const first = lib.find((t) => t.path === pl.tracks[0]);
    if (first) {
      // set queue to playlist order
      void api.setQueue(pl.tracks).catch(() => undefined);
      await usePlayerStore.getState().playTrack(first);
    }
  },

  setAddPickerOpen: (open) => set({ addPickerOpen: open, addPickerIds: open ? [] : get().addPickerIds }),

  toggleAddPickerId: (path) => {
    const cur = get().addPickerIds;
    set({
      addPickerIds: cur.includes(path) ? cur.filter((p) => p !== path) : [...cur, path],
    });
  },

  confirmAddSelected: async () => {
    const { selectedId, addPickerIds } = get();
    if (!selectedId || !addPickerIds.length) {
      set({ addPickerOpen: false });
      return;
    }
    await get().addTracks(selectedId, addPickerIds);
    set({ addPickerOpen: false, addPickerIds: [] });
  },

  tracksFor: (playlist) => {
    if (!playlist) return [];
    const lib = useLibraryStore.getState().tracks;
    const byPath = new Map(lib.map((t) => [t.path, t]));
    return playlist.tracks
      .map((p) => byPath.get(p))
      .filter((t): t is TrackMeta => Boolean(t));
  },
}));

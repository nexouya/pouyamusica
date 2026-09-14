import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import styles from "./Playlists.module.css";
import { usePlaylistStore } from "../../stores/playlistStore";
import { useLibraryStore } from "../../stores/libraryStore";
import { usePlayerStore } from "../../stores/playerStore";
import { formatTime } from "../../lib/format";
import {
  IconPlay,
  IconLibrary,
} from "../../components/icons/Icons";

export function PlaylistsView() {
  const playlists = usePlaylistStore((s) => s.playlists);
  const selectedId = usePlaylistStore((s) => s.selectedId);
  const select = usePlaylistStore((s) => s.select);
  const create = usePlaylistStore((s) => s.create);
  const rename = usePlaylistStore((s) => s.rename);
  const remove = usePlaylistStore((s) => s.remove);
  const removeTrack = usePlaylistStore((s) => s.removeTrack);
  const moveTrack = usePlaylistStore((s) => s.moveTrack);
  const playPlaylist = usePlaylistStore((s) => s.playPlaylist);
  const tracksFor = usePlaylistStore((s) => s.tracksFor);
  const addPickerOpen = usePlaylistStore((s) => s.addPickerOpen);
  const addPickerIds = usePlaylistStore((s) => s.addPickerIds);
  const setAddPickerOpen = usePlaylistStore((s) => s.setAddPickerOpen);
  const toggleAddPickerId = usePlaylistStore((s) => s.toggleAddPickerId);
  const confirmAddSelected = usePlaylistStore((s) => s.confirmAddSelected);
  const refresh = usePlaylistStore((s) => s.refresh);

  const library = useLibraryStore((s) => s.tracks);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const currentPath = usePlayerStore((s) => s.current?.path);

  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [pickQuery, setPickQuery] = useState("");

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selected = playlists.find((p) => p.id === selectedId) ?? null;
  const tracks = tracksFor(selected);

  const pickable = library.filter((t) => {
    const q = pickQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      t.title.toLowerCase().includes(q) ||
      t.artist.toLowerCase().includes(q) ||
      t.album.toLowerCase().includes(q)
    );
  });

  return (
    <div className={styles.view}>
      {/* Left pane — playlist manager */}
      <aside className={styles.listPane}>
        <div className={styles.listHeader}>
          <h2 className={styles.listTitle}>Playlists</h2>
          <button
            type="button"
            className={styles.newBtn}
            onClick={() => {
              setNewName("");
              setNewDesc("");
              setShowCreate(true);
            }}
            aria-label="New playlist"
            title="New playlist"
          >
            +
          </button>
        </div>
        <div className={styles.plList}>
          {playlists.length === 0 && (
            <p className={styles.plEmpty}>
              No playlists yet.
              <br />
              Click + to create your first playlist.
            </p>
          )}
          {playlists.map((pl) => (
            <motion.button
              key={pl.id}
              type="button"
              className={`${styles.plItem} ${pl.id === selectedId ? styles.plItemSelected : ""}`}
              onClick={() => select(pl.id)}
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 400, damping: 24 }}
            >
              <span className={styles.plIcon}>
                <IconLibrary size={14} />
              </span>
              <span className={styles.plMeta}>
                <span className={styles.plName}>{pl.name}</span>
                <span className={styles.plCount}>{pl.tracks.length} tracks</span>
              </span>
            </motion.button>
          ))}
        </div>
      </aside>

      {/* Right pane — file-manager style detail */}
      <section className={styles.detailPane}>
        <div className={styles.breadcrumb}>
          <span className={styles.crumb}>Library</span>
          <span>/</span>
          <span className={styles.crumb}>Playlists</span>
          {selected && (
            <>
              <span>/</span>
              <span className={styles.crumbCurrent}>{selected.name}</span>
            </>
          )}
        </div>

        {!selected ? (
          <div className={styles.emptyDetail}>
            <IconLibrary size={36} />
            <p>Select a playlist or create one.</p>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnAccent}`}
              onClick={() => setShowCreate(true)}
            >
              New playlist
            </button>
          </div>
        ) : (
          <>
            <header className={styles.detailHeader}>
              <div>
                {editing ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 240 }}>
                    <input
                      className={styles.input}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Playlist name"
                    />
                    <input
                      className={styles.input}
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      placeholder="Description (optional)"
                    />
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnAccent}`}
                        onClick={() => {
                          void rename(selected.id, editName, editDesc);
                          setEditing(false);
                        }}
                      >
                        Save
                      </button>
                      <button type="button" className={styles.btn} onClick={() => setEditing(false)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h1 className={styles.detailTitle}>{selected.name}</h1>
                    <p className={styles.detailDesc}>
                      {selected.description || "No description"} · {tracks.length} tracks ·{" "}
                      {formatTime(tracks.reduce((s, t) => s + t.duration_secs, 0))} total
                    </p>
                  </>
                )}
              </div>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnAccent}`}
                  onClick={() => void playPlaylist(selected.id)}
                  disabled={!tracks.length}
                >
                  <IconPlay size={13} /> Play
                </button>
                <button
                  type="button"
                  className={styles.btn}
                  onClick={() => setAddPickerOpen(true)}
                >
                  Add tracks
                </button>
                <button
                  type="button"
                  className={styles.btn}
                  onClick={() => {
                    setEditName(selected.name);
                    setEditDesc(selected.description);
                    setEditing(true);
                  }}
                >
                  Rename
                </button>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnDanger}`}
                  onClick={() => {
                    if (confirm(`Delete playlist "${selected.name}"?`)) {
                      void remove(selected.id);
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </header>

            <div className={styles.tracks}>
              {tracks.length === 0 && (
                <div className={styles.emptyDetail}>
                  <p>Playlist is empty. Add tracks from your library.</p>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnAccent}`}
                    onClick={() => setAddPickerOpen(true)}
                  >
                    Add tracks
                  </button>
                </div>
              )}
              {tracks.map((t, i) => {
                const playing = currentPath === t.path;
                return (
                  <div
                    key={`${t.path}-${i}`}
                    className={styles.trackRow}
                    onDoubleClick={() => void playTrack(t)}
                  >
                    <span className={styles.plCount} style={{ width: 20, textAlign: "right" }}>
                      {i + 1}
                    </span>
                    <img className={styles.trackThumb} src={t.cover_data_url || undefined} alt="" />
                    <span className={styles.trackMeta}>
                      <span className={styles.trackTitle} style={playing ? { color: "#fff" } : undefined}>
                        {t.title}
                      </span>
                      <span className={styles.trackArtist}>{t.artist}</span>
                    </span>
                    <span className={styles.plCount}>{formatTime(t.duration_secs)}</span>
                    <span className={styles.rowBtns}>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        onClick={() => void playTrack(t)}
                        aria-label="Play"
                      >
                        <IconPlay size={13} />
                      </button>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        disabled={i === 0}
                        onClick={() => void moveTrack(selected.id, i, i - 1)}
                        aria-label="Move up"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        disabled={i === tracks.length - 1}
                        onClick={() => void moveTrack(selected.id, i, i + 1)}
                        aria-label="Move down"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        onClick={() => void removeTrack(selected.id, t.path)}
                        aria-label="Remove"
                      >
                        ✕
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      {/* Create modal */}
      {showCreate && (
        <div className={styles.scrim} onClick={() => setShowCreate(false)}>
          <motion.div
            className={styles.modal}
            initial={{ scale: 0.96, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHead}>
              <h3 className={styles.modalTitle}>New playlist</h3>
              <button type="button" className={styles.iconBtn} onClick={() => setShowCreate(false)}>
                ✕
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.field}>
                <label className={styles.label}>Name</label>
                <input
                  className={styles.input}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Late Night Drive"
                  autoFocus
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Description</label>
                <input
                  className={styles.input}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>
            <div className={styles.modalFoot}>
              <button type="button" className={styles.btn} onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnAccent}`}
                onClick={() => {
                  if (!newName.trim()) return;
                  void create(newName, newDesc).then(() => setShowCreate(false));
                }}
              >
                Create
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Add tracks picker */}
      {addPickerOpen && selected && (
        <div className={styles.scrim} onClick={() => setAddPickerOpen(false)}>
          <motion.div
            className={styles.modal}
            initial={{ scale: 0.96, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHead}>
              <h3 className={styles.modalTitle}>Add tracks to {selected.name}</h3>
              <button type="button" className={styles.iconBtn} onClick={() => setAddPickerOpen(false)}>
                ✕
              </button>
            </div>
            <div className={styles.modalBody}>
              <input
                className={styles.input}
                value={pickQuery}
                onChange={(e) => setPickQuery(e.target.value)}
                placeholder="Filter library…"
              />
              {pickable.map((t) => {
                const on = addPickerIds.includes(t.path);
                return (
                  <div
                    key={t.path}
                    className={`${styles.pickRow} ${on ? styles.pickRowOn : ""}`}
                    onClick={() => toggleAddPickerId(t.path)}
                  >
                    <span className={`${styles.pickCheck} ${on ? styles.pickCheckOn : ""}`}>
                      {on ? "✓" : ""}
                    </span>
                    <img className={styles.trackThumb} src={t.cover_data_url || undefined} alt="" />
                    <span className={styles.trackMeta}>
                      <span className={styles.trackTitle}>{t.title}</span>
                      <span className={styles.trackArtist}>{t.artist}</span>
                    </span>
                  </div>
                );
              })}
              {pickable.length === 0 && (
                <p className={styles.plEmpty}>Library is empty — scan a folder first.</p>
              )}
            </div>
            <div className={styles.modalFoot}>
              <button type="button" className={styles.btn} onClick={() => setAddPickerOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnAccent}`}
                disabled={!addPickerIds.length}
                onClick={() => void confirmAddSelected()}
              >
                Add {addPickerIds.length || ""} selected
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

export default PlaylistsView;

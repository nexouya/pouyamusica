import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import styles from "./Online.module.css";
import { useOnlineStore } from "../../stores/onlineStore";
import { usePlayerStore } from "../../stores/playerStore";
import {
  IconDownload,
  IconMusic,
  IconOnline,
  IconPause,
  IconPlay,
  IconSearch,
} from "../../components/icons/Icons";
import type { YtSong } from "../../types";

function formatDur(d?: string | number) {
  if (typeof d === "number" && d > 0) {
    const m = Math.floor(d / 60);
    const s = Math.floor(d % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }
  return typeof d === "string" ? d : "";
}

export function OnlineView() {
  const core = useOnlineStore((s) => s.core);
  const coreError = useOnlineStore((s) => s.coreError);
  const results = useOnlineStore((s) => s.results);
  const searching = useOnlineStore((s) => s.searching);
  const searchError = useOnlineStore((s) => s.searchError);
  const currentId = useOnlineStore((s) => s.currentId);
  const playing = useOnlineStore((s) => s.playing);
  const downloading = useOnlineStore((s) => s.downloading);
  const downloadNote = useOnlineStore((s) => s.downloadNote);
  const buffering = useOnlineStore((s) => s.buffering);
  const ensureCore = useOnlineStore((s) => s.ensureCore);
  const search = useOnlineStore((s) => s.search);
  const setQuery = useOnlineStore((s) => s.setQuery);
  const playSong = useOnlineStore((s) => s.playSong);
  const downloadSong = useOnlineStore((s) => s.downloadSong);
  const playerPlaying = usePlayerStore((s) => s.playing);
  const [localQ, setLocalQ] = useState("");

  useEffect(() => {
    void ensureCore();
  }, [ensureCore]);

  const onSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = localQ.trim();
    if (!q) return;
    setQuery(q);
    void search(q);
  };

  const play = (song: YtSong) => {
    void playSong(song);
  };

  return (
    <div className={styles.view}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Online · YouTube</p>
        <h1 className={styles.title}>Stream & Download</h1>
        <p className={styles.sub}>
          Search the world’s music, stream instantly, or save to your disk. Uses your
          signed-in Chrome cookies when available.
        </p>

        <form className={styles.searchRow} onSubmit={onSearch}>
          <div className={styles.searchBar}>
            <IconSearch size={16} className={styles.searchIcon} />
            <input
              className={styles.input}
              value={localQ}
              onChange={(e) => setLocalQ(e.target.value)}
              placeholder="Search songs, artists, mixes…"
              autoFocus
            />
          </div>
          <button type="submit" className={styles.searchBtn} disabled={searching}>
            {searching ? "Searching…" : "Search"}
          </button>
        </form>

        <div className={styles.coreRow}>
          <span
            className={styles.corePip}
            data-on={core?.running ? "true" : "false"}
            aria-hidden
          />
          <span className={styles.coreText}>
            {core?.running
              ? `Stream core live · port ${core.port}${core.node_ok ? "" : " · Node missing?"}`
              : coreError
                ? coreError
                : "Starting stream core…"}
          </span>
        </div>
        {searchError && <p className={styles.error}>{searchError}</p>}
        {downloadNote && <p className={styles.note}>{downloadNote}</p>}
        {buffering && currentId && (
          <p className={styles.note}>Buffering stream… first play can take a few seconds.</p>
        )}
      </header>

      <div className={styles.list}>
        {searching && (
          <div className={styles.loading}>
            <div className={styles.loadingPulse} />
            <p>Searching YouTube Music…</p>
          </div>
        )}
        {!searching && !results.length && (
          <div className={styles.empty}>
            <IconOnline size={28} />
            <h3>Find something to play</h3>
            <p>Type an artist or track name above. First result plays instantly.</p>
          </div>
        )}
        {results.map((song, i) => {
          const active = currentId === song.videoId;
          const isPlaying = active && playing && playerPlaying;
          return (
            <motion.div
              key={song.videoId}
              className={`${styles.row} ${active ? styles.rowActive : ""}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 8) * 0.03, type: "spring", stiffness: 360, damping: 28 }}
            >
              <button
                type="button"
                className={styles.playBtn}
                onClick={() => play(song)}
                aria-label={isPlaying ? "Playing" : "Play"}
              >
                {song.thumbnail ? (
                  <img src={song.thumbnail} alt="" className={styles.thumb} />
                ) : (
                  <span className={styles.thumbFallback}>
                    <IconMusic size={16} />
                  </span>
                )}
                <span className={styles.playOverlay}>
                  {isPlaying ? <IconPause size={16} /> : <IconPlay size={16} />}
                </span>
              </button>

              <div className={styles.meta}>
                <div className={styles.songTitle}>{song.title}</div>
                <div className={styles.songArtist}>
                  {song.artist || "YouTube"}
                  {formatDur(song.duration) ? ` · ${formatDur(song.duration)}` : ""}
                </div>
              </div>

              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={() => play(song)}
                  aria-label="Play"
                >
                  <IconPlay size={14} />
                </button>
                <button
                  type="button"
                  className={styles.actionBtn}
                  disabled={!!downloading[song.videoId]}
                  onClick={() => void downloadSong(song)}
                  aria-label="Download"
                  title="Download MP3"
                >
                  <IconDownload size={14} />
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export default OnlineView;

import { useEffect, useMemo, useState } from "react";
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
  const signedIn = useOnlineStore((s) => s.signedIn);
  const ensureCore = useOnlineStore((s) => s.ensureCore);
  const search = useOnlineStore((s) => s.search);
  const setQuery = useOnlineStore((s) => s.setQuery);
  const playSong = useOnlineStore((s) => s.playSong);
  const downloadSong = useOnlineStore((s) => s.downloadSong);
  const importCookies = useOnlineStore((s) => s.importCookies);
  const playerPlaying = usePlayerStore((s) => s.playing);
  const [localQ, setLocalQ] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [cookieJson, setCookieJson] = useState("");

  useEffect(() => {
    void ensureCore();
  }, [ensureCore]);

  const statusLabel = useMemo(() => {
    if (!core?.running) return coreError ? "Offline" : "Starting…";
    if (signedIn) return "Live · signed in";
    return "Live · sign in needed";
  }, [core, signedIn, coreError]);

  const statusClass =
    core?.running && signedIn ? styles.badgeOn : core?.running ? styles.badgeWarn : "";

  const onSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = localQ.trim();
    if (!q) return;
    setQuery(q);
    void search(q);
  };

  return (
    <div className={styles.view}>
      <section className={styles.hero}>
        <div className={styles.heroTop}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Online · YouTube Music</p>
            <h1 className={styles.title}>Stream the world</h1>
            <p className={styles.sub}>
              Full-length tracks, instant search, clean downloads. Signed-in cookies keep
              playback reliable — never 30-second previews.
            </p>
          </div>
          <div className={`${styles.badge} ${statusClass}`}>
            <span className={styles.badgePip} aria-hidden />
            {statusLabel}
          </div>
        </div>

        {!signedIn && (
          <div className={styles.importRow}>
            <button
              type="button"
              className={styles.importToggle}
              onClick={() => setShowImport((v) => !v)}
            >
              {showImport ? "Hide cookie import" : "Import cookies (JSON)"}
            </button>
            {showImport && (
              <div className={styles.importBox}>
                <textarea
                  className={styles.importArea}
                  placeholder='Paste cookie JSON from EditThisCookie / "Get cookies.txt LOCALLY"…'
                  value={cookieJson}
                  onChange={(e) => setCookieJson(e.target.value)}
                  rows={5}
                />
                <button
                  type="button"
                  className={styles.searchBtn}
                  style={{ height: 40, alignSelf: "flex-end" }}
                  onClick={() => {
                    if (!cookieJson.trim()) return;
                    void importCookies(cookieJson);
                  }}
                >
                  Save cookies
                </button>
              </div>
            )}
          </div>
        )}

        <form className={styles.searchForm} onSubmit={onSearch}>
          <div className={styles.searchBar}>
            <IconSearch size={18} className={styles.searchIcon} />
            <input
              className={styles.input}
              value={localQ}
              onChange={(e) => setLocalQ(e.target.value)}
              placeholder="Artist, song, mix…"
              autoFocus
              aria-label="Search YouTube Music"
            />
          </div>
          <button type="submit" className={styles.searchBtn} disabled={searching}>
            {searching ? "Searching…" : "Search"}
          </button>
        </form>

        {(searchError || downloadNote || (buffering && currentId)) && (
          <div className={styles.notes}>
            {buffering && currentId && (
              <p className={styles.note}>
                Buffering full track… first play takes a few seconds.
              </p>
            )}
            {downloadNote && <p className={styles.note}>{downloadNote}</p>}
            {searchError && (
              <p className={styles.error}>
                {searchError}
                {/Chrome|cookies|bot-check|Sign in|Node/i.test(searchError) && (
                  <button type="button" className={styles.retryBtn} onClick={() => void search()}>
                    Retry
                  </button>
                )}
              </p>
            )}
          </div>
        )}
      </section>

      <div className={styles.results}>
        {searching && (
          <div className={styles.loading}>
            <div className={styles.loadingPulse} />
            <p>Searching YouTube Music…</p>
          </div>
        )}

        {!searching && !results.length && (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>
              <IconOnline size={26} />
            </div>
            <h3>Find something to play</h3>
            <p>
              Search an artist or track. First result starts the full song — then it stays
              cached for instant replay.
            </p>
          </div>
        )}

        {!searching && results.length > 0 && (
          <>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>Results</h2>
              <span className={styles.sectionCount}>{results.length} tracks</span>
            </div>
            <div className={styles.grid}>
              {results.map((song, i) => {
                const active = currentId === song.videoId;
                const isPlaying = active && playing && playerPlaying;
                return (
                  <motion.div
                    key={song.videoId}
                    className={`${styles.row} ${active ? styles.rowActive : ""}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      delay: Math.min(i, 10) * 0.028,
                      type: "spring",
                      stiffness: 380,
                      damping: 30,
                    }}
                  >
                    <button
                      type="button"
                      className={styles.artBtn}
                      onClick={() => void playSong(song)}
                      aria-label={isPlaying ? "Now playing" : `Play ${song.title}`}
                    >
                      {song.thumbnail ? (
                        <img
                          className={styles.thumb}
                          src={song.thumbnail}
                          alt=""
                          onError={(e) => {
                            const el = e.currentTarget;
                            el.style.display = "none";
                            const fb = el.parentElement?.querySelector(`.${styles.thumbFallback}`) as HTMLElement | null;
                            if (fb) fb.style.display = "flex";
                          }}
                        />
                      ) : null}
                      <span
                        className={styles.thumbFallback}
                        style={{ display: song.thumbnail ? "none" : "flex" }}
                      >
                        <IconMusic size={18} />
                      </span>
                      <span className={styles.playOverlay}>
                        {isPlaying ? <IconPause size={18} /> : <IconPlay size={18} />}
                      </span>
                    </button>

                    <div className={styles.meta}>
                      <div className={styles.songTitle}>{song.title}</div>
                      <div className={styles.songArtist}>{song.artist || "YouTube"}</div>
                    </div>

                    <span className={styles.songDur}>{formatDur(song.duration)}</span>

                    <div className={styles.actions}>
                      <button
                        type="button"
                        className={styles.actionBtn}
                        onClick={() => void playSong(song)}
                        aria-label="Play"
                      >
                        <IconPlay size={15} />
                      </button>
                      <button
                        type="button"
                        className={styles.actionBtn}
                        disabled={!!downloading[song.videoId]}
                        onClick={() => void downloadSong(song)}
                        aria-label="Download"
                        title="Save MP3"
                      >
                        <IconDownload size={15} />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default OnlineView;

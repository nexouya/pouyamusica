import { useEffect, useState } from "react";
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

  const statusLabel = !core?.running
    ? coreError
      ? "Offline"
      : "Starting…"
    : signedIn
      ? "Live"
      : "Live · limited";
  const statusClass =
    core?.running && signedIn ? styles.badgeOn : core?.running ? styles.badgeWarn : "";

  const onSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = localQ.trim();
    if (!q) return;
    setQuery(q);
    void search(q);
  };

  const isPlaying = (videoId: string) =>
    currentId === videoId && playing && playerPlaying;

  return (
    <div className={styles.view}>
      <section className={styles.hero}>
        <div className={styles.heroTop}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Online · YouTube Music</p>
            <h1 className={styles.title}>Search</h1>
            <p className={styles.sub}>Full tracks. Fast parallel search. Local cache for instant replay.</p>
          </div>
          <div className={`${styles.badge} ${statusClass}`}>
            <span className={styles.badgePip} aria-hidden />
            {statusLabel}
          </div>
        </div>

        <form className={styles.searchForm} onSubmit={onSearch}>
          <div className={styles.searchBar}>
            <IconSearch size={17} className={styles.searchIcon} />
            <input
              className={styles.input}
              value={localQ}
              onChange={(e) => setLocalQ(e.target.value)}
              placeholder="Artist, song…"
              autoFocus
              aria-label="Search YouTube Music"
            />
          </div>
          <button type="submit" className={styles.searchBtn} disabled={searching}>
            {searching ? "Searching…" : "Search"}
          </button>
        </form>

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
                  rows={4}
                />
                <button
                  type="button"
                  className={styles.searchBtn}
                  style={{ height: 36, alignSelf: "flex-end", padding: "0 14px" }}
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

        {(searchError || downloadNote || (buffering && currentId)) && (
          <div className={styles.notes}>
            {buffering && currentId && (
              <p className={styles.note}>Buffering track — first play fills the local cache…</p>
            )}
            {downloadNote && <p className={styles.note}>{downloadNote}</p>}
            {searchError && (
              <p className={styles.error}>
                {searchError}
                {/Chrome|cookies|bot-check|Sign in|Node|Stream/i.test(searchError) && (
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
        {searching && !results.length && (
          <div className={styles.loading}>
            <div className={styles.loadingPulse} />
            <p>Searching…</p>
          </div>
        )}

        {!searching && !results.length && (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>
              <IconOnline size={24} />
            </div>
            <h3>Find something to play</h3>
            <p>Search once — the engine fans out in parallel and caches tracks locally.</p>
          </div>
        )}

        {results.length > 0 && (
          <>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>{searching ? "Updating…" : "Results"}</h2>
              <span className={styles.sectionCount}>{results.length} tracks</span>
            </div>
            <div className={styles.grid}>
              {results.map((song) => {
                const active = currentId === song.videoId;
                const playingNow = isPlaying(song.videoId);
                const busy = !!downloading[song.videoId];
                return (
                  <div
                    key={song.videoId}
                    className={`${styles.row} ${active ? styles.rowActive : ""}`}
                  >
                    <button
                      type="button"
                      className={styles.artBtn}
                      onClick={() => void playSong(song)}
                      aria-label={playingNow ? "Now playing" : `Play ${song.title}`}
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
                        <IconMusic size={16} />
                      </span>
                      <span className={styles.playOverlay}>
                        {playingNow ? <IconPause size={16} /> : <IconPlay size={16} />}
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
                        <IconPlay size={14} />
                      </button>
                      <button
                        type="button"
                        className={styles.actionBtn}
                        disabled={busy}
                        onClick={() => void downloadSong(song)}
                        aria-label={busy ? "Downloading" : "Download"}
                        title={busy ? "Saving…" : "Download m4a"}
                      >
                        <IconDownload size={14} />
                      </button>
                    </div>
                  </div>
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

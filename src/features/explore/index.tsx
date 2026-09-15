import { useState } from "react";
import styles from "../../components/views/Home.module.css";
import { useLibraryStore } from "../../stores/libraryStore";
import { EmptyState, TrackRow } from "../../components/views/TrackRow";
import { AlbumCard } from "../../components/views/AlbumCard";
import { api } from "../../core/api";
import { formatTime } from "../../lib/format";

export function ExploreView() {
  const tracks = useLibraryStore((s) => s.tracks);
  const refresh = useLibraryStore((s) => s.refresh);
  const root = useLibraryStore((s) => s.root);
  const [loadingFolder, setLoadingFolder] = useState(false);

  const handlePickFolder = async () => {
    setLoadingFolder(true);
    try {
      const result = await api.pickFolder();
      if (result) {
        useLibraryStore.setState({ tracks: result, loading: false, error: null });
        const newRoot = await api.getMusicRoot().catch(() => "");
        if (newRoot) useLibraryStore.setState({ root: newRoot });
      }
    } catch (e) {
      console.error("pickFolder failed", e);
      useLibraryStore.setState({ error: String(e) });
    } finally {
      setLoadingFolder(false);
    }
  };

  // Distinct albums
  const albums = Array.from(new Map(tracks.map((t) => [t.album, t])).values()).slice(0, 16);
  const artists = new Set(tracks.map((t) => t.artist)).size;
  const totalSecs = tracks.reduce((acc, t) => acc + (t.duration_secs || 0), 0);

  return (
    <div className={styles.view}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div>
            <p className="navLabel">Explore & Sources</p>
            <h1 className={styles.headerTitle}>Music Directory</h1>
            <p className={styles.sub}>
              {root ? (
                <span className={styles.pathBadge} title={root}>
                  📁 {root}
                </span>
              ) : (
                "No folder selected"
              )}
            </p>
          </div>

          <div className={styles.headerActions}>
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
              onClick={() => void handlePickFolder()}
              disabled={loadingFolder}
            >
              {loadingFolder ? "Selecting…" : "📁 Choose Folder"}
            </button>
            <button
              type="button"
              className={styles.actionBtn}
              onClick={() => void refresh()}
            >
              🔄 Rescan
            </button>
          </div>
        </div>

        {/* Library stats banner */}
        {tracks.length > 0 && (
          <div className={styles.statsBar}>
            <div className={styles.statBox}>
              <span className={styles.statVal}>{tracks.length}</span>
              <span className={styles.statLabel}>Tracks</span>
            </div>
            <div className={styles.statBox}>
              <span className={styles.statVal}>{albums.length}</span>
              <span className={styles.statLabel}>Albums</span>
            </div>
            <div className={styles.statBox}>
              <span className={styles.statVal}>{artists}</span>
              <span className={styles.statLabel}>Artists</span>
            </div>
            <div className={styles.statBox}>
              <span className={styles.statVal}>{formatTime(totalSecs)}</span>
              <span className={styles.statLabel}>Playtime</span>
            </div>
          </div>
        )}
      </header>

      <div className={styles.pageContent}>
        {albums.length > 0 && (
          <section className={styles.sectionBlock}>
            <h2 className={styles.sectionHeading}>Albums In Directory</h2>
            <div className={styles.albumGrid}>
              {albums.map((t) => (
                <AlbumCard key={t.album} track={t} />
              ))}
            </div>
          </section>
        )}

        <section className={styles.sectionBlock}>
          <h2 className={styles.sectionHeading}>All Tracks In Directory</h2>
          {tracks.length === 0 ? (
            <EmptyState
              title="No music found in directory"
              hint="Click 'Choose Folder' above and select a folder that contains your audio files (MP3, FLAC, WAV, M4A, OGG…)."
            />
          ) : (
            <div className={styles.list}>
              {tracks.map((t, i) => (
                <TrackRow key={t.id} track={t} index={i} queue={tracks} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default ExploreView;

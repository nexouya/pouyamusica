import styles from "../../components/views/Home.module.css";
import { useLibraryStore } from "../../stores/libraryStore";
import { usePlayerStore } from "../../stores/playerStore";
import { EmptyState, TrackRow } from "../../components/views/TrackRow";
import { formatTime } from "../../lib/format";
import { IconPlay } from "../../components/icons/Icons";

export function LikedView() {
  const tracks = useLibraryStore((s) => s.tracks);
  const liked = usePlayerStore((s) => s.liked);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const only = tracks.filter((t) => liked.includes(t.path));

  const totalDuration = only.reduce((acc, t) => acc + (t.duration_secs || 0), 0);

  return (
    <div className={styles.view}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div>
            <p className="navLabel">Liked</p>
            <h1 className={styles.headerTitle}>Favorites</h1>
            <p className={styles.sub}>
              {only.length} {only.length === 1 ? "track" : "tracks"} •{" "}
              {formatTime(totalDuration)}
            </p>
          </div>
          {only.length > 0 && (
            <button
              type="button"
              className={styles.playAllBtn}
              onClick={() => void playTrack(only[0], only)}
            >
              <IconPlay size={14} /> Play All
            </button>
          )}
        </div>
      </header>

      <div className={styles.pageContent}>
        {only.length === 0 ? (
          <EmptyState
            title="No likes yet"
            hint="Tap the heart icon on any track or the player bar to save your favorite music here."
          />
        ) : (
          <div className={styles.list}>
            {only.map((t, i) => (
              <TrackRow key={t.id} track={t} index={i} queue={only} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default LikedView;

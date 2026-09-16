import { motion } from "framer-motion";
import styles from "./Views.module.css";
import { GlassButton } from "../glass/GlassPanel";
import { IconMusic, IconPlay } from "../icons/Icons";
import type { TrackMeta } from "../../types";
import { usePlayerStore } from "../../stores/playerStore";
import { useLibraryStore } from "../../stores/libraryStore";
import { formatTime } from "../../lib/format";

export function AlbumCard({
  track,
  featured = false,
}: {
  track: TrackMeta;
  featured?: boolean;
}) {
  const playTrack = usePlayerStore((s) => s.playTrack);
  const current = usePlayerStore((s) => s.current);
  const playing = usePlayerStore((s) => s.playing);
  const libraryTracks = useLibraryStore((s) => s.tracks);

  const albumTracks = libraryTracks.filter((t) => t.album === track.album);
  const active = current?.album === track.album || current?.id === track.id;

  const handlePlayAlbum = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (albumTracks.length > 0) {
      void playTrack(albumTracks[0], albumTracks);
    } else {
      void playTrack(track);
    }
  };

  return (
    <motion.div
      className={`${styles.card} ${featured ? styles.cardFeatured : ""}`}
      initial={false}
      whileHover={{ scale: 1.03, y: -3 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 360, damping: 22 }}
      onClick={handlePlayAlbum}
      style={{ cursor: "pointer" }}
    >
      <div className={styles.coverWrap}>
        {track.cover_data_url ? (
          <img
            className={styles.cover}
            src={track.cover_data_url}
            alt=""
            draggable={false}
          />
        ) : (
          <div className={styles.coverFallback} aria-hidden>
            <IconMusic size={featured ? 36 : 28} />
          </div>
        )}
        <div className={styles.coverShade} />
        <div className={styles.playOverlay}>
          <GlassButton
            size={featured ? 48 : 40}
            label="Play Album"
            onClick={handlePlayAlbum}
          >
            <IconPlay size={featured ? 20 : 16} />
          </GlassButton>
        </div>
        {active && playing && (
          <div className={styles.nowBadge} aria-hidden>
            <span /> <span /> <span />
          </div>
        )}
      </div>
      <div className={styles.info}>
        <div className={styles.title} title={track.album || track.title}>
          {track.album || track.title}
        </div>
        <div className={styles.artist}>{track.artist}</div>
        <div className={`mono ${styles.metaRow}`}>
          {albumTracks.length} {albumTracks.length === 1 ? "track" : "tracks"}
          {featured && ` · ${formatTime(track.duration_secs)}`}
        </div>
      </div>
    </motion.div>
  );
}

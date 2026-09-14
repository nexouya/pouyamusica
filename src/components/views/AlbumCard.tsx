import { motion } from "framer-motion";
import styles from "./Views.module.css";
import { GlassButton } from "../glass/GlassPanel";
import { IconPlay } from "../icons/Icons";
import type { TrackMeta } from "../../types";
import { usePlayerStore } from "../../stores/playerStore";
import { formatTime } from "../../lib/format";

export function AlbumCard({
  track,
  featured = false,
}: {
  track: TrackMeta;
  featured?: boolean;
}) {
  const playTrack = usePlayerStore((s) => s.playTrack);
  const currentId = usePlayerStore((s) => s.current?.id);
  const playing = usePlayerStore((s) => s.playing);
  const active = currentId === track.id;

  return (
    <motion.div
      className={`${styles.card} ${featured ? styles.cardFeatured : ""}`}
      initial={false}
      whileHover={{ scale: 1.03, y: -3 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 360, damping: 22 }}
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
          <div className={styles.coverFallback}>♪</div>
        )}
        <div className={styles.coverShade} />
        <div className={styles.playOverlay}>
          <GlassButton
            size={featured ? 48 : 40}
            label="Play"
            onClick={(e) => {
              e.stopPropagation();
              void playTrack(track);
            }}
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
        <div className={styles.title} title={track.title}>
          {track.title}
        </div>
        <div className={styles.artist}>{track.artist}</div>
        {featured && (
          <div className={`mono ${styles.metaRow}`}>
            {track.album} · {formatTime(track.duration_secs)}
          </div>
        )}
      </div>
    </motion.div>
  );
}

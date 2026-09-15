import type { ReactNode } from "react";
import { motion } from "framer-motion";
import styles from "./Views.module.css";
import { GlassPanel } from "../glass/GlassPanel";
import { IconMusic, IconPlay } from "../icons/Icons";
import type { TrackMeta } from "../../types";
import { usePlayerStore } from "../../stores/playerStore";
import { formatTime } from "../../lib/format";

export function TrackRow({
  track,
  index,
  highlight: _highlight,
  meta,
  action,
  queue,
}: {
  track: TrackMeta;
  index: number;
  highlight?: boolean;
  meta?: string;
  action?: ReactNode;
  /** Play context for this row (playlist / liked). Defaults to full library. */
  queue?: TrackMeta[];
}) {
  const playTrack = usePlayerStore((s) => s.playTrack);
  const currentId = usePlayerStore((s) => s.current?.id);
  const playing = usePlayerStore((s) => s.playing);
  const isSelected = currentId === track.id;
  const isPlaying = isSelected && playing;

  return (
    <motion.div
      role="button"
      tabIndex={0}
      className={`${styles.row} ${isSelected ? styles.rowActive : ""} ${isPlaying ? styles.rowPlaying : ""}`}
      onClick={() => void playTrack(track, queue)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          void playTrack(track, queue);
        }
      }}
      whileHover={{ x: 3 }}
      whileTap={{ scale: 0.99 }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: "spring",
        stiffness: 380,
        damping: 28,
        delay: Math.min(index, 10) * 0.03,
      }}
    >
      <span className={`mono ${styles.rowIdx}`}>
        {isPlaying ? (
          <span className={styles.eqDots} aria-hidden>
            <span />
            <span />
            <span />
          </span>
        ) : (
          index + 1
        )}
      </span>

      <span className={styles.rowThumbWrap}>
        {track.cover_data_url ? (
          <img
            className={styles.rowThumb}
            src={track.cover_data_url}
            alt=""
            draggable={false}
          />
        ) : (
          <span className={styles.rowThumbFallback} aria-hidden>
            <IconMusic size={16} />
          </span>
        )}
        <span className={styles.rowThumbShade} aria-hidden>
          <IconPlay size={13} />
        </span>
      </span>

      <span className={styles.rowMeta}>
        <span className={styles.rowTitle}>{track.title}</span>
        <span className={styles.rowArtist}>{track.artist}</span>
      </span>

      <span className={styles.rowAlbum}>{track.album}</span>

      <span
        className={styles.rowActions}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {action}
      </span>

      <span className={`mono ${styles.rowDur}`}>
        {meta || formatTime(track.duration_secs)}
      </span>
    </motion.div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint: string;
  action?: ReactNode;
}) {
  return (
    <GlassPanel className={styles.empty} radius={20}>
      <h2 className={styles.emptyTitle}>{title}</h2>
      <p className={styles.emptyHint}>{hint}</p>
      {action}
    </GlassPanel>
  );
}

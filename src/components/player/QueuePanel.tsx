import { AnimatePresence, motion } from "framer-motion";
import styles from "./QueuePanel.module.css";
import { GlassPanel } from "../glass/GlassPanel";
import { usePlayerStore } from "../../stores/playerStore";
import { useLibraryStore } from "../../stores/libraryStore";
import { formatTime } from "../../lib/format";
import { IconMusic } from "../icons/Icons";

export function QueuePanel() {
  const open = usePlayerStore((s) => s.queueOpen);
  const toggle = usePlayerStore((s) => s.toggleQueue);
  const current = usePlayerStore((s) => s.current);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const contextQueue = usePlayerStore((s) => s.queue);
  const library = useLibraryStore((s) => s.tracks);

  // Show the active play context (playlist/liked/library), not a random library slice.
  const source = contextQueue.length ? contextQueue : library;
  const queue = source
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => t.path !== current?.path)
    .slice(0, 80);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className={styles.scrim}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={toggle}
          />
          <motion.div
            className={styles.host}
            initial={{ x: 320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 320, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
          >
            <GlassPanel className={styles.panel} radius={28} strong>
              <div className={styles.header}>
                <h2 className={styles.title}>Queue</h2>
                <button type="button" className={styles.close} onClick={toggle} aria-label="Close queue">
                  Close
                </button>
              </div>
              <div className={styles.list}>
                {queue.map(({ t, i }) => (
                  <button
                    key={`${t.id}-${i}`}
                    type="button"
                    className={styles.item}
                    onClick={() => {
                      void playTrack(t, source);
                      toggle();
                    }}
                  >
                    <span className={`mono ${styles.idx}`}>{String(i + 1).padStart(2, "0")}</span>
                    {t.cover_data_url ? (
                      <img className={styles.thumb} src={t.cover_data_url} alt="" />
                    ) : (
                      <span className={`${styles.thumb} ${styles.thumbFallback}`} aria-hidden>
                        <IconMusic size={14} />
                      </span>
                    )}
                    <span className={styles.meta}>
                      <span className={styles.tTitle}>{t.title}</span>
                      <span className={styles.tArtist}>{t.artist}</span>
                    </span>
                    <span className={`mono ${styles.dur}`}>{formatTime(t.duration_secs)}</span>
                  </button>
                ))}
                {!queue.length && (
                  <p className={styles.meta} style={{ padding: 16, opacity: 0.7 }}>
                    Queue is empty.
                  </p>
                )}
              </div>
            </GlassPanel>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

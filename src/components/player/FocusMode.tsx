import { AnimatePresence, motion } from "framer-motion";
import styles from "./FocusMode.module.css";
import { Visualizer } from "./Visualizer";
import { usePlayerStore } from "../../stores/playerStore";
import {
  IconClose,
  IconHeart,
  IconPause,
  IconPlay,
  IconNext,
  IconPrev,
  IconVolume,
  IconVolumeMute,
} from "../icons/Icons";
import { SeekBar } from "./SeekBar";

export function FocusMode() {
  const focusMode = usePlayerStore((s) => s.focusMode);
  const toggleFocus = usePlayerStore((s) => s.toggleFocus);
  const current = usePlayerStore((s) => s.current);
  const playing = usePlayerStore((s) => s.playing);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const next = usePlayerStore((s) => s.next);
  const prev = usePlayerStore((s) => s.prev);
  const liked = usePlayerStore((s) => s.liked);
  const toggleLike = usePlayerStore((s) => s.toggleLikeCurrent);
  const volume = usePlayerStore((s) => s.volume);
  const applyVolume = usePlayerStore((s) => s.applyVolume);

  const isLiked = current ? liked.includes(current.path) : false;

  return (
    <AnimatePresence>
      {focusMode && (
        <motion.div
          className={styles.root}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div
            className={styles.backdrop}
            style={
              current?.cover_data_url
                ? { backgroundImage: `url(${current.cover_data_url})` }
                : undefined
            }
          />
          <div className={styles.tint} />

          <button
            type="button"
            className={styles.close}
            onClick={toggleFocus}
            aria-label="Exit focus mode"
            title="Exit focus mode (Esc)"
          >
            <IconClose size={16} />
          </button>

          <motion.div
            className={styles.stage}
            initial={{ scale: 0.88, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
          >
            <div className={styles.visualWrap}>
              <Visualizer
                mode="radial"
                size={440}
                innerRadius={135}
                className={styles.viz}
              />

              {/* Vinyl Record Player Unit */}
              <motion.div
                className={styles.vinylDisc}
                animate={playing ? { rotate: 360 } : {}}
                transition={
                  playing
                    ? { repeat: Infinity, duration: 18, ease: "linear" }
                    : { duration: 0.5, ease: "easeOut" }
                }
              >
                <div className={styles.vinylGroove1} />
                <div className={styles.vinylGroove2} />
                <div className={styles.vinylGroove3} />
                <div className={styles.vinylSheen} />

                {/* Center album art label */}
                <div className={styles.vinylLabel}>
                  {current?.cover_data_url ? (
                    <img
                      className={styles.coverImg}
                      src={current.cover_data_url}
                      alt=""
                      draggable={false}
                    />
                  ) : (
                    <div className={styles.fallbackLabel}>
                      <span className={styles.fallbackIcon}>♪</span>
                    </div>
                  )}
                  <div className={styles.spindleHole} />
                </div>
              </motion.div>
            </div>

            <div className={styles.meta}>
              <motion.h1
                key={current?.title}
                className={styles.title}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {current?.title || "Nothing playing"}
              </motion.h1>
              <p className={styles.artist}>{current?.artist || "—"}</p>
              {current?.album && <p className={styles.album}>{current.album}</p>}
            </div>

            {/* SeekBar with single duration */}
            <div className={styles.seekWrap}>
              <SeekBar />
            </div>

            <div className={styles.controlsRow}>
              <div className={styles.controls}>
                <button
                  type="button"
                  onClick={() => void prev()}
                  aria-label="Previous"
                  className={styles.ctrl}
                  title="Previous (Shift + Left)"
                >
                  <IconPrev size={22} />
                </button>
                <button
                  type="button"
                  className={styles.play}
                  onClick={() => void togglePlay()}
                  aria-label={playing ? "Pause" : "Play"}
                  title="Play / Pause (Space)"
                >
                  {playing ? <IconPause size={28} /> : <IconPlay size={28} />}
                </button>
                <button
                  type="button"
                  onClick={() => void next()}
                  aria-label="Next"
                  className={styles.ctrl}
                  title="Next (Shift + Right)"
                >
                  <IconNext size={22} />
                </button>
                <button
                  type="button"
                  onClick={() => void toggleLike()}
                  aria-label={isLiked ? "Unlike" : "Like"}
                  className={`${styles.ctrl} ${isLiked ? styles.liked : ""}`}
                  title="Like / Save (L)"
                >
                  <IconHeart size={20} filled={isLiked} />
                </button>
              </div>

              {/* Inline volume */}
              <div className={styles.volumeBar}>
                <button
                  type="button"
                  className={styles.volumeBtn}
                  onClick={() => void applyVolume(volume > 0 ? 0 : 0.8)}
                  title={volume > 0 ? "Mute" : "Unmute"}
                >
                  {volume > 0 ? <IconVolume size={16} /> : <IconVolumeMute size={16} />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  onChange={(e) => void applyVolume(parseFloat(e.target.value))}
                  className={styles.volumeSlider}
                  aria-label="Volume"
                />
              </div>
            </div>

            <div className={styles.hints}>
              <span>Esc to exit</span>
              <span>•</span>
              <span>Space to toggle play</span>
              <span>•</span>
              <span>← / → to scrub</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

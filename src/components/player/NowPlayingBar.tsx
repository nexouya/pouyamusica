import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import styles from "./NowPlayingBar.module.css";
import { SeekBar } from "./SeekBar";
import { VolumeSlider } from "./VolumeSlider";
import { EqualizerModal } from "./EqualizerModal";
import { Visualizer } from "./Visualizer";
import {
  IconEq,
  IconHeart,
  IconMusic,
  IconNext,
  IconPause,
  IconPlay,
  IconPrev,
  IconQueue,
  IconRepeat,
  IconShuffle,
} from "../icons/Icons";
import { usePlayerStore } from "../../stores/playerStore";
import { useSoundLabStore } from "../../stores/soundLabStore";

function Ctrl({
  children,
  label,
  onClick,
  active,
  size = "md",
}: {
  children: React.ReactNode;
  label: string;
  onClick?: () => void;
  active?: boolean;
  size?: "sm" | "md";
}) {
  return (
    <motion.button
      type="button"
      className={`${styles.ctrl} ${size === "sm" ? styles.ctrlSm : ""} ${active ? styles.ctrlActive : ""}`}
      aria-label={label}
      onClick={onClick}
      whileTap={{ scale: 0.92 }}
      transition={{ type: "spring", stiffness: 420, damping: 18 }}
    >
      {children}
    </motion.button>
  );
}

export function NowPlayingBar() {
  const [eqOpen, setEqOpen] = useState(false);
  const current = usePlayerStore((s) => s.current);
  const playing = usePlayerStore((s) => s.playing);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const next = usePlayerStore((s) => s.next);
  const prev = usePlayerStore((s) => s.prev);
  const shuffle = usePlayerStore((s) => s.shuffle);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const repeat = usePlayerStore((s) => s.repeat);
  const cycleRepeat = usePlayerStore((s) => s.cycleRepeat);
  const toggleQueue = usePlayerStore((s) => s.toggleQueue);
  const toggleFocus = usePlayerStore((s) => s.toggleFocus);
  const liked = usePlayerStore((s) => s.liked);
  const toggleLike = usePlayerStore((s) => s.toggleLikeCurrent);
  const dspOn = useSoundLabStore((s) => s.webPath);
  const isLiked = current ? liked.includes(current.path) : false;

  return (
    <>
      <div className={styles.bar} role="region" aria-label="Now playing">
        {/* Left — now playing */}
        <div className={styles.left}>
          <button
            type="button"
            className={styles.artBtn}
            onClick={() => toggleFocus()}
            aria-label="Focus mode"
            title="Focus mode"
            data-playing={playing ? "true" : "false"}
          >
            {current?.cover_data_url ? (
              <img className={styles.art} src={current.cover_data_url} alt="" draggable={false} />
            ) : (
              <span className={styles.artEmpty} aria-hidden>
                <IconMusic size={18} />
              </span>
            )}
            {playing && (
              <motion.span
                className={styles.artRing}
                aria-hidden
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
              />
            )}
          </button>
        <div className={styles.meta}>
          <div className={styles.titleRow}>
            <span className={styles.livePip} data-on={playing ? "true" : "false"} aria-hidden />
            <div className={styles.title}>{current?.title || "Nothing playing"}</div>
          </div>
          <div className={styles.artist}>
            {current?.artist || "—"}
            {dspOn ? " · DSP" : ""}
          </div>
        </div>
        {current && (
          <button
            type="button"
            className={`${styles.heart} ${isLiked ? styles.heartOn : ""}`}
            onClick={() => void toggleLike()}
            aria-label={isLiked ? "Unlike" : "Like"}
          >
            <IconHeart size={14} filled={isLiked} />
          </button>
        )}
      </div>

      {/* Center — transport + seek */}
      <div className={styles.center}>
        <div className={styles.transport}>
          <Ctrl label="Shuffle" active={shuffle} onClick={toggleShuffle} size="sm">
            <IconShuffle size={14} active={shuffle} />
          </Ctrl>
          <Ctrl label="Previous" onClick={() => void prev()}>
            <IconPrev size={16} />
          </Ctrl>
          <motion.button
            type="button"
            className={styles.play}
            onClick={() => void togglePlay()}
            aria-label={playing ? "Pause" : "Play"}
            whileTap={{ scale: 0.94 }}
            transition={{ type: "spring", stiffness: 420, damping: 16 }}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={playing ? "pause" : "play"}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.1 }}
                style={{ display: "inline-flex", lineHeight: 0 }}
              >
                {playing ? <IconPause size={15} /> : <IconPlay size={15} />}
              </motion.span>
            </AnimatePresence>
          </motion.button>
          <Ctrl label="Next" onClick={() => void next()}>
            <IconNext size={16} />
          </Ctrl>
          <Ctrl label="Repeat" active={repeat !== "off"} onClick={cycleRepeat} size="sm">
            <IconRepeat size={14} mode={repeat} />
          </Ctrl>
        </div>
        <SeekBar compact />
      </div>

      {/* Right — tools + live spectrum */}
      <div className={styles.right}>
        {current && (
          <div className={styles.spectrum} aria-hidden>
            <Visualizer mode="linear" size={72} height={28} />
          </div>
        )}
        <Ctrl label="Queue" onClick={toggleQueue} size="sm">
          <IconQueue size={14} />
        </Ctrl>
        <Ctrl
          label="Equalizer"
          size="sm"
          active={eqOpen || dspOn}
          onClick={() => setEqOpen(!eqOpen)}
        >
          <IconEq size={14} />
        </Ctrl>
        <VolumeSlider />
      </div>
    </div>
    <EqualizerModal open={eqOpen} onClose={() => setEqOpen(false)} />
  </>
  );
}

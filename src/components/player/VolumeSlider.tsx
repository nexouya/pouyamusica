import { useCallback, useRef, useState } from "react";
import { motion } from "framer-motion";
import styles from "./VolumeSlider.module.css";
import { usePlayerStore } from "../../stores/playerStore";
import { useUiStore } from "../../stores/uiStore";
import { IconVolume, IconVolumeMute } from "../icons/Icons";

export function VolumeSlider() {
  const volume = usePlayerStore((s) => s.volume);
  const applyVolume = usePlayerStore((s) => s.applyVolume);
  const accentRgb = useUiStore((s) => s.accentRgb);
  const [expanded, setExpanded] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const lastVolRef = useRef<number>(0.8);

  const getRatio = useCallback((e: React.PointerEvent) => {
    const el = trackRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      const r = getRatio(e);
      if (r > 0) lastVolRef.current = r;
      void applyVolume(r);
    },
    [applyVolume, getRatio],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (e.buttons === 1) {
        const r = getRatio(e);
        if (r > 0) lastVolRef.current = r;
        void applyVolume(r);
      }
    },
    [applyVolume, getRatio],
  );

  const toggleMute = () => {
    if (volume > 0) {
      lastVolRef.current = volume;
      void applyVolume(0);
    } else {
      void applyVolume(lastVolRef.current || 0.8);
    }
  };

  return (
    <div
      className={styles.wrap}
      onPointerEnter={() => setExpanded(true)}
      onPointerLeave={() => setExpanded(false)}
    >
      <button
        type="button"
        className={styles.iconBtn}
        aria-label={volume === 0 ? "Unmute" : `Volume ${Math.round(volume * 100)}%`}
        title={volume === 0 ? "Unmute" : `Volume ${Math.round(volume * 100)}%`}
        onClick={toggleMute}
      >
        {volume === 0 ? <IconVolumeMute size={14} /> : <IconVolume size={14} />}
      </button>

      <motion.div
        className={styles.barShell}
        initial={false}
        animate={{ width: expanded ? 80 : 44 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      >
        <div
          ref={trackRef}
          className={styles.track}
          role="slider"
          aria-valuemin={0}
          aria-valuemax={1}
          aria-valuenow={volume}
          aria-label="Volume"
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") void applyVolume(Math.min(1, volume + 0.05));
            if (e.key === "ArrowLeft") void applyVolume(Math.max(0, volume - 0.05));
          }}
        >
          <div
            className={styles.fill}
            style={{
              width: `${Math.round(volume * 100)}%`,
              background: `linear-gradient(90deg, rgba(${accentRgb}, 0.7), rgba(${accentRgb}, 1))`,
            }}
          />
        </div>
      </motion.div>
    </div>
  );
}

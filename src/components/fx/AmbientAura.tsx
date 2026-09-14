import { useEffect, useRef } from "react";
import styles from "./AmbientAura.module.css";
import { usePlayerStore } from "../../stores/playerStore";
import { useUiStore } from "../../stores/uiStore";
import { subscribeAudioVisual } from "../../core/events/audioVisualBus";

/** Soft breathing orbs tinted by the live accent — react smoothly to FFT energy. */
export function AmbientAura() {
  const accentRgb = useUiStore((s) => s.accentRgb);
  const liteMode = useUiStore((s) => s.liteMode);
  const playing = usePlayerStore((s) => s.playing);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (liteMode) return;
    const el = rootRef.current;
    if (!el) return;

    let smoothedEnergy = 0;
    const unsub = subscribeAudioVisual((bands) => {
      const low = bands[2] ?? 0;
      const mid = bands[10] ?? 0;
      const target = playing ? Math.min(1, low * 0.7 + mid * 0.3) : 0;
      smoothedEnergy += (target - smoothedEnergy) * 0.25;

      el.style.setProperty("--aura-scale", (1 + smoothedEnergy * 0.16).toFixed(3));
      el.style.setProperty(
        "--aura-opacity",
        (playing ? 0.45 + smoothedEnergy * 0.45 : 0.22).toFixed(3),
      );
    });

    return () => unsub();
  }, [playing, liteMode]);

  if (liteMode) {
    return null;
  }

  return (
    <div
      ref={rootRef}
      className={styles.aura}
      aria-hidden
      style={{ ["--accent-dynamic-rgb" as string]: accentRgb }}
    >
      <div className={`${styles.orb} ${styles.orbA}`} />
      <div className={`${styles.orb} ${styles.orbB}`} />
      <div className={`${styles.orb} ${styles.orbC}`} />
      <div className={styles.grain} />
    </div>
  );
}

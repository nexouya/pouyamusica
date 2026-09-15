import { useEffect, useRef } from "react";
import styles from "./AmbientAura.module.css";
import { usePlayerStore } from "../../stores/playerStore";
import { useUiStore } from "../../stores/uiStore";
import { subscribeAudioVisual } from "../../core/events/audioVisualBus";

/** Soft breathing orbs tinted by the live accent — react smoothly to FFT energy. */
export function AmbientAura() {
  const accentRgb = useUiStore((s) => s.accentRgb);
  const playing = usePlayerStore((s) => s.playing);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    let smoothedEnergy = 0;
    let idlePhase = 0;
    let raf = 0;

    const paintIdle = () => {
      idlePhase += 0.012;
      const idle = playing ? 0 : 0.06 + Math.sin(idlePhase) * 0.04;
      const energy = Math.max(smoothedEnergy, idle);
      el.style.setProperty("--aura-scale", (1 + energy * 0.2).toFixed(3));
      el.style.setProperty(
        "--aura-opacity",
        (playing ? 0.5 + energy * 0.5 : 0.28 + energy * 0.2).toFixed(3),
      );
      el.style.setProperty("--aura-shift", playing ? "1" : "0.35");
      raf = requestAnimationFrame(paintIdle);
    };

    const unsub = subscribeAudioVisual((bands) => {
      const low = (bands[2] ?? 0) * 0.55 + (bands[3] ?? 0) * 0.45;
      const mid = (bands[10] ?? 0) * 0.5 + (bands[12] ?? 0) * 0.5;
      const high = bands[20] ?? 0;
      const target = playing ? Math.min(1, low * 0.55 + mid * 0.35 + high * 0.1) : 0;
      smoothedEnergy += (target - smoothedEnergy) * 0.35;
    });

    cancelAnimationFrame(raf);
    paintIdle();

    return () => {
      unsub();
      cancelAnimationFrame(raf);
    };
  }, [playing]);

  return (
    <div
      ref={rootRef}
      className={styles.aura}
      aria-hidden
      data-playing={playing ? "true" : "false"}
      style={{ ["--accent-dynamic-rgb" as string]: accentRgb }}
    >
      <div className={`${styles.orb} ${styles.orbA}`} />
      <div className={`${styles.orb} ${styles.orbB}`} />
      <div className={`${styles.orb} ${styles.orbC}`} />
      <div className={styles.grain} />
    </div>
  );
}

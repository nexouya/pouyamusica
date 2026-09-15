import { useCallback, useMemo, useRef, useState } from "react";
import styles from "./SeekBar.module.css";
import { usePlayerStore } from "../../stores/playerStore";
import { useUiStore } from "../../stores/uiStore";
import { formatTime } from "../../lib/format";

type Props = {
  /** Slim single-line progress (default player bar). */
  compact?: boolean;
};

export function SeekBar({ compact = false }: Props) {
  const waveform = usePlayerStore((s) => s.waveform);
  const position = usePlayerStore((s) => s.position);
  const duration = usePlayerStore((s) => s.duration);
  const seek = usePlayerStore((s) => s.seek);
  const accentRgb = useUiStore((s) => s.accentRgb);

  const [hover, setHover] = useState<number | null>(null);
  const [scrub, setScrub] = useState<number | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const isScrubbing = scrub !== null;
  const progress = isScrubbing
    ? scrub
    : duration > 0
      ? Math.min(1, Math.max(0, position / duration))
      : 0;
  const displayPos = isScrubbing ? scrub * duration : position;

  const barCount = compact ? 80 : 72;
  const bars = useMemo(() => {
    if (!waveform.length) return new Array(barCount).fill(0.35);
    if (waveform.length <= barCount) return waveform;
    const out: number[] = [];
    const step = waveform.length / barCount;
    for (let i = 0; i < barCount; i++) {
      const a = Math.floor(i * step);
      const b = Math.min(waveform.length, Math.floor((i + 1) * step));
      let peak = 0;
      for (let j = a; j < b; j++) peak = Math.max(peak, waveform[j]);
      out.push(peak);
    }
    return out;
  }, [waveform, barCount]);

  const getRatioFromEvent = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const el = trackRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (duration <= 0) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      const r = getRatioFromEvent(e);
      setScrub(r);
      setHover(r);
    },
    [duration, getRatioFromEvent],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const r = getRatioFromEvent(e);
      setHover(r);
      if (isScrubbing) {
        setScrub(r);
      }
    },
    [getRatioFromEvent, isScrubbing],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (isScrubbing && duration > 0) {
        const r = getRatioFromEvent(e);
        void seek(r * duration);
      }
      setScrub(null);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    [duration, getRatioFromEvent, isScrubbing, seek],
  );

  const onPointerCancel = useCallback(() => {
    setScrub(null);
    setHover(null);
  }, []);

  if (compact) {
    return (
      <div className={styles.wrapCompact}>
        <span className={`mono ${styles.timeSm}`}>{formatTime(displayPos)}</span>
        <div
          ref={trackRef}
          className={`${styles.trackCompact} ${isScrubbing ? styles.scrubbing : ""}`}
          role="slider"
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={displayPos}
          aria-label="Seek"
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onPointerLeave={() => {
            if (!isScrubbing) setHover(null);
          }}
          onKeyDown={(e) => {
            if (duration <= 0) return;
            if (e.key === "ArrowRight") void seek(Math.min(duration, position + 5));
            if (e.key === "ArrowLeft") void seek(Math.max(0, position - 5));
          }}
        >
          {/* Subtle Waveform mini-bars */}
          {waveform.length > 0 && (
            <div className={styles.waveMini} aria-hidden>
              {bars.map((v, i) => {
                const done = i / bars.length <= progress;
                const h = Math.max(22, Math.round(v * 100));
                return (
                  <span
                    key={i}
                    className={styles.barMini}
                    style={{
                      height: `${h}%`,
                      background: done
                        ? `rgba(${accentRgb}, 0.55)`
                        : "rgba(255, 255, 255, 0.08)",
                    }}
                  />
                );
              })}
            </div>
          )}

          <div
            className={styles.rail}
            style={{
              transform: `scaleX(${progress})`,
              background: `rgba(${accentRgb}, 1)`,
            }}
          />

          <div
            className={styles.knob}
            style={{ left: `${progress * 100}%` }}
            aria-hidden
          />

          {hover !== null && (
            <>
              <div
                className={styles.hoverLine}
                style={{ left: `${hover * 100}%` }}
                aria-hidden
              />
              <div
                className={styles.hoverTooltip}
                style={{ left: `${hover * 100}%` }}
              >
                {formatTime(hover * duration)}
              </div>
            </>
          )}
        </div>
        <span className={`mono ${styles.timeSm}`}>{formatTime(duration)}</span>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <span className={`mono ${styles.time}`}>{formatTime(displayPos)}</span>
      <div
        ref={trackRef}
        className={`${styles.track} ${isScrubbing ? styles.scrubbing : ""}`}
        role="slider"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={displayPos}
        aria-label="Seek"
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={() => {
          if (!isScrubbing) setHover(null);
        }}
        onKeyDown={(e) => {
          if (duration <= 0) return;
          if (e.key === "ArrowRight") void seek(Math.min(duration, position + 5));
          if (e.key === "ArrowLeft") void seek(Math.max(0, position - 5));
        }}
      >
        <div className={styles.wave} aria-hidden>
          {bars.map((v, i) => {
            const done = i / bars.length <= progress;
            const h = Math.max(16, Math.round(v * 100));
            return (
              <span
                key={i}
                className={styles.bar}
                style={{
                  height: `${h}%`,
                  background: done
                    ? `rgba(${accentRgb}, 0.95)`
                    : "rgba(255, 255, 255, 0.14)",
                }}
              />
            );
          })}
        </div>

        <div
          className={styles.playhead}
          style={{ left: `${progress * 100}%` }}
          aria-hidden
        />

        {hover !== null && (
          <div
            className={styles.hoverTooltip}
            style={{ left: `${hover * 100}%` }}
          >
            {formatTime(hover * duration)}
          </div>
        )}
      </div>
      <span className={`mono ${styles.time}`}>{formatTime(duration)}</span>
    </div>
  );
}

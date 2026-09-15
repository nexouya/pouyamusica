import { useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import styles from "./EqualizerModal.module.css";
import { IconClose } from "../icons/Icons";
import { useSoundLabStore } from "../../stores/soundLabStore";
import { usePlayerStore } from "../../stores/playerStore";
import { useLibraryStore } from "../../stores/libraryStore";
import { EQ_FREQS } from "../../audio/soundLab/engine";

const FREQUENCIES = EQ_FREQS.map((f) => (f >= 1000 ? `${f / 1000}kHz` : `${f}Hz`));

const PRESETS: Record<string, number[]> = {
  Flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  "Bass Boost": [6, 5, 4, 2, 0, 0, 0, 1, 2, 2],
  Vocal: [-2, -1, 1, 3, 5, 4, 3, 2, 1, 0],
  Electronic: [5, 4, 2, 0, -2, 2, 1, 3, 4, 5],
  Rock: [4, 3, 2, 0, -1, 1, 3, 4, 4, 5],
  Acoustic: [3, 2, 1, 2, 3, 3, 2, 3, 4, 3],
  "Treble Boost": [-2, -1, 0, 0, 1, 2, 4, 6, 7, 8],
};

function matchPreset(gains: number[]): string {
  for (const [name, g] of Object.entries(PRESETS)) {
    if (g.length === gains.length && g.every((v, i) => Math.abs(v - gains[i]) < 0.05)) {
      return name;
    }
  }
  return "Custom";
}

type Props = {
  open: boolean;
  onClose: () => void;
};

export function EqualizerModal({ open, onClose }: Props) {
  const eqGains = useSoundLabStore((s) => s.eqGains);
  const setEqGains = useSoundLabStore((s) => s.setEqGains);
  const webPath = useSoundLabStore((s) => s.webPath);
  const lastEngageError = useSoundLabStore((s) => s.lastEngageError);
  const current = usePlayerStore((s) => s.current);
  const error = useLibraryStore((s) => s.error);

  const enabled = eqGains.some((g) => Math.abs(g) > 0.05);
  const presetName = useMemo(() => matchPreset(eqGains), [eqGains]);
  const status = lastEngageError
    ? `DSP error — ${lastEngageError}`
    : webPath
      ? "Live on Web Audio · 32-bit float"
      : current
        ? "Engages on next play · native until then"
        : "Play a track to hear EQ";

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const applyPreset = (name: string) => {
    const g = PRESETS[name];
    if (g) void setEqGains([...g]);
  };

  const setBand = (index: number, val: number) => {
    const next = [...eqGains];
    next[index] = val;
    void setEqGains(next);
  };

  const resetFlat = () => {
    void setEqGains([...PRESETS.Flat]);
  };

  return (
    <AnimatePresence>
      {open && (
        <div className={styles.scrim} onClick={onClose} role="presentation">
          <motion.div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-label="Equalizer"
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ type: "spring", stiffness: 350, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.head}>
              <div className={styles.headTitle}>
                <span className={styles.eqBadge}>DSP</span>
                <h3>10-Band Graphic Equalizer</h3>
              </div>
              <div className={styles.headRight}>
                <button
                  type="button"
                  className={styles.closeBtn}
                  onClick={onClose}
                  aria-label="Close"
                >
                  <IconClose size={13} />
                </button>
              </div>
            </div>

            <div className={styles.presets}>
              {Object.keys(PRESETS).map((name) => (
                <button
                  key={name}
                  type="button"
                  className={`${styles.presetChip} ${presetName === name ? styles.presetChipActive : ""}`}
                  onClick={() => applyPreset(name)}
                >
                  {name}
                </button>
              ))}
            </div>

            <div className={styles.eqArea}>
              <div className={styles.sliderCol}>
                <span className={styles.sliderVal}>
                  {eqGains[0] > 0 ? `+${eqGains[0]}` : eqGains[0]}dB
                </span>
                <div className={styles.sliderTrack}>
                  <input
                    type="range"
                    min={-12}
                    max={12}
                    step={0.5}
                    value={eqGains[0] ?? 0}
                    onChange={(e) => setBand(0, parseFloat(e.target.value))}
                    className={styles.vSlider}
                    aria-label={FREQUENCIES[0]}
                  />
                </div>
                <span className={styles.sliderFreq}>Pre</span>
              </div>

              <div className={styles.divider} />

              {FREQUENCIES.map((freq, idx) => {
                const val = eqGains[idx] ?? 0;
                return (
                  <div key={freq} className={styles.sliderCol}>
                    <span className={styles.sliderVal}>
                      {val > 0 ? `+${val}` : val}dB
                    </span>
                    <div className={styles.sliderTrack}>
                      <input
                        type="range"
                        min={-12}
                        max={12}
                        step={0.5}
                        value={val}
                        onChange={(e) => setBand(idx, parseFloat(e.target.value))}
                        className={styles.vSlider}
                        aria-label={freq}
                      />
                    </div>
                    <span className={styles.sliderFreq}>{freq}</span>
                  </div>
                );
              })}
            </div>

            <div className={styles.foot}>
              <button type="button" className={styles.resetBtn} onClick={resetFlat}>
                Reset to Flat
              </button>
              <span className={styles.hintText}>
                {enabled ? status : "Bypassed · Flat"}
                {error ? ` · ${error}` : ""}
              </span>
              <button type="button" className={styles.doneBtn} onClick={onClose}>
                Done
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import styles from "./EqualizerModal.module.css";
import { IconClose } from "../icons/Icons";

const FREQUENCIES = [
  "32Hz",
  "64Hz",
  "125Hz",
  "250Hz",
  "500Hz",
  "1kHz",
  "2kHz",
  "4kHz",
  "8kHz",
  "16kHz",
];

const PRESETS: Record<string, number[]> = {
  Flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  "Bass Boost": [6, 5, 4, 2, 0, 0, 0, 1, 2, 2],
  Vocal: [-2, -1, 1, 3, 5, 4, 3, 2, 1, 0],
  Electronic: [5, 4, 2, 0, -2, 2, 1, 3, 4, 5],
  Rock: [4, 3, 2, 0, -1, 1, 3, 4, 4, 5],
  Acoustic: [3, 2, 1, 2, 3, 3, 2, 3, 4, 3],
  "Treble Boost": [-2, -1, 0, 0, 1, 2, 4, 6, 7, 8],
};

type Props = {
  open: boolean;
  onClose: () => void;
};

export function EqualizerModal({ open, onClose }: Props) {
  const [enabled, setEnabled] = useState(true);
  const [preset, setPreset] = useState("Flat");
  const [gains, setGains] = useState<number[]>(PRESETS.Flat);
  const [preamp, setPreamp] = useState(0);

  const handlePresetSelect = (name: string) => {
    setPreset(name);
    if (PRESETS[name]) {
      setGains([...PRESETS[name]]);
    }
  };

  const handleGainChange = (index: number, val: number) => {
    const next = [...gains];
    next[index] = val;
    setGains(next);
    setPreset("Custom");
  };

  const resetFlat = () => {
    handlePresetSelect("Flat");
    setPreamp(0);
  };

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
                  role="switch"
                  aria-checked={enabled}
                  aria-label={enabled ? "Disable equalizer" : "Enable equalizer"}
                  className={`${styles.toggleSwitch} ${enabled ? styles.toggleOn : ""}`}
                  onClick={() => setEnabled(!enabled)}
                  title={enabled ? "Disable Equalizer" : "Enable Equalizer"}
                >
                  <span className={styles.toggleKnob} />
                </button>
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

            {/* Presets ribbon */}
            <div className={styles.presets}>
              {Object.keys(PRESETS).map((name) => (
                <button
                  key={name}
                  type="button"
                  className={`${styles.presetChip} ${preset === name ? styles.presetChipActive : ""}`}
                  onClick={() => handlePresetSelect(name)}
                >
                  {name}
                </button>
              ))}
            </div>

            {/* Sliders Area */}
            <div
              className={`${styles.eqArea} ${!enabled ? styles.eqDisabled : ""}`}
            >
              {/* Preamp */}
              <div className={styles.sliderCol}>
                <span className={styles.sliderVal}>
                  {preamp > 0 ? `+${preamp}` : preamp}dB
                </span>
                <div className={styles.sliderTrack}>
                  <input
                    type="range"
                    min={-12}
                    max={12}
                    step={0.5}
                    value={preamp}
                    disabled={!enabled}
                    onChange={(e) => setPreamp(parseFloat(e.target.value))}
                    className={styles.vSlider}
                  />
                </div>
                <span className={styles.sliderFreq}>Pre</span>
              </div>

              <div className={styles.divider} />

              {/* 10 Bands */}
              {FREQUENCIES.map((freq, idx) => {
                const val = gains[idx] ?? 0;
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
                        disabled={!enabled}
                        onChange={(e) =>
                          handleGainChange(idx, parseFloat(e.target.value))
                        }
                        className={styles.vSlider}
                      />
                    </div>
                    <span className={styles.sliderFreq}>{freq}</span>
                  </div>
                );
              })}
            </div>

            <div className={styles.foot}>
              <button
                type="button"
                className={styles.resetBtn}
                onClick={resetFlat}
              >
                Reset to Flat
              </button>
              <span className={styles.hintText}>
                {enabled ? "Processing Active (32-bit float precision)" : "Bypassed"}
              </span>
              <button
                type="button"
                className={styles.doneBtn}
                onClick={onClose}
              >
                Done
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

import { useEffect, useMemo, useRef } from "react";
import type { ComponentType } from "react";
import styles from "./SoundLab.module.css";
import { PRESET_CATALOG } from "../../audio/soundLab/presets";
import type { SoundLabPresetId } from "../../audio/soundLab/types";
import {
  IconBass,
  IconHall,
  IconMic,
  IconMoon,
  IconOrbit,
  IconRocket,
  IconSoundLab,
  IconTape,
  IconWave,
} from "../../components/icons/Icons";
import { useSoundLabStore } from "../../stores/soundLabStore";
import { usePlayerStore } from "../../stores/playerStore";

const PRESET_ICONS: Record<string, ComponentType<{ size?: number }>> = {
  funk: IconWave,
  lofi: IconTape,
  bass: IconBass,
  nightcore: IconRocket,
  slowed: IconHall,
  vocal: IconMic,
  hall: IconHall,
  night: IconMoon,
};

export function SoundLabView() {
  const preset = useSoundLabStore((s) => s.preset);
  const spatial = useSoundLabStore((s) => s.spatial);
  const orbitPeriod = useSoundLabStore((s) => s.orbitPeriod);
  const webPath = useSoundLabStore((s) => s.webPath);
  const spectrum = useSoundLabStore((s) => s.spectrum);
  const lastEngageError = useSoundLabStore((s) => s.lastEngageError);
  const setPreset = useSoundLabStore((s) => s.setPreset);
  const setSpatial = useSoundLabStore((s) => s.setSpatial);
  const setOrbitPeriod = useSoundLabStore((s) => s.setOrbitPeriod);
  const pollSpectrum = useSoundLabStore((s) => s.pollSpectrum);
  const playing = usePlayerStore((s) => s.playing);
  const current = usePlayerStore((s) => s.current);

  const raf = useRef(0);

  useEffect(() => {
    if (!webPath || !playing) return;
    const tick = () => {
      pollSpectrum();
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [webPath, playing, pollSpectrum]);

  const engineLabel = useMemo(() => {
    if (webPath) return "Web Audio DSP · engaged";
    if (preset !== "off" || spatial)
      return "DSP selected · engages when a track plays";
    return "Off · native engine";
  }, [webPath, preset, spatial]);

  return (
    <div className={styles.view}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Settings · Audio</p>
        <h1 className={styles.title}>Sound Lab</h1>
        <p className={styles.sub}>
          Real Web Audio DSP on the playing signal. Selecting a preset (or 8D)
          rewires the live graph; 8D is an independent spatial layer and stacks
          on top of any preset.
        </p>
        <p className={styles.headphoneHint}>
          <span aria-hidden>🎧</span>
          For the best 8D experience, use headphones — HRTF needs stereo ears.
        </p>
        <p className={styles.engineStatus} data-active={webPath ? "true" : "false"}>
          {engineLabel}
          {current ? ` · ${current.title}` : " · no track"}
        </p>
        {lastEngageError && (
          <p className={styles.errorLine} role="alert">
            Last error: {lastEngageError}
          </p>
        )}
      </header>

      <div className={styles.sectionLabel}>
        <span>Live spectrum (post-DSP)</span>
        <span className={styles.spectrumIdle}>
          {webPath
            ? playing
              ? "AnalyserNode · live"
              : "Web path ready · press play"
            : "Enable a preset or 8D, then play a track"}
        </span>
      </div>
      {webPath ? (
        <div className={styles.spectrumWrap} aria-hidden>
          {spectrum.map((v, i) => (
            <span
              key={i}
              className={styles.spectrumBar}
              style={{ height: `${Math.max(4, v * 100)}%` }}
            />
          ))}
        </div>
      ) : (
        <p className={styles.spectrumIdle}>{engineLabel}</p>
      )}

      <div className={styles.sectionLabel}>
        <span>Presets</span>
        <span className={styles.spectrumIdle}>
          {preset === "off" ? "off" : preset}
          {spatial ? " + 8D" : ""}
        </span>
      </div>
      <div className={styles.grid} role="listbox" aria-label="Sound Lab presets">
        <button
          type="button"
          role="option"
          aria-selected={preset === "off"}
          className={`${styles.card} ${preset === "off" ? styles.cardActive : ""}`}
          onClick={() => void setPreset("off")}
        >
          <span className={styles.cardIcon}>
            <IconSoundLab size={18} />
          </span>
          <span className={styles.cardName}>Off</span>
          <span className={styles.cardTag}>Clean native path</span>
          <span className={styles.cardDetail}>No DSP · rodio engine</span>
        </button>
        {PRESET_CATALOG.map((p) => {
          const Icon = PRESET_ICONS[p.id] ?? IconWave;
          const active = preset === p.id;
          return (
            <button
              key={p.id}
              type="button"
              role="option"
              aria-selected={active}
              className={`${styles.card} ${active ? styles.cardActive : ""}`}
              onClick={() => void setPreset(p.id as SoundLabPresetId)}
            >
              <span className={styles.cardIcon}>
                <Icon size={18} />
              </span>
              <span className={styles.cardName}>{p.name}</span>
              <span className={styles.cardTag}>{p.tagline}</span>
              <span className={styles.cardDetail}>{p.detail}</span>
            </button>
          );
        })}
      </div>

      <div className={styles.sectionLabel}>
        <span>Spatial · 8D</span>
      </div>
      <div className={styles.spatial}>
        <div className={styles.spatialHead}>
          <div className={styles.spatialTitleRow}>
            <span className={styles.cardIcon}>
              <IconOrbit size={18} />
            </span>
            <div>
              <h2 className={styles.spatialTitle}>8D orbit (HRTF)</h2>
              <p className={styles.spatialDesc}>
                PannerNode with HRTF + inverse distance. Source circles your head
                on the XZ plane; a low-pass tracks “behind” you (head shadow) and
                gain dips ±2 dB with depth. Stacks with any preset.
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={spatial}
            aria-label="Enable 8D spatial audio"
            className={`${styles.toggle} ${spatial ? styles.toggleOn : ""}`}
            onClick={() => void setSpatial(!spatial)}
          >
            <span className={styles.toggleKnob} />
          </button>
        </div>
        <div className={styles.orbitRow}>
          <span className={styles.orbitLabel} id="orbit-label">
            Revolution
          </span>
          <input
            className={styles.orbitSlider}
            type="range"
            min={8}
            max={14}
            step={0.5}
            value={orbitPeriod}
            disabled={!spatial}
            aria-labelledby="orbit-label"
            aria-valuetext={`${orbitPeriod} seconds per revolution`}
            onChange={(e) => void setOrbitPeriod(parseFloat(e.target.value))}
          />
          <span className={styles.orbitValue}>{orbitPeriod.toFixed(1)}s</span>
        </div>
      </div>
    </div>
  );
}

export default SoundLabView;

export type SoundLabPresetId =
  | "off"
  | "funk"
  | "lofi"
  | "bass"
  | "nightcore"
  | "slowed"
  | "vocal"
  | "hall"
  | "night";

export type SoundLabState = {
  preset: SoundLabPresetId;
  spatial: boolean;
  /** Seconds per full 8D revolution (8–14). */
  orbitPeriod: number;
  /** True when Web Audio path owns playback (preset ≠ off or spatial). */
  webPath: boolean;
};

export type SoundLabPresetMeta = {
  id: Exclude<SoundLabPresetId, "off">;
  name: string;
  tagline: string;
  /** What actually happens in the DSP graph — shown under the card. */
  detail: string;
};

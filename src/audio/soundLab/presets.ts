import type { SoundLabPresetMeta } from "./types";

export const PRESET_CATALOG: SoundLabPresetMeta[] = [
  {
    id: "funk",
    name: "Funk",
    tagline: "Warm analog punch",
    detail:
      "Soft saturation (WaveShaper) · peaking +4 dB @ 120 Hz · gentle 10 kHz shelf cut · compressor",
  },
  {
    id: "lofi",
    name: "Lo-fi",
    tagline: "Tape + vinyl",
    detail:
      "LPF 5 kHz · vinyl noise loop · 0.5 Hz wow & flutter · bitcrush worklet",
  },
  {
    id: "bass",
    name: "Bass Boost",
    tagline: "Deep low end",
    detail: "Peaking +9 dB @ 80 Hz · safety limiter",
  },
  {
    id: "nightcore",
    name: "Nightcore",
    tagline: "Faster · higher",
    detail: "playbackRate ×1.20 (pitch + tempo together)",
  },
  {
    id: "slowed",
    name: "Slowed + Reverb",
    tagline: "Dreamy stretch",
    detail: "playbackRate ×0.80 · Convolver hall IR · 25% wet",
  },
  {
    id: "vocal",
    name: "Vocal / Podcast",
    tagline: "Clear speech",
    detail: "Peaking +5 dB @ 2.2 kHz · bass cut · leveling compressor",
  },
  {
    id: "hall",
    name: "Concert Hall",
    tagline: "Live space",
    detail: "Convolver hall IR · 28% wet/dry mix",
  },
  {
    id: "night",
    name: "Night Mode",
    tagline: "Quiet-hour clarity",
    detail: "Strong compression + limiter for low-volume detail",
  },
];

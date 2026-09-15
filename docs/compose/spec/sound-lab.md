---
feature: sound-lab
status: delivered
updated: 2026-01-01
branch: main
commits: working-tree
---

# Sound Lab (Real Web Audio DSP + 8D)

## Report

**What was built** — Sound Lab panel (sidebar) with eight real DSP presets and an independent 8D spatial layer. When any preset or 8D is engaged, playback switches from native rodio to an HTMLAudioElement + Web Audio graph: MediaElementSource → preset nodes → HRTF PannerNode (orbit) → safety limiter → AnalyserNode → destination. Preset swaps rebuild the wet chain with ~220ms ramps. Native engine is muted via a non-persisting `set_engine_muted` command so user volume settings are never clobbered.

**Verification** — `npx tsc --noEmit` + `npm run build` pass; `cargo check` passes (protocol-asset feature enabled).

**Journey log** — App playback is rodio, not `<audio>`; MediaElementSource is one-shot per element so the web graph is long-lived. Asset protocol + `protocol-asset` required for `convertFileSrc`. Volume mute must not persist 0.

## [S1] Problem
Need real DSP (not cosmetic UI) on the playing signal, plus true 8D HRTF orbit, with a glass Sound Lab panel.

## [S2] Design
- Engage when `preset ≠ off` OR `spatial`; 8D stacks with any preset.
- Graph: source → [preset] → shadow LPF → Panner(HRTF) → gain → limiter → analyser → dest.
- Presets: funk (sat+EQ+comp), lofi (LPF+vinyl+wow/bitcrush), bass, nightcore (rate 1.2), slowed (0.8+hall IR), vocal, hall, night.
- 8D: orbit 8–14s, head-shadow LPF, ±2 dB depth.
- UI: glass squircle cards, accent glow active, live Analyser spectrum.

## [S3] Out of Scope
Rewriting rodio DSP, user IR import, multi-band visual EQ editor.

## Tasks
- [x] T1: Web Audio engine + presets + 8D orbit (covers: S2)
- [x] T2: soundLabStore + playerStore dual-path routing (covers: S2)
- [x] T3: Sound Lab UI + icons + ViewId registry (covers: S1)
- [x] T4: asset protocol + set_engine_muted + build verify (covers: S2)

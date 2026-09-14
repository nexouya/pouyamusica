---
feature: player-overhaul
status: designed
updated: 2026-09-14
branch: fix/player-overhaul
commits: 
---

# Player overhaul — bug fixes + visual upgrade

## Report

## [S1] Problem
Playback can report “playing” when the engine never loaded the file (load/play are fire-and-forget). Toggle/seek/next can desync UI from the backend. Prev always restarts the previous track instead of restarting the current one after a few seconds. End of library leaves the UI in a weird state. Visually the chrome is flat compared to a premium Liquid Glass player.

## [S2] Design
1. **Confirmed load/play** — `play_track` waits for the audio worker to finish Load (error or success) before Play. Frontend only sets `playing: true` after IPC success.
2. **Truthful transport** — after `togglePlay`, re-read `get_playback_status`. At end of library with repeat off, stop and clear playing. Prev: if `position > 3s`, seek 0; else previous track.
3. **Visual** — deepen glass on player bar and sidebar; accent glow on active cover; richer track-row hover; ambient aura tied to accent; keep existing tokens and reduced-motion.

## [S3] Out of Scope
- Equalizer DSP
- Streaming/cloud
- Figma export

## Tasks
- [ ] T1: Engine load confirmation + play_track wait — acceptance: failed load does not set UI playing (covers: S2.1)
- [ ] T2: Transport UX fixes (toggle sync, prev restart, end stop) — acceptance: behaviors match S2.2 (covers: S2.2)
- [ ] T3: Visual depth pass on player/sidebar/rows/aura — acceptance: screenshots show richer chrome at 1280 (covers: S2.3)
- [ ] T4: Rebuild + QA — acceptance: tsc+build pass; app plays D:\\a track (covers: S2; depends: T1–T3)

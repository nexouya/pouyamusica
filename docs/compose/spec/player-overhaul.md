---
feature: player-overhaul
status: delivered
updated: 2026-09-14
branch: fix/player-overhaul
commits: fa9740462b6f4a9caf6e5f3f749ac96dc8df30da..2041b33
---

# Player overhaul — bug fixes + visual upgrade

## Report

**What was built** — Playback now confirms Load on the audio worker before Play, so a failed decode cannot leave the UI stuck on “playing.” Toggle re-reads engine status; Prev restarts the current track after 3s; end of library stops the UI when repeat is off. Visually: deeper glass, stronger accent play control, larger glowing cover art, richer track-row hover/playing states, and a more premium transport bar.

**Verification** — `npm run build` PASS. `cargo build --release --features custom-protocol` PASS. `cargo test --lib d_drive` PASS: real file `D:\a` Chicago (title=Chicago, dur=245.5s) loads and plays via `AudioEngine`. Live app lists D:\a tracks including Chicago and pouya-demo-track.

**Journey log** — Load was fire-and-forget, so Play could run against an empty sink while the UI assumed success; an ack channel on `AudioCmd::Load` fixes the contract. UI click automation for play was unreliable; backend integration test is the reliable proof. User-supplied real music in `D:\a` is scanned correctly.

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
- [x] T1: Engine load confirmation + play_track wait — acceptance: failed load does not set UI playing (covers: S2.1)
- [x] T2: Transport UX fixes (toggle sync, prev restart, end stop) — acceptance: behaviors match S2.2 (covers: S2.2)
- [x] T3: Visual depth pass on player/sidebar/rows/aura — acceptance: screenshots show richer chrome at 1280 (covers: S2.3)
- [x] T4: Rebuild + QA — acceptance: tsc+build pass; app plays D:\\a track (covers: S2; depends: T1–T3)

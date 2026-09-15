---
feature: debug-sweep
status: delivered
updated: 2026-09-15
branch: feature/debug-sweep
commits: 3e1569e..5e7c7bd
---

# Debug Sweep

## Report

**What was built** — A full debug pass over pouya music that keeps the Liquid Glass visual system intact while fixing critical and major functional bugs. The backend now registers `get_playlist`, retargets the folder watcher when the music root changes, tags scans with a generation so stale results cannot overwrite a newer library, reports real errors when no audio device exists, reloads the last track after device recovery, clamps seeks past EOF, stores duration as f64, writes settings/playlists atomically under a playlist mutex, restores intentional mute and the last track on startup, and uses a proper dialog path API. The frontend owns a real play-context queue (playlist / liked / library), stops native progress from fighting Sound Lab, actually pauses at end-of-queue, fails loudly on bad files, feeds web spectrum into FocusMode/AmbientAura, likes the correct hero track, and stops lying about EQ DSP.

**Verification** —
- `cargo check --lib` — PASS
- `cargo test --lib` — PASS (5 tests)
- `npx tsc --noEmit` — PASS
- `npm run build` — PASS
- Independent review of `3e1569e..9ddd30b` — request-changes; 4 majors fixed in `5e7c7bd` and re-verified

**Journey log** —
1. Folder was not a git repo; initialized with a baseline commit and worked on `feature/debug-sweep`.
2. Dual audit (backend + frontend) surfaced ~30 concrete bugs; criticals clustered around queue ownership, Sound Lab vs native progress, and silent device failures.
3. Review correctly caught half-done mute persistence (backend fixed, FE still stomped to 0.8), missing last_track restore, debounce TOCTOU, and backend next_track wrap.
4. `set_engine_muted(false)` still maps intentional session mute 0 → 0.8 on Sound Lab handoff (product call left as-is for audible unmute UX).
5. Graphics were intentionally not redesigned; only broken visual state (volume thrash, frozen visualizer, false EQ copy) was corrected.

## [S1] Problem

pouya music looks polished but is functionally unreliable: playback state fights Sound Lab, playlist “play next” walks the whole library, folder pick stops live updates, several IPC endpoints are dead or lying, and the backend can silently fail (no audio device, seek past EOF, non-atomic settings). Graphics stay as-is; this pass only fixes real bugs (including graphical bugs that break usability).

## [S2] Design

### Scope
- Fix all **critical** and **major** findings from backend + frontend audits.
- Do **not** redesign the Liquid Glass visual system, layout, or motion.
- Graphical fixes only when they are broken state (frozen visualizer, volume slider stomped to 0, fake EQ “Processing Active”, Space double-fire).

### Contracts

#### IPC surface
- Register `commands::get_playlist` in `generate_handler!`.
- `pick_folder` uses dialog `FilePath` path API (`into_path`), not string URL munging.
- `next_track`/`prev_track` resolve from `state.queue` when non-empty, else library; end of queue stops (no wrap).
- `play_track` updates `current_index` against the active queue.
- `set_engine_muted(false)` restores the **session** user volume.
- Heavy commands (`get_waveform`, `scan_library`, `read_audio_b64`) run via `async` + `spawn_blocking`.

#### Audio engine
- Store duration as f64 bits in `AtomicU64`.
- Clamp seek to `[0, max(duration-ε, 0)]`.
- When no output device: Play/Toggle/Seek return an error (never silent success).
- On device recovery, reload `current_path` paused at last known position.
- Watcher ownership lives in `AppState`; `set_music_root` drops/restarts the watcher.
- Scan results are generation-tagged; stale scans must not overwrite a newer root.
- Folder-watch debounce re-arms after unpending if dirty (no trailing-event drop).

#### Settings / playlists
- Atomic write: unique temp file + rename for `settings.json` and `playlists.json`.
- Process-wide mutex around playlist load-modify-save.
- Persist intentional mute: volume 0 is valid; no force-rewrites to 0.8.
- Restore `last_track` into engine (paused) and UI metadata on startup.
- Env-gate machine-local audio tests (`POUYA_TEST_AUDIO_DIR`).

#### Frontend transport
- `playerStore` owns an ordered **play context** (`queue: TrackMeta[]`).
- `playTrack` does **not** overwrite a playlist/liked queue with the full library.
- `next`/`prev`/QueuePanel/end-of-list use the play context.
- `next` on last track (repeat off) **pauses** native/web audio.
- `playTrack` IPC failure → `playing: false`, error surfaced.
- Sound Lab prev-restart does not toggle-pause after seek-0.
- `useAppEvents` ignores native `playback-progress` while `webPath` is true.
- Volume changes always persist user volume even when web path owns output.
- Web spectrum feeds `updateAudioVisualData`.
- Home hero heart likes the hero track path.
- TrackRow Space stops propagation; global shortcuts ignore form controls.
- Playlist UI move uses path-based move with raw playlist indices.
- EQ modal: same visuals; does not claim DSP is active when it is not.

#### CSP
- `connect-src 'self' asset: http://asset.localhost ipc: http://ipc.localhost`.

### Out of scope
- Visual redesign, new glass layers, layout changes.
- Full parametric EQ DSP implementation on native rodio.
- Streaming, cloud, mobile.
- Tightening asset-protocol allowlist beyond CSP connect-src.

## [S3] Out of Scope
- Mobile, streaming services, DRM.
- Redesign of Liquid Glass / squircle / motion.
- Full native EQ DSP.

## Tasks
- [x] T1: Register missing IPC + fix pick_folder path API — acceptance: `get_playlist` in handler; folder pick sets a real OS path (covers: S2 IPC)
- [x] T2: Watcher re-target + scan generation + debounce trailing event — acceptance: set_music_root rewatches new root; stale scan ignored (covers: S2 engine)
- [x] T3: Audio device errors + recovery reload + seek clamp + duration f64 — acceptance: no silent play failure; seek past EOF does not auto-skip (covers: S2 engine)
- [x] T4: Atomic settings/playlists + mute persist + session volume restore — acceptance: mute survives restart; unmute restores session volume (covers: S2 settings)
- [x] T5: Queue ownership end-to-end — acceptance: playlist play advances in playlist order; QueuePanel shows context (covers: S2 transport)
- [x] T6: Sound Lab vs native progress + volume + spectrum bus — acceptance: no UI thrash under DSP; visualizer moves (covers: S2 transport)
- [x] T7: Transport edge cases — acceptance: last-track next pauses; failed load not playing; prev restart works (covers: S2 transport)
- [x] T8: UI honesty / input bugs — acceptance: hero like correct; Space single-fire; EQ no false “Processing Active”; playlist index map (covers: S2 frontend)
- [x] T9: CSP connect-src + env-gate tests + async heavy IPC — acceptance: asset fetch allowed; cargo test portable (covers: S2)
- [x] T10: Verify builds/tests + review + finalize — acceptance: cargo check/test + tsc + vite build PASS (covers: S2)

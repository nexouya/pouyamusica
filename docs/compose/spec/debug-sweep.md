---
feature: debug-sweep
status: designed
updated: 2026-09-15
branch: feature/debug-sweep
commits: 3e1569e..HEAD
---

# Debug Sweep

## Report

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
- `pick_folder` uses dialog `FilePath` path API (`as_path`/`into_path`), not string URL munging.
- `next_track`/`prev_track` resolve from `state.queue` when non-empty, else library.
- `play_track` updates `current_index` against the active queue when present.
- `set_engine_muted(false)` restores the **session** user volume (not a stale settings-file rewrite of 0).
- Heavy commands (`get_waveform`, `scan_library`, `read_audio_b64`) run via `async` + `spawn_blocking`.

#### Audio engine
- Store duration as f64 bits in `AtomicU64`.
- Clamp seek to `[0, max(duration-ε, 0)]`.
- When no output device: Play/Toggle/Seek return an error (never silent success).
- On device recovery, reload `current_path` (paused at last known position if possible).
- Watcher ownership lives in `AppState`; `set_music_root` drops/restarts the watcher.
- Scan results are generation-tagged; stale scans must not overwrite a newer root.
- Folder-watch debounce must not drop the trailing event (re-scan once more if dirty).

#### Settings / playlists
- Atomic write: temp file + rename for `settings.json` and `playlists.json`.
- Process-wide mutex around playlist load-modify-save.
- Persist intentional mute: stop force-rewriting `volume <= 0` to 0.8; default only when field missing.
- Restore `last_track` into UI metadata on startup (loaded, not autoplayed).
- Env-gate machine-local audio tests (`POUYA_TEST_AUDIO_DIR`); drop hardcoded `D:\a`.

#### Frontend transport
- `playerStore` owns an ordered **play context** (`queue: TrackMeta[]` + source).
- `playTrack` does **not** overwrite a playlist/liked queue with the full library.
- `next`/`prev`/QueuePanel/end-of-list use the play context.
- `next` on last track (repeat off) **pauses** native/web audio, not just UI flag.
- `playTrack` IPC failure → `playing: false`, error surfaced, track not claimed as playing.
- Sound Lab prev-restart uses `playWeb()` when not playing — never `webTogglePlay()` after seek-0.
- `useAppEvents` ignores native `playback-progress` while `soundLabStore.webPath` is true.
- Volume changes always persist user volume even when web path owns output.
- Web spectrum feeds `updateAudioVisualData` so FocusMode/AmbientAura move under DSP.
- Home hero heart likes the hero track path, not `current`.
- TrackRow Space stops propagation; global shortcuts ignore defaultPrevented / form controls.
- Playlist UI move indices map back to raw playlist indices (handle missing library paths).
- EQ modal: same visuals; do not claim DSP is active when it is not applied.

#### CSP
- Add `connect-src 'self' asset: http://asset.localhost` so Sound Lab can fetch asset URLs.

### Out of scope
- Visual redesign, new glass layers, layout changes.
- Full parametric EQ DSP implementation on native rodio.
- Streaming, cloud, mobile.
- Tightening asset-protocol allowlist beyond CSP connect-src (security follow-up).

## [S3] Out of Scope
- Mobile, streaming services, DRM.
- Redesign of Liquid Glass / squircle / motion.
- Full native EQ DSP.

## Tasks
- [ ] T1: Register missing IPC + fix pick_folder path API — acceptance: `get_playlist` in handler; folder pick sets a real OS path (covers: S2 IPC)
- [ ] T2: Watcher re-target + scan generation + debounce trailing event — acceptance: set_music_root rewatches new root; stale scan ignored (covers: S2 engine)
- [ ] T3: Audio device errors + recovery reload + seek clamp + duration f64 — acceptance: no silent play failure; seek past EOF does not auto-skip (covers: S2 engine)
- [ ] T4: Atomic settings/playlists + mute persist + session volume restore — acceptance: mute survives restart; unmute restores session volume (covers: S2 settings)
- [ ] T5: Queue ownership end-to-end — acceptance: playlist play advances in playlist order; QueuePanel shows context (covers: S2 transport)
- [ ] T6: Sound Lab vs native progress + volume + spectrum bus — acceptance: no UI thrash under DSP; visualizer moves (covers: S2 transport)
- [ ] T7: Transport edge cases — acceptance: last-track next pauses; failed load not playing; prev restart works (covers: S2 transport)
- [ ] T8: UI honesty / input bugs — acceptance: hero like correct; Space single-fire; EQ no false “Processing Active”; playlist index map (covers: S2 frontend)
- [ ] T9: CSP connect-src + env-gate tests + async heavy IPC — acceptance: asset fetch allowed; cargo test portable (covers: S2)
- [ ] T10: Verify builds/tests + review + finalize — acceptance: cargo check/test + tsc + vite build PASS (covers: S2)

---
feature: pouya-music
status: delivered
updated: 2026-09-13
branch: feature/pouya-music
commits: 72cb5e0..HEAD
---

# pouya music

## Report

**What was built** — pouya music is a Tauri v2 + React 18 Liquid Glass music player with a modular feature registry. Frontend features live under `src/features/*` and register via `src/core/features/registry.ts`; App + Sidebar consume the registry automatically. IPC is a typed facade in `src/core/api`; Tauri events fan out from `src/core/events/useAppEvents.ts`. Rust commands are split into `commands/{library,playback,system}.rs` with settings persistence (`settings.json`) and a debounced notify watcher. UI includes hero now-playing, single-line track list, floating player (waveform seek), focus mode, and responsive breakpoints.

**Verification** —
- `npm run build` — PASS
- `cargo check` / `cargo test --lib` — PASS (2 tests)
- App process: title `pouya music`, Responding=True
- Screenshot QA: player not clipped; single-line rows; readable titles
- Review: no criticals; majors fixed (engine-error emit, set_queue sync, saved-root preference)

**Journey log** —
1. rodio 0.20 yields `i16` — SampleTap mono for FFT.
2. `OutputStream` !Send — dedicated audio thread + channel.
3. objectBoundingBox squircle on tall panels → oval; removed for standard border-radius.
4. Player 80px clipped seek → 104px flex layout.
5. Grid 5-col / 6 children wrapped duration — switched to flex single-line rows.

## [S1] Problem

Build a production-quality Windows music player named **pouya music** that feels like a studio product, not AI slop. The visual system is Liquid Glass: multi-layer material, dynamic accent from album art, custom squircle geometry, spring-physics motion, real FFT visualizer.

Amendment: harden the backend (persistence, folder watch, robust transport) and raise glass/animation/responsive polish; hunt and fix remaining graphic bugs via screenshot QA.

## [S2] Design

### Stack
- Frontend: React 18 + TypeScript + Vite, CSS Modules + CSS custom properties, Framer Motion (spring), Zustand, Canvas 2D visualizer
- Backend: Tauri v2 (Rust), rodio+symphonia playback, rustfft live analysis, lofty metadata, image+k-means color extraction, notify folder watch, window-vibrancy Acrylic/Mica
- Window: decorations=false, transparent=true, min 1024×640

### Liquid Glass material (4 layers)
1. Base blur: `backdrop-filter: blur(28px) saturate(180%) brightness(1.05)` + `rgba(255,255,255,0.055)`
2. Edge refraction: SVG overlay on player bar (refraction prop)
3. Dynamic tint: gradient from `--accent-dynamic` (cover art k-means), opacity 0.08
4. Light/edge: inset highlight + outer shadow + accent glow; pointer-parallax highlight (max 6px)

### Geometry
- Superellipse squircle clipPath (`#squircle-soft` / `#squircle-clip`) on glass panels and album cards
- Player bar: full pill; titlebar: no clip

### Color tokens
| Token | Value |
|---|---|
| --bg-base | #0A0D12 |
| --accent-dynamic | dynamic from cover |
| --danger / --success | #FF6B6B / #4ADE80 |

### Audio & visualizer
- Commands: play, pause, seek, set_volume, load_track, play_track, get_library, get_waveform, get_color_palette, find_demo_library, …
- Events: fft-data (32 bands), playback-progress (250ms), playback-ended (once per track), library-updated, track-changed
- Ended latch: audio thread `recv_timeout` + `sink.empty()` → `mark_ended()` → single event

### Transport
- Frontend owns next/prev with shuffle + repeat off/all/one
- `track-changed` adopts metadata only (no second IPC load)

## [S3] Out of Scope
- Mobile / Android
- Streaming services
- Full parametric EQ DSP
- DRM / cloud sync

## [S4] Hardening & polish (amendment)

### Backend contracts
- Persist `liked`, `music_root`, `volume` to `dirs::config_dir()/pouya-music/settings.json`
- `notify` watcher on music root → emit `library-updated` (debounced ~300ms)
- `engine-error` Tauri event for load/play failures (never silent)
- Transport: edge-triggered end, wall-clock position only while playing, seek rebuild with autoplay preserved
- `set_queue` stored and used for next-when-shuffle-off beyond library order (fallback library)

### Frontend glass / motion / responsive
- Glass: blur + tint + edge only; no large circular highlight (oval artifact)
- Motion: springs on primary controls; view crossfade blur/y; staggered lists; `prefers-reduced-motion` respected
- Responsive: min window 1024×640; sidebar 240; hide album column & simplify player meta under ~1180px; player height 104
- Active track: white title + accent rail; accent brightened for text contrast

## Tasks
- [x] T1: Workspace + scaffold — acceptance: worktree, deps (covers: S2 stack)
- [x] T2: Spec document — acceptance: this file (covers: S2)
- [x] T3: Demo album art + sample audio — acceptance: demo-library/ assets (covers: S2 color)
- [x] T4: Rust audio engine, FFT, library, commands — acceptance: cargo check/test PASS (covers: S2 audio)
- [x] T5: Frontend Liquid Glass UI — acceptance: npm run build PASS (covers: S2 material/layout)
- [x] T6: Build, run, verify + review fixes — acceptance: app launches; end/shuffle/repeat fixed (covers: S2)
- [x] T7: Amend spec for harden+polish — acceptance: S4 present (covers: S4)
- [x] T8: Backend persist + watch + engine-error — acceptance: cargo test PASS; settings.json path (covers: S4 backend)
- [x] T9: Glass/motion/responsive polish — acceptance: npm build PASS; CSS breakpoints (covers: S4 frontend)
- [x] T10: Screenshot QA fixes — acceptance: debug captures clean (covers: S4)
- [x] T11: Verify + review + finalize — acceptance: builds PASS; review criticals none (covers: S4)
- [x] T12: Modular feature registry + domain commands — acceptance: ARCHITECTURE.md; registry-driven App (covers: S4 modularity)

---
feature: standalone-packaging
status: designed
updated: 2026-09-14
branch: fix/standalone-packaging
commits: 
---

# Standalone packaging + crash hardening

## Report

## [S1] Problem
The shipped `pouya-music.exe` opens a window but the WebView loads `http://localhost:1420`. Without a separate Vite server the UI is an error page. Users must run `npm run dev` for the app to appear usable, and prior sessions reported frequent crashes. The binary was not a self-contained production build.

## [S2] Design
1. **Production assets embedded** — `npm run tauri build` (not bare `cargo build`) must produce an exe that serves `../dist` via Tauri's custom protocol. `Cargo.toml` enables `custom-protocol` so release builds do not fall back to `devUrl`. Vite `base` stays `/` which is correct for Tauri asset protocol.
2. **No hard panic on audio init** — `AppState::new` and `AudioEngine` must start even when the default output device is missing or fails. The audio worker thread records failure and rejects playback commands instead of panicking the process.
3. **Clean entrypoint** — `main.rs` uses `windows_subsystem = "windows"` for release, logs panics to an app-data path (not CWD), and does not leave ad-hoc debug files as the only diagnostics.
4. **Single documented run path** — README: dev = `npm run tauri dev`; standalone = `npm run tauri build` then run the release exe.

## [S3] Out of Scope
- UI redesign
- Playlist/library feature changes
- Code signing / MSI polish beyond default Tauri bundler output
- Fixing unrelated React warnings

## Tasks
- [ ] T1: Enable production custom-protocol and document build path — acceptance: release build config no longer depends on Vite at runtime (covers: S2.1, S2.4)
- [ ] T2: Harden audio init and remove fatal expects in startup path — acceptance: app process starts and shows UI even if audio device init fails (covers: S2.2, S2.3)
- [ ] T3: Clean main/lib debug logging for production — acceptance: no CWD log spam; panic hook writes under app data (covers: S2.3)
- [ ] T4: Rebuild release and verify standalone UI without Vite — acceptance: kill Vite, launch release exe, UI loads Home with tracks (covers: S2.1; depends: T1, T2, T3)

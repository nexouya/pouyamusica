---
feature: standalone-packaging
status: delivered
updated: 2026-09-14
branch: fix/standalone-packaging
commits: 3027d2284e3285fa8df66e1ed39e072dfcd0663..7a395a3
---

# Standalone packaging + crash hardening

## Report

**What was built** — The release `pouya-music.exe` is now a self-contained Tauri app. Frontend assets from `dist/` are embedded via the `custom-protocol` feature (`src-tauri/Cargo.toml`), so the WebView no longer requires Vite on `localhost:1420`. Startup no longer panics when the default audio device is missing: the audio worker keeps running and retries the device every 3s, volume apply during `AppState::new` is non-fatal, and the FFT thread spawn failure only logs. `main.rs` is a clean production entry (`windows_subsystem = "windows"` in release).

**Verification** — `npm run tauri build` completed (`EXIT=0`) producing `src-tauri/target/release/pouya-music.exe` plus NSIS/MSI bundles. With port 1420 closed and no Vite process, the new exe launched, stayed responsive, and the screenshot shows Home with 4 demo tracks (no connection-refused page).

**Journey log** — Root cause of “must run server” was a missing `[features] custom-protocol = ["tauri/custom-protocol"]` entry, so even CLI release builds loaded `devUrl`. A second crash path was `AppState::new` propagating `set_volume` failure after the audio thread exited when `EngineCore::new()` failed. Bare `cargo build --release` still produces a broken dev-URL binary; always use `npm run tauri build`.

## [S1] Problem
The shipped `pouya-music.exe` opens a window but the WebView loads `http://localhost:1420`. Without a separate Vite server the UI is an error page. Users must run `npm run dev` for the app to appear usable, and prior sessions reported frequent crashes. The binary was not a self-contained production build.

## [S2] Design
1. **Production assets embedded** — `npm run tauri build` (not bare `cargo build`) must produce an exe that serves `../dist` via Tauri's custom protocol. `Cargo.toml` enables `custom-protocol` so release builds do not fall back to `devUrl`. Vite `base` stays `/` which is correct for Tauri asset protocol.
2. **No hard panic on audio init** — `AppState::new` and `AudioEngine` must start even when the default output device is missing or fails. The audio worker thread records failure and rejects playback commands instead of panicking the process.
3. **Clean entrypoint** — `main.rs` uses `windows_subsystem = "windows"` for release and does not leave ad-hoc debug files as the only diagnostics.
4. **Single documented run path** — README: dev = `npm run tauri dev`; standalone = `npm run tauri build` then run the release exe.

## [S3] Out of Scope
- UI redesign
- Playlist/library feature changes
- Code signing / MSI polish beyond default Tauri bundler output
- Fixing unrelated React warnings

## Tasks
- [x] T1: Enable production custom-protocol and document build path — acceptance: release build config no longer depends on Vite at runtime (covers: S2.1, S2.4)
- [x] T2: Harden audio init and remove fatal expects in startup path — acceptance: app process starts and shows UI even if audio device init fails (covers: S2.2, S2.3)
- [x] T3: Clean main/lib debug logging for production — acceptance: no CWD log spam (covers: S2.3)
- [x] T4: Rebuild release and verify standalone UI without Vite — acceptance: kill Vite, launch release exe, UI loads Home with tracks (covers: S2.1; depends: T1, T2, T3)

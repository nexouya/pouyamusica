# pouya music — full source

Tauri v2 + React Liquid Glass music player.

## Run (development)

```bash
npm install
npm run tauri dev
```

This starts Vite on port 1420 and opens the Tauri window against that dev server.

## Build (standalone — no Vite required)

```bash
npm install
npm run tauri build
```

Produces a self-contained binary under `src-tauri/target/release/` (and a Windows installer under `src-tauri/target/release/bundle/`). The frontend is embedded via Tauri's custom protocol — **do not** run the exe from a bare `cargo build --release` without the `custom-protocol` feature, or the WebView will try `http://localhost:1420`.

## Requirements

- Node.js 18+
- Rust toolchain (stable)
- Windows 10/11 (primary target)

## Notes

- Demo tracks: `demo-library/` (auto-used if no music folder saved)
- App data (playlists, liked, volume) is stored in `%APPDATA%/pouya-music/`
- Architecture guide: `ARCHITECTURE.md`
- Feature specs: `docs/compose/spec/`

## Not included (by design)

- `node_modules/` — run `npm install`
- `src-tauri/target/` — cargo build output
- `dist/` — vite build output (created by `npm run build` / `tauri build`)

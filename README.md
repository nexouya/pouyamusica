# pouya music — full source

Tauri v2 + React 18 Liquid Glass music player.

## Run

```bash
npm install
npm run tauri dev
```

## Requirements
- Node.js 18+
- Rust toolchain (stable)
- Windows 10/11 (primary target)

## Notes
- Demo tracks: `demo-library/` (auto-used if no music folder saved)
- App data (playlists, liked, volume) is stored in `%APPDATA%/pouya-music/`
- Architecture guide: `ARCHITECTURE.md`
- Feature spec: `docs/compose/spec/pouya-music.md`

## Not included (by design)
- `node_modules/` — run `npm install`
- `src-tauri/target/` — cargo build output
- `dist/` — vite build output

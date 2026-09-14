# pouya music — architecture

## How to add a feature

### 1. Frontend view (drop-in)
1. Create `src/features/<name>/index.tsx` exporting a default React component.
2. Register in `src/core/features/registry.ts`:
   ```ts
   { id: "my-feature", label: "My Feature", Icon: IconHome, component: MyFeature }
   ```
3. Done — sidebar, view switching, and AnimatePresence pick it up automatically.

### 2. Frontend store slice
- Create `src/stores/<name>Store.ts` with zustand.
- Compose in components via hooks; no global root reducer needed.

### 3. Frontend IPC
- Add methods to `src/core/api/index.ts` (typed `invoke` wrappers).
- Listen to events in `src/core/events/useAppEvents.ts` or a feature hook.

### 4. Rust backend command
1. Implement in `src-tauri/src/commands/<domain>.rs`.
2. Re-export from `src-tauri/src/commands/mod.rs`.
3. Register in `src-tauri/src/lib.rs` `generate_handler![]`.

### 5. Persisted settings
- Add fields to `AppSettings` in `src-tauri/src/settings.rs` (serde default).
- Call `state.persist()` after mutation.

## Layers
```
src/features/*     product surfaces (views)
src/components/*   shared UI primitives
src/stores/*       state slices
src/core/api       typed IPC
src/core/events    Tauri event wiring
src/styles/*       tokens + glass material
src-tauri/src/audio    playback + FFT
src-tauri/src/library  scan + palette
src-tauri/src/commands domain IPC surface
src-tauri/src/settings JSON persistence
```


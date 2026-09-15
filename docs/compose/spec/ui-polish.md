---
feature: ui-polish
status: delivered
updated: 2026-09-14
branch: fix/ui-polish
commits: 80a813a47d7df5facbf4204edb342a185abd8c79..e1bfa16
---

# UI polish — graphics, motion, responsiveness

## Report

**What was built** — Polished the Liquid Glass player without inventing a second design system. Framer motion now respects OS reduced-motion (`MotionConfig reducedMotion="user"`); infinite logo spin removed; view switches use opacity/y only (no blur filter). Below 1180px the sidebar becomes an icon rail and the player bar tightens so transport stays usable at the Tauri min size (1024×640). Library errors render in a dismissible banner; empty library CTA uses the accent primary button; track rows get focus-visible rings; path badges ellipsize instead of wrapping.

**Verification** — `npm run build` (tsc + vite) PASS. `cargo build --release --features custom-protocol` PASS. Live process: window title “pouya music”, Responding, screenshots at 1296×788 and 1040×680 show Home + 3 tracks, no horizontal overflow; 1024 width shows icon-only sidebar.

**Journey log** — Figma MCP is not connected in this environment, so all work stayed in code against existing tokens. Bare `cargo build --release` still omits assets — always pass `--features custom-protocol` or use `npm run tauri build`. Windows Task View overlay can appear in screenshots and is not an app bug.

## [S1] Problem
The player looks finished at 1280×800 but degrades and feels rough elsewhere: fixed sidebar/player widths crush the transport at the 1024px min window; framer-motion still animates when the OS asks for reduced motion; infinite logo spin and view-enter `filter: blur` feel cheap/expensive; empty/error states are low-contrast text-only; hover/focus affordances are inconsistent across track rows vs player controls.

## [S2] Design
Stay inside the existing Liquid Glass system (`tokens.css`, `glass.css`, General Sans + JetBrains Mono, accent `#7C9CFF`). No second visual language.

1. **Motion** — wrap the app in framer `MotionConfig reducedMotion="user"`. Drop infinite logo spin. Soften view transitions (opacity + small y, no blur filter). Prefer `--ease-out` / existing spring tokens.
2. **Responsive chrome** — sidebar collapses to icon rail (~72px) below ~1180px; player bar stacks cleanly (meta ellipsis, transport always visible, tools hide progressively). Match Tauri `minWidth: 1024`.
3. **Layout bugs** — ensure view host scrolls, no horizontal overflow, path badge ellipsis. Dismissible error banner.
4. **States** — empty library CTA uses primary accent button; loading spinner respects reduced motion; track rows share hover/active/playing language + focus-visible.

## [S3] Out of Scope
- Figma file work (MCP not connected)
- Backend/audio changes
- Full mobile layout (desktop Tauri window only)

## Tasks
- [x] T1: MotionConfig + remove infinite spin + cheaper view enter — acceptance: reduced-motion user disables decorative motion; no blur filter on view change (covers: S2.1)
- [x] T2: Sidebar icon-rail + player bar breakpoints at 1024–1180 — acceptance: transport and play button remain clickable; no horizontal scroll (covers: S2.2)
- [x] T3: Empty/error CTA polish + dismissible error banner — acceptance: empty home has accent Choose folder button; errors dismissible (covers: S2.3, S2.4)
- [x] T4: Row/control hover-focus consistency + scroll containers — acceptance: focus-visible rings on interactive rows/actions; view content scrolls under player (covers: S2.3, S2.4)
- [x] T5: Rebuild + screenshot QA at 1280 and ~1024 widths — acceptance: screenshots show no overflow; process stays up (covers: S2; depends: T1–T4)

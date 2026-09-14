---
feature: ui-polish
status: designed
updated: 2026-09-14
branch: fix/ui-polish
commits: 
---

# UI polish — graphics, motion, responsiveness

## Report

## [S1] Problem
The player looks finished at 1280×800 but degrades and feels rough elsewhere: fixed sidebar/player widths crush the transport at the 1024px min window; framer-motion still animates when the OS asks for reduced motion; infinite logo spin and view-enter `filter: blur` feel cheap/expensive; empty/error states are low-contrast text-only; hover/focus affordances are inconsistent across track rows vs player controls.

## [S2] Design
Stay inside the existing Liquid Glass system (`tokens.css`, `glass.css`, General Sans + JetBrains Mono, accent `#7C9CFF`). No second visual language.

1. **Motion** — wrap the app in framer `MotionConfig reducedMotion="user"`. Drop infinite logo spin. Soften view transitions (opacity + small y, no blur filter). EQ bars and loaders already have CSS reduced-motion; keep them. Prefer `--ease-out` / existing spring tokens.
2. **Responsive chrome** — sidebar collapses to icon rail (~72px) below ~1180px; player bar stacks cleanly (meta ellipsis, transport always visible, tools hide progressively). Match Tauri `minWidth: 1024`.
3. **Layout bugs** — ensure view host scrolls, no horizontal overflow, hero chips wrap, path badge wraps without breaking stats. Clear library error with dismissible banner (not permanent red strip).
4. **States** — empty library CTA uses primary accent button; loading spinner respects reduced motion; track rows share one hover/active/playing language.

## [S3] Out of Scope
- Figma file work (MCP not connected)
- Backend/audio changes
- Full mobile layout (desktop Tauri window only)

## Tasks
- [ ] T1: MotionConfig + remove infinite spin + cheaper view enter — acceptance: reduced-motion user disables decorative motion; no blur filter on view change (covers: S2.1)
- [ ] T2: Sidebar icon-rail + player bar breakpoints at 1024–1180 — acceptance: transport and play button remain clickable; no horizontal scroll (covers: S2.2)
- [ ] T3: Empty/error CTA polish + dismissible error banner — acceptance: empty home has accent Choose folder button; errors dismissible (covers: S2.3, S2.4)
- [ ] T4: Row/control hover-focus consistency + scroll containers — acceptance: focus-visible rings on all interactive chrome; view content scrolls under player (covers: S2.3, S2.4)
- [ ] T5: Rebuild + screenshot QA at 1280 and ~1024 widths — acceptance: screenshots show no overflow; process stays up (covers: S2; depends: T1–T4)

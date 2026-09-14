---
feature: graphics-polish
status: delivered
updated: 2026-01-01
branch: main
commits: working-tree
---

# Graphics Polish (Bugfix + Token Upgrade)

## Report

**What was built** — Upgraded Pouya Music’s liquid-glass UI without changing architecture or playback logic. Replaced Unicode `♪`/`↑`/`↓`/`✕` icons with SVG, tokenized remaining hardcoded colors, raised text contrast, enlarged transport/control hit targets, fixed broken-image empty-cover states, and hardened a11y (Escape close, `role=switch`, volume labels, focus rings, reduced-motion).

**Verification** — `npx tsc --noEmit` pass; `npm run build` pass (478 modules, no errors).

**Journey log** — Design-system search returned a generic entertainment/green/Righteous palette that does not fit this desktop liquid-glass player; kept existing General Sans + dynamic accent and applied only UX/a11y rules. No Tailwind/shadcn introduction (stack is CSS Modules).

## [S1] Problem
Graphical/a11y defects made the player look unprofessional: Unicode fallback glyphs, low-contrast tertiary text, undersized transport targets, broken empty-cover images, missing modal keyboard close, and scattered hardcoded hex values.

## [S2] Design
- Keep liquid-glass identity (glass.css, AmbientAura, dynamic accent).
- Three-layer tokens in `src/styles/tokens.css` (primitive already present; added semantic surface/on-accent/focus/danger-soft/windows-close).
- SVG-only structural icons in `src/components/icons/Icons.tsx`.
- Existing-codebase mode: no second visual language.

## [S3] Out of Scope
- Backend/Rust audio, new features, Tailwind/shadcn migration, light theme, PPT/banner assets.

## Tasks
- [x] T1: Token contrast + semantic tokens — acceptance: tertiary ≥ ~0.48 white, tokens used for solid/on-accent (covers: S2)
- [x] T2: SVG music/chevron/plus/close icons replace Unicode — acceptance: no ♪↑↓✕ in src (covers: S2)
- [x] T3: Empty cover fallbacks (Home/Queue/Playlists/Sidebar) — acceptance: no `src=undefined` img (covers: S1)
- [x] T4: Hit targets + player height token — acceptance: transport ≥32–44px, player-height 76 (covers: S1)
- [x] T5: A11y (EQ Escape, switch role, volume labels, focus ring token) — acceptance: dialog + switch semantics (covers: S1)
- [x] T6: Build verify — acceptance: tsc + vite build clean (covers: S1)

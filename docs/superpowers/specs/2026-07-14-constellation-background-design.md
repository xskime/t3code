# Animated Constellation Background — Design

**Date:** 2026-07-14
**Status:** Approved (Isaac, via prototype artifact claude.ai/code/artifact/d1fa17df-3e89-42d1-ba34-ec47ec3401ae; settings JSON supplied 2026-07-14)
**Scope:** A shared canvas starfield background on the app's idle surfaces — SplashScreen, the no-active-thread empty state, and the pairing screen. One React component in `apps/web`; the desktop apps ship the same bundle, so mac/Windows/web are automatically consistent.

## Behavior (locked by prototype settings)

```json
{
  "starCount": 190,
  "driftSpeed": 8,
  "twinkleAmount": 0.55,
  "starSize": 1.3,
  "shooterGapSeconds": [3, 15],
  "shooterMax": 2
}
```

- Three parallax depth layers (z 0.35 / 0.65 / 1.0, shares 45/35/20%): far stars smaller, dimmer, slower. Global drift up-right (angle −π/5) at 8 px/s for the nearest layer; stars wrap at edges.
- Twinkle: per-star random phase and period (0.3–1.2 cycles/s), modulation depth 0.55 — never synchronized.
- Shooting stars: fly opposite the drift (+π, ±0.35 rad jitter), 420–680 px/s, 0.9–1.4 s life, fading gradient trail; spawn gap uniform 3–15 s; hard cap 2 concurrent.
- NO connecting lines, NO cursor interaction.

## Non-negotiables (performance-first)

- Canvas 2D, single rAF loop; DPR-capped at 2.
- Loop pauses on `document.hidden`; the component only exists on idle surfaces, so no cost while working.
- `prefers-reduced-motion: reduce`: static field (no drift, no twinkle, no shooters), mid-alpha.
- Stars draw in the surface's foreground color (canvas inherits `currentColor` via computed style), so dark and light themes both work with no extra config.
- `pointer-events: none`, `aria-hidden` — purely decorative, zero interaction or a11y surface.

## Component

`apps/web/src/components/ConstellationBackground.tsx` — absolutely-positioned canvas filling its nearest positioned ancestor; sizes via ResizeObserver on the parent. Pure/testable pieces (star generation, twinkle math, shooter spawn gating) live in `ConstellationBackground.logic.ts` with unit tests. The reference implementation is the approved prototype (same math, same constants).

## Mount points (all render it as the backdrop layer, content above)

1. `apps/web/src/components/SplashScreen.tsx` — behind the typing mark.
2. `apps/web/src/components/NoActiveThreadState.tsx` — inside the `<Empty>` region (below the header; the header/topbar stays clean).
3. `apps/web/src/components/auth/PairingRouteSurface.tsx` — behind the pairing card.

## Out of scope

- The pre-React boot shell in index.html (static; splash takes over immediately).
- Any working-surface (chat/terminal) backdrop.

## Verification

- Unit: logic tests (layer distribution, twinkle bounds, spawn gap window, concurrency cap).
- `vp check` + `vp run typecheck` + web suite pass.
- Runtime: splash/empty-state/pairing each show the field; tab-hidden pauses rAF; reduced-motion static; light theme renders dark-ink stars.

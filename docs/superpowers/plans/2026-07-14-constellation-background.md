# Constellation Background Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the approved animated starfield (spec: `docs/superpowers/specs/2026-07-14-constellation-background-design.md`) as one shared React component mounted on the three idle surfaces.

**Architecture:** `ConstellationBackground.logic.ts` holds the pure, unit-tested math (settings constants, star generation, twinkle alpha, shooter spawn/step). `ConstellationBackground.tsx` owns the canvas/rAF/ResizeObserver/visibility lifecycle and calls the logic. Three one-line-ish mounts. The reference implementation (identical math, approved by Isaac) is the prototype at `/private/tmp/claude-501/-Users-ski-dev-t3ski/5030dce2-816e-40f2-a981-a2495280e1b1/scratchpad/constellation-template.html` — port it, don't reinvent it.

**Tech Stack:** React 19, Canvas 2D, vite-plus test runner.

## Global Constraints

- Locked settings: starCount 190, driftSpeed 8 px/s (nearest layer), driftAngle −π/5, twinkleAmount 0.55, starSize 1.3, shooter gap uniform 3–15 s, shooterMax 2, shooter speed 420–680 px/s, life 0.9–1.4 s, trail 90–160 px, jitter ±0.175 rad ((random−0.5)×0.35), direction = drift + π.
- Layers: z 0.35/0.65/1.0 with shares 0.45/0.35/0.20; per-star radius `(0.35 + rand*0.65) * starSize * z`; base alpha `(0.35 + rand*0.5) * (0.45 + 0.55*z)`; twinkle speed 0.3–1.2 cycles/s, random phase.
- No connecting lines, no cursor interaction, `pointer-events-none`, `aria-hidden="true"`.
- rAF pauses on `document.hidden`; DPR capped at 2; `prefers-reduced-motion` → static field, no shooters, no drift/twinkle.
- Star color from the surface foreground (`getComputedStyle(canvas).color`) so themes work automatically.
- `vp check` and `vp run typecheck` must pass (AGENTS.md).
- Do NOT push. Commit only.

---

### Task 1: Component + logic module with tests

**Files:**

- Create: `apps/web/src/components/ConstellationBackground.logic.ts`
- Create: `apps/web/src/components/ConstellationBackground.logic.test.ts`
- Create: `apps/web/src/components/ConstellationBackground.tsx`

**Interfaces:**

- Produces: `ConstellationBackground({ className }?)` — React component rendering an absolutely-positioned canvas (`absolute inset-0`), used by Task 2.
- Produces (logic, consumed by the component and its tests):

```ts
export interface ConstellationSettings {
  readonly starCount: number;
  readonly driftSpeed: number;
  readonly driftAngle: number;
  readonly twinkleAmount: number;
  readonly starSize: number;
  readonly shooterMinGapMs: number;
  readonly shooterMaxGapMs: number;
  readonly shooterMax: number;
}
export const CONSTELLATION_SETTINGS: ConstellationSettings; // the locked values
export interface Star {
  x: number;
  y: number;
  z: number;
  r: number;
  baseAlpha: number;
  twinklePhase: number;
  twinkleSpeed: number;
}
export function createStars(input: {
  width: number;
  height: number;
  settings: ConstellationSettings;
  random?: () => number;
}): Star[];
export function twinkleAlpha(star: Star, timeSeconds: number, twinkleAmount: number): number; // ≥ 0.05, ≤ baseAlpha
export function nextShooterDelayMs(settings: ConstellationSettings, random?: () => number): number; // uniform in [min,max]
export function canSpawnShooter(activeShooters: number, settings: ConstellationSettings): boolean;
export function spawnShooter(input: {
  width: number;
  height: number;
  settings: ConstellationSettings;
  random?: () => number;
}): Shooter; // direction = driftAngle + π ± 0.175 ((random−0.5)×0.35)
export function stepShooter(shooter: Shooter, dtSeconds: number): Shooter; // advances position/life
export function shooterFade(shooter: Shooter): number; // 0..1 envelope: in over first 15%, out over last 30%
```

All `random` parameters default to `Math.random` and exist so tests inject a seeded stub.

- [ ] **Step 1: Write failing logic tests** (`ConstellationBackground.logic.test.ts`) — with a stubbed `random`, assert: (a) `createStars` layer shares 45/35/20% of 190 (rounding tolerated ±1) and every star's radius/baseAlpha/twinkleSpeed within the constraint formulas' bounds; (b) `twinkleAlpha` stays within `[0.05, baseAlpha]` across a sampled time sweep and differs between two stars with different phases at the same t; (c) `nextShooterDelayMs` hits exactly min/max at random()=0/1; (d) `canSpawnShooter` false at 2 active, true at 0 and 1; (e) `spawnShooter` direction within ±0.175 rad ((random−0.5)×0.35) of `driftAngle + π` and speed within 420–680; (f) `shooterFade` envelope: ~0 at life 0, 1 at mid-life, ~0 at end of `maxLife`.

- [ ] **Step 2: Run to verify failure** — `vp run --filter @t3tools/web test -- ConstellationBackground` → FAIL (module missing).

- [ ] **Step 3: Implement the logic module** — port the prototype's math verbatim into the pure functions (the prototype is the reference; the Global Constraints restate every constant). Then implement the component:

```tsx
// ConstellationBackground.tsx — lifecycle owner; all math lives in the logic module.
// - canvas: className merge of "pointer-events-none absolute inset-0" + prop, aria-hidden
// - useEffect: read prefers-reduced-motion once + subscribe to change
// - size from ResizeObserver on canvas.parentElement, DPR = min(devicePixelRatio, 2)
// - color: getComputedStyle(canvas).color parsed to "r, g, b" (re-read on theme change via
//   a MutationObserver on document.documentElement's class attribute — the app toggles `.dark`)
// - rAF loop mirrors the prototype's step(): drift+wrap (skip when reduced), twinkleAlpha,
//   shooter schedule/spawn/step/draw (skip when reduced); dt clamped to 50ms
// - document.visibilitychange pauses/resumes the loop
// - full cleanup on unmount (cancelAnimationFrame, observers, listeners)
```

Follow the repo's component idioms (function component, `cn()` for class merge). No new dependencies.

- [ ] **Step 4: Run tests to verify pass** — `vp run --filter @t3tools/web test -- ConstellationBackground` → PASS; `vp check && vp run typecheck` → PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ConstellationBackground.logic.ts apps/web/src/components/ConstellationBackground.logic.test.ts apps/web/src/components/ConstellationBackground.tsx
git commit -m "Add constellation background component

Canvas starfield with three parallax layers, unsynchronized twinkle,
and counter-drift shooting stars (max 2, 3-15s apart). Pure math in a
tested logic module; rAF pauses when hidden; reduced-motion renders a
static field; star color follows the surface foreground for theming.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Jokqts7ghf89zWER5GP3RE"
```

### Task 2: Mount on the three idle surfaces

**Files:**

- Modify: `apps/web/src/components/SplashScreen.tsx`
- Modify: `apps/web/src/components/NoActiveThreadState.tsx`
- Modify: `apps/web/src/components/auth/PairingRouteSurface.tsx`

**Interfaces:**

- Consumes: `ConstellationBackground` from Task 1.

- [ ] **Step 1: SplashScreen** — the root div (`flex min-h-screen items-center justify-center bg-background`) gains `relative overflow-hidden`; `<ConstellationBackground />` as its first child; the existing content wrapper gains `relative` so it layers above.

- [ ] **Step 2: NoActiveThreadState** — mount inside the `<Empty className="flex-1">` region only (the header stays clean): give the `Empty` (or an inner wrapper if `Empty` doesn't accept the classes cleanly) `relative overflow-hidden`, insert `<ConstellationBackground />` before the content, content wrapper `relative`.

- [ ] **Step 3: PairingRouteSurface** — read the component first; mount behind the pairing card at its outermost full-viewport container using the same relative/overflow-hidden + first-child pattern. If the surface has multiple states (form, error), the backdrop belongs to the container that persists across them.

- [ ] **Step 4: Verify** — `vp check && vp run typecheck && vp run --filter @t3tools/web test` → PASS. Runtime (dev server on :5733, Playwright profile at the scratchpad `pw/` setup): (a) empty state shows moving stars, header/topbar clean; (b) splash shows stars behind the typing mark on reload; (c) `/pair` (fresh unpaired context — a non-persistent context hits the redirect) shows stars; (d) `reducedMotion: "reduce"` context renders static field (two screenshots 2s apart are pixel-identical in the canvas region); (e) light theme (toggle `document.documentElement.classList`) draws dark stars.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/SplashScreen.tsx apps/web/src/components/NoActiveThreadState.tsx apps/web/src/components/auth/PairingRouteSurface.tsx
git commit -m "Mount constellation background on idle surfaces

Splash, no-active-thread empty state, and pairing screen; working
surfaces stay clean per the perf-first placement decision.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Jokqts7ghf89zWER5GP3RE"
```

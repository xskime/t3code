# Tool-Call Color Treatment Implementation Plan (rev 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship rev 2 of `docs/superpowers/specs/2026-07-14-toolcall-color-treatment-design.md`: color + per-icon animation as a running-state treatment, mono on settle, red on failure, orange dynamic-tool category, and provider-logo subagent icons.

**Architecture:** Rev 1 (categorizer, tokens, always-on ink, shimmer) is already committed (b523217ee). Task 1 reworks the semantics: ink becomes running-only, settled rows return to the existing mono styling, and `dynamic_tool_call` moves to a new orange `tool` category. Task 2 adds the per-icon running animations via a new `WorkEntryToolIcon.tsx` component (custom SVGs with classed sub-elements, lucide geometry) and provider-logo subagent icons threaded from ChatView through `TimelineRowActivityCtx`.

**Tech Stack:** React 19, Tailwind + CSS custom properties, vite-plus test runner.

## Global Constraints

- Color/animation ONLY while running: `isRunning = !turnSettled && workEntryIndicatesToolNeutralStatus(workEntry)` (the existing `showNeutralIndicator` value — reuse it, do not recompute).
- Settled rows = the app's pre-existing mono classes (icon `text-muted-foreground/65`, existing heading classes). Settled subagent rows keep the provider logo shape but in muted fill.
- Failure/warning overrides keep precedence over category ink in every state, exactly as today.
- Token values exactly per the spec table; new `tool` category dark `#f2a05f` / light `#d35f0f`.
- All animations (shimmer + per-icon + logos) inside `@media (prefers-reduced-motion: no-preference)`; reduced motion shows static category ink on running rows.
- Preview text stays muted; no layout/behavior changes.
- `vp check` + `vp run typecheck` + web suite must pass. Do NOT push; commit only.

---

### Task 1: Running-only ink, mono settle, orange `tool` category

**Files:**

- Modify: `apps/web/src/components/chat/MessagesTimeline.logic.ts`
- Test: `apps/web/src/components/chat/MessagesTimeline.logic.test.ts`
- Modify: `apps/web/src/components/chat/MessagesTimeline.tsx` (`SimpleWorkEntryRow` ~1911, `TOOL_CATEGORY_CLASS` ~1900)
- Modify: `apps/web/src/index.css` (tokens + class)

**Interfaces:**

- Produces: `ToolCallCategory` union gains `"tool"`; `workEntryToolCategory` maps `dynamic_tool_call` → `"tool"` (was `"mcp"`). Everything else unchanged. Task 2 consumes this union.

- [ ] **Step 1: Failing tests** — in `MessagesTimeline.logic.test.ts`, update the `dynamic_tool_call` expectation from `"mcp"` to `"tool"`.

- [ ] **Step 2: RED** — `vp run --filter @t3tools/web test -- MessagesTimeline.logic` fails on that assertion.

- [ ] **Step 3: Implement**

(a) Logic: add `"tool"` to `ToolCallCategory`; `case "dynamic_tool_call": return "tool";`.

(b) `index.css`: add to the existing light and `.dark` token blocks (beside the other `--tool-*` tokens):

```css
/* light */
--tool-tool: #d35f0f;
/* .dark */
--tool-tool: #f2a05f;
```

and beside the other `.tool-cat-*` classes:

```css
.tool-cat-tool {
  --tool-cat: var(--tool-tool);
}
```

(c) `MessagesTimeline.tsx`: add `tool: "tool-cat-tool"` to `TOOL_CATEGORY_CLASS`. Then gate ALL category ink on running: in `SimpleWorkEntryRow`, the icon wrapper's `tool-cat-ink` branch and the heading's `tool-cat-ink` branch apply only when `isRunning && category` (settled rows take the exact pre-rev-1 muted classes — restore them from the surrounding branches); the row's `TOOL_CATEGORY_CLASS[category]` class and `tool-heading-running`/`tool-icon-running` classes likewise apply only when running. Failure/warning branches stay FIRST and unchanged.

- [ ] **Step 4: GREEN + gates** — logic test passes; `vp check && vp run typecheck && vp run --filter @t3tools/web test` pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/chat/MessagesTimeline.logic.ts apps/web/src/components/chat/MessagesTimeline.logic.test.ts apps/web/src/components/chat/MessagesTimeline.tsx apps/web/src/index.css
git commit -m "Scope tool-call category color to running calls

Completed calls settle back to mono; failed calls keep red. Dynamic
tools split out of mcp into a new orange tool category.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Jokqts7ghf89zWER5GP3RE"
```

---

### Task 2: Per-icon running animations + provider subagent logos

**Files:**

- Create: `apps/web/src/components/chat/WorkEntryToolIcon.tsx`
- Modify: `apps/web/src/components/chat/MessagesTimeline.logic.ts` (logo-kind mapping)
- Test: `apps/web/src/components/chat/MessagesTimeline.logic.test.ts`
- Modify: `apps/web/src/components/chat/MessagesTimeline.tsx` (icon slot in `SimpleWorkEntryRow`; `TimelineRowActivityCtx` value ~148/474; props)
- Modify: `apps/web/src/components/ChatView.tsx` (pass provider driver kind, `<MessagesTimeline …>` ~5072; `activeProviderStatus` memo ~2139 has the thread's provider — find the driver-kind field on it or on the session, see `packages/contracts/src/model.ts:130-134`)
- Modify: `apps/web/src/index.css` (keyframes)

**Interfaces:**

- Produces in `MessagesTimeline.logic.ts`:

```ts
export type CollabAgentLogoKind = "openai" | "claude" | "cursor" | "grok" | "opencode";
export function collabAgentLogoKind(
  driverKind: string | null | undefined,
): CollabAgentLogoKind | null;
// codex→"openai", claudeAgent→"claude", cursor→"cursor", grok→"grok", opencode→"opencode", else null
```

- Produces in `WorkEntryToolIcon.tsx`:

```tsx
// Animated running glyphs. Category determines the glyph (icon/category branch
// orders mirror each other by construction). Copy path geometry from the
// installed lucide-react icons so the running↔settled swap doesn't jump.
export function AnimatedToolIcon(props: {
  category: "terminal" | "edit" | "read" | "web" | "mcp" | "tool";
  className?: string;
}): ReactNode;
// Provider logo for collab agent rows (re-exports from ../Icons):
export function CollabAgentLogo(props: {
  kind: CollabAgentLogoKind;
  className?: string;
}): ReactNode;
```

- [ ] **Step 1: Failing tests** — `collabAgentLogoKind`: one assertion per driver kind above, plus `null`/`undefined`/`"unknown"` → null.

- [ ] **Step 2: RED** — `vp run --filter @t3tools/web test -- MessagesTimeline.logic` fails (export missing).

- [ ] **Step 3: Implement `collabAgentLogoKind`** (pure map) → those tests GREEN.

- [ ] **Step 4: `WorkEntryToolIcon.tsx`** — custom SVGs with classed animatable parts, geometry copied from the installed lucide-react source (`node_modules/lucide-react/dist/esm/icons/{terminal,square-pen,eye,globe,wrench,hammer}.js`): terminal's cursor line gets `class="t-cursor"`; square-pen's pen path `class="t-pen"` (baseline path unclassed); globe rendered as circle + equator path + meridian path `class="t-meridian"` (split the combined path if needed); eye/wrench/hammer animate at the svg level (no sub-class). Each svg carries a category marker class: `tool-anim-terminal|edit|read|web|mcp|tool`. `CollabAgentLogo` maps kind → `OpenAI|ClaudeAI|CursorIcon|GrokIcon|OpenCodeIcon` from `../Icons`.

- [ ] **Step 5: CSS** — inside the existing `@media (prefers-reduced-motion: no-preference)` block in `index.css`, add (keep the existing shimmer + generic `.tool-icon-running svg` pulse; the pulse remains the fallback for running categorized rows that render lucide icons, e.g. thinking-tone bot):

```css
.tool-icon-running .tool-anim-terminal .t-cursor {
  animation: tool-cursor-blink 1.1s step-end infinite;
}
.tool-icon-running .tool-anim-edit .t-pen {
  transform-box: fill-box;
  transform-origin: 15% 85%;
  animation: tool-pen-write 1.1s ease-in-out infinite;
}
.tool-icon-running .tool-anim-read {
  transform-origin: center;
  animation: tool-eye-blink 3.2s ease-in-out infinite;
}
.tool-icon-running .tool-anim-web .t-meridian {
  transform-box: fill-box;
  transform-origin: center;
  animation: tool-globe-spin 2.2s ease-in-out infinite;
}
.tool-icon-running .tool-anim-mcp {
  transform-origin: center;
  animation: tool-wrench-turn 1.6s ease-in-out infinite;
}
.tool-icon-running .tool-anim-tool {
  transform-origin: 20% 90%;
  animation: tool-hammer-tap 1.4s ease-in-out infinite;
}
.tool-icon-running .tool-logo-claude {
  transform-origin: center;
  animation: tool-claude-twinkle 1.8s ease-in-out infinite;
}
.tool-icon-running .tool-logo-openai {
  transform-origin: center;
  animation: tool-openai-spin 2.8s linear infinite;
}
/* svgs with a bespoke animation opt out of the generic pulse */
.tool-icon-running svg[class*="tool-anim-"],
.tool-icon-running svg[class*="tool-logo-"] {
  animation-name: inherit;
}
```

NOTE on the opt-out rule: if `animation-name: inherit` proves awkward, instead scope the existing generic pulse selector to `:not([class*="tool-anim-"]):not([class*="tool-logo-"])` — either is acceptable; pick one and delete the other.

Keyframes (outside the media query, beside `tool-shimmer`):

```css
@keyframes tool-cursor-blink {
  50% {
    opacity: 0;
  }
}
@keyframes tool-pen-write {
  0%,
  100% {
    transform: rotate(0deg) translate(0, 0);
  }
  25% {
    transform: rotate(-5deg) translate(-0.5px, 0.3px);
  }
  55% {
    transform: rotate(3deg) translate(0.4px, -0.2px);
  }
  80% {
    transform: rotate(-2deg) translate(-0.2px, 0.1px);
  }
}
@keyframes tool-eye-blink {
  0%,
  86%,
  96%,
  100% {
    transform: scaleY(1);
  }
  91% {
    transform: scaleY(0.12);
  }
}
@keyframes tool-globe-spin {
  0%,
  100% {
    transform: scaleX(1);
  }
  50% {
    transform: scaleX(0.08);
  }
}
@keyframes tool-wrench-turn {
  0%,
  45%,
  100% {
    transform: rotate(0deg);
  }
  20% {
    transform: rotate(-28deg);
  }
}
@keyframes tool-hammer-tap {
  0%,
  40%,
  100% {
    transform: rotate(0deg);
  }
  14% {
    transform: rotate(-6deg);
  }
  26% {
    transform: rotate(14.5deg);
  }
}
@keyframes tool-claude-twinkle {
  0%,
  100% {
    transform: scale(1) rotate(0deg);
    filter: brightness(1);
  }
  50% {
    transform: scale(1.16) rotate(8deg);
    filter: brightness(1.4);
  }
}
@keyframes tool-openai-spin {
  to {
    transform: rotate(360deg);
  }
}
```

The hammer strike (+14.5°, origin 20% 90%) was measured against the text baseline in the approved mockup — keep these values exactly.

- [ ] **Step 6: Provider plumbing** — `MessagesTimeline` gains an optional `providerDriverKind?: string | null` prop, merged into the `TimelineRowActivityCtx` value (`activityState`, ~474) so rows read it via the existing `use(TimelineRowActivityCtx)`. ChatView passes the active thread's provider driver kind at the `<MessagesTimeline>` call (~5072) from `activeProviderStatus`/session (see Files note).

- [ ] **Step 7: Icon slot wiring** in `SimpleWorkEntryRow`:

  - `logoKind = workEntry.itemType === "collab_agent_tool_call" ? collabAgentLogoKind(activity.providerDriverKind) : null`.
  - Icon precedence (warning/destructive/failed branches keep their current icons FIRST, unchanged): if `logoKind` → `<CollabAgentLogo kind={logoKind} className={cn("size-3.5", `tool-logo-${logoKind}`, !isRunning && "fill-muted-foreground/65")} />` (running keeps the component's brand fill; tailwind-merge lets the mono fill win when settled — verify Claude's `fill-[#d97757]` is actually overridden, and if not, apply mono via a wrapper class + CSS `fill` override instead); else if `isRunning && category && category !== "agent"` → `<AnimatedToolIcon category={category} className="size-3.5" />`; else → existing `WorkEntryIconSvg` (match the size class the row currently passes — reuse whatever `entryIconName` rendering uses today).
  - Heading/ink classes: unchanged from Task 1 (running-gated).

- [ ] **Step 8: GREEN + gates** — `vp check && vp run typecheck && vp run --filter @t3tools/web test` pass.

- [ ] **Step 9: Runtime verification** — dev server per the repo `verify` skill (:5733, Playwright profile in the session scratchpad `pw/`): (a) settled historical tool calls render mono with no category ink; (b) force-add `tool-icon-running` + the row's category class in the DOM inspector (or start a cheap real turn) and screenshot: terminal cursor blinks, hammer taps, globe meridian sweeps while circle stays; (c) light theme legible; (d) if any historical collab-agent entry exists, its row shows the provider logo, mono when settled. State plainly which evidence was captured.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/components/chat/WorkEntryToolIcon.tsx apps/web/src/components/chat/MessagesTimeline.logic.ts apps/web/src/components/chat/MessagesTimeline.logic.test.ts apps/web/src/components/chat/MessagesTimeline.tsx apps/web/src/components/ChatView.tsx apps/web/src/index.css
git commit -m "Animate running tool-call icons and show provider logos for subagents

Each in-flight icon moves like its glyph: blinking terminal cursor,
writing pencil, blinking eye, front-to-back globe, ratcheting wrench,
baseline-flush hammer tap. Collab agent rows swap the hammer for the
thread provider's logo (Claude twinkles, OpenAI spins), settling to a
mono mark. Reduced motion renders everything static.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Jokqts7ghf89zWER5GP3RE"
```

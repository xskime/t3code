# Tool-Call Color + Animation Treatment — Design

**Date:** 2026-07-14 (rev 2 — per-icon animations, provider subagent logos, mono-on-settle)
**Status:** Approved (Isaac, via mockup artifact claude.ai/code/artifact/7a46a968-a397-4241-8be4-1abdb1612710 — final "looks good" after the mono-settle + orange-hammer revision)
**Scope:** Running-state color + animation for the chat timeline's work entries (`SimpleWorkEntryRow` in `apps/web/src/components/chat/MessagesTimeline.tsx`). All faces (mac/windows/web) share the web bundle.

## Core semantics (rev 2 — this supersedes rev 1's always-colored treatment)

- **Color and animation are a running-state treatment.** A row whose call is in flight (existing `!turnSettled && workEntryIndicatesToolNeutralStatus` condition) renders its icon AND heading in the category ink, the heading shimmers, and the icon plays its category-specific animation.
- **Completed calls settle to mono** — the app's existing muted styling (`text-muted-foreground/65` icon, existing heading classes). No category ink on settled rows. Provider logos on settled subagent rows also go mono (muted fill), but the logo shape stays (it does not revert to the hammer).
- **Failed calls highlight red** — the existing `destructive` treatment, always, running or settled. Warnings keep `warning`. These override category ink.
- Preview text stays muted at all times. Row layout, sizes, and expansion behavior unchanged.
- `prefers-reduced-motion: reduce`: no shimmer, no icon animation. Running rows show static category ink only.

## Categories and colors

CSS custom properties in `apps/web/src/index.css` (dark / light):

| token             | category      | mapping (mirrors `workEntryIconName`)                                      | dark      | light     |
| ----------------- | ------------- | -------------------------------------------------------------------------- | --------- | --------- |
| `--tool-terminal` | commands      | `requestKind "command"`, `itemType "command_execution"`, `command` present | `#7fd88f` | `#1e8f3d` |
| `--tool-edit`     | file changes  | `requestKind "file-change"`, `itemType "file_change"`, changedFiles        | `#e5b567` | `#b26b00` |
| `--tool-read`     | file reads    | `requestKind "file-read"`, `itemType "image_view"`                         | `#7ab8f5` | `#1667c4` |
| `--tool-web`      | web           | `itemType "web_search"`                                                    | `#64d3d0` | `#0d8f8b` |
| `--tool-mcp`      | mcp tools     | `itemType "mcp_tool_call"`                                                 | `#b79df7` | `#6d3fd4` |
| `--tool-tool`     | dynamic tools | `itemType "dynamic_tool_call"`                                             | `#f2a05f` | `#d35f0f` |
| `--tool-agent`    | subagents     | `itemType "collab_agent_tool_call"`, thinking tone                         | `#ef9fda` | `#c02993` |

(rev 2 splits `dynamic_tool_call` out of mcp into the new orange `tool` category — Isaac: "make the hammer orange".)

Entries matching none of the above keep today's neutral styling in every state.

## Per-icon running animations (approved mockup values)

Each in-flight icon animates in a way native to its glyph. Exact keyframes live in the plan; approved behavior:

- **terminal** — the underscore cursor blinks (1.1s step-end, hidden at 50%).
- **edit** — the pencil writes: pencil path wiggles (rotate −5°/+3°/−2° with sub-pixel translate, 1.1s), the baseline stroke stays put.
- **read** — the eye blinks: scaleY collapse to 0.12 at 91% of a 3.2s cycle.
- **web** — wireframe-globe spin: outline circle and equator stay fixed; the meridian path sweeps front-to-back via scaleX 1 → 0.08 → 1 (2.2s ease-in-out). Never rotates flat/invisible.
- **mcp** — the wrench ratchets: rotate 0 → −28° → 0 with a hold (1.6s).
- **dynamic tools** — the hammer taps: transform-origin 20% 90%, wind-up −6°, strike **+14.5°** (measured in headless chromium so the hammer head lands flush with the text baseline, delta 0.38px), 1.4s.
- **subagents** — provider logo instead of the hammer: **Claude twinkles** (scale 1.16, rotate 8°, brightness 1.4 at 50%, 1.8s), **OpenAI spins** (2.8s linear 360°).

Animations are implemented as custom SVG markup (lucide geometry with classed sub-elements) shown only while running; settled rows render the existing lucide components in mono, so the static state is untouched.

## Subagent provider logos

- `collab_agent_tool_call` rows always render the thread's provider logo (from `apps/web/src/components/Icons.tsx`) instead of the generic hammer: `codex` → `OpenAI`, `claudeAgent` → `ClaudeAI`, `cursor` → `CursorIcon`, `grok` → `GrokIcon`, `opencode` → `OpenCodeIcon`. Unknown/missing provider falls back to the existing hammer.
- Running: brand ink (Claude terracotta `#d97757`, OpenAI foreground mono) + the logo animation. Settled: mono muted fill. Heading stays agent-pink while running.
- Provider comes from the thread's session (subagents run on the thread's provider); it is threaded from ChatView into the timeline via the existing `TimelineRowActivityCtx`.

## Implementation shape

- Pure `workEntryToolCategory(workEntry): ToolCallCategory | null` in `MessagesTimeline.logic.ts` (already landed in rev 1, commit b523217ee) — rev 2 adds the `tool` category.
- Colors as CSS vars in `index.css`; running-gated classes; shimmer + per-icon keyframes inside `@media (prefers-reduced-motion: no-preference)`.
- Animated running icons in a new focused component file (`apps/web/src/components/chat/WorkEntryToolIcon.tsx`) so MessagesTimeline.tsx (~2k lines) doesn't grow further.

## Verification

- Unit tests: categorizer (incl. `dynamic_tool_call` → `tool`), provider→logo mapping, running/settled class resolution.
- `vp check`, `vp run typecheck`, web suite pass.
- Runtime: a live turn shows category ink + per-icon animation on in-flight entries; settled entries mono; failed red; reduced-motion static; light theme legible.

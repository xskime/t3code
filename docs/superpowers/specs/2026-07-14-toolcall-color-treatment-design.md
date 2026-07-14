# Tool-Call Color + Animation Treatment — Design

**Date:** 2026-07-14
**Status:** Approved (Isaac: "icon + name", via mockup artifact claude.ai/code/artifact/7a46a968-a397-4241-8be4-1abdb1612710)
**Scope:** Category-colored icons and tool names with a running-state shimmer in the chat timeline's work entries (`SimpleWorkEntryRow` in `apps/web/src/components/chat/MessagesTimeline.tsx`). Previews/details stay muted. All faces (mac/windows/web) share the web bundle.

## Treatment (option A)

- The row's icon AND heading (tool name) render in the entry's category color. The preview text stays `muted-foreground/55`; row layout, sizes, expansion behavior unchanged.
- **Running rows** (turn in progress and the entry has not reported success/failure — the existing `!turnSettled && workEntryIndicatesToolNeutralStatus` condition): heading gets a shimmer sweep (gradient `category → 30% fg mix → category`, background-clip text, 1.8s linear infinite), icon gets a soft opacity pulse (1.6s, min 0.45). On settle, both freeze to static category ink.
- **Failure overrides category**: failed entries keep the existing `destructive` treatment (red icon + heading); warnings keep `warning`. Category colors never replace error/warning semantics.
- `prefers-reduced-motion`: no shimmer, no pulse — static category color only.

## Categories and colors

CSS custom properties in `apps/web/src/index.css`, dark and light values (from the approved mockup):

| token             | category          | mapping (existing logic in `workEntryIconName`)                            | dark      | light     |
| ----------------- | ----------------- | -------------------------------------------------------------------------- | --------- | --------- |
| `--tool-terminal` | commands          | `requestKind "command"`, `itemType "command_execution"`, `command` present | `#7fd88f` | `#1e8f3d` |
| `--tool-edit`     | file changes      | `requestKind "file-change"`, `itemType "file_change"`, changedFiles        | `#e5b567` | `#b26b00` |
| `--tool-read`     | file reads        | `requestKind "file-read"`, `itemType "image_view"`                         | `#7ab8f5` | `#1667c4` |
| `--tool-web`      | web               | `itemType "web_search"`                                                    | `#64d3d0` | `#0d8f8b` |
| `--tool-mcp`      | mcp/dynamic tools | `itemType "mcp_tool_call"`, `"dynamic_tool_call"`                          | `#b79df7` | `#6d3fd4` |
| `--tool-agent`    | subagents/collab  | `itemType "collab_agent_tool_call"`, thinking/bot tone                     | `#ef9fda` | `#c02993` |

Entries matching none of the above (user-input prompts, info/check tones) keep today's neutral styling — not every row needs a hue.

## Implementation shape

- Pure `workEntryCategory(workEntry): ToolCategory | null` beside the existing icon mapping, extracted to `MessagesTimeline.logic.ts` with unit tests (categorization mirrors `workEntryIconName`'s branch order so icon and color always agree).
- Colors as CSS vars on `.dark`/root in `index.css`; row classes reference `var(--tool-…)`.
- Shimmer/pulse keyframes in `index.css` gated by `@media (prefers-reduced-motion: no-preference)`.

## Verification

- Unit tests for `workEntryCategory` (one per category + fallback + failure override precedence).
- `vp check`, `vp run typecheck`, web suite pass.
- Runtime: a live turn shows shimmering heading + pulsing icon on the in-flight entry, settled entries hold static color, failed entry red, reduced-motion static.

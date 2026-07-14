# Tool-Call Color Treatment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship treatment A from `docs/superpowers/specs/2026-07-14-toolcall-color-treatment-design.md` — category-colored icon + tool name with running-state shimmer — in the chat timeline work entries.

**Architecture:** One pure categorizer in `MessagesTimeline.logic.ts` (tested), CSS tokens + keyframes in `index.css`, and class wiring inside `SimpleWorkEntryRow` (MessagesTimeline.tsx ~1900-1990). No layout/behavior changes; failure/warning overrides keep precedence.

**Tech Stack:** React 19, Tailwind + CSS custom properties, vite-plus test runner.

## Global Constraints

- Colors exactly per the spec's token table (dark + light values). Preview text stays muted; only icon + heading take the category color.
- Running condition reuses the row's existing logic: `!turnSettled && workEntryIndicatesToolNeutralStatus(workEntry)` — do not invent new state.
- Failure (`workEntryIndicatesToolFailure` / destructive style) and warning rows keep their existing red/warning styling — category color must NOT apply to icon or heading there.
- Shimmer: linear-gradient(100deg, cat 20%, color-mix(in oklab, cat 30%, fg) 40%, cat 60%), background-size 200%, background-clip text, 1.8s linear infinite. Icon pulse: opacity to 0.45 at 50%, 1.6s ease-in-out infinite. Both inside `@media (prefers-reduced-motion: no-preference)`.
- Entries outside the six categories keep today's styling untouched.
- `vp check` + `vp run typecheck` + web suite must pass. Do NOT push; commit only.

---

### Task 1: Categorizer, tokens, row wiring

**Files:**

- Modify: `apps/web/src/components/chat/MessagesTimeline.logic.ts` (add categorizer)
- Test: `apps/web/src/components/chat/MessagesTimeline.logic.test.ts` (extend)
- Modify: `apps/web/src/components/chat/MessagesTimeline.tsx` (`SimpleWorkEntryRow` ~1900, `workEntryIconName` ~1852 stays the icon source of truth)
- Modify: `apps/web/src/index.css` (tokens + keyframes)

**Interfaces:**

- Produces:

```ts
// MessagesTimeline.logic.ts
export type ToolCallCategory = "terminal" | "edit" | "read" | "web" | "mcp" | "agent";
export function workEntryToolCategory(entry: {
  readonly requestKind?: string | null;
  readonly itemType?: string | null;
  readonly command?: string | null;
  readonly changedFiles?: readonly string[] | null;
  readonly tone?: string | null;
  readonly sourceActivityKind?: string | null;
}): ToolCallCategory | null;
```

Branch order MUST mirror `workEntryIconName` in MessagesTimeline.tsx (user-input kinds → null; requestKind command/file-read/file-change; command_execution/command; file_change/changedFiles; web_search; image_view → "read"; mcp_tool_call → "mcp"; dynamic_tool_call → "mcp"; collab_agent_tool_call → "agent"; tone "thinking" → "agent"; otherwise null) so icon and color always agree.

- [ ] **Step 1: Failing tests** — in `MessagesTimeline.logic.test.ts`, one assertion per category (matching the mapping above), plus: user-input kinds → null even with a command present; unknown/info entries → null; image_view → "read"; dynamic_tool_call → "mcp"; tone thinking → "agent".

- [ ] **Step 2: RED** — `vp run --filter @t3tools/web test -- MessagesTimeline.logic` fails (export missing).

- [ ] **Step 3: Implement**

(a) The categorizer in `MessagesTimeline.logic.ts` per the interface above.

(b) `index.css` — inside the existing token blocks (find where theme-scoped custom properties live; add to both the root/light and `.dark` scopes):

```css
/* light */
--tool-terminal: #1e8f3d;
--tool-edit: #b26b00;
--tool-read: #1667c4;
--tool-web: #0d8f8b;
--tool-mcp: #6d3fd4;
--tool-agent: #c02993;
/* .dark */
--tool-terminal: #7fd88f;
--tool-edit: #e5b567;
--tool-read: #7ab8f5;
--tool-web: #64d3d0;
--tool-mcp: #b79df7;
--tool-agent: #ef9fda;
```

And, in the components layer:

```css
.tool-cat-terminal {
  --tool-cat: var(--tool-terminal);
}
.tool-cat-edit {
  --tool-cat: var(--tool-edit);
}
.tool-cat-read {
  --tool-cat: var(--tool-read);
}
.tool-cat-web {
  --tool-cat: var(--tool-web);
}
.tool-cat-mcp {
  --tool-cat: var(--tool-mcp);
}
.tool-cat-agent {
  --tool-cat: var(--tool-agent);
}

.tool-cat-ink {
  color: var(--tool-cat);
}

@media (prefers-reduced-motion: no-preference) {
  .tool-heading-running {
    background: linear-gradient(
      100deg,
      var(--tool-cat, currentColor) 20%,
      color-mix(in oklab, var(--tool-cat, currentColor) 30%, var(--foreground)) 40%,
      var(--tool-cat, currentColor) 60%
    );
    background-size: 200% 100%;
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    animation: tool-shimmer 1.8s linear infinite;
  }
  .tool-icon-running svg {
    animation: tool-icon-pulse 1.6s ease-in-out infinite;
  }
}
@keyframes tool-shimmer {
  to {
    background-position: -200% 0;
  }
}
@keyframes tool-icon-pulse {
  50% {
    opacity: 0.45;
  }
}
```

(verify `--foreground` is the app's actual foreground token name in index.css; use the real one.)

(c) `SimpleWorkEntryRow` wiring: compute `const category = workEntryToolCategory(workEntry)` and `const isRunning = !turnSettled && workEntryIndicatesToolNeutralStatus(workEntry)` (the same expression already computed for `showNeutralIndicator` — reuse that variable, don't duplicate). Then:

- Root row div gains `category && "tool-cat-" + category` (via cn with a static map — Tailwind-safe since these are plain CSS classes: `TOOL_CATEGORY_CLASS: Record<ToolCallCategory, string>`).
- `iconWrapperClass`: when NOT warning/destructive/failed AND category present → replace the `text-muted-foreground/65` branch with `"tool-cat-ink"`; add `isRunning && "tool-icon-running"`.
- `headingClass`: when NOT warning/destructive AND category present → `"font-medium tool-cat-ink"`; add `isRunning && "tool-heading-running"` (running class also applies to non-categorized entries — the CSS falls back to `currentColor` via `var(--tool-cat, currentColor)`).
- Precedence: warning/destructive checks stay FIRST, exactly as today.

- [ ] **Step 4: GREEN + gates** — logic test passes; `vp check && vp run typecheck && vp run --filter @t3tools/web test` all pass.

- [ ] **Step 5: Runtime verification** — dev server (:5733, existing Playwright setup in the session scratchpad `pw/`): open a thread with historical tool calls → settled entries show colored icon+name per category, previews muted, any failed entry red. If a live turn is impractical to trigger, verify the running treatment by temporarily forcing `isRunning` in DevTools/a scratch page is NOT acceptable for evidence — instead start a cheap real turn (e.g. a trivial prompt to a local provider if configured) OR document that the running-state visual was verified via the mockup-equivalent storybook-less route: add the two classes manually in the DOM inspector and screenshot. State plainly which evidence you captured.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/chat/MessagesTimeline.logic.ts apps/web/src/components/chat/MessagesTimeline.logic.test.ts apps/web/src/components/chat/MessagesTimeline.tsx apps/web/src/index.css
git commit -m "Color tool-call icons and names by category with running shimmer

Terminal/edit/read/web/mcp/agent entries get themed icon+name ink from
new CSS tokens (dark+light); in-flight entries shimmer and pulse until
they settle; failure/warning overrides keep precedence; reduced motion
renders static color.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Jokqts7ghf89zWER5GP3RE"
```

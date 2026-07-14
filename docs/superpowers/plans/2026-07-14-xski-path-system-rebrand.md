# xski Path-System Rebrand + Remote Scope Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace "Ski Code" display branding with the xski path system (`~/x/ski/code/<channel>` lockup, typing splash, root-glyph favicon) and add an environment scope menu to the sidebar's Remote tab.

**Architecture:** Part A is string/markup swaps across the seven Ski Code surfaces plus one new pure helper (`resolveAppChannel`). Part B threads one new persisted field (`sidebarRemoteScope`) from `uiStateStore` through Sidebar's existing tab-filtering memos and adds a dropdown on the Remote toggle. No new modules; everything follows existing file boundaries.

**Tech Stack:** React 19, zustand (`uiStateStore`), Tailwind, JetBrains Mono via `@fontsource/jetbrains-mono` (400 + 500 already imported in `apps/web/src/main.tsx`), vite-plus test runner.

## Global Constraints

- Brand: always lowercase `xski code`; root `~/x/ski/` and channel segment at 40% ink (opacity 0.4), `code` at full ink; JetBrains Mono 500; never letter-space, never colorize.
- Channel mapping: stage `Dev` → `dev`, `Nightly` → `nightly`, anything else (Alpha/Latest) → `stable`.
- No stage suffix or pill anywhere: display name is plain `xski code`.
- Bundle/package/userdata identifiers stay `T3 Code` / `com.t3tools.t3code` — do not touch electron-builder config, package.json names, or update-channel config.
- Remote scope chevron renders only when MORE THAN ONE remote environment exists; scope persists in `uiStateStore`; invalid scope falls back to `"all"`.
- Motion ≤ 1.6s; `prefers-reduced-motion` gets the static mark immediately.
- `vp check` and `vp run typecheck` must pass before a task is complete (AGENTS.md).
- Do NOT push. Commit only. (Repo policy: ask Isaac before push.)

---

### Task 1: Naming — branding modules, desktop identity, index.html strings

**Files:**

- Modify: `apps/web/src/branding.ts`, `apps/web/src/branding.logic.ts`, `apps/web/src/branding.test.ts`
- Modify: `apps/desktop/src/app/DesktopEnvironment.ts:79-102`, `apps/desktop/src/app/DesktopAppIdentity.test.ts:195-196`
- Modify: `apps/web/index.html` (title + any "Ski Code" strings only — visuals are Task 3)

**Interfaces:**

- Produces: `resolveAppChannel(input: { stageLabel: string }): "stable" | "nightly" | "dev"` exported from `apps/web/src/branding.logic.ts` — Tasks 2 and 3 consume it.
- Produces: `formatAppDisplayName({ baseName, stageLabel })` now returns `baseName` only (signature unchanged — callers keep compiling).

- [ ] **Step 1: Update tests to the new expectations (failing first)**

In `apps/web/src/branding.test.ts`, change the injected-desktop-branding expectations to whatever the bridge injects (that path is passthrough — leave the `T3 Code (Nightly)` assertions as they are, since injected branding wins verbatim), and change the module-fallback expectations:

```ts
// in "normalizes hosted app channel metadata":
expect(branding.APP_DISPLAY_NAME).toBe("xski code");

// replace the two resolveServerBackedAppDisplayName display-name tests' expectations:
// nightly primary server version:
expect(/* ... */).toBe("xski code"); // baseName passed in the test changes to "xski code"
// stable + malformed nightly:
expect(/* ... */).toBe("xski code (Alpha)"); // fallbackDisplayName is returned untouched
```

Concretely, the three `resolveServerBackedAppDisplayName` tests become:

```ts
it("updates the display name for nightly primary server versions", () => {
  expect(
    resolveServerBackedAppDisplayName({
      baseName: "xski code",
      fallbackDisplayName: "xski code",
      fallbackStageLabel: "Alpha",
      primaryServerVersion: "0.0.28-nightly.20260616.12",
    }),
  ).toBe("xski code");
});

it("keeps the fallback display name for stable primary server versions", () => {
  expect(
    resolveServerBackedAppDisplayName({
      baseName: "xski code",
      fallbackDisplayName: "xski code",
      fallbackStageLabel: "Alpha",
      primaryServerVersion: "0.0.27",
    }),
  ).toBe("xski code");
});

it("keeps the fallback display name for malformed nightly primary server versions", () => {
  expect(
    resolveServerBackedAppDisplayName({
      baseName: "xski code",
      fallbackDisplayName: "xski code",
      fallbackStageLabel: "Alpha",
      primaryServerVersion: "0.0.28-nightly.20260616",
    }),
  ).toBe("xski code");
});
```

Add channel-mapping tests:

```ts
describe("app channel", () => {
  it("maps stages to path channels", () => {
    expect(resolveAppChannel({ stageLabel: "Dev" })).toBe("dev");
    expect(resolveAppChannel({ stageLabel: "Nightly" })).toBe("nightly");
    expect(resolveAppChannel({ stageLabel: "Alpha" })).toBe("stable");
    expect(resolveAppChannel({ stageLabel: "Latest" })).toBe("stable");
  });
});
```

(import `resolveAppChannel` alongside the existing `branding.logic` imports)

In `apps/desktop/src/app/DesktopAppIdentity.test.ts:195-196` change both `"Ski Code (Alpha)"` assertions to `"xski code"`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `vp run --filter @t3tools/web test -- branding` (and the desktop test: `vp run --filter @t3tools/desktop test -- DesktopAppIdentity`)
Expected: FAIL — `resolveAppChannel` not exported; display-name mismatches.

- [ ] **Step 3: Implement**

`apps/web/src/branding.logic.ts` — change `formatAppDisplayName` and add `resolveAppChannel`:

```ts
export function formatAppDisplayName(input: {
  readonly baseName: string;
  readonly stageLabel: string;
}): string {
  // Brand voice: the stage is a path segment in the lockup, never a name suffix.
  return input.baseName;
}

export type AppChannel = "stable" | "nightly" | "dev";

export function resolveAppChannel(input: { readonly stageLabel: string }): AppChannel {
  if (input.stageLabel === "Dev") return "dev";
  if (input.stageLabel === "Nightly") return "nightly";
  return "stable";
}
```

`apps/web/src/branding.ts` — one string change:

```ts
export const APP_BASE_NAME = injectedDesktopAppBranding?.baseName ?? "xski code";
```

`apps/desktop/src/app/DesktopEnvironment.ts:79,100`:

```ts
const APP_BASE_NAME = "xski code";
// ...in resolveDesktopAppBranding:
    displayName: APP_BASE_NAME,
```

(keep `stageLabel` in the returned branding object — the web reads it for the channel segment)

`apps/web/index.html` — replace every `Ski Code` string with `xski code` (title tag and boot-splash aria/alt text; leave structure for Task 3).

- [ ] **Step 4: Run tests to verify they pass**

Run: `vp run --filter @t3tools/web test -- branding && vp run --filter @t3tools/desktop test -- DesktopAppIdentity`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/branding.ts apps/web/src/branding.logic.ts apps/web/src/branding.test.ts apps/desktop/src/app/DesktopEnvironment.ts apps/desktop/src/app/DesktopAppIdentity.test.ts apps/web/index.html
git commit -m "Rebrand naming to xski code (path system)

Display name drops the stage suffix; the stage becomes a path channel
(resolveAppChannel: Dev→dev, Nightly→nightly, else stable) consumed by
the lockup and splash. Bundle/package ids deliberately unchanged.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Jokqts7ghf89zWER5GP3RE"
```

### Task 2: Sidebar path lockup

**Files:**

- Modify: `apps/web/src/components/Sidebar.tsx` (`SidebarBrand` ~line 2761, `SkiWordmark` ~line 2781, `useSidebarStageLabel` ~line 2801)
- Modify: `apps/web/src/index.css:104-125` (`.sidebar-brand*` container-query rules)

**Interfaces:**

- Consumes: `resolveAppChannel` from Task 1.
- Produces: nothing later tasks rely on.

- [ ] **Step 1: Replace `SidebarBrand` and delete `SkiWordmark`**

`SidebarBrand` becomes (the stage pill span and `SkiWordmark` component are deleted entirely):

```tsx
function SidebarBrand() {
  const stageLabel = useSidebarStageLabel();
  const channel = resolveAppChannel({ stageLabel });

  return (
    <Link
      aria-label="Go to threads"
      className="sidebar-brand ml-[var(--workspace-titlebar-content-left)] h-7 w-fit min-w-0 shrink-0 items-center overflow-hidden rounded-md font-mono text-[13px] font-medium text-foreground outline-hidden ring-ring focus-visible:ring-2"
      to="/"
    >
      <span className="sidebar-brand-path truncate whitespace-nowrap">
        <span className="opacity-40">~/x/ski/</span>
        code
        <span className="opacity-40">/{channel}</span>
      </span>
      <span className="sidebar-brand-path-compact whitespace-nowrap">
        <span className="opacity-40">/</span>code
      </span>
    </Link>
  );
}
```

(`font-mono` resolves to JetBrains Mono in this app; import `resolveAppChannel` from `../branding.logic`. If `font-mono` maps elsewhere, set `style={{ fontFamily: '"JetBrains Mono", monospace' }}` — check `tailwind`/`index.css` for the mono stack first.)

- [ ] **Step 2: Update the container-query CSS**

In `apps/web/src/index.css`, replace the `.sidebar-brand*` block: the full path shows at the wide breakpoint, the `/code` compact form at the narrow one, pill rules deleted:

```css
.sidebar-brand {
  display: none;
}

.sidebar-brand-path {
  display: none;
}

.sidebar-brand-path-compact {
  display: none;
}

@media (min-width: 48rem) {
  @container sidebar-header (min-width: 10rem) {
    .sidebar-brand {
      display: flex;
    }
    .sidebar-brand-path-compact {
      display: inline;
    }
  }

  @container sidebar-header (min-width: 13.5rem) {
    .sidebar-brand-path {
      display: inline;
    }
    .sidebar-brand-path-compact {
      display: none;
    }
  }
}
```

- [ ] **Step 3: Remove now-dead code and verify**

Delete `SkiWordmark` (Sidebar.tsx ~2781-2799). Search for other `sidebar-brand-stage` references (`grep -rn "sidebar-brand-stage" apps/web/src`) and remove leftovers. `useSidebarStageLabel` stays (feeds the channel).

Run: `vp check && vp run typecheck`
Expected: PASS (no unused-symbol or type errors).

- [ ] **Step 4: Visual sanity check**

Run the dev server (`HOST=0.0.0.0 node scripts/dev-runner.ts dev --no-browser` per `.claude/skills/verify/SKILL.md`) and confirm in a browser: wide sidebar shows `~/x/ski/code/dev` with root+channel dimmed; narrow container shows `/code`. Kill the server after.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/Sidebar.tsx apps/web/src/index.css
git commit -m "Replace sidebar wordmark with live-text path lockup

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Jokqts7ghf89zWER5GP3RE"
```

### Task 3: Splash typing motion, boot splash, favicon

**Files:**

- Modify: `apps/web/src/components/SplashScreen.tsx` (full replacement)
- Modify: `apps/web/index.html` (boot-shell markup + favicon links)
- Create: `apps/web/public/favicon.svg` (copy from `/Users/ski/dev/branding/final/path-system/favicon.svg`)

**Interfaces:**

- Consumes: `resolveAppChannel` + `APP_STAGE_LABEL` (`apps/web/src/branding.ts`).

- [ ] **Step 1: Rewrite `SplashScreen.tsx`**

```tsx
import { useEffect, useState } from "react";

import { APP_STAGE_LABEL } from "../branding";
import { resolveAppChannel } from "../branding.logic";

const ROOT = "~/x/ski/";
const APP = "code";
const TYPE_INTERVAL_MS = 40;
const MOUNT_PAUSE_MS = 520;

type SplashPhase = "typing" | "mounting" | "resolved";

function StaticMark({ channel }: { channel: string }) {
  return (
    <span className="whitespace-nowrap font-mono text-xl font-medium text-foreground">
      <span className="opacity-40">{ROOT}</span>
      {APP}
      <span className="opacity-40">/{channel}</span>
    </span>
  );
}

export function SplashScreen() {
  const channel = resolveAppChannel({ stageLabel: APP_STAGE_LABEL });
  const command = `cd ${ROOT}${APP}/${channel}`;
  const prefersReducedMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [phase, setPhase] = useState<SplashPhase>(prefersReducedMotion ? "resolved" : "typing");
  const [typedLength, setTypedLength] = useState(0);

  useEffect(() => {
    if (phase !== "typing") return;
    if (typedLength >= command.length) {
      setPhase("mounting");
      return;
    }
    const timer = setTimeout(() => setTypedLength((length) => length + 1), TYPE_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [phase, typedLength, command.length]);

  useEffect(() => {
    if (phase !== "mounting") return;
    const timer = setTimeout(() => setPhase("resolved"), MOUNT_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3" aria-label="xski code splash screen">
        {phase === "resolved" ? (
          <StaticMark channel={channel} />
        ) : (
          <span className="whitespace-nowrap font-mono text-xl font-medium text-foreground">
            {command.slice(0, typedLength)}
            <span className="ml-px inline-block h-5 w-2.5 animate-pulse bg-foreground align-text-bottom" />
          </span>
        )}
        <span className="h-4 font-mono text-xs text-muted-foreground">
          {phase === "mounting" ? "mounting directory…" : ""}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Boot splash + favicon in `index.html`**

- Copy the favicon: `cp /Users/ski/dev/branding/final/path-system/favicon.svg apps/web/public/favicon.svg`
- Add before the existing `favicon.ico` link: `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />`
- Replace the `#boot-shell-card` contents (currently an icon img) with a static mono path — inside the existing boot-shell markup:

```html
<div id="boot-shell-card">
  <span
    style="font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 15px; font-weight: 500; white-space: nowrap"
  >
    <span style="opacity: 0.4">~/x/ski/</span>code
  </span>
</div>
```

(widen `#boot-shell-card`'s fixed 96px width in the inline style block to `width: auto`; the boot shell has no React yet, so it shows the channel-less static path — the React splash takes over with the full one.)

- [ ] **Step 3: Verify**

Run: `vp check && vp run typecheck && vp run --filter @t3tools/web test`
Expected: PASS. Then dev-server spot check: reload shows boot path → typing splash → sidebar; OS reduced-motion setting (or DevTools emulation) shows the static mark with no typing.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/SplashScreen.tsx apps/web/index.html apps/web/public/favicon.svg
git commit -m "Add path-system splash motion and root-glyph favicon

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Jokqts7ghf89zWER5GP3RE"
```

### Task 4: Remote scope state in uiStateStore

**Files:**

- Modify: `apps/web/src/uiStateStore.ts`
- Test: `apps/web/src/uiStateStore.test.ts`

**Interfaces:**

- Produces: `SidebarRemoteScope = "all" | (string & {})`; `sidebarRemoteScope: SidebarRemoteScope` on `UiProjectState` (default `"all"`, persisted); store action `setSidebarRemoteScope(scope: SidebarRemoteScope): void`; pure reducer export `setSidebarRemoteScope(state, scope)` mirroring `setSidebarEnvironmentTab` (uiStateStore.ts:344). Task 5 consumes all of these.

- [ ] **Step 1: Write failing tests** (mirror the existing `sidebarEnvironmentTab` tests in `uiStateStore.test.ts` — find them with `grep -n sidebarEnvironmentTab apps/web/src/uiStateStore.test.ts`)

```ts
describe("sidebar remote scope", () => {
  it("defaults to all", () => {
    expect(useUiStateStore.getState().sidebarRemoteScope).toBe("all");
  });

  it("persists a selected remote environment id", () => {
    useUiStateStore.getState().setSidebarRemoteScope("env-123");
    expect(useUiStateStore.getState().sidebarRemoteScope).toBe("env-123");
    expect(readPersistedState().sidebarRemoteScope).toBe("env-123");
  });

  it("restores the scope from persisted state", () => {
    seedPersistedState({ sidebarRemoteScope: "env-456" });
    expect(rehydratedStore().sidebarRemoteScope).toBe("env-456");
  });
});
```

(adapt `readPersistedState` / `seedPersistedState` / `rehydratedStore` to the file's existing test helpers — reuse exactly what the `sidebarEnvironmentTab` tests use; do not invent new helpers if equivalents exist.)

- [ ] **Step 2: Run to verify failure** — `vp run --filter @t3tools/web test -- uiStateStore` → FAIL (`sidebarRemoteScope` undefined).

- [ ] **Step 3: Implement** — follow `sidebarEnvironmentTab` end-to-end (type, `PersistedUiState` field, `initialState`, pure reducer, store action, persistence read/write). New pieces:

```ts
export type SidebarRemoteScope = "all" | (string & {});

// PersistedUiState:
sidebarRemoteScope?: string;

// UiProjectState:
sidebarRemoteScope: SidebarRemoteScope;

// initialState:
sidebarRemoteScope: "all",

// pure reducer next to setSidebarEnvironmentTab (line ~344):
export function setSidebarRemoteScope(state: UiState, scope: SidebarRemoteScope): UiState {
  return state.sidebarRemoteScope === scope ? state : { ...state, sidebarRemoteScope: scope };
}

// store action next to setSidebarEnvironmentTab (~455):
setSidebarRemoteScope: (scope) => set((state) => setSidebarRemoteScope(state, scope)),
```

Wire the persisted field wherever `sidebarEnvironmentTab` is serialized/deserialized (same functions, same defaults-on-missing behavior).

- [ ] **Step 4: Run tests** — `vp run --filter @t3tools/web test -- uiStateStore` → PASS; then `vp run typecheck` → PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/uiStateStore.ts apps/web/src/uiStateStore.test.ts
git commit -m "Persist sidebar remote scope in uiStateStore

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Jokqts7ghf89zWER5GP3RE"
```

### Task 5: Remote scope menu + tab filtering in Sidebar

**Files:**

- Modify: `apps/web/src/components/Sidebar.tsx` (`ToggleGroup` block ~2978-3006 and its props ~2877-2925; filtering memos ~3211-3283)
- Modify: `apps/web/src/components/Sidebar.logic.ts` (+ its test file — locate the existing one via `ls apps/web/src/components/Sidebar.logic*`)

**Interfaces:**

- Consumes: `sidebarRemoteScope`/`setSidebarRemoteScope` from Task 4; existing `isLocalEnvironmentId`, `environments`, `hasRemoteEnvironments` (Sidebar.tsx:3215-3227).
- Produces: `resolveEffectiveRemoteScope` in `Sidebar.logic.ts` (below).

- [ ] **Step 1: Failing test for the pure scope resolver** (in the Sidebar.logic test file)

```ts
describe("resolveEffectiveRemoteScope", () => {
  const remoteIds = new Set(["env-a", "env-b"]);
  it("keeps all", () => {
    expect(resolveEffectiveRemoteScope({ scope: "all", remoteEnvironmentIds: remoteIds })).toBe(
      "all",
    );
  });
  it("keeps a scope that names a live remote", () => {
    expect(resolveEffectiveRemoteScope({ scope: "env-a", remoteEnvironmentIds: remoteIds })).toBe(
      "env-a",
    );
  });
  it("falls back to all when the scoped environment is gone", () => {
    expect(
      resolveEffectiveRemoteScope({ scope: "env-gone", remoteEnvironmentIds: remoteIds }),
    ).toBe("all");
  });
});
```

- [ ] **Step 2: Run to verify failure**, then implement in `Sidebar.logic.ts`:

```ts
import type { SidebarRemoteScope } from "../uiStateStore";

export function resolveEffectiveRemoteScope(input: {
  readonly scope: SidebarRemoteScope;
  readonly remoteEnvironmentIds: ReadonlySet<string>;
}): SidebarRemoteScope {
  return input.scope !== "all" && !input.remoteEnvironmentIds.has(input.scope)
    ? "all"
    : input.scope;
}
```

Run the logic test → PASS.

- [ ] **Step 3: Wire filtering in `Sidebar()`** (after `hasRemoteEnvironments`, ~3228):

```tsx
const sidebarRemoteScope = useUiStateStore((store) => store.sidebarRemoteScope);
const setSidebarRemoteScope = useUiStateStore((store) => store.setSidebarRemoteScope);
const remoteEnvironments = useMemo(
  () =>
    environments
      .filter((environment) => !isLocalEnvironmentId(environment.environmentId))
      .map((environment) => ({
        environmentId: environment.environmentId,
        label: environment.label.toLowerCase(),
      }))
      .sort((left, right) => left.label.localeCompare(right.label)),
  [environments, isLocalEnvironmentId],
);
const remoteScope = resolveEffectiveRemoteScope({
  scope: sidebarRemoteScope,
  remoteEnvironmentIds: useMemo(
    () => new Set(remoteEnvironments.map((environment) => environment.environmentId)),
    [remoteEnvironments],
  ),
});
const matchesRemoteScope = useCallback(
  (environmentId: EnvironmentId) =>
    activeEnvironmentTab !== "remote" || remoteScope === "all" || environmentId === remoteScope,
  [activeEnvironmentTab, remoteScope],
);
```

Extend `tabProjects` and `tabThreads` (3246-3265) — the existing tab predicate gains `&& matchesRemoteScope(project.environmentId)` / `&& matchesRemoteScope(thread.environmentId)` inside their filters, and `matchesRemoteScope` joins each memo's dependency array. `tabAttention` (3266) is left untouched per the spec.

- [ ] **Step 4: The Remote toggle grows the scope menu** (replace the Remote `<Toggle>` at 2998-3003; new props threaded through `SidebarContentInner`'s prop list at ~2877/2922 — `remoteEnvironments`, `remoteScope`, `onRemoteScopeChange`):

```tsx
<Toggle aria-label="Remote projects" value="remote" className="flex-1 gap-1.5">
  {remoteScope === "all" ? (
    "Remote"
  ) : (
    <span className="truncate font-mono text-xs font-medium">
      <span className="opacity-40">remote/</span>
      {remoteEnvironments.find((env) => env.environmentId === remoteScope)?.label ?? remoteScope}
    </span>
  )}
  {environmentTab !== "remote" && environmentTabAttention.remote ? (
    <span className="size-1.5 rounded-full bg-primary" />
  ) : null}
  {remoteEnvironments.length > 1 ? (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Choose remote environment scope"
        className="-mr-1 rounded p-0.5 text-muted-foreground outline-hidden hover:text-foreground focus-visible:ring-2"
        onClick={(event) => event.stopPropagation()}
      >
        <ChevronDownIcon className="size-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuCheckboxItem
          checked={remoteScope === "all"}
          onSelect={() => onRemoteScopeChange("all")}
        >
          all remotes
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        {remoteEnvironments.map((environment) => (
          <DropdownMenuCheckboxItem
            key={environment.environmentId}
            checked={remoteScope === environment.environmentId}
            onSelect={() => onRemoteScopeChange(environment.environmentId)}
          >
            {environment.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null}
</Toggle>
```

Use the dropdown-menu components already imported in Sidebar.tsx (project/thread context menus use them — match those exact import paths and component names; if the file uses `ContextMenu` only, import `DropdownMenu*` from the same `./ui/` directory). If nesting a menu trigger inside `Toggle` breaks toggling (test it), render the trigger as a sibling: wrap the Remote `Toggle` and the `DropdownMenu` in a `relative flex-1` div with the trigger absolutely positioned at the right edge — behavior over markup purity.

- [ ] **Step 5: Verify**

Run: `vp check && vp run typecheck && vp run --filter @t3tools/web test`
Expected: PASS.

Runtime (recipe from `.claude/skills/verify/SKILL.md`): start the dev server; with 0-1 remote environments the chevron must be absent. Then start two standalone remote servers (`T3CODE_HOME=/tmp/t3remote-a … server start --port 13790`, `…-b … --port 13791`, pairing codes via `auth pairing create`), add both in Settings → Connections, and confirm: chevron appears; scoping to one environment filters the Remote tab's projects/threads; the segment reads `remote/<label>` dimmed-parent style; reload keeps the scope; removing the scoped environment falls back to `all remotes`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/Sidebar.tsx apps/web/src/components/Sidebar.logic.ts apps/web/src/components/Sidebar.logic*.test.ts
git commit -m "Add remote environment scope menu to the sidebar Remote tab

Chevron appears with >1 remote; selection scopes the tab's projects and
threads to one environment, renders as a dimmed-parent path segment, and
persists beside the tab choice. Missing environments fall back to all.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Jokqts7ghf89zWER5GP3RE"
```

---

## Not in this plan

- Packaged desktop icons (.icns/.ico) — separate build-asset pass (spec: out of scope).
- Pushing / releasing — after this plan lands, resume Task 2 of `2026-07-13-windows-desktop-release.md` (push gate: ask Isaac).

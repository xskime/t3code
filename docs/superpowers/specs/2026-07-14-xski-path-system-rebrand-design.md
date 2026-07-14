# xski Path-System Rebrand + Remote Scope — Design

**Date:** 2026-07-14
**Status:** Approved (Isaac, via artifact review 2026-07-14; artifact: claude.ai/code/artifact/c424ab10-7257-433f-adf1-73ee241a1bb2)
**Scope:** Replace the committed "Ski Code" display branding with the xski path system (`~/dev/branding/BRAND-GUIDE.md`, "the path system — draft 01"), and add a remote-environment scope menu to the sidebar's Remote tab. Display level only — bundle/package/userdata identifiers stay `T3 Code`/`com.t3tools.t3code` so upstream syncs and auto-updates stay clean.

## Part A — Path-system branding

The app mounts at `~/x/ski/code`; the release channel mounts under it as a path segment.

### Naming

| Surface                                                                                      | Was (Ski Code commit) | Becomes                            |
| -------------------------------------------------------------------------------------------- | --------------------- | ---------------------------------- |
| `APP_BASE_NAME` (`apps/web/src/branding.ts`)                                                 | `Ski Code`            | `xski code`                        |
| Display name / window title (`formatAppDisplayName`)                                         | `Ski Code (Alpha)`    | `xski code` — stage suffix dropped |
| Desktop-injected branding (`apps/desktop/src/app/DesktopEnvironment.ts`: dock, About, title) | `Ski Code (…)`        | `xski code`                        |
| Tab title + boot splash (`apps/web/index.html`)                                              | `Ski Code`            | `xski code`                        |
| Bundle / package / userdata ids                                                              | unchanged             | unchanged (deliberate)             |

Brand voice: always lowercase `xski code`; never letter-space, never mix weights, never colorize the mark.

### Sidebar lockup (`apps/web/src/components/Sidebar.tsx`)

- Delete the `SkiWordmark` SVG component and the "Code" text + stage pill.
- Replace with live text in JetBrains Mono 500: `~/x/ski/code/<channel>`.
  - Root `~/x/ski/` and channel segment `/<channel>` at 40% ink (opacity 0.4 of foreground); `code` at full ink.
  - Channel from the stage: Alpha/Latest → `stable`, Nightly → `nightly`, Dev → `dev`. Mapping lives in `branding.logic.ts`.
- Collapsed rail: abbreviate to `/code` (the guide's `/ski` tight-space rule applied to the app).
- JetBrains Mono 500 loaded via the existing `@fontsource/jetbrains-mono` dependency (repo already ships 400); latin subset only.

### Splash + boot screen (`apps/web/src/components/SplashScreen.tsx`, `index.html`)

- The mark types itself per the guide's motion spec, extended one segment:
  `cd ~/x/ski/code/<channel>` types (~40ms/char) → `mounting directory…` (~520ms) → resolves to the static path. ≤ 1.6s total.
- `prefers-reduced-motion`: render the static mark immediately, no typing.
- The `index.html` boot splash shows the static path + `xski code` title; full typing animation lives in SplashScreen (React).

### Favicon (`apps/web/index.html` + public assets)

- Swap the web favicon to the path-system root glyph: copy `~/dev/branding/final/path-system/favicon.svg` (bare `x` on void `#07080b`) into the web public assets.
- Packaged desktop icons (.icns/.ico) are OUT of scope — separate build-asset pass later.

## Part B — Remote scope menu (new feature)

With the Windows build, one client talks to several remotes (mac mini, macbook, skyy). The sidebar's Remote tab gains a scope menu:

- A chevron on the Remote segment, rendered only when **more than one** remote environment exists (consistent with the existing rule hiding the whole switcher when no remotes exist).
- Menu contents: `all remotes` (default, checkmark) then one entry per remote environment, lowercase runtime label.
- Selecting an environment scopes the Remote tab's projects and threads to that environment. `all remotes` restores today's merged behavior.
- Scoped segment label renders as a path: `remote/<label>` with `remote/` at 40% ink, leaf at full ink (same parent-dimmed grammar as the lockup).
- Persistence: the selected scope is stored in `uiStateStore` beside the environment-tab choice. If the scoped environment disappears (removed/unreachable catalog entry), fall back to `all remotes`.
- Attention dots: unchanged semantics on the Remote segment (any remote activity), regardless of scope.
- Local tab is untouched.

## Commit structure

Part A cosmetics commits land before Part B remote-scope commits (one commit per plan task). The existing Ski Code commit `429415c71` stays in history; this supersedes its strings/assets in place.

## Verification

- `vp check` and `vp run typecheck` pass; updated unit tests (`branding.test.ts`, `DesktopAppIdentity.test.ts`, `uiStateStore.test.ts`, sidebar logic tests) pass.
- Runtime: dev server — sidebar shows `~/x/ski/code/dev` (dev stage → `/dev`), splash types and resolves, reduced-motion static; with two simulated remotes the Remote chevron appears, scoping filters the tab, selection survives reload; with one remote the chevron is absent.

---
name: sync-upstream
description: Pull the latest pingdotgg/t3code changes into this fork, merge them into the working branch, and verify nothing broke. Use whenever Isaac asks to update/sync the fork, "get the latest T3 Code", or before starting new feature work on a stale checkout.
---

# Syncing the fork with upstream T3 Code

Remotes: `origin` = luvskyy/t3code (Ski's fork), `upstream` = pingdotgg/t3code.

Branch model: local `main` is a pristine mirror of `upstream/main` — never commit to it.
Fork work lives on feature branches (currently `feature/sidebar-environment-tabs`); upstream
updates flow in by merging `main` into the working branch. Merge, don't rebase — the branch
is shared across machines (MacBook `/Users/isaac/dev/t3ski`, Mac mini `/Users/ski/dev/t3ski`).

## Workflow

```bash
git fetch upstream --prune
git log --oneline main..upstream/main            # see what's new
git fetch . upstream/main:main                    # fast-forward main without checkout
git merge main --no-edit                          # from the working branch
vp install                                        # if pnpm-lock.yaml changed in the merge
vp check && vp run typecheck
(cd apps/web && vp test)                          # 148 files / ~1282 tests, ~10s
```

If the merge or upstream touched `apps/web/src/components/Sidebar.tsx`,
`apps/web/src/uiStateStore.ts`, or `packages/client-runtime/src/state/projectGrouping.ts`,
also runtime-verify the sidebar Local|Remote tabs feature — recipe in the `verify` skill.

## Conflict hotspots (fork's custom diff vs upstream)

- `apps/web/src/components/Sidebar.tsx` — tab partition logic (`tabProjects`/`tabThreads`).
  Never let an upstream change reintroduce filtering of `orderedProjects`; drag-and-drop
  passes it wholesale to `reorderProjects` (see HANDOFF-2026-07-12-001 in LEXICON).
- `apps/web/src/uiStateStore.ts` — persisted `sidebarEnvironmentTab` field.
- `AGENTS.md` — fork prepends a `LEXICON_LINK_START/END` block; keep the block above
  upstream's content when resolving.
- `scripts/dev-runner.ts` / `apps/web/src/environments/primary/target.ts` — fork's
  `--dev-url` / non-loopback browsing support.

## Gotchas

- No `pnpm` on PATH — use `vp install` (wraps pnpm), never `pnpm install`.
- Machine-local LEXICON pointer files (`LEXICON.md`, `.agents/`,
  `.cursor/rules/00-lexicon.mdc`) are hidden via `.git/info/exclude` (local-only, not
  `.gitignore` — keeps zero diff vs upstream). Re-add entries there after a fresh clone.
- Upstream lint warnings (~9) and Effect suggestions in typecheck output are pre-existing;
  only exit codes matter.
- Do not push (`origin` or anywhere) without asking Isaac first.
- After syncing, update LEXICON notes (`lexicon finish`).

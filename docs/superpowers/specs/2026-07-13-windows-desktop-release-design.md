# Windows Desktop Release for the Fork — Design

**Date:** 2026-07-13
**Status:** Approved (Isaac, 2026-07-13)
**Scope:** Extend `.github/workflows/fork-desktop-release.yml` to build and publish an unsigned Windows x64 NSIS installer alongside the existing signed macOS arm64 DMG, in a single GitHub release per version so electron-updater works on both platforms.

## Goals

- Isaac's PC runs the fork desktop app ("T3 Code (Alpha)" bundle, Ski Code branding) with working auto-updates from `xskime/t3code` releases.
- WSL backend works in the Windows build (bundled Linux `pty.node`).
- macOS release path is unchanged.

## Non-goals

- Windows code signing (Azure Trusted Signing). Build unsigned; SmartScreen shows a one-time warning on install. The workflow structure must allow adding signing later by supplying secrets and `--signed`.
- Windows arm64, Linux targets, CLI publishing.

## Decisions

| Decision       | Choice                                          | Rationale                                                                                                                                                 |
| -------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Signing        | Unsigned NSIS                                   | Personal build; zero cost/setup. electron-updater only enforces signature checks when the installed app is signed.                                        |
| WSL backend    | Include                                         | Copy upstream's `build_wsl_node_pty` job; without it the packaged WSL backend refuses to start.                                                           |
| Workflow shape | One workflow, build matrix + single publish job | electron-updater's GitHub provider reads the _latest_ release for `latest.yml`/`latest-mac.yml`; both platforms' manifests must ship in the same release. |
| Windows runner | `blacksmith-32vcpu-windows-2025`                | Same image upstream release.yml uses. Fallback: GitHub-hosted `windows-2025` if the Blacksmith plan lacks Windows runners.                                |
| Arch           | x64 only                                        | Isaac's PC is x64; upstream also ships x64-only (arm64 commented out). Avoids upstream's manifest-merge step entirely.                                    |

## Workflow structure (target state)

Jobs in `fork-desktop-release.yml` (triggers unchanged: push to `feature/sidebar-environment-tabs`, `workflow_dispatch`; concurrency group unchanged; `FORK_VERSION: 0.1.${{ github.run_number }}` and `T3CODE_DESKTOP_UPDATE_REPOSITORY: xskime/t3code` stay workflow-level so both platforms inherit them):

1. **`build_wsl_node_pty`** — copied from upstream `release.yml`: Ubuntu runner compiles the Linux x64 node-pty `pty.node` matching the version pinned in the repo, uploads artifact `wsl-node-pty-x64`. Windows build gates on it via `needs` (same `!cancelled()` pattern as upstream so a mac build never waits on a failed prebuild).
2. **`build` matrix** —
   - _macOS arm64_ (unchanged behavior): `blacksmith-12vcpu-macos-26`, signed DMG with `CSC_LINK`/`CSC_KEY_PASSWORD`, signing-secrets check, `vp check` + `vp run typecheck` run here only (once per workflow run).
   - _Windows x64_ (new): `blacksmith-32vcpu-windows-2025`; steps copied from upstream's Windows matrix leg: install Spectre-mitigated MSVC libs (pwsh/vswhere step), download `wsl-node-pty-x64` into `wsl-prebuild/`, then `vp run dist:desktop:artifact --platform win --target nsis --arch x64 --build-version "$FORK_VERSION" --verbose` with the WSL prebuild passed the same way upstream does (flag/`T3CODE_DESKTOP_WSL_PREBUILD`). **No `--signed`** — the build script disables CSC auto-discovery for unsigned builds.
   - Both legs collect `release/` outputs (dmg/zip/exe/blockmap/yml) and upload as `desktop-<platform>-<arch>` artifacts instead of publishing directly.
3. **`publish`** — Ubuntu runner, `needs: build`; downloads all `desktop-*` artifacts into one directory and creates the single release `fork-desktop-v${FORK_VERSION}` (softprops/action-gh-release, `make_latest: true`) with files: `*.dmg`, `*.zip`, `*.exe`, `*.blockmap`, `*.yml` (covers `latest-mac.yml` + `latest.yml`), `fail_on_unmatched_files: true` so a half-built release cannot ship.

Exact step contents (WSL prebuild compile steps, Spectre install script, artifact-collect script) are lifted from upstream `.github/workflows/release.yml` — do not reinvent them; the x64-only choice means the commented-out per-arch manifest suffixing/merging in upstream stays out.

## Error handling

- `fail-fast: false` on the matrix so a Windows failure doesn't cancel the mac build (and vice versa), but the publish job requires both to succeed — no partial releases.
- Missing WSL prebuild artifact fails only the Windows leg (upstream's `needs`/`if` pattern).
- Signing-secret check remains a hard failure, mac leg only.

## Verification

1. Trigger via `workflow_dispatch`; confirm the release contains: DMG + ZIP + mac blockmaps + `latest-mac.yml` + EXE + exe blockmap + `latest.yml`.
2. On the PC: download the `.exe`, install through the SmartScreen warning, confirm the app launches, Add Project shows environments, and the mac mini appears over tailnet.
3. Auto-update: after the next release, confirm the Windows app offers/installs the update from `xskime/t3code`.
4. macOS regression: install the new release's DMG (or auto-update) and confirm nothing changed.

## Install notes (PC)

- First install: SmartScreen → "More info" → "Run anyway".
- User data land in the standard t3code locations; updater cache dir `t3code-updater` (unchanged, per `app-update.yml`).

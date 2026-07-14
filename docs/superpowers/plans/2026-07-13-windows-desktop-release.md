# Windows Desktop Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `fork-desktop-release.yml` so every fork release ships a signed macOS arm64 DMG **and** an unsigned Windows x64 NSIS installer (with working WSL backend) in a single GitHub release, keeping electron-updater working on both platforms.

**Architecture:** Three jobs mirroring upstream `release.yml`: (1) `build_wsl_node_pty` compiles the Linux `pty.node` on Ubuntu, (2) a `build` matrix produces mac (signed) and Windows (unsigned) artifacts and uploads them as workflow artifacts, (3) a `publish` job downloads everything and cuts one release `fork-desktop-v0.1.<run>`. Build jobs no longer publish directly.

**Tech Stack:** GitHub Actions (Blacksmith runners), `scripts/build-desktop-artifact.ts` (`vp run dist:desktop:artifact`), electron-builder NSIS target, softprops/action-gh-release.

## Global Constraints

- Windows builds are UNSIGNED: never pass `--signed` on the win leg; never add Azure secrets.
- macOS leg behavior is unchanged: signed DMG, hard failure if `CSC_LINK`/`CSC_KEY_PASSWORD` missing.
- One release per version containing BOTH platforms' files including `latest-mac.yml` AND `latest.yml` — electron-updater reads the latest release only.
- Version scheme stays `FORK_VERSION: 0.1.${{ github.run_number }}`; update repo stays `T3CODE_DESKTOP_UPDATE_REPOSITORY: xskime/t3code` (workflow-level env).
- Copy upstream step contents verbatim where marked; do not improvise replacements.
- Repo policy: ask Isaac before `git push` (the push triggers a real release build).

---

### Task 1: Rewrite `fork-desktop-release.yml` with the three-job structure

**Files:**

- Modify: `.github/workflows/fork-desktop-release.yml` (full replacement below)

**Interfaces:**

- Produces: workflow jobs `build_wsl_node_pty` → artifact `wsl-node-pty-x64`; `build` → artifacts `desktop-mac-arm64`, `desktop-win-x64`; `publish` → GitHub release `fork-desktop-v0.1.<run_number>` on `xskime/t3code` with files `*.dmg, *.zip, *.exe, *.blockmap, *.yml`.

- [ ] **Step 1: Replace the workflow file with this exact content**

```yaml
name: Fork Desktop Release

on:
  push:
    branches:
      - feature/sidebar-environment-tabs
  workflow_dispatch:

permissions:
  contents: write

concurrency:
  group: fork-desktop-release
  cancel-in-progress: true

env:
  FORK_VERSION: 0.1.${{ github.run_number }}
  T3CODE_DESKTOP_UPDATE_REPOSITORY: xskime/t3code
  T3CODE_DESKTOP_MAC_PASSKEY_SIGNING: disabled

jobs:
  # node-pty publishes no Linux prebuilt and the WSL backend runs under the
  # distro's own (Linux) Node, which can't load the Windows/Electron binary.
  # Build the Linux pty.node here and hand it to the Windows packaging job so
  # the Windows artifact ships a ready WSL backend binary.
  build_wsl_node_pty:
    name: Build WSL node-pty (linux-x64)
    runs-on: blacksmith-8vcpu-ubuntu-2404
    timeout-minutes: 15
    steps:
      - name: Checkout
        uses: actions/checkout@v6
        with:
          fetch-depth: 0

      - name: Setup Vite+
        uses: voidzero-dev/setup-vp@v1
        with:
          node-version-file: package.json
          cache: true
          run-install: true

      - name: Build node-pty linux-x64 prebuild
        shell: bash
        run: |
          set -euo pipefail
          # Resolve node-pty from apps/server (where it's a dependency) and build
          # its native binary from source for Linux. node-addon-api resolves from
          # node-pty's own dependency tree, so node-gyp has everything it needs.
          pty_pkg="$(node -e "console.log(require.resolve('node-pty/package.json', { paths: ['$GITHUB_WORKSPACE/apps/server'] }))")"
          pty_dir="$(dirname "$pty_pkg")"
          ( cd "$pty_dir" && npx --yes node-gyp rebuild )
          mkdir -p wsl-prebuild
          cp "$pty_dir/build/Release/pty.node" wsl-prebuild/pty.node
          file wsl-prebuild/pty.node

      - name: Upload node-pty linux-x64 prebuild
        uses: actions/upload-artifact@v7
        with:
          name: wsl-node-pty-x64
          path: wsl-prebuild/pty.node
          if-no-files-found: error

  build:
    name: Build ${{ matrix.label }}
    # build_wsl_node_pty stays in `needs` so its artifact exists before the
    # Windows leg downloads it, but `!cancelled()` lets the macOS leg run even
    # if the prebuild failed; the Windows-only download step then fails that
    # single platform.
    needs: [build_wsl_node_pty]
    if: ${{ !cancelled() }}
    runs-on: ${{ matrix.runner }}
    timeout-minutes: 45
    strategy:
      fail-fast: false
      matrix:
        include:
          - label: macOS arm64
            runner: blacksmith-12vcpu-macos-26
            platform: mac
            target: dmg
            arch: arm64
          - label: Windows x64
            runner: blacksmith-32vcpu-windows-2025
            platform: win
            target: nsis
            arch: x64
    steps:
      - name: Checkout
        uses: actions/checkout@v6
        with:
          fetch-depth: 0

      - name: Setup Vite+
        uses: voidzero-dev/setup-vp@v1
        with:
          node-version-file: package.json
          cache: true
          run-install: true

      - name: Check signing configuration
        if: matrix.platform == 'mac'
        shell: bash
        env:
          CSC_LINK: ${{ secrets.FORK_DESKTOP_CSC_LINK }}
          CSC_KEY_PASSWORD: ${{ secrets.FORK_DESKTOP_CSC_KEY_PASSWORD }}
        run: |
          if [[ -z "$CSC_LINK" || -z "$CSC_KEY_PASSWORD" ]]; then
            echo "Fork desktop signing secrets are not configured." >&2
            exit 1
          fi

      - name: Check
        if: matrix.platform == 'mac'
        run: vp check

      - name: Typecheck
        if: matrix.platform == 'mac'
        run: vp run typecheck

      - name: Download WSL node-pty prebuild
        if: matrix.platform == 'win'
        uses: actions/download-artifact@v7
        with:
          name: wsl-node-pty-x64
          path: wsl-prebuild

      - name: Install Spectre-mitigated MSVC libs
        if: matrix.platform == 'win'
        shell: pwsh
        run: |
          $vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
          $installPath = & $vswhere -products * -latest -property installationPath
          $setupExe = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\setup.exe"
          $proc = Start-Process -FilePath $setupExe `
            -ArgumentList "modify", "--installPath", "`"$installPath`"", "--add", `
            "Microsoft.VisualStudio.Component.VC.Tools.x86.x64.Spectre", "--quiet", "--norestart" `
            -Wait -PassThru -NoNewWindow
          if ($null -eq $proc -or $proc.ExitCode -ne 0) {
            $code = if ($null -ne $proc) { $proc.ExitCode } else { 1 }
            Write-Error "Visual Studio Installer failed with exit code $code"
            exit $code
          }

      - name: Build desktop artifact
        shell: bash
        env:
          CSC_LINK: ${{ secrets.FORK_DESKTOP_CSC_LINK }}
          CSC_KEY_PASSWORD: ${{ secrets.FORK_DESKTOP_CSC_KEY_PASSWORD }}
        run: |
          args=(
            --platform "${{ matrix.platform }}"
            --target "${{ matrix.target }}"
            --arch "${{ matrix.arch }}"
            --build-version "$FORK_VERSION"
            --verbose
          )

          if [[ "${{ matrix.platform }}" == "mac" ]]; then
            args+=(--signed)
          elif [[ "${{ matrix.platform }}" == "win" ]]; then
            # Bundle the Linux node-pty binary built by build_wsl_node_pty so the
            # packaged WSL backend ships a ready binary (no first-launch compile).
            # Unsigned on purpose: personal build, no Azure Trusted Signing.
            args+=(--wsl-prebuild "$GITHUB_WORKSPACE/wsl-prebuild/pty.node")
          fi

          vp run dist:desktop:artifact "${args[@]}"

      - name: Collect release assets
        shell: bash
        run: |
          set -euo pipefail
          mkdir -p release-publish

          shopt -s nullglob
          for pattern in \
            "release/*.dmg" \
            "release/*.zip" \
            "release/*.exe" \
            "release/*.blockmap" \
            "release/*.yml"; do
            for file in $pattern; do
              cp "$file" release-publish/
            done
          done

          ls -la release-publish/

      - name: Upload build artifacts
        uses: actions/upload-artifact@v7
        with:
          name: desktop-${{ matrix.platform }}-${{ matrix.arch }}
          path: release-publish/*
          if-no-files-found: error

  publish:
    name: Publish fork desktop release
    needs: [build]
    runs-on: blacksmith-8vcpu-ubuntu-2404
    timeout-minutes: 10
    steps:
      - name: Download build artifacts
        uses: actions/download-artifact@v7
        with:
          pattern: desktop-*
          path: release-assets
          merge-multiple: true

      - name: List release assets
        shell: bash
        run: ls -la release-assets/

      - name: Publish fork desktop release
        uses: softprops/action-gh-release@v2
        with:
          tag_name: fork-desktop-v${{ env.FORK_VERSION }}
          target_commitish: ${{ github.sha }}
          name: Isaac's T3 Code v${{ env.FORK_VERSION }}
          body: |
            Personal desktop build (macOS arm64 + Windows x64) from `${{ github.ref_name }}` at `${{ github.sha }}`.
          prerelease: false
          make_latest: true
          files: |
            release-assets/*.dmg
            release-assets/*.zip
            release-assets/*.exe
            release-assets/*.blockmap
            release-assets/*.yml
          fail_on_unmatched_files: true
```

Notes for the implementer:

- The `Build desktop artifact` step is a simplified copy of upstream `release.yml` (~line 480): the fork requires mac signing (hard failure via the check step) instead of upstream's optional `has_all` dance, and omits all Azure branches because Windows is unsigned by design.
- `build-desktop-artifact.ts` handles unsigned builds itself (`--signed` absent → it sets `CSC_IDENTITY_AUTO_DISCOVERY=false` and strips `CSC_*` from the build env), so the CSC env vars being present on the win leg is harmless — but they are only referenced, never required, there.
- `--wsl-prebuild` is a real flag of `scripts/build-desktop-artifact.ts` (also settable via `T3CODE_DESKTOP_WSL_PREBUILD`).
- `shell: bash` on Windows runs in git-bash; upstream uses the same pattern for this exact step.

- [ ] **Step 2: Validate the YAML parses**

Run:

```bash
python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/fork-desktop-release.yml')); print('YAML OK')"
```

Expected: `YAML OK`

If `actionlint` is installed (`command -v actionlint`), also run `actionlint .github/workflows/fork-desktop-release.yml` and fix any findings; if it is not installed, skip (do not install anything for this).

- [ ] **Step 3: Diff-check against the constraints**

Run: `git diff .github/workflows/fork-desktop-release.yml`
Manually confirm, against Global Constraints: no `--signed` on the win path; mac steps unchanged in behavior (same secrets, same check, `vp check`/typecheck now mac-gated); `fail_on_unmatched_files: true` retained; files list includes `*.exe` and `*.yml`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/fork-desktop-release.yml
git commit -m "Build Windows x64 in fork desktop releases

Mirror upstream release.yml: prebuild Linux node-pty for the WSL
backend, add an unsigned Windows NSIS leg to the build matrix, and move
publishing to a single job so one release carries both platforms'
artifacts and updater manifests (electron-updater reads the latest
release only).

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Jokqts7ghf89zWER5GP3RE"
```

### Task 2: Push and verify the release run

**Files:** none (CI verification)

**Interfaces:**

- Consumes: the workflow from Task 1; pushing `feature/sidebar-environment-tabs` triggers it.
- Produces: a published release `fork-desktop-v0.1.<run>` whose assets Task 3 installs.

- [ ] **Step 1: Confirm push with Isaac** (repo policy: ask before push). The push triggers a real release build (~15 min).

- [ ] **Step 2: Push**

```bash
git push origin feature/sidebar-environment-tabs
```

- [ ] **Step 3: Watch the run**

```bash
gh run list --repo xskime/t3code --workflow fork-desktop-release.yml --limit 1
gh run watch --repo xskime/t3code <run-id> --exit-status
```

Expected: all three jobs green. Known failure modes:

- Windows runner never picks up → Blacksmith plan may lack Windows runners; swap `blacksmith-32vcpu-windows-2025` → `windows-2025` (GitHub-hosted) and re-push.
- `node-gyp rebuild` fails in prebuild job → check Ubuntu image has build-essential (upstream runs the same job on the same image; compare logs against a recent upstream run before changing anything).

- [ ] **Step 4: Verify the release contents**

```bash
gh release view "fork-desktop-v0.1.$(gh run list --repo xskime/t3code --workflow fork-desktop-release.yml --limit 1 --json number --jq '.[0].number')" --repo xskime/t3code --json assets --jq '.assets[].name'
```

(If the tag guess is off, use `gh release list --repo xskime/t3code --limit 1` for the actual tag.)
Expected asset names (exact version varies):

- `T3-Code-<v>-arm64.dmg`, `T3-Code-<v>-arm64.dmg.blockmap`
- `T3-Code-<v>-arm64.zip` (`+ .blockmap`), `latest-mac.yml`
- `T3-Code-<v>-x64.exe` (NSIS setup; name may include `Setup`), `.exe.blockmap`, `latest.yml`

Then confirm `latest.yml` points at the exe:

```bash
gh release download <tag> --repo xskime/t3code --pattern latest.yml -O - | head -10
```

Expected: `version: 0.1.<run>` and a `path:`/`url:` referencing the `.exe`.

- [ ] **Step 5: macOS regression check** — on the mac mini, the installed fork app should offer/apply the update to the new version (Settings → updates, or auto). Confirm the app relaunches and loads projects.

### Task 3: Install and verify on the PC (manual, Isaac-driven)

**Files:** none

**Interfaces:**

- Consumes: the `.exe` asset from Task 2's release.

- [ ] **Step 1: Install** — on the PC, download the `.exe` from the latest `fork-desktop-v0.1.<run>` release on `xskime/t3code`; SmartScreen will warn (unsigned): "More info" → "Run anyway".
- [ ] **Step 2: Smoke test** — app launches; Add Project shows the environment picker; the mac mini environment appears over tailnet; local Windows projects addable.
- [ ] **Step 3: WSL backend** — if WSL is installed, enable the WSL backend in settings and confirm it starts (this exercises the bundled `pty.node`).
- [ ] **Step 4: Auto-update** — after the next fork release, confirm the Windows app updates itself from `xskime/t3code`.
- [ ] **Step 5: Update LEXICON** — record the release/verification outcome in `$LEXICON/projects/t3ski/` via `lexicon finish`.

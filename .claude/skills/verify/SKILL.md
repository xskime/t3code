---
name: verify
description: Build, launch, pair, and drive t3ski (T3 Code fork) for runtime verification of web-UI changes
---

# Verifying t3ski changes at runtime

## Toolchain

- `vp` lives at `~/.vite-plus/bin/vp`; vp-managed node at `~/.vite-plus/js_runtime/node/<ver>/bin`. There is no `pnpm` on PATH — root scripts that call pnpm need both dirs on PATH, or invoke `vp run` directly.
- Install: `vp i`. Typecheck/test one app: `vp run --filter @t3tools/web typecheck|test`.

## Launch (bind 0.0.0.0 for ssh/tailscale)

```bash
export PATH="$HOME/.vite-plus/bin:$HOME/.vite-plus/js_runtime/node/24.18.0/bin:$PATH"
HOST=0.0.0.0 nohup node scripts/dev-runner.ts dev --host 0.0.0.0 > /tmp/t3ski-dev.log 2>&1 &
```

Web on :5733, API on :13773. **Gotcha:** killing the dev-runner does NOT kill its `node --watch src/bin.ts` children — orphans keep the port and stale in-memory auth. Kill with `pgrep -fl "bin.ts|dev-runner"` and kill each pid before restarting.

## Auth / pairing

- Fresh browser profiles are redirected to `/pair`. The ONLY reliable token is the one the dev server prints at startup: `grep -o "pair#token=[A-Z0-9]*" /tmp/t3ski-dev.log`. Tokens expire in ~5 min.
- `node apps/server/src/bin.ts auth pairing create` does NOT work for the dev server: dev server state is `~/.t3/dev/state.sqlite`, while the CLI writes `<T3CODE_HOME>/userdata/state.sqlite`. It DOES work for a standalone `server start` instance (same userdata path).
- Sessions persist across server restarts, so pair a persistent Playwright profile once and reuse it.

## Headless driving

Playwright browsers are cached: executable at
`~/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell`.
Use `playwright-core` (npm i in a temp dir) with `launchPersistentContext("/tmp/pw-verify/profile", { executablePath })`. Working scripts from the sidebar-tabs verification live in `/tmp/pw-verify/*.mjs` (pair, add project, add remote env, tab probes).

## Simulating a remote environment

```bash
mkdir -p /tmp/t3remote-home
# seed a project BEFORE starting (CLI and server share userdata/state.sqlite when the server is down)
T3CODE_HOME=/tmp/t3remote-home node apps/server/src/bin.ts project add /path/to/repo --title demo
T3CODE_HOME=/tmp/t3remote-home nohup node apps/server/src/bin.ts server start --host 0.0.0.0 --port 13790 &
T3CODE_HOME=/tmp/t3remote-home node apps/server/src/bin.ts auth pairing create   # mint code
```

Then in the UI: Settings → Connections → Add environment → Host `http://localhost:13790` (MUST include `http://` — schemeless hosts default to https) + the pairing code.

## Adding a local project

Sidebar `[data-testid="sidebar-add-project-trigger"]` → type absolute path → Enter. (CLI project add does not reach the dev server's DB — see above.)

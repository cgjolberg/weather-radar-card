# weather-radar-card — Repo Overview

> Snapshot: 2026-06-19. Part of the Home Assistant **file/code lane** workspace.
> The root [`../CLAUDE.md`](../CLAUDE.md) is the authority on workspace-wide rules.
> This repo also has its own deep agent docs in [`AGENTS.md`](AGENTS.md) and
> [`CLAUDE.md`](CLAUDE.md) — **read those first** for repo-specific rules
> (diagnostic discipline, branch policy). This file is just a quick overview.

## Purpose
A Lovelace **custom card** (`custom:weather-radar-card`) showing animated rain-radar
loops in Home Assistant from RainViewer / NOAA-NWS / DWD, with hazard overlays
(US wildfires, NWS watches/warnings), DWD nowcast, Blitzortung lightning, animated
wind, sections-grid support, and 11 languages. Used as the kitchen tablet's
full-screen radar subview.

## Tech stack
- **TypeScript + Lit + Leaflet** (+ markercluster). Bundler: **Rollup**.
- Package manager: **npm**. Tests: **Vitest**. HACS-published (`hacs.json`). v`3.6.3`.
- Ships a **Dockerized dev Home Assistant** for local testing
  (`npm run ha:up` / `ha:down` / `ha:logs` / `ha:reset`, mounting `.dev/ha-config/`).

## Build
```powershell
npm run build    # = lint -> rollup  ->  dist/weather-radar-card.js  (gitignored)
npm run start    # rollup dev watch
npm test         # vitest
```
The built bundle `dist/weather-radar-card.js` is a **build output and is gitignored**
(CI builds it; releases attach a fresh `.js` + `.gz`).

## Deploy (dev channel)
```powershell
.\deploy.cmd            # wrapper -> deploy.ps1 -> scripts\deploy-ha-dev.ps1
```
- **The deploy scripts live on `main`** (`deploy.cmd`, `deploy.ps1`,
  `scripts/deploy-ha-dev.ps1`) — they are *not* present on feature branches.
- Mechanism: builds (`npm run lint` + `rollup`, or `-FullBuild`), ensures the remote
  directory exists (`ssh … mkdir -p`), then `scp`s `dist/weather-radar-card.js`.
- **Target** is read from `scripts/deploy-ha-dev.local.ps1` — a git-excluded,
  machine-local config that the tracked script *sources* (the script errors with clear
  instructions if it's missing, so each clone supplies its own). Configured target:
  `root@homeassistant.local:/homeassistant/www/custom-cards/weather-radar-card-dev/weather-radar-card.js`.
- Switches: `-DryRun`, `-SkipBuild`, `-FullBuild`. After deploy, **bump the Lovelace
  resource `?v=devN`**. Same wrapper-chain pattern as the sibling card repos.

## Git
- `origin` → `github.com/cgjolberg/weather-radar-card`;
  **`upstream` → `github.com/jpettitt/weather-radar-card.git`** (this is a fork).
- **Forgejo:** this workspace repo pushes to **GitHub only** — by design. Forgejo
  backs up the **HA server's own config** (a separate lane, reachable via the
  home-assistant MCP), not these card repos. See [`../WORKSPACE-OVERVIEW.md`](../WORKSPACE-OVERVIEW.md).
- As of 2026-06-19: on **`main`**, in sync with `origin/main`. (The
  `feature/progress-bar-touch-height` branch — the touch-target work behind the root
  `../Progress bar touch demo.mp4` — was being PR'd back to `upstream`; switched to `main`
  for the deploy path.) Per `CLAUDE.md`, `main` is the only long-lived branch.

## Repo-specific notes
- **Line endings — fork-safe handling.** `.gitattributes` here only marks
  `dist/weather-radar-card.js` as generated; it does **not** pin `eol=lf`. Because this is
  a **fork that PRs back to `upstream`**, its tracked `.gitattributes` is deliberately left
  unchanged (avoid diverging upstream), and the deploy artifact is JS anyway. For local LF
  consistency, `core.autocrlf` is set to **false** in this clone (2026-06-19) instead of
  committing an `eol` change.
- The repo's own `AGENTS.md` diagnostic discipline ("no fixes without understanding")
  is a hard constraint — honor it.

# weather-radar-card — canonical rules for AI coding agents

This is the **single rules file** for this repo (there is no longer an
`AGENTS.md` — its contents were absorbed here). Read it before making any
change. The root [`../CLAUDE.md`](../CLAUDE.md) governs workspace-wide policy;
where this file and the root overlap on deploy/push, the root is authoritative.

**Workspace autonomy policy (root, 2026-06-20).** Commit with a reviewed diff,
push to `origin` (the cgjolberg fork), and deploy to HA to complete a task — **no
per-action approval**; review happens via git history. Two carve-outs stay
explicit-request-only: **PRs to `upstream` (jpettitt)** and **any history
rewriting** (rebase / `reset --hard` / force-push / tag deletion).

## What this project is

**Weather Radar Card** is a Home Assistant custom Lovelace card that renders
animated weather radar from RainViewer, NOAA/NWS, and DWD, plus optional overlays
(US wildfires, NWS watches & warnings, Blitzortung lightning, global wind). Lit /
TypeScript source under [`src/`](src/), bundled by Rollup into
[`dist/weather-radar-card.js`](dist/) — the single file HA loads.

Read order for context, design rationale, and the roadmap:

- [`README.md`](README.md) — what the card does, install, the "What's new" line
  for the current minor version, the Roadmap, the documentation map.
- [`CHANGELOG.md`](CHANGELOG.md) — Keep-a-Changelog format; what actually shipped.
- [`docs/todo.md`](docs/todo.md) — working backlog (shipped inline as history;
  open ideas unchecked).
- [`docs/configuration.md`](docs/configuration.md) — full options table, the
  canonical YAML reference for users.
- [`docs/animation.md`](docs/animation.md) — internal architecture: layer
  z-stack, two-slot crossfade, opacity ownership, tile-size rules. **Read before
  touching playback / fetch / opacity code.**
- [`docs/*-feature-design.md`](docs/) — per-feature design docs (wildfires, NWS
  alerts, wind, lightning). Read the one matching the surface you're changing.
- [`docs/ha-elements-guide.md`](docs/ha-elements-guide.md) — **read before using
  any `ha-*` Web Component**: which one to use, the lazy-load timing window, the
  empirically-verified status of each, the design tokens to target.

## The diagnostic discipline

**No fixes without understanding.** This is the single most load-bearing rule in
this repo.

- Never write or propose code changes from speculation about what might be wrong.
  Diagnose first; *then* propose a fix.
- Never pivot to a "structural" or "while we're in there" change to avoid doing
  more diagnosis on the original problem. If the current diagnostic isn't giving
  you enough signal, **improve the diagnostic** — add a `console.warn`, add a
  probe in the dev HA instance, capture a Network tab waterfall — rather than
  guessing.
- Never proceed past a diagnostic step without explicit user go-ahead. Surface
  what the data shows, propose what to change, wait.
- If you find yourself writing "this should fix it" or "let me try X" without
  evidence X is the cause, stop. Read the rule again.

This applies equally to fresh problems and to fixes that don't work on the first
try. **A failed fix is not a license to start trying things — it's a signal that
the diagnosis was wrong.**

### Worked example — the rule behind a specific rule

Some frameworks have constraints the public API does not expose. When something
doesn't work the way the docs imply, **diagnose what the framework actually does
at runtime before coding a workaround, and document the workaround so the next
contributor doesn't "simplify" it back into a bug.**

The case that taught this rule here is the `leaflet.markercluster`
initialisation race —
[`src/weather-radar-card.ts:1086-1108`](src/weather-radar-card.ts#L1086-L1108).
Markercluster initialises its internal cluster tree
(`_topClusterLevel._bounds`) lazily on the first event tick that needs bounds;
there is no public "tree ready" lifecycle hook. The card's `ResizeObserver` can
fire *before* that first tick, in which case calling `map.invalidateSize()`
drives markercluster into reading the undefined `_bounds` and throwing
`Cannot read properties of undefined (reading 'lat')` — issue
[#110](https://github.com/jpettitt/weather-radar-card/issues/110), fixed in
commit `c33a4a3`.

The fix is a `requestAnimationFrame` defer plus a `try/catch`. The rAF lets the
lazy init complete (microtask, lands before next paint); the try/catch handles
the rare case where one rAF isn't enough (observer fires again on the next resize
tick and recovers). The doc-block above `_setupResizeObserver` explicitly warns:

> ⚠️ Do not "simplify" by removing the requestAnimationFrame defer or the
> try/catch.

The takeaway is general: when an HA / Lit / Leaflet / markercluster pattern needs
a non-obvious workaround, leave a doc-block that names the framework limitation
and what would break if someone "cleaned it up." For the same reason, when the HA
frontend doesn't behave the way a tutorial implies, grep the installed
`hass_frontend/frontend_latest/*.js` bundle for the element name *before* writing
a workaround — the published frontend changes between releases.

## Pre-commit gates — all green before any commit

These are the same checks `build.yml` runs in CI. Run them locally so CI is a
backstop, not your test runner:

```bash
npm run lint     # eslint src/*.ts — zero errors
npm test         # vitest run — all suites green
npm run build    # runs lint then rollup; rebuilds dist/weather-radar-card.js
```

`npm run build` runs lint + rollup but **not** vitest — so `npm test` is a
separate, required step. Docs-only changes (`*.md`) may skip the test suites; still
preview README / CHANGELOG / touched `docs/*.md` before pushing.

Install deps with **`npm install --legacy-peer-deps`** — the eslint config extends
an airbnb base that peer-depends on an older eslint major; without the flag npm
refuses to install (CI uses the same flag).

## Testing conventions

- Tests live under [`tests/`](tests/), using
  [vitest](https://vitest.dev/) with
  [happy-dom](https://github.com/capricorn86/happy-dom) as the DOM environment
  (see [`vitest.config.ts`](vitest.config.ts)).
- Convention is **"stub Leaflet, test the helpers"** — Leaflet's runtime is heavy
  and happy-dom can't drive it faithfully, so tests mock `L.TileLayer` / `L.WMS` /
  layer event APIs and exercise the helpers behind `@internal` exports. See
  [`tests/fetch-abort.test.ts`](tests/fetch-abort.test.ts) and
  [`tests/wind-helpers.test.ts`](tests/wind-helpers.test.ts).
- **Every behavioral change comes with a test that fails on `main`** and passes
  with the change; bug fixes get a regression test reproducing the symptom.
  Browser-only behaviour (fetch's forbidden-header rule, real pointer events, real
  ResizeObserver timing) won't surface in happy-dom — exercise it in the Docker HA
  testbed (`npm run ha:up`) and document the manual steps rather than fabricating a
  test that can't fail.

## Hard limits — never without explicit user approval in the same session

1. **Version bumps, tags, releases.** Do not edit `version` in
   [`package.json`](package.json) / [`package-lock.json`](package-lock.json), or
   `CARD_VERSION` in [`src/const.ts`](src/const.ts). Do not create tags/releases or
   trigger [`.github/workflows/release.yml`](.github/workflows/release.yml).
   Releases are human-initiated.
2. **CI / packaging / dependencies / build config.** Do not modify anything under
   [`.github/workflows/`](.github/workflows/), [`hacs.json`](hacs.json),
   `package.json` dependencies, `package-lock.json`,
   [`rollup.config.js`](rollup.config.js), or
   [`rollup.config.dev.js`](rollup.config.dev.js) without explicit approval — they
   shape what ships in `dist/` and the dev server.
3. **`dist/` JS bundle.** `dist/weather-radar-card.js` (+ `.js.gz`) are build
   outputs — **gitignored**, not tracked. Rebuild locally with `npm run build` for
   testing. Static assets in `dist/` (PNGs, SVGs, JPG) **are** tracked — canonical
   source, not build output; replace the file rather than hand-editing.
4. **Deletions.** Do not delete files or directories without instruction. Renames
   are fine; if a file looks unused, raise it rather than removing it.

If a task seems to require any of the above, stop and ask — don't work around the
rule by structuring the change differently. (History rewrites and `upstream` PRs
are the workspace-level carve-outs above.)

## Documentation obligations — updated in the same commit as the change

- **[`README.md`](README.md)** — "What's new" line + Roadmap, on every user-facing
  feature change.
- **[`CHANGELOG.md`](CHANGELOG.md)** — an entry under `## [Unreleased]`
  (Keep-a-Changelog) for every user-visible change, and for internal changes an
  upgrader should know about.
- **[`docs/todo.md`](docs/todo.md)** — tick finished items in place; add follow-up
  work with enough context to pick up later.
- **[`docs/configuration.md`](docs/configuration.md)** — when a config field is
  added, renamed, or changes behaviour, update the options table and examples.
- **[`docs/animation.md`](docs/animation.md) /
  [`docs/*-feature-design.md`](docs/)** — update when the architectural approach,
  a constraint, or a documented decision changes. **Read `animation.md` before
  touching playback / fetch / opacity; read
  [`docs/ha-elements-guide.md`](docs/ha-elements-guide.md) before using `ha-*`
  components.** These are load-bearing records — typo/clarification edits are fine;
  wholesale restructuring needs approval.

## Commit messages

One-line subject `<type>(<scope>): <summary>` or `<type>: <summary>`. Types:
`feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `perf`, `security`,
`release`. Subject under ~72 chars; body explains the *why* when non-obvious.
Sign agent-authored work with a `Co-Authored-By:` trailer. Don't amend or squash a
commit once pushed to a PR branch — reviewers track changes via the commit history.

## Branch policy

`main` is the canonical and **only** long-lived branch (the pre-transfer `master`
was removed mid-2026 — if a memory says otherwise, update it). Work directly on
`main` for the autonomous workspace flow. **Feature branches exist only for
explicitly-requested `upstream` PRs** — those PRs then follow upstream's own
contributor rules (branch naming, PR template, human review/merge), which are out
of scope for the autonomous path.

## Permissions — deploy/push runs prompt-free

Deploy/push runs prompt-free via the workspace permission layer — a PreToolUse
hook (Layer 0) plus this repo's own `.claude/settings.json` as declarative
fallback when the session is scoped here. Exact pushes only
(`git push origin main`); force-push and **`upstream` (jpettitt)** pushes always
prompt by design. Form contract, current status, and maintenance rules: root
[`../CLAUDE.md`](../CLAUDE.md) (*Shell commands & permission prompts*) and
[`../.claude/PERMISSIONS.md`](../.claude/PERMISSIONS.md). Prefer the PowerShell
tool and the committed wrappers (`./deploy.cmd`, `../commit-push.cmd`) over ad-hoc
commands.

## Workspace notes

- **Per-user Claude Code memory** under `~/.claude/projects/<project>/` is saved
  context from prior sessions (preferences, decisions, project state). It
  complements this file; it does **not** override it. If a memory entry conflicts
  with this file, this file wins and the memory should be updated.
- **Working plan: read [`PLAN.md`](PLAN.md) first, keep it updated.** It's the
  persistent record of what we're doing in *this* repo — current focus, next steps,
  open questions, decisions. Update it in the **same commit** as the work (the
  workspace `SessionStart` hook auto-prints its *Current focus* + *Next steps*).
  PLAN.md is a workspace-local working file — keep it out of `upstream`-facing
  concerns.
- **Keep docs current without being asked.** When a change affects the build,
  deploy, push/credentials, or branch story, update [`OVERVIEW.md`](OVERVIEW.md)
  (bump its `> Snapshot:` date) in the **same commit** — and if the deploy/push
  story changed, also the `card-deploy-setup` memory and
  [`../WORKSPACE-OVERVIEW.md`](../WORKSPACE-OVERVIEW.md). Derive dates/status from
  `git`; don't invent them. Fixing a doc the code has outgrown is in scope even
  when the user only asked about code.

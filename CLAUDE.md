# CLAUDE.md

The canonical rules for AI coding agents working on this repository
live in [`AGENTS.md`](AGENTS.md). Read it first. Everything below is
Claude-specific supplement, not override.

## Claude-specific notes

- Per-user Claude Code memory under `~/.claude/projects/<project>/`
  is your working knowledge — saved context from prior sessions
  (user preferences, decisions, project state). It complements
  [`AGENTS.md`](AGENTS.md); it does **not** override it. If a
  memory entry conflicts with [`AGENTS.md`](AGENTS.md),
  [`AGENTS.md`](AGENTS.md) wins and the memory entry should be
  updated.
- **Push/deploy autonomy (workspace policy, 2026-06-20).** In this workspace
  the user has granted Claude **durable** autonomy to commit, push to
  `origin` (the cgjolberg fork), and deploy to HA to complete a task —
  **no per-action approval**; review happens via git history. See the root
  [`../CLAUDE.md`](../CLAUDE.md) and [`OVERVIEW.md`](OVERVIEW.md) for the
  full policy and the deploy/push mechanics. This is a deliberate standing
  decision, not a session-level grant. Two carve-outs still hold: the
  **diagnostic discipline** below (no fixes without understanding), and
  **`upstream` (jpettitt) PRs**, which remain a deliberate, explicitly
  requested action — autonomy covers `origin` + HA deploy, not contributing
  upstream. No history rewriting (rebase/reset --hard/force-push) without an
  explicit instruction.
- The **diagnostic discipline** in [`AGENTS.md`](AGENTS.md) ("no
  fixes without understanding") is load-bearing. It exists because
  the rule was learned from real incidents in this codebase — the
  `leaflet.markercluster` init race ([#110](https://github.com/jpettitt/weather-radar-card/issues/110))
  is the canonical example. Treat it as a hard constraint, not
  advisory.
- `main` is the canonical and only long-lived branch. The repo had a
  `master` branch up to mid-2026 from its pre-transfer history; it
  has been removed. If a memory entry says otherwise, update it.
- **Keep docs current without being asked.** When a change affects the
  build, deploy, push/credentials, or branch story, update
  [`OVERVIEW.md`](OVERVIEW.md) (bump its `> Snapshot:` date) in the **same
  commit** — and if the deploy/push story changed, also the
  `card-deploy-setup` memory and
  [`../WORKSPACE-OVERVIEW.md`](../WORKSPACE-OVERVIEW.md). See *Keeping this
  file current* in [`OVERVIEW.md`](OVERVIEW.md). Project/code rules stay in
  [`AGENTS.md`](AGENTS.md); workspace deploy specifics stay in `OVERVIEW.md`.

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
- **Run deploy/push prompt-free (allowlisted in [`../.claude/settings.json`](../.claude/settings.json),
  2026-06-28).** Invoke as **standalone, forward-slash, `cd`-free** commands — in-repo
  `git push origin main` then `./deploy.cmd`, or from the workspace root
  `git -C ./weather-radar-card push origin main` then `./weather-radar-card/deploy.cmd`. A
  `cd`-prefixed, back-slashed (`.\deploy.cmd`), or piped/chained form won't match the allowlist
  and will prompt. Force-push and **`upstream` (jpettitt) pushes** are deliberately left to prompt.
  (Allowlist/deploy specifics belong here in `CLAUDE.md`/`OVERVIEW.md`, not in fork-facing `AGENTS.md`.)
- **Allowlist scoping.** Scoped into this repo (the `cd`-into-it workflow), the live permissions are
  **this repo's own** [`.claude/settings.json`](.claude/settings.json) + your user settings — **not**
  the parent's. So the deploy/push entries above live here too, alongside the workspace's shared
  **read-only MCP allowlist** (HA `ha_*` reads + Chrome reads) — kept **in sync across all repos + the
  root** and **never** moved to user/global `~/.claude/settings.json` (auto-approval is scoped to this
  tree on purpose). Full logic: root [`../CLAUDE.md`](../CLAUDE.md) → *Permission allowlists*. (This is
  a workspace/deploy specific — it stays here, not in the fork-facing `AGENTS.md`.)
- **Shell: prefer the PowerShell tool.** The Bash tool is enabled; the dev-loop wrappers are
  allowlisted under **both** `Bash(...)` and `PowerShell(...)` in this repo's `.claude/settings.json`
  (so they run prompt-free whichever facade Claude picks), but PowerShell stays the default. (Workspace
  specific; stays here, not in `AGENTS.md`.)
- The **diagnostic discipline** in [`AGENTS.md`](AGENTS.md) ("no
  fixes without understanding") is load-bearing. It exists because
  the rule was learned from real incidents in this codebase — the
  `leaflet.markercluster` init race ([#110](https://github.com/jpettitt/weather-radar-card/issues/110))
  is the canonical example. Treat it as a hard constraint, not
  advisory.
- `main` is the canonical and only long-lived branch. The repo had a
  `master` branch up to mid-2026 from its pre-transfer history; it
  has been removed. If a memory entry says otherwise, update it.
- **Working plan: read [`PLAN.md`](PLAN.md) first, keep it updated.** It's the
  persistent record of what we're doing in *this* repo — current focus, next
  steps, open questions, decisions, and a dated log. Read it at the start of any
  work here (the workspace `SessionStart` hook also auto-prints its *Current
  focus* + *Next steps*), and update it in the **same commit** as the work so we
  don't lose track when bouncing between projects. PLAN.md is a workspace-local
  working file — keep it out of `upstream`-facing concerns; it's not part of
  [`AGENTS.md`](AGENTS.md)'s fork-facing code rules.
- **Keep docs current without being asked.** When a change affects the
  build, deploy, push/credentials, or branch story, update
  [`OVERVIEW.md`](OVERVIEW.md) (bump its `> Snapshot:` date) in the **same
  commit** — and if the deploy/push story changed, also the
  `card-deploy-setup` memory and
  [`../WORKSPACE-OVERVIEW.md`](../WORKSPACE-OVERVIEW.md). See *Keeping this
  file current* in [`OVERVIEW.md`](OVERVIEW.md). Project/code rules stay in
  [`AGENTS.md`](AGENTS.md); workspace deploy specifics stay in `OVERVIEW.md`.

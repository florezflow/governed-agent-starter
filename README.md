# Governed Agent Starter

A GitHub repo where a coding agent opens pull requests and can't merge without you.

Write `@claude` in an issue. Claude works in GitHub Actions, follows this repo's rules, design
language and skill, and takes before and after screenshots. A separate job with no model checks its
diff and opens the pull request with the plan, the check results and the screenshots. You review and
merge; merging publishes the demo site.

Other people can use the agent without any rights in the repository: maintainers start it, people
on an allowlist start it within a daily quota, and everyone else waits for a maintainer's approval.

**Live demo site:** <https://florezflow.github.io/governed-agent-starter/>

## Try it

You can use the agent on this repository without any rights in it.

1. **[Sign in with GitHub](https://n8n.marcoflorez.com/webhook/site-agent-signup).** It reads only your
   public profile and puts your username on the allowlist. Accounts must be at least 30 days old.
2. **[Open an issue](https://github.com/florezflow/governed-agent-starter/issues/new?template=agent-request.yml)**
   that starts with `@claude` and says what should change on the demo site, for example
   `@claude add a dark mode that follows the system setting`.
3. **A pull request arrives** a few minutes later, with the plan, the checks and screenshots. A person
   reviews it; merging publishes the [demo site](https://florezflow.github.io/governed-agent-starter/).

You have 3 requests a day. Without signing up, your issue waits until a maintainer approves it with
the label `agent-approved`. What gets stored: your GitHub username, its numeric id and when you signed
up. To be removed, open an issue.

## What's in here

| File | What it does |
|---|---|
| `site/` | The demo website: one HTML page, one stylesheet, no build step, no external requests |
| `DESIGN.md` | The design language ("Swiss Pop Lite"): tokens, rules, components, words |
| `scripts/check-design.mjs` | Enforces the checked rules of `DESIGN.md`, including the safety rule (no scripts, forms or outside links); runs on every PR (`checks.yml`) |
| `AGENTS.md` | The rulebook for any agent (Claude Code, Copilot, Codex): where it may work, what it must never touch |
| `CLAUDE.md` | Imports `AGENTS.md` and adds what Claude Code needs in the workflow |
| `CHECKLIST.md` | One page to go through before any agent gets commit rights |
| `.claude/settings.json` | Allowed tools, and deny rules so the agent can't edit its own guardrails |
| `.claude/skills/site-change/` | The skill the agent loads for any site change: plan, check, screenshots, PR |
| `hooks/` | Example Claude Code hooks, off by default: guardrail files, git on `main`, design check after edits |
| `.mcp.json` | Playwright MCP, for the screenshots |
| `.github/workflows/claude.yml` | Gate, agent and deliver jobs: who may start Claude, Claude with a read-only token, a model-free job that checks the diff and opens the PR |
| `scripts/agent-gate.mjs`, `scripts/agent-deliver.mjs` | The gate's decisions and the deliver job's checks, with tests (`node --test scripts/*.test.mjs`) |
| `.github/rulesets/main.json` | The ruleset for `main`: pull requests only, code owner review, the design check required |
| `.github/CODEOWNERS` | Every change to `main` needs the owner's review |
| `.github/workflows/reset-demo.yml` | Weekly pull request that puts `site/` back to the tag `baseline` |
| `.github/ISSUE_TEMPLATE/` | The issue form for requests to the agent |
| `.github/workflows/pages.yml` | Publishes `site/` to GitHub Pages when a change lands on `main` |
| `.github/workflows/wif-smoke-test.yml` | Checks the federation from both sides (`/wif-test` comment) |

## Guardrails

- **No API key anywhere.** GitHub's OIDC token is exchanged for a 10-minute Claude token through a
  federation rule that only accepts this repository, `main`, and comment or issue events.
- **A spend cap** on the agent's own Claude Console workspace, plus 40 turns and 20 minutes per run.
- **A gate before the model.** Only maintainers, allowlisted people within a quota, or issues a
  maintainer approved start Claude, and Claude sees only the request text, as data.
- **The model holds no write token.** Claude runs with the job's read-only token. Its browser can
  reach only the local site, and `/proc` and `.git` are denied. The diff leaves the job as an artifact.
- **A model-free job checks the diff.** Only `site/` (HTML, CSS, SVG, images) and screenshots, no
  symlinks, real images only, and the design and safety rules, with the scripts from `main`.
- **The agent can't edit its rules:** `.github/`, `.claude/`, `hooks/`, `CLAUDE.md`, `AGENTS.md`,
  `.mcp.json` and `scripts/` are denied in its settings and dropped by the deliver job.
- **A human merges.** The ruleset requires a code owner's review on `main`; nothing is published
  before that merge.

Before you give any agent commit rights, here or elsewhere, go through [`CHECKLIST.md`](CHECKLIST.md).

## Setup after copying

**Use this template** copies the files only. Settings, variables, the ruleset, labels and tags
don't come with it; the steps below set them.

1. Apply the ruleset (change the owner in `CODEOWNERS` first):
   `gh api -X POST repos/<owner>/<repo>/rulesets --input .github/rulesets/main.json`
2. Make the default workflow token read-only and let GitHub Actions open pull requests. The deliver
   job opens the PR; approvals still need a code owner.
   `gh api -X PUT repos/<owner>/<repo>/actions/permissions/workflow -f default_workflow_permissions=read -F can_approve_pull_request_reviews=true`
   (Settings → Actions → General → Workflow permissions.)
3. Create the label `agent-approved`, and tag the baseline: `git tag baseline && git push origin baseline`.
4. Repository variables: the four `ANTHROPIC_*` IDs, and optionally `AGENT_USERS` (logins,
   comma-separated), `AGENT_DAILY_QUOTA` (default 3) and `AGENT_SIGNUP_URL`.

## Read-only tokens

The model never holds a token that can write. Three places to check:

1. **The agent job.** `claude.yml` gives it `contents: read`, `issues: read` and `id-token: write`
   (for the federation), and passes `github_token: ${{ github.token }}`, so the action uses this
   read-only job token instead of the Claude GitHub App's token. Only `deliver`, which runs no
   model, can write. To check, open the agent job's log: **Set up job → GITHUB_TOKEN Permissions**
   lists Contents and Issues as read.
2. **The repository default.** With step 2 above, any workflow without its own `permissions:`
   block gets read access only. To check:
   `gh api repos/<owner>/<repo>/actions/permissions/workflow` shows `"default_workflow_permissions":"read"`.
3. **A local session or a GitHub MCP server.** Use a fine-grained personal access token, never your
   own `gh` login: GitHub → Settings → Developer settings → Fine-grained tokens → Generate.
   Repository access: only this repository. Permissions: Contents, Issues and Pull requests set to
   Read-only (Metadata is added automatically). Expiry: 30 days. Keep it in your shell or keychain,
   never in the repository or `.mcp.json`. To check, with the token in `GH_TOKEN`:
   `gh api -X POST repos/<owner>/<repo>/labels -f name=probe` must fail with HTTP 403.
   For the GitHub MCP server, also switch on its read-only mode: the remote URL
   `https://api.githubcopilot.com/mcp/readonly`, or `--read-only` for the local server.

## Example hooks

Claude Code runs hooks before and after its tool calls. The three in `hooks/` are plain Node, with
no dependencies:

| Hook | When | What it does |
|---|---|---|
| `protect-guardrails.mjs` | before Edit, Write | Refuses edits to `.github/`, `.claude/`, `hooks/`, `scripts/`, `AGENTS.md`, `CLAUDE.md`, `.mcp.json`, `.git/` and anything outside the repository, symlinks included |
| `guard-bash.mjs` | before Bash | Refuses commits and pushes on the default branch, pushes to it, force pushes, `--no-verify`, `gh pr merge` and `gh pr review --approve` |
| `design-check.mjs` | after Edit, Write | Runs the design check after a change in `site/` and hands the problems back to Claude |

They are off by default, because the workflow's agent already has its deny rules, the read-only
token and the deliver job. To switch them on for your own sessions, put this into
`.claude/settings.local.json` (ignored by git). To use them in the workflow as well, put it into
`.claude/settings.json` instead.

```json
{
  "hooks": {
    "PreToolUse": [
      { "matcher": "Edit|Write|NotebookEdit",
        "hooks": [{ "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/hooks/protect-guardrails.mjs\"" }] },
      { "matcher": "Bash",
        "hooks": [{ "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/hooks/guard-bash.mjs\"" }] }
    ],
    "PostToolUse": [
      { "matcher": "Edit|Write",
        "hooks": [{ "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/hooks/design-check.mjs\"" }] }
    ]
  }
}
```

A hook reads the command as text, so `sh -c` or a script can get past `guard-bash.mjs`. Treat the
hooks as a seatbelt for honest mistakes. The read-only token and the ruleset on `main` are the
boundary. Tests: `node --test hooks/*.test.mjs`.

Setup guide and the full write-up: [Hand GitHub issues to Claude with no API key](https://florezflow.com/claude-github-issues/) on florezflow.com.

## Licence

MIT

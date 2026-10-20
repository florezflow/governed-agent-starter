# Governed Agent Starter

A GitHub repo where a coding agent opens pull requests and can't merge without you.

Write `@claude` in an issue. Claude works in GitHub Actions, follows this repo's rules, design
language and skill, and takes before and after screenshots. A separate job with no model checks its
diff and opens the pull request with the plan, the check results and the screenshots. You review and
merge; merging publishes the demo site.

Other people can use the agent without any rights in the repository: maintainers start it, people
on an allowlist start it within a daily quota, and everyone else waits for a maintainer's approval.

**Live demo site:** <https://florezflow.github.io/governed-agent-starter/> (after Pages is enabled)

## What's in here

| File | What it does |
|---|---|
| `site/` | The demo website: one HTML page, one stylesheet, no build step, no external requests |
| `DESIGN.md` | The design language ("Swiss Pop Lite"): tokens, rules, components, words |
| `scripts/check-design.mjs` | Enforces the checked rules of `DESIGN.md`, including the safety rule (no scripts, forms or outside links); runs on every PR (`checks.yml`) |
| `CLAUDE.md` | The agent's rulebook: where it may work, what it must never touch |
| `.claude/settings.json` | Allowed tools, and deny rules so the agent can't edit its own guardrails |
| `.claude/skills/site-change/` | The skill the agent loads for any site change: plan, check, screenshots, PR |
| `.mcp.json` | Playwright MCP, for the screenshots |
| `.github/workflows/claude.yml` | Gate, agent and deliver jobs: who may start Claude, Claude with a read-only token, a model-free job that checks the diff and opens the PR |
| `scripts/agent-gate.mjs`, `scripts/agent-deliver.mjs` | The gate's decisions and the deliver job's checks, with tests (`node --test scripts/*.test.mjs`) |
| `.github/rulesets/main.json` | The ruleset for `main`: pull requests only, code owner review, the design check required |
| `.github/CODEOWNERS` | Every change to `main` needs the owner's review |
| `.github/workflows/reset-demo.yml` | Weekly pull request that puts `site/` back to the tag `baseline` |
| `.github/ISSUE_TEMPLATE/` | The issue form for requests to the agent |
| `.github/workflows/pages.yml` | Publishes `site/` to GitHub Pages when a change lands on `main` |
| `.github/workflows/wif-smoke-test.yml` | Checks the federation from both sides (`/wif-test` comment) |

## Try it

Open an issue with the form **Ask the agent to change the demo site**, for example:

```
@claude add a FAQ section with three questions a team lead would ask
```

If you're not a maintainer or on the allowlist, a maintainer approves the issue with the label
`agent-approved`, and the agent starts then.

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
- **The agent can't edit its rules:** `.github/`, `.claude/`, `CLAUDE.md`, `.mcp.json` and
  `scripts/` are denied in its settings and dropped by the deliver job.
- **A human merges.** The ruleset requires a code owner's review on `main`; nothing is published
  before that merge.

## Setup after copying

1. Apply the ruleset (change the owner in `CODEOWNERS` first):
   `gh api -X POST repos/<owner>/<repo>/rulesets --input .github/rulesets/main.json`
2. Settings → Actions → General → allow GitHub Actions to create and approve pull requests. The
   deliver job opens the PR; approvals still need a code owner.
3. Create the label `agent-approved`, and tag the baseline: `git tag baseline && git push origin baseline`.
4. Repository variables: the four `ANTHROPIC_*` IDs, and optionally `AGENT_USERS` (logins,
   comma-separated), `AGENT_DAILY_QUOTA` (default 3) and `AGENT_SIGNUP_URL`.

Setup guide and the full write-up: [Hand GitHub issues to Claude with no API key](https://florezflow.com/claude-github-issues/) on florezflow.com.

## Licence

MIT

# Governed Agent Starter

A GitHub repo where a coding agent opens pull requests and can't merge without you.

Comment `@claude` on an issue. Claude works in GitHub Actions, follows this repo's rules, design
language and skill, takes before and after screenshots, and opens a pull request with the plan,
the design check result and the screenshots. You review and merge; merging publishes the demo site.

**Live demo site:** <https://florezflow.github.io/governed-agent-starter/> (after Pages is enabled)

## What's in here

| File | What it does |
|---|---|
| `site/` | The demo website: one HTML page, one stylesheet, no build step, no external requests |
| `DESIGN.md` | The design language ("Swiss Pop Lite"): tokens, rules, components, words |
| `scripts/check-design.mjs` | Enforces the checked rules of `DESIGN.md`; runs on every PR (`checks.yml`) |
| `CLAUDE.md` | The agent's rulebook: where it may work, what it must never touch |
| `.claude/settings.json` | Allowed tools, and deny rules so the agent can't edit its own guardrails |
| `.claude/skills/site-change/` | The skill the agent loads for any site change: plan, check, screenshots, PR |
| `.mcp.json` | Playwright MCP, for the screenshots |
| `.github/workflows/claude.yml` | The agent: `claude-code-action`, authenticated by workload identity federation |
| `.github/workflows/pages.yml` | Publishes `site/` to GitHub Pages when a change lands on `main` |
| `.github/workflows/wif-smoke-test.yml` | Checks the federation from both sides (`/wif-test` comment) |

## Try it

On an issue in this repository (write access needed), comment for example:

```
@claude add a FAQ section with three questions a team lead would ask
```

## Guardrails

- **No API key anywhere.** GitHub's OIDC token is exchanged for a 10-minute Claude token through a
  federation rule that only accepts this repository, `main`, and comment or issue events.
- **A spend cap** on the agent's own Claude Console workspace, plus 40 turns and 20 minutes per run.
- **The agent can't edit its rules:** `.github/`, `.claude/`, `CLAUDE.md`, `.mcp.json` and
  `scripts/` are denied in its settings.
- **A human merges.** The agent opens pull requests; it never merges or approves.

Setup guide and the full write-up: coming on [florezflow.com](https://florezflow.com).

## Licence

MIT

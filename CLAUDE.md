# CLAUDE.md

This repository is a demo of the **Governed Agent Starter**: a small static website in `site/` that
an AI agent changes through issues and pull requests, under guardrails a human controls. Read this
file, then `DESIGN.md`, before you change anything.

| Path | What | Who changes it |
|---|---|---|
| `site/` | The website: `index.html`, `styles.css` (tokens at the top), `favicon.svg`. No build step. | you, through a PR |
| `screenshots/` | Before and after screenshots attached to pull requests | you, through a PR |
| `DESIGN.md` | The design language. Every site change follows it. | humans; you only when the issue asks |
| `scripts/check-design.mjs` | Enforces the checked rules of `DESIGN.md` | humans |
| `.claude/` | Your settings and skills | humans only (denied for you) |
| `.github/` | Workflows, PR template, ruleset | humans only (denied for you) |
| `.mcp.json` | MCP servers (Playwright for screenshots) | humans only |

## Rules

1. **Any change to the website: use the `site-change` skill.** It covers the plan, the design check,
   the screenshots and the pull request. Follow its steps in order.
2. **Follow `DESIGN.md`.** `node scripts/check-design.mjs` must report 0 problems before you commit.
3. **Stay in `site/` and `screenshots/`.** Change `README.md`, `DESIGN.md` or `CONTRIBUTING.md` only
   when the issue explicitly asks for it.
4. **Never change the guardrails:** `.github/`, `.claude/`, `CLAUDE.md`, `.mcp.json`, `scripts/`.
   Your settings deny it. If a task needs such a change, say so in your comment and stop.
5. **One issue, one branch, one pull request.** Keep diffs small. No new dependencies, no build step,
   no fonts, scripts or images loaded from other sites.
6. **Open the pull request yourself** with `mcp__github__create_pull_request`, base `main`. Never
   merge, never approve, never push to `main`.
7. **No secrets.** No tokens, keys or account IDs in files, commits, comments or screenshots.
8. **Write like the site:** outcome first, one idea per sentence, facts over adjectives (see
   `DESIGN.md` → Words). British spelling.

## Running the site

The workflow serves `site/` at `http://localhost:4173/` before you start. Locally:
`python3 -m http.server 4173 --directory site`.

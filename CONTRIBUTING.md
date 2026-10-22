# Contributing

This repo lets a coding agent, Claude, open pull requests. Claude can't merge them: the ruleset on `main` requires a human review. This file explains how to ask Claude for work and what to expect.

## How to trigger @claude

Mention `@claude` in one of these places:

- **A new issue**: put `@claude` in the title or the body. The issue form does that for you.
- **A comment** on an issue: any new comment that contains `@claude`. Comments on pull requests are
  ignored; ask on the issue, and the agent updates the same pull request.

Who starts the agent:

| Who | What happens |
|---|---|
| `OWNER`, `MEMBER` or `COLLABORATOR` | The agent starts. |
| Someone on the allowlist (repository variable `AGENT_USERS`) | The agent starts, up to `AGENT_DAILY_QUOTA` requests in 24 hours (default 3). |
| Anyone else | A comment explains how to sign up. A maintainer can approve the issue with the label `agent-approved`; the agent then starts on the issue text as it was at that moment. |

Nobody needs rights in the repository to use the agent. Claude reads only the issue or comment that
started it, as data: the request says what to change, and `CLAUDE.md` decides how.

Be specific: name the section and the change, for example "@claude make the FAQ collapsible, one row
per question."

## What happens

1. **Gate** (no model): decides as in the table above and posts a status comment with the run link.
2. **Agent**: Claude follows the `site-change` skill (`.claude/skills/site-change/`): a plan, the
   change in `site/`, the design check, and before and after screenshots taken with Playwright MCP.
   It runs with a read-only token and writes a title and summary instead of committing.
3. **Deliver** (no model): checks the diff with the scripts from `main`, commits it to
   `agent/issue-<number>`, opens or updates the pull request and starts the required check. The
   status comment then links the pull request, or says why there is none.
4. **You** review and merge. Merging publishes the site.

## Limits

- **Runs are capped**: 40 turns and 20 minutes per run. A large task may stop before it finishes; split it into smaller issues.
- **One run per issue at a time**. A second `@claude` on the same issue waits for the first run to finish, and its change lands on the same pull request.
- **Only the site**: the deliver job accepts changes to `site/` (HTML, CSS, SVG, images) and `screenshots/` only. JavaScript, docs and everything else are changed by people.
- **Model**: Claude runs on Haiku 5.5, the cheapest model. For harder, multi-file changes the workflow can be switched to `claude-sonnet-5-5` in `.github/workflows/claude.yml`.
- **Spend limit**: runs stop when the workspace's monthly spend limit in the Claude Console is reached.
- **No changes to its own guardrails**: `.claude/settings.json` denies edits to `.github/`, `.claude/`, `hooks/`, `CLAUDE.md`, `AGENTS.md`, `.mcp.json` and `scripts/`, and the deliver job drops them. Those changes must be made by a human.
- **No pushing, merging or approving**: Claude has no write token. The ruleset on `main` requires a code owner's review.

## Reviewing Claude's work

- Read the diff before merging. Claude can make mistakes, and its own summary may not match what the code does.
- Ask for changes by commenting `@claude` on the issue. The next run builds on the open pull request's branch.
- Check the run linked from the status comment if a run fails or stops early.
- The demo resets: `reset-demo.yml` opens a pull request every Monday that restores `site/` from the tag `baseline`.

## Setup and maintenance

Claude authenticates with GitHub-to-Claude workload identity federation. There is no API key in the repository, and none should be added: a static `anthropic_api_key` input would silently take precedence over federation. The four `ANTHROPIC_*` IDs are repository variables, not secrets.

Runs are billed as Claude Code usage. The monthly API credits that come with Max and Team plans don't cover them, so the workspace needs purchased credit.

The workflow `.github/workflows/wif-smoke-test.yml` checks the federation setup. Post `/wif-test` as a comment from an owner to confirm that a run can obtain a token and make a billed call.

## Contributing without Claude

Anyone can open issues and pull requests the usual way. Claude's runs are an addition to that workflow, not a replacement.

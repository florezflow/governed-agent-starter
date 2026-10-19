# Contributing

This repo lets a coding agent, Claude, open pull requests. Claude can't merge them: the ruleset on `main` requires a human review. This file explains how to ask Claude for work and what to expect.

## How to trigger @claude

Mention `@claude` in one of these places:

- **A new issue**: put `@claude` in the title or the body. Claude runs when the issue is opened.
- **A comment** on an issue or on a pull request conversation: any new comment that contains `@claude`.

Only people with the `OWNER`, `MEMBER`, or `COLLABORATOR` role on this repository can trigger a run. Anyone else's `@claude` is ignored. Claude only acts on the comment or issue that mentions it. Other comments in the thread are context, not instructions.

Be specific about the task. Good requests name the files, the behaviour you want, and any constraints, for example: "@claude add a `--verbose` flag to `src/cli.py` and document it in the README."

## What Claude does

1. Reads the issue or comment, plus the repository files it needs.
2. For a question or a review request, replies in its single comment. It does not change code unless asked.
3. For a change to the website, follows the `site-change` skill (`.claude/skills/site-change/`): a plan, the change in `site/`, the design check from `DESIGN.md`, and before and after screenshots taken with Playwright MCP.
4. Commits on a branch named `claude/issue-<number>-<timestamp>`, pushes it, and opens the pull request itself, with the plan, the check result and the screenshots. Review it, then merge it yourself if it's right.

Claude edits its one comment as it works: a checklist of tasks, then a summary at the end. It doesn't post new comments.

## Limits

- **Runs are capped**: 40 turns and 20 minutes per run. A large task may stop before it finishes; split it into smaller issues.
- **One run per issue at a time**. A second `@claude` on the same issue waits for the first run to finish. Runs are not cancelled.
- **Model**: Claude runs on Haiku 5.5, the cheapest model. For harder, multi-file changes the workflow can be switched to `claude-sonnet-5-5` in `.github/workflows/claude.yml`.
- **Spend limit**: runs stop when the workspace's monthly spend limit in the Claude Console is reached.
- **No changes to its own guardrails**: `.claude/settings.json` denies edits to `.github/`, `.claude/`, `CLAUDE.md`, `.mcp.json` and `scripts/`. Those changes must be made by a human.
- **No merging, no approving**: Claude can't merge branches, rebase, or submit formal PR reviews.

## Reviewing Claude's work

- Read the diff before merging. Claude can make mistakes, and its own summary may not match what the code does.
- Ask for changes by commenting `@claude` on the pull request. Claude pushes follow-up commits to the existing branch.
- Check the job run log linked from Claude's comment if a run fails or stops early.

## Setup and maintenance

Claude authenticates with GitHub-to-Claude workload identity federation. There is no API key in the repository, and none should be added: a static `anthropic_api_key` input would silently take precedence over federation. The four `ANTHROPIC_*` IDs are repository variables, not secrets.

Runs are billed as Claude Code usage. The monthly API credits that come with Max and Team plans don't cover them, so the workspace needs purchased credit.

The workflow `.github/workflows/wif-smoke-test.yml` checks the federation setup. Post `/wif-test` as a comment from an owner to confirm that a run can obtain a token and make a billed call.

## Contributing without Claude

Anyone can open issues and pull requests the usual way. Claude's runs are an addition to that workflow, not a replacement.

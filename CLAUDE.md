# CLAUDE.md

@AGENTS.md

## Claude Code in the `claude.yml` workflow

The rules in `AGENTS.md` above apply in full. This adds what is specific to you here.

1. **Any change to the website: use the `site-change` skill.** It covers the plan, the design check,
   the screenshots and the title and summary for the pull request. Follow its steps in order.
2. **You don't commit, push or open the pull request.** Write `.agent/title.txt` and
   `.agent/summary.md` as the skill says; `.agent/` is never committed. The deliver job checks your
   changes in `site/` and `screenshots/`, drops everything else and opens the pull request; a human
   merges it. Where `AGENTS.md` says "say so in the pull request", write it in `.agent/summary.md`.
3. **Your settings deny the guardrails.** `.claude/settings.json` refuses edits to them. Don't try
   another tool or path.
4. **The site is already running** at `http://localhost:4173/` when you start.

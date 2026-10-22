# Before an agent gets commit rights

Go through this page before a coding agent can push branches or open pull requests in a repository.
Answer each line yes or no. One no means the agent waits. Where this kit does it is in brackets.

## Credentials

- [ ] No long-lived model key in the repository. GitHub's OIDC token is exchanged for a
      short-lived one, or the key is a single secret you can rotate in one place. (`claude.yml`)
- [ ] The federation rule accepts one repository by its numeric owner and repository IDs, the
      default branch only, and only the events that start the agent.
- [ ] The model's workspace has a monthly spend limit and alerts.
- [ ] The token the model holds can't write. A separate job with no model does the writing.
      (`agent` and `deliver` jobs)
- [ ] The default workflow token is read-only; each job asks for what it needs. (README → Read-only tokens)

## Branches and review

- [ ] Nobody pushes to `main` directly, the agent included. (`.github/rulesets/main.json`)
- [ ] Every pull request needs a person's approval, and a new push dismisses it. (ruleset)
- [ ] The checks that matter block the merge when they fail. (ruleset: `design`)
- [ ] Code owners cover the guardrails: workflows, agent settings, rules, hooks, scripts. (`.github/CODEOWNERS`)
- [ ] A person merges. Auto-merge is off, or needs the same review.

## What the agent may touch

- [ ] A rulebook says where it may work and what it never touches. (`AGENTS.md`, `CLAUDE.md`)
- [ ] Its tools are an allow list, and its own guardrail files are denied. (`.claude/settings.json`)
- [ ] Something that isn't the model drops changes outside the allowed paths. (`scripts/agent-deliver.mjs`)
- [ ] MCP servers are listed, pinned to a version and limited in what they reach. (`.mcp.json`)
- [ ] The request is passed in as data, and the rules say it can't change them. (prompt in `claude.yml`)

## Who starts it, and how far it goes

- [ ] Only people you chose start a run; everyone else waits for a maintainer. (gate)
- [ ] Every run stops at a turn and time limit, and people outside the team have a daily quota. (`claude.yml`)

## Seeing and stopping

- [ ] Every pull request shows the plan and the check results above the diff. (PR template)
- [ ] Each run's log lists the tools it called and the calls it was refused. ("Show what Claude did")
- [ ] You can stop it within a minute: `gh workflow disable claude.yml`, or delete the federation rule.
- [ ] You tried to break it once: a push to `main`, an edit to a workflow, and a request that tells
      it to ignore its rules. All three were refused.

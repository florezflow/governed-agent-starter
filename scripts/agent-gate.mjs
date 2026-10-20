#!/usr/bin/env node
// The gate in front of the agent. Runs in the first job of claude.yml, with no model and no
// write access to code. It decides whether this event may start Claude, and with which text.
//
//   maintainer   OWNER, MEMBER or COLLABORATOR wrote @claude            -> run
//   approved     a maintainer added the label `agent-approved`         -> run on the issue text
//   allowlist    the author is in the repository variable AGENT_USERS  -> run, within a daily quota
//   anyone else                                                         -> a comment, no run
//
// Inputs (env): GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_EVENT_NAME, GITHUB_EVENT_PATH, GITHUB_RUN_ID,
// GITHUB_OUTPUT, and the repository variables AGENT_USERS (comma-separated logins),
// AGENT_DAILY_QUOTA (default 3) and AGENT_SIGNUP_URL (optional).
// Outputs: run, trust, login, allowed_user, issue, base_ref, comment_id, request.
//
// No dependencies; `node --test scripts/*.test.mjs` tests the decisions.

import { readFileSync, appendFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

export const LABEL = 'agent-approved';
export const MAX_REQUEST = 4000;
const TRUSTED = ['OWNER', 'MEMBER', 'COLLABORATOR'];
const MARK = { signup: '<!-- agent-gate:signup -->', quota: '<!-- agent-gate:quota -->', status: '<!-- agent-gate:status -->' };

/** Removes what a reader can't see but a model would read: HTML comments, invisible and bidi characters. */
export function cleanRequest(text) {
  let t = String(text ?? '')
    .replace(/<!--[\s\S]*?(?:-->|$)/g, '')
    .replace(/[​-‏‪-‮⁠-⁤⁦-⁩﻿]/g, '')
    .replace(/[\u{E0000}-\u{E007F}]/gu, '')
    .replace(/<\/?\s*request\s*>/gi, '')
    .replace(/\r\n?/g, '\n')
    .trim();
  if (t.length > MAX_REQUEST) t = `${t.slice(0, MAX_REQUEST)}\n[request cut at ${MAX_REQUEST} characters]`;
  return t;
}

export const parseList = (value) =>
  String(value ?? '').split(/[\s,]+/).map((s) => s.trim().toLowerCase().replace(/^@/, '')).filter(Boolean);

/** Reads the event. Returns null when the event is not a request to the agent. */
export function readEvent(name, payload) {
  const issue = payload.issue;
  if (!issue || issue.pull_request) return null; // pull request conversations: ask on the issue
  const issueText = `${issue.title ?? ''}\n\n${issue.body ?? ''}`;
  if (name === 'issues' && payload.action === 'opened') {
    if (!/@claude\b/i.test(issueText)) return null;
    return { kind: 'issue', issue, author: issue.user, association: issue.author_association, text: issueText };
  }
  if (name === 'issues' && payload.action === 'labeled') {
    if (payload.label?.name !== LABEL) return null;
    // Only people with triage or write access can add labels; GitHub enforces that.
    // The text is the issue as it was when the label was added: later edits are not read.
    return { kind: 'approved', issue, author: issue.user, approver: payload.sender, association: 'APPROVED', text: issueText };
  }
  if (name === 'issue_comment' && payload.action === 'created') {
    const c = payload.comment;
    if (!/@claude\b/i.test(c.body ?? '')) return null;
    // Context from the issue only when the same person wrote it: someone else's issue text is not theirs to vouch for.
    const own = issue.user?.login === c.user?.login;
    const text = own ? `${issueText}\n\n---\n\n${c.body}` : c.body;
    return { kind: 'comment', issue, author: c.user, association: c.author_association, text };
  }
  return null;
}

/** Decides who this is. Quota is checked separately because it needs the API. */
export function trustOf(event, allowlist) {
  if (!event || event.author?.type === 'Bot') return 'ignore';
  if (event.kind === 'approved') return 'approved';
  if (TRUSTED.includes(event.association)) return 'maintainer';
  if (allowlist.includes(String(event.author?.login).toLowerCase())) return 'allowlist';
  return 'none';
}

// ---------- GitHub API ----------

const API = process.env.GITHUB_API_URL || 'https://api.github.com';
const REPO = process.env.GITHUB_REPOSITORY;

async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${path}: HTTP ${res.status} ${data?.message ?? ''}`);
  return data;
}

const comment = (issue, body) => api('POST', `/repos/${REPO}/issues/${issue}/comments`, { body });

async function hasMarker(issue, marker) {
  const comments = await api('GET', `/repos/${REPO}/issues/${issue}/comments?per_page=100`);
  return comments.some((c) => c.user?.type === 'Bot' && c.body?.includes(marker));
}

/** Runs of this workflow started by `login` in the last 24 hours, not counting this one. */
async function recentRuns(login) {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const q = `actor=${encodeURIComponent(login)}&created=${encodeURIComponent(`>=${since}`)}&per_page=100`;
  const { workflow_runs: runs } = await api('GET', `/repos/${REPO}/actions/workflows/claude.yml/runs?${q}`);
  return runs.filter((r) => String(r.id) !== String(process.env.GITHUB_RUN_ID) && r.conclusion !== 'skipped').length;
}

function setOutputs(outputs) {
  const file = process.env.GITHUB_OUTPUT;
  for (const [key, value] of Object.entries(outputs)) {
    const v = String(value ?? '');
    const line = v.includes('\n')
      ? (() => { const d = `EOF_${randomBytes(12).toString('hex')}`; return `${key}<<${d}\n${v}\n${d}\n`; })()
      : `${key}=${v}\n`;
    if (file) appendFileSync(file, line); else process.stdout.write(`[output] ${line}`);
  }
}

async function main() {
  const payload = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const event = readEvent(process.env.GITHUB_EVENT_NAME, payload);
  const trust = trustOf(event, parseList(process.env.AGENT_USERS));
  const issue = payload.issue?.number;
  const login = event?.author?.login ?? '';
  console.log(`event: ${process.env.GITHUB_EVENT_NAME}.${payload.action}  issue: #${issue}  author: ${login}  trust: ${trust}`);

  if (trust === 'ignore') return setOutputs({ run: 'false' });

  if (trust === 'none') {
    if (!(await hasMarker(issue, MARK.signup))) {
      const signup = process.env.AGENT_SIGNUP_URL;
      await comment(issue, [
        MARK.signup,
        signup
          ? `Thanks for the request. The agent starts on its own for people who have signed up: [sign in with GitHub](${signup}) (it reads only your public profile), then mention the agent again in a new comment.`
          : 'Thanks for the request. The agent starts on its own only for people on this repository\'s allowlist.',
        '',
        `Until then a maintainer can approve this issue with the label \`${LABEL}\`.`,
      ].join('\n'));
    }
    return setOutputs({ run: 'false', trust });
  }

  if (trust === 'allowlist') {
    const quota = Number(process.env.AGENT_DAILY_QUOTA || 3);
    const used = await recentRuns(login);
    console.log(`quota: ${used} of ${quota} runs used in the last 24 hours`);
    if (used >= quota) {
      // One notice per issue, so going over the quota can't be used to make the bot comment.
      if (!(await hasMarker(issue, MARK.quota))) {
        await comment(issue, `${MARK.quota}\nYou've used your ${quota} agent runs for the last 24 hours. Try again later, or a maintainer can approve this issue with the label \`${LABEL}\`.`);
      }
      return setOutputs({ run: 'false', trust });
    }
  }

  if (trust === 'approved') {
    await api('DELETE', `/repos/${REPO}/issues/${issue}/labels/${LABEL}`).catch((e) => console.log(`label not removed: ${e.message}`));
  }

  // Work continues on the open pull request for this issue, if there is one.
  const branch = `agent/issue-${issue}`;
  const owner = REPO.split('/')[0];
  const open = await api('GET', `/repos/${REPO}/pulls?state=open&head=${encodeURIComponent(`${owner}:${branch}`)}`);
  const baseRef = open.length ? branch : payload.repository.default_branch;

  const runUrl = `${process.env.GITHUB_SERVER_URL || 'https://github.com'}/${REPO}/actions/runs/${process.env.GITHUB_RUN_ID}`;
  const status = await comment(issue, `${MARK.status}\nWorking on it: [run ${process.env.GITHUB_RUN_ID}](${runUrl}). This comment gets the link to the pull request when it's ready.`);

  setOutputs({
    run: 'true',
    trust,
    login: event.author.login,
    allowed_user: trust === 'allowlist' ? event.author.login : '',
    issue,
    base_ref: baseRef,
    comment_id: status.id,
    request: cleanRequest(event.text),
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`::error::${error.message}`);
    process.exit(1);
  });
}

#!/usr/bin/env node
// The deliver step of claude.yml. Runs with write access and no model, from a checkout of main
// (trusted/), on the tree the agent started from (work/). It treats everything the agent produced
// as untrusted data: it applies the diff, checks it, and only then pushes a branch and opens or
// updates the pull request. Nothing here ever merges.
//
//   node trusted/scripts/agent-deliver.mjs <artifact dir> <work dir>
//
// Checks, in order: the branch hasn't moved since the agent started; the diff applies; it touches
// only site/ (allowed file types) and screenshots/<issue>-(before|after)-(desktop|mobile).png;
// regular files only (no symlinks, no executables); size limits; images are real images; the
// design and safety rules pass (scripts/check-design.mjs from main).
//
// Env: GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_RUN_ID, GITHUB_SERVER_URL, ISSUE, LOGIN,
// COMMENT_ID, BASE_REF, DEFAULT_BRANCH. Output: delivered=true|false, pr=<number>.

import { readFileSync, existsSync, statSync, appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SITE_TYPES = ['.html', '.css', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.ico'];
export const MAX_FILE = 3 * 1024 * 1024;
export const MAX_PATCH = 12 * 1024 * 1024;
const MAGIC = {
  '.png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  '.jpg': [0xff, 0xd8, 0xff],
  '.jpeg': [0xff, 0xd8, 0xff],
  '.webp': [0x52, 0x49, 0x46, 0x46],
  '.ico': [0x00, 0x00, 0x01, 0x00],
};

/** Problems with one changed path, or [] when it is allowed. `mode` is git's new mode. */
export function pathProblems(path, mode, issue) {
  const problems = [];
  if (mode !== '100644' && mode !== '000000') problems.push(`${path}: mode ${mode}; only regular files are allowed (no symlinks, no executables)`);
  if (path.startsWith('screenshots/')) {
    const re = new RegExp(`^screenshots/${issue}-(before|after)-(desktop|mobile)\\.png$`);
    if (!re.test(path)) problems.push(`${path}: screenshots must be named screenshots/${issue}-<before|after>-<desktop|mobile>.png`);
  } else if (path.startsWith('site/')) {
    if (!/^site\/[A-Za-z0-9._\/-]+$/.test(path) || path.includes('..') || /\/\./.test(path)) problems.push(`${path}: unusual file name`);
    else if (!SITE_TYPES.includes(extname(path).toLowerCase())) problems.push(`${path}: file type not allowed in site/ (allowed: ${SITE_TYPES.join(' ')}); scripts are maintained by people`);
  } else {
    problems.push(`${path}: outside site/ and screenshots/`);
  }
  return problems;
}

/** Problems with the content of a file that exists after the change. */
export function contentProblems(path, bytes) {
  const problems = [];
  if (bytes.length > MAX_FILE) problems.push(`${path}: ${bytes.length} bytes, more than ${MAX_FILE}`);
  const magic = MAGIC[extname(path).toLowerCase()];
  if (magic && !magic.every((b, i) => bytes[i] === b)) problems.push(`${path}: not a real ${extname(path)} file`);
  if (['.html', '.css', '.svg'].includes(extname(path).toLowerCase()) && bytes.includes(0)) problems.push(`${path}: binary content in a text file`);
  return problems;
}

/** Parses `git diff --cached --raw -z --no-renames`. */
export function parseRaw(out) {
  const parts = out.split('\0').filter((p) => p !== '');
  const entries = [];
  for (let i = 0; i + 1 < parts.length; i += 2) {
    // ":<old mode> <new mode> <old sha> <new sha> <status>" then the path
    const [, newMode, , , status] = parts[i].slice(1).split(' ');
    entries.push({ mode: newMode, status: status[0], path: parts[i + 1] });
  }
  return entries;
}

export function cleanTitle(text, issue) {
  const t = String(text ?? '').replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, ' ').replace(/\s+/g, ' ').trim();
  return (t || `site: change for #${issue}`).slice(0, 72);
}

/** The agent's own words, shown as plain text: no links, mentions or images render inside a fence. */
export function fenced(text, max = 3000) {
  let t = String(text ?? '').replace(/\r\n?/g, '\n').trim() || '(no summary)';
  if (t.length > max) t = `${t.slice(0, max)}\n[cut at ${max} characters]`;
  const longest = Math.max(2, ...[...t.matchAll(/`+/g)].map((m) => m[0].length));
  const fence = '`'.repeat(longest + 1);
  return `${fence}text\n${t}\n${fence}`;
}

// ---------- run ----------

const env = process.env;
const API = env.GITHUB_API_URL || 'https://api.github.com';
const REPO = env.GITHUB_REPOSITORY;

async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { authorization: `Bearer ${env.GITHUB_TOKEN}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${path}: HTTP ${res.status} ${data?.message ?? ''}`);
  return data;
}

const read = (file) => (existsSync(file) ? readFileSync(file, 'utf8') : '');
const output = (k, v) => (env.GITHUB_OUTPUT ? appendFileSync(env.GITHUB_OUTPUT, `${k}=${v}\n`) : console.log(`[output] ${k}=${v}`));

async function main() {
  const [artifacts, work] = process.argv.slice(2).map((p) => resolve(p));
  const git = (...args) => execFileSync('git', args, { cwd: work, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const issue = env.ISSUE;
  const branch = `agent/issue-${issue}`;
  const runUrl = `${env.GITHUB_SERVER_URL || 'https://github.com'}/${REPO}/actions/runs/${env.GITHUB_RUN_ID}`;
  const summary = read(join(artifacts, 'summary.md'));
  const status = (body) => api('PATCH', `/repos/${REPO}/issues/comments/${env.COMMENT_ID}`, { body: `<!-- agent-gate:status -->\n${body}` });

  const reject = async (reason, details = []) => {
    console.log(`::warning::not delivered: ${reason}`);
    for (const d of details) console.log(`  ${d}`);
    await status([
      `No pull request from [run ${env.GITHUB_RUN_ID}](${runUrl}): ${reason}`,
      ...(details.length ? ['', fenced(details.join('\n'), 2000)] : []),
      '', 'What the agent says:', '', fenced(summary, 1500),
    ].join('\n'));
    output('delivered', 'false');
  };

  // 1. The tree must be the one the agent started from.
  const base = read(join(artifacts, 'base.txt')).trim();
  if (git('rev-parse', 'HEAD').trim() !== base) return reject('the branch changed while the agent worked; ask again');

  // 2. A diff that applies.
  const patchFile = join(artifacts, 'change.patch');
  const size = existsSync(patchFile) ? statSync(patchFile).size : 0;
  if (size === 0) return reject('the agent changed nothing in site/');
  if (size > MAX_PATCH) return reject(`the change is ${size} bytes, more than ${MAX_PATCH}`);
  try { git('apply', '--index', '--whitespace=nowarn', patchFile); } catch (e) { return reject('the diff does not apply', [String(e.stderr || e.message).slice(0, 1500)]); }

  // 3. Only allowed paths, modes, types and contents.
  const entries = parseRaw(git('diff', '--cached', '--raw', '-z', '--no-renames', '--no-abbrev'));
  const problems = [];
  for (const e of entries) {
    problems.push(...pathProblems(e.path, e.mode, issue));
    if (e.status !== 'D' && existsSync(join(work, e.path))) problems.push(...contentProblems(e.path, readFileSync(join(work, e.path))));
  }
  const other = read(join(artifacts, 'other-changes.txt')).trim();
  if (other) console.log(`ignored, outside site/ and screenshots/:\n${other}`);
  if (problems.length) return reject('the change touches files the agent may not change', problems);

  // 4. Design and safety rules, with the script from main.
  const checker = join(dirname(fileURLToPath(import.meta.url)), 'check-design.mjs');
  let check;
  try { check = execFileSync('node', [checker, work], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); } catch (e) {
    return reject('the design check failed', String(e.stderr || e.stdout).trim().split('\n'));
  }

  // 5. Commit and push the agent's branch.
  const title = cleanTitle(read(join(artifacts, 'title.txt')), issue);
  git('-c', 'user.name=github-actions[bot]', '-c', 'user.email=41898282+github-actions[bot]@users.noreply.github.com',
    'commit', '-q', '-m', `${title} (#${issue})`, '-m', `Requested by @${env.LOGIN} in #${issue}. Agent run: ${runUrl}`);
  const continuing = env.BASE_REF === branch;
  git('push', ...(continuing ? [] : ['--force']), 'origin', `HEAD:refs/heads/${branch}`);
  const sha = git('rev-parse', 'HEAD').trim();

  // 6. The pull request: a body built here, with the agent's text fenced as plain text.
  const raw = (f) => `https://raw.githubusercontent.com/${REPO}/${sha}/${f}`;
  const shot = (kind) => {
    const f = `screenshots/${issue}-${kind}.png`;
    return existsSync(join(work, f)) ? `![${kind}](${raw(f)})` : '–';
  };
  const files = entries.map((e) => `| \`${e.path}\` | ${{ A: 'added', M: 'changed', D: 'deleted' }[e.status] ?? e.status} |`);
  const body = [
    `Requested by @${env.LOGIN} in #${issue} · [agent run](${runUrl})`,
    '', '## What the agent says', '', fenced(summary),
    '', '## Files', '', '| File | Change |', '|---|---|', ...files,
    '', '## Checks (deliver job, no model)', '',
    '- Only `site/` (html, css, svg, images) and `screenshots/` changed; regular files only; images are real images',
    `- \`${check.split('\n').pop()}\``,
    '', '## Screenshots', '', '| Before | After, desktop | After, phone |', '|---|---|---|',
    `| ${shot('before-desktop')} | ${shot('after-desktop')} | ${shot('after-mobile')} |`,
    '', 'A person reviews and merges. Merging publishes the site.', '', `Closes #${issue}`,
  ].join('\n');

  const owner = REPO.split('/')[0];
  const open = await api('GET', `/repos/${REPO}/pulls?state=open&head=${encodeURIComponent(`${owner}:${branch}`)}`);
  const pr = open.length
    ? await api('PATCH', `/repos/${REPO}/pulls/${open[0].number}`, { title, body })
    : await api('POST', `/repos/${REPO}/pulls`, { title, body, head: branch, base: env.DEFAULT_BRANCH });

  // 7. Pushes made with the workflow token start no workflows, so start the required check by hand.
  await api('POST', `/repos/${REPO}/actions/workflows/checks.yml/dispatches`, { ref: branch });

  await status(`Pull request #${pr.number} is ready for review: ${pr.html_url}`);
  output('delivered', 'true');
  output('pr', pr.number);
  console.log(`delivered: ${pr.html_url} at ${sha}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`::error::${error.message}`);
    process.exit(1);
  });
}

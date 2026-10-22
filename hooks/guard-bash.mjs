#!/usr/bin/env node
// Claude Code hook, PreToolUse on Bash: refuses the git and gh commands that only a person should
// run here. No dependencies.
//
//   - a commit or a push while the default branch is checked out
//   - a push that names the default branch, force-pushes, deletes or mirrors
//   - --no-verify on a commit or a push
//   - gh pr merge, gh pr review --approve
//
//   input   the hook JSON on stdin (tool_input.command)
//   exit 0  the command may run (the permission rules in .claude/settings.json still apply)
//   exit 2  refused; Claude reads the reason from stderr
//
// It reads the command as text, so `sh -c`, aliases or a script can get past it. A seatbelt for
// honest mistakes, not the boundary: the read-only token and the ruleset on main are.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const git = (cwd, ...args) => {
  try {
    return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
};

// The repository's state: the branch checked out and the default branch (origin's HEAD, else main).
export function repoState(cwd) {
  const head = git(cwd, 'symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD');
  return {
    branch: git(cwd, 'branch', '--show-current'),
    defaultBranch: head ? head.replace(/^origin\//, '') : 'main',
  };
}

// Splits on ; && || | and newlines, then into words; quotes are dropped, not parsed.
const segments = (command) =>
  command.split(/&&|\|\||[;|\n]/).map((s) => s.trim().split(/\s+/).map((w) => w.replace(/^['"]|['"]$/g, ''))).filter((w) => w[0]);

// The subcommand after `git`, skipping global options such as -C <dir> or -c <key=value>.
function gitArgs(words) {
  const i = words.findIndex((w) => w === 'git' || w.endsWith('/git'));
  if (i === -1) return null;
  const rest = words.slice(i + 1);
  while (rest[0]?.startsWith('-')) rest.splice(0, ['-C', '-c', '--git-dir', '--work-tree'].includes(rest[0]) ? 2 : 1);
  return rest;
}

// Returns the reason to refuse, or null. `state` is { branch, defaultBranch }.
export function check(command, state) {
  if (!command) return null;
  const main = state.defaultBranch;
  for (const words of segments(command)) {
    const ghAt = words.indexOf('gh');
    if (ghAt !== -1 && words[ghAt + 1] === 'pr') {
      if (words[ghAt + 2] === 'merge') return 'Merging is a person\'s job. Leave the pull request for review.';
      if (words[ghAt + 2] === 'review' && words.some((w) => w === '--approve' || w === '-a')) {
        return 'Approving is a person\'s job.';
      }
    }
    const args = gitArgs(words);
    if (!args) continue;
    const [sub, ...opts] = args;
    if (sub !== 'commit' && sub !== 'push') continue;
    if (opts.includes('--no-verify') || (sub === 'commit' && opts.includes('-n'))) {
      return `git ${sub} --no-verify skips the checks. Fix what they report instead.`;
    }
    if (sub === 'commit' && state.branch === main) {
      return `You are on ${main}. Create a branch first: git switch -c agent/<issue>-<slug>`;
    }
    if (sub === 'push') {
      if (opts.some((o) => /^(--force(-with-lease|-if-includes)?(=.*)?|-f|--delete|-d|--mirror|--all)$/.test(o) || /^\+/.test(o))) {
        return 'Force pushes, deletes and mirror pushes are refused. Push a new commit to your own branch.';
      }
      const refs = opts.filter((o) => !o.startsWith('-')).slice(1);
      const target = (ref) => ref.split(':').pop().replace(/^refs\/heads\//, '');
      if (refs.some((ref) => target(ref) === main) || (refs.length === 0 && state.branch === main)) {
        return `Pushing to ${main} is refused. Push your branch and open a pull request.`;
      }
    }
  }
  return null;
}

function main() {
  const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
  const cwd = input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const reason = check(input.tool_input?.command, repoState(cwd));
  if (reason) {
    process.stderr.write(`${reason}\n`);
    process.exit(2);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

// node --test hooks/*.test.mjs   Tests for the example hooks. No network; temporary folders only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as guardrails from './protect-guardrails.mjs';
import * as bash from './guard-bash.mjs';
import * as design from './design-check.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const temp = () => mkdtempSync(join(tmpdir(), 'hooks-'));

// Runs a hook the way Claude Code does: JSON on stdin, the project in CLAUDE_PROJECT_DIR.
const runHook = (name, input, projectDir) =>
  spawnSync(process.execPath, [join(HERE, name)], {
    input: JSON.stringify(input),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir },
  });

test('guardrails: site and screenshot edits pass, guardrail edits are refused', () => {
  const dir = temp();
  assert.equal(guardrails.check(join(dir, 'site/index.html'), dir), null);
  assert.equal(guardrails.check('screenshots/9-after-desktop.png', dir), null);
  for (const path of ['.github/workflows/claude.yml', '.claude/settings.json', '.claude/settings.local.json',
    'hooks/guard-bash.mjs', 'scripts/check-design.mjs', 'CLAUDE.md', 'AGENTS.md', '.mcp.json', '.git/config']) {
    assert.match(guardrails.check(path, dir), /guardrail/, path);
  }
});

test('guardrails: case, dot segments and paths outside the repository do not get past', () => {
  const dir = temp();
  assert.match(guardrails.check('claude.md', dir), /guardrail/);
  assert.match(guardrails.check('site/../.GitHub/workflows/x.yml', dir), /guardrail/);
  assert.match(guardrails.check('../elsewhere.txt', dir), /outside/);
  assert.match(guardrails.check('/etc/hosts', dir), /outside/);
});

test('guardrails: a symlink in site/ that points at a guardrail is refused', () => {
  const dir = temp();
  mkdirSync(join(dir, 'site'));
  mkdirSync(join(dir, '.github'));
  symlinkSync(join(dir, '.github'), join(dir, 'site', 'gh'));
  assert.match(guardrails.check('site/gh/workflows/claude.yml', dir), /guardrail/);
});

test('guardrails: the hook exits 2 with the reason on stderr, 0 otherwise', () => {
  const dir = temp();
  const refused = runHook('protect-guardrails.mjs', { tool_name: 'Edit', tool_input: { file_path: join(dir, 'CLAUDE.md') } }, dir);
  assert.equal(refused.status, 2);
  assert.match(refused.stderr, /CLAUDE\.md is a guardrail/);
  const allowed = runHook('protect-guardrails.mjs', { tool_name: 'Write', tool_input: { file_path: join(dir, 'site/x.css') } }, dir);
  assert.equal(allowed.status, 0);
});

const onMain = { branch: 'main', defaultBranch: 'main' };
const onBranch = { branch: 'agent/12-faq', defaultBranch: 'main' };

test('bash: commits and pushes on a branch pass', () => {
  for (const command of ['git commit -m "site: fold the FAQ"', 'git push -u origin agent/12-faq', 'git push',
    'git status && git diff --stat', 'gh pr create --fill', 'gh pr view 12']) {
    assert.equal(bash.check(command, onBranch), null, command);
  }
});

test('bash: committing or pushing on main, or pushing to main, is refused', () => {
  assert.match(bash.check('git commit -am "quick fix"', onMain), /Create a branch/);
  assert.match(bash.check('git add . && git commit -m x', onMain), /Create a branch/);
  assert.match(bash.check('git push', onMain), /Pushing to main/);
  assert.match(bash.check('git push origin main', onBranch), /Pushing to main/);
  assert.match(bash.check('git -C . push origin HEAD:refs/heads/main', onBranch), /Pushing to main/);
  assert.match(bash.check('git push origin trunk', { branch: 'x', defaultBranch: 'trunk' }), /Pushing to trunk/);
});

test('bash: force, delete, mirror and --no-verify are refused anywhere', () => {
  for (const command of ['git push --force', 'git push -f origin agent/12-faq', 'git push --force-with-lease',
    'git push origin +agent/12-faq', 'git push origin --delete agent/12-faq', 'git push --mirror']) {
    assert.match(bash.check(command, onBranch), /Force pushes/, command);
  }
  assert.match(bash.check('git commit --no-verify -m x', onBranch), /no-verify/);
  assert.match(bash.check('git commit -n -m x', onBranch), /no-verify/);
});

test('bash: merging and approving pull requests are refused', () => {
  assert.match(bash.check('gh pr merge 12 --squash', onBranch), /Merging/);
  assert.match(bash.check('gh pr review 12 --approve', onBranch), /Approving/);
  assert.equal(bash.check('gh pr review 12 --comment -b "looks fine"', onBranch), null);
});

test('bash: the hook reads the branch from the repository it runs in', () => {
  const dir = temp();
  execFileSync('git', ['init', '-q', '-b', 'main', dir]);
  const input = { tool_name: 'Bash', cwd: dir, tool_input: { command: 'git commit -m x' } };
  assert.equal(runHook('guard-bash.mjs', input, dir).status, 2);
  execFileSync('git', ['-C', dir, 'switch', '-q', '-c', 'agent/1-test']);
  assert.equal(runHook('guard-bash.mjs', input, dir).status, 0);
});

// A copy of the site and the design check, so a broken stylesheet can be tested.
function siteCopy() {
  const dir = temp();
  cpSync(join(ROOT, 'site'), join(dir, 'site'), { recursive: true });
  mkdirSync(join(dir, 'scripts'));
  cpSync(join(ROOT, 'scripts', 'check-design.mjs'), join(dir, 'scripts', 'check-design.mjs'));
  return dir;
}

test('design: files outside site/ are not checked, a clean site passes', () => {
  const dir = siteCopy();
  assert.equal(design.check('README.md', dir), null);
  assert.equal(design.check(join(dir, 'site/styles.css'), dir), null);
});

test('design: a colour outside the tokens comes back to Claude with exit 2', () => {
  const dir = siteCopy();
  const css = join(dir, 'site', 'styles.css');
  writeFileSync(css, `${readFileSync(css, 'utf8')}\n.oops { color: #ff0000; }\n`);
  const run = runHook('design-check.mjs', { tool_name: 'Edit', tool_input: { file_path: css } }, dir);
  assert.equal(run.status, 2);
  assert.match(run.stderr, /\[tokens\]/);
});

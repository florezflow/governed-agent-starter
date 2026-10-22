#!/usr/bin/env node
// Claude Code hook, PreToolUse on Edit|Write|NotebookEdit: refuses edits to the guardrails and to
// anything outside the repository. No dependencies.
//
//   input   the hook JSON on stdin (tool_input.file_path or tool_input.notebook_path)
//   exit 0  the edit may go ahead (the permission rules in .claude/settings.json still apply)
//   exit 2  refused; Claude reads the reason from stderr
//
// A seatbelt, not the boundary: the read-only token, the deliver job and the ruleset are.

import { readFileSync, realpathSync } from 'node:fs';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Directories end in a slash. Compared in lower case, because macOS and Windows file systems are
// case-insensitive: an edit to claude.md lands in CLAUDE.md.
export const GUARDED = [
  '.git/', '.github/', '.claude/', 'hooks/', 'scripts/',
  'CLAUDE.md', 'AGENTS.md', '.mcp.json', '.gitignore', '.gitattributes',
];

// The real path, also for a file that doesn't exist yet: resolve the nearest parent that does, so a
// symlink inside the repository can't point an edit somewhere else.
function realish(path) {
  try {
    return realpathSync(path);
  } catch {
    const parent = dirname(path);
    return parent === path ? path : resolve(realish(parent), basename(path));
  }
}

// Returns the reason to refuse, or null.
export function check(filePath, projectDir) {
  if (!filePath) return null;
  const root = realish(resolve(projectDir));
  const target = realish(resolve(root, filePath));
  const rel = relative(root, target);
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) {
    return `${filePath} is outside the repository. Work only inside it.`;
  }
  const path = rel.split(sep).join('/').toLowerCase();
  const hit = GUARDED.find((g) => {
    const guard = g.toLowerCase();
    return guard.endsWith('/') ? path.startsWith(guard) || `${path}/` === guard : path === guard;
  });
  return hit
    ? `${rel} is a guardrail (${hit}). Humans change it; say in your summary what should change and why.`
    : null;
}

function main() {
  const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
  const file = input.tool_input?.file_path ?? input.tool_input?.notebook_path;
  const reason = check(file, process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd());
  if (reason) {
    process.stderr.write(`${reason}\n`);
    process.exit(2);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

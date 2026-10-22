#!/usr/bin/env node
// Claude Code hook, PostToolUse on Edit|Write: after a change in site/, runs the design check and
// hands its problems back to Claude, so they are fixed before the pull request, not in review.
// No dependencies.
//
//   input   the hook JSON on stdin (tool_input.file_path)
//   exit 0  not a site file, or the check passed
//   exit 2  the check found problems; Claude reads them from stderr (the edit has already happened)

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Returns the problems to report, or null.
export function check(filePath, projectDir) {
  if (!filePath) return null;
  const rel = relative(resolve(projectDir), resolve(projectDir, filePath)).split(sep).join('/');
  if (!rel.startsWith('site/')) return null;
  const run = spawnSync(process.execPath, [join(projectDir, 'scripts', 'check-design.mjs')], { cwd: projectDir, encoding: 'utf8' });
  if (run.status === 0) return null;
  return `${run.stdout}${run.stderr}`.trim() || `design check exited with ${run.status}`;
}

function main() {
  const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
  const problems = check(input.tool_input?.file_path, process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd());
  if (problems) {
    process.stderr.write(`The design check found problems after this edit. Fix them:\n${problems}\n`);
    process.exit(2);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

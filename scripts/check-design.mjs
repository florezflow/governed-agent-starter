#!/usr/bin/env node
// Design check for site/. Enforces the rules marked [checked] in DESIGN.md.
// No dependencies: runs with any Node 18+.
//
//   node scripts/check-design.mjs        exit 0 when clean, 1 with a list of problems
//
// 1. tokens:   no colour literal (#hex, rgb(), hsl()) outside the :root block of site/styles.css
// 2. signal:   exactly one element with the class "is-signal" per HTML page
// 3. requests: no stylesheet, script, font or image loaded from another site
// 4. basics:   <html lang>, <title>, viewport meta tag, alt text on every <img>

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = join(ROOT, 'site');
const problems = [];

const files = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? files(path) : [path];
});

const lineOf = (text, index) => text.slice(0, index).split('\n').length;
const report = (file, line, rule, message) =>
  problems.push(`${relative(ROOT, file)}:${line}  [${rule}] ${message}`);

const COLOUR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/g;

function checkColours(file, text, allowedRange) {
  for (const match of text.matchAll(COLOUR)) {
    if (allowedRange && match.index >= allowedRange[0] && match.index < allowedRange[1]) continue;
    report(file, lineOf(text, match.index), 'tokens',
      `colour literal "${match[0]}"; use a token from the :root block (DESIGN.md → Tokens)`);
  }
}

function tokenBlock(css) {
  const start = css.search(/:root\s*\{/);
  if (start < 0) return null;
  const end = css.indexOf('}', start);
  return [start, end + 1];
}

const all = files(SITE);

for (const file of all.filter((f) => extname(f) === '.css')) {
  const css = readFileSync(file, 'utf8');
  const isTokens = relative(SITE, file) === 'styles.css';
  checkColours(file, css, isTokens ? tokenBlock(css) : null);
  for (const m of css.matchAll(/@import\s+url\(\s*["']?https?:|url\(\s*["']?https?:/g)) {
    report(file, lineOf(css, m.index), 'requests', 'loads a file from another site; keep everything in the repo');
  }
}

for (const file of all.filter((f) => extname(f) === '.html')) {
  const html = readFileSync(file, 'utf8');

  // Colours may only appear inside <style> blocks or style="" attributes by mistake; flag both.
  for (const m of html.matchAll(/<style[\s\S]*?<\/style>|style="[^"]*"/g)) {
    const block = m[0];
    for (const c of block.matchAll(COLOUR)) {
      report(file, lineOf(html, m.index + c.index), 'tokens',
        `colour literal "${c[0]}" in inline style; use a class and the tokens in styles.css`);
    }
  }

  const signals = [...html.matchAll(/class="[^"]*\bis-signal\b[^"]*"/g)];
  if (signals.length !== 1) {
    const where = signals.length ? lineOf(html, signals[1]?.index ?? signals[0].index) : 1;
    report(file, where, 'signal',
      `${signals.length} elements with "is-signal"; exactly one per page (the primary call to action)`);
  }

  for (const m of html.matchAll(/<(link|script|img|source|iframe)\b[^>]*\b(?:href|src)="(https?:)?\/\/[^"]*"/g)) {
    report(file, lineOf(html, m.index), 'requests',
      `<${m[1]}> loads from another site; keep fonts, scripts, styles and images in the repo`);
  }

  if (!/<html[^>]*\blang="[^"]+"/.test(html)) report(file, 1, 'basics', '<html> needs a lang attribute');
  if (!/<title>[^<]+<\/title>/.test(html)) report(file, 1, 'basics', 'page needs a <title>');
  if (!/<meta[^>]+name="viewport"/.test(html)) report(file, 1, 'basics', 'page needs a viewport meta tag');
  for (const m of html.matchAll(/<img\b[^>]*>/g)) {
    if (!/\balt="[^"]+"/.test(m[0])) report(file, lineOf(html, m.index), 'basics', '<img> needs a non-empty alt text');
  }
}

const checked = all.filter((f) => ['.css', '.html'].includes(extname(f))).length;
if (problems.length) {
  console.error(`design check: ${problems.length} problem(s) in ${checked} file(s)\n`);
  for (const p of problems) console.error(`  ${p}`);
  console.error('\nRules: DESIGN.md. Fix the file, then run node scripts/check-design.mjs again.');
  process.exit(1);
}
console.log(`design check: 4 rules, ${checked} file(s), 0 problems`);

#!/usr/bin/env node
// Design check for site/. Enforces the rules marked [checked] in DESIGN.md.
// No dependencies: runs with any Node 18+.
//
//   node scripts/check-design.mjs          exit 0 when clean, 1 with a list of problems
//   node scripts/check-design.mjs <dir>    check <dir>/site instead (the deliver job checks the
//                                          agent's tree with the script from main)
//
// 1. tokens:   no colour literal (#hex, rgb(), hsl()) outside the :root block of site/styles.css
// 2. signal:   exactly one element with the class "is-signal" per HTML page
// 3. requests: no stylesheet, script, font or image loaded from another site
// 4. basics:   <html lang>, <title>, viewport meta tag, alt text on every <img>
// 5. safety:   no inline or unknown scripts, event handlers, javascript: URLs, frames or forms in HTML and SVG;
//              links only within the site or to the hosts in LINK_HOSTS

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.argv[2] ? resolve(process.argv[2]) : join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = join(ROOT, 'site');
const problems = [];

const files = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? files(path) : [path];
});

const lineOf = (text, index) => text.slice(0, index).split('\n').length;
const report = (file, line, rule, message) =>
  problems.push(`${relative(ROOT, file)}:${line}  [${rule}] ${message}`);

// Links to other sites are allowed only to these hosts, so a page can't send visitors anywhere else.
const LINK_HOSTS = ['florezflow.com', 'www.florezflow.com', 'florezflow.github.io', 'github.com'];
// The only scripts a page may load: files in site/ that humans maintain (the agent can't change .js).
const SCRIPT_FILES = ['copy.js'];

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

// Rule 5. The agent may build pages from other people's requests, so a page must not run code,
// embed other sites, collect input or link anywhere but here and the allowed hosts.
// Browsers decode character references in attributes and drop tabs and newlines inside URLs, so
// "java&#9;script&colon;" still runs. Decode before checking.
const NAMED = { colon: ':', sol: '/', tab: '\t', newline: '\n', lpar: '(', rpar: ')', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', equals: '=' };
const decode = (s) => s
  .replace(/&#x([0-9a-f]+);?/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);?/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&([a-z]+);/gi, (m, n) => NAMED[n.toLowerCase()] ?? m);

function checkSafety(file, raw) {
  const text = decode(raw);
  const forbidden = [
    [/<(?:iframe|frame|object|embed|form|base)\b/gi, 'frames, embeds, forms and <base> are not allowed'],
    [/<meta\b[^>]*http-equiv\s*=\s*["']?refresh/gi, 'meta refresh redirects are not allowed'],
    [/url\(\s*["']?\s*(?:[a-z][a-z0-9+.-]*:|\/\/)/gi, 'url() may only point to files in this site'],
    [/@import\b/gi, '@import is not allowed; put the styles in styles.css'],
    [/<[^>]*[\s/"']on[a-z]+\s*=/gi, 'inline event handlers (onclick=…) are not allowed'],
    [/(?:j\s*a\s*v\s*a\s*s\s*c\s*r\s*i\s*p\s*t|vbscript|data)\s*:/gi, 'javascript:, vbscript: and data: URLs are not allowed'],
  ];
  for (const m of text.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>|<script\b/gi)) {
    const src = (m[1] || '').match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1];
    if (m[2] === undefined || m[2].trim() !== '' || !SCRIPT_FILES.includes(src)) {
      report(file, lineOf(text, m.index), 'safety',
        `<script>: only <script src="${SCRIPT_FILES.join('" | "')}"></script> with no inline code`);
    }
  }
  for (const [re, message] of forbidden) {
    for (const m of text.matchAll(re)) report(file, lineOf(text, m.index), 'safety', message);
  }
  for (const m of text.matchAll(/[\s/"'](?:href|xlink:href|src|action|formaction|poster|srcset)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
    const url = (m[1] ?? m[2] ?? m[3]).replace(/[\u0000-\u0020]/g, '');
    if (!/^[a-z][a-z0-9+.-]*:|^\/\//i.test(url)) continue; // relative or #anchor
    let host = null;
    try { const u = new URL(url, 'https://example.invalid/'); host = u.protocol === 'https:' ? u.hostname : null; } catch {}
    if (!host || !LINK_HOSTS.includes(host.toLowerCase())) {
      report(file, lineOf(text, m.index), 'safety', `link to "${url}"; allowed: relative links and https://${LINK_HOSTS.join(', https://')}`);
    }
  }
}

for (const file of all.filter((f) => ['.html', '.svg'].includes(extname(f)))) {
  checkSafety(file, readFileSync(file, 'utf8'));
}

for (const name of ['index.html', 'styles.css']) {
  if (!all.includes(join(SITE, name))) report(join(SITE, name), 1, 'basics', 'file is missing');
}

const checked = all.filter((f) => ['.css', '.html'].includes(extname(f))).length;
if (problems.length) {
  console.error(`design check: ${problems.length} problem(s) in ${checked} file(s)\n`);
  for (const p of problems) console.error(`  ${p}`);
  console.error('\nRules: DESIGN.md. Fix the file, then run node scripts/check-design.mjs again.');
  process.exit(1);
}
console.log(`design check: 5 rules, ${checked} file(s), 0 problems`);

// node --test scripts/*.test.mjs   The safety rule against known tricks: each case is added to a copy
// of the real site, which must then fail; the clean cases must still pass.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, appendFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = join(ROOT, 'scripts', 'check-design.mjs');

function run(html, svg) {
  const dir = mkdtempSync(join(tmpdir(), 'design-'));
  cpSync(join(ROOT, 'site'), join(dir, 'site'), { recursive: true });
  if (html) appendFileSync(join(dir, 'site', 'index.html'), `\n${html}\n`);
  if (svg) writeFileSync(join(dir, 'site', 'extra.svg'), svg);
  const r = spawnSync('node', [CHECK, dir], { encoding: 'utf8' });
  return { ok: r.status === 0, out: r.stdout + r.stderr };
}

const attacks = {
  'inline script': '<script>alert(1)</script>',
  'unknown script file': '<script src="evil.js"></script>',
  'event handler': '<img src="a.png" alt="a" onerror="x()">',
  'handler after a quoted >': `<div title="a>b" onmouseover="eval(atob('x'))">hover</div>`,
  'handler after a slash': '<img/onerror=x() src="a.png" alt="a">',
  'javascript: link': '<a href="javascript:alert(1)">x</a>',
  'entity-encoded javascript:': '<a href="java&#9;script&colon;alert(1)">x</a>',
  'data: URL': '<a href="data:text/html;base64,PHNjcmlwdD4=">x</a>',
  'outside link': '<a href="https://evil.example/login">x</a>',
  'unquoted outside link': '<a href=https://evil.example/>x</a>',
  'protocol-relative link': '<a href="//evil.example/">x</a>',
  'plain http': '<a href="http://github.com/x">x</a>',
  'srcset second candidate': '<img src="/a" alt="x" srcset="/a 1x, https://evil.example/t 2x">',
  'ping': '<a href="/" ping="https://evil.example/collect">x</a>',
  'iframe': '<iframe srcdoc="hi"></iframe>',
  'form': '<form action="/"><input name="pw"></form>',
  'meta refresh after a quoted >': '<meta name="a>b" http-equiv="refresh" content="0;url=/x">',
  'style url to another site': '<p style="background:url(https://t.example/p.gif)">x</p>',
  '@import': '<style>@import "x.css";</style>',
};
for (const [name, html] of Object.entries(attacks)) {
  test(`refuses: ${name}`, () => assert.equal(run(html).ok, false, name));
}

const svgAttacks = {
  'svg script': '<svg xmlns="http://www.w3.org/2000/svg"><script>x()</script></svg>',
  'svg onload after a quoted >': `<svg xmlns="http://www.w3.org/2000/svg"><rect data-x="a>b" onload="eval(atob('x'))"/></svg>`,
  'svg animate to javascript': '<svg xmlns="http://www.w3.org/2000/svg"><a><animate attributeName="href" to="/x"/><text>x</text></a></svg>',
  'svg foreignObject': '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><p>x</p></foreignObject></svg>',
  'svg outside link': '<svg xmlns="http://www.w3.org/2000/svg"><a xlink:href="https://evil.example"><text>x</text></a></svg>',
};
for (const [name, svg] of Object.entries(svgAttacks)) {
  test(`refuses: ${name}`, () => assert.equal(run(null, svg).ok, false, name));
}

test('accepts the site as it is, prose with "data:" and "on", and allowed links', () => {
  const r = run('<p>Export your data: click once, then on = off.</p><a href="https://github.com/florezflow">x</a><a href="#try">x</a><img src="a.png" alt="a" srcset="a.png 1x, b.png 2x">');
  assert.equal(r.ok, true, r.out);
});

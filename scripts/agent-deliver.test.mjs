// node --test scripts/*.test.mjs   Tests for the deliver job's checks. No network, no git.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathProblems, contentProblems, parseRaw, cleanTitle, fenced } from './agent-deliver.mjs';

test('allowed: site files of allowed types and correctly named screenshots', () => {
  assert.deepEqual(pathProblems('site/index.html', '100644', '7'), []);
  assert.deepEqual(pathProblems('site/img/hero.webp', '100644', '7'), []);
  assert.deepEqual(pathProblems('site/old.css', '000000', '7'), []);
  assert.deepEqual(pathProblems('screenshots/7-after-mobile.png', '100644', '7'), []);
});

test('refused: other folders, scripts, other issues’ screenshots, symlinks, executables, dot files', () => {
  for (const [path, mode] of [
    ['.github/workflows/claude.yml', '100644'], ['scripts/check-design.mjs', '100644'], ['CLAUDE.md', '100644'],
    ['site/copy.js', '100644'], ['site/app.mjs', '100644'], ['site/x.html', '120000'], ['site/x.html', '100755'],
    ['screenshots/8-after-mobile.png', '100644'], ['screenshots/7-after-mobile.jpg', '100644'],
    ['site/.well-known/x.html', '100644'], ['site/a b.html', '100644'],
  ]) assert.notDeepEqual(pathProblems(path, mode, '7'), [], `${path} ${mode}`);
});

test('content: real images only, size limit, no binary in text files', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]);
  assert.deepEqual(contentProblems('screenshots/7-before-desktop.png', png), []);
  assert.notDeepEqual(contentProblems('screenshots/7-before-desktop.png', Buffer.from('<html>')), []);
  assert.notDeepEqual(contentProblems('site/index.html', Buffer.from('a\0b')), []);
  assert.notDeepEqual(contentProblems('site/big.css', Buffer.alloc(4 * 1024 * 1024, 32)), []);
});

test('parses git diff --raw -z', () => {
  const out = ':100644 100644 aaa bbb M\0site/index.html\0:000000 120000 000 ccc A\0site/link.html\0:100644 000000 ddd 000 D\0site/old.css\0';
  assert.deepEqual(parseRaw(out), [
    { mode: '100644', status: 'M', path: 'site/index.html' },
    { mode: '120000', status: 'A', path: 'site/link.html' },
    { mode: '000000', status: 'D', path: 'site/old.css' },
  ]);
});

test('the title is one plain line; the agent’s text is fenced so nothing in it renders', () => {
  assert.equal(cleanTitle('site: fold the FAQ\n‮evil', 7), 'site: fold the FAQ evil');
  assert.equal(cleanTitle('', 7), 'site: change for #7');
  const f = fenced('see [this](https://evil.example) @someone ```` break out');
  assert.ok(f.startsWith('`````text\n'));
  assert.ok(f.endsWith('\n`````'));
});

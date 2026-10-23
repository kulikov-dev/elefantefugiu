// scripts/check-published.mjs keeps cards that are not published (drafts, test fixtures) out of dist/. It is tried here on small
// stand-in builds: a clean one passes, and each kind of leak makes it fail.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../scripts/check-published.mjs', import.meta.url));

function run(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), 'dist-'));
  try {
    for (const [name, text] of Object.entries(files)) {
      const path = join(dir, name);
      mkdirSync(join(path, '..'), { recursive: true });
      writeFileSync(path, text);
    }
    return spawnSync(process.execPath, [script], { env: { ...process.env, CHECK_DIST: dir }, encoding: 'utf8' });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('a build with nothing of the unpublished cards passes', () => {
  const r = run({ 'pt/index.html': '<html><body>O Elefante Fugiu</body></html>' });
  assert.equal(r.status, 0, r.stderr);
});

test('a page named after a draft card fails', () => {
  const r = run({ 'pt/historia/evento-exemplo-17/index.html': '<html></html>' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /named after a card that is not published/);
});

test('the QR page of a draft card fails', () => {
  const r = run({ 'p/evento-exemplo-19/index.html': '<html></html>' });
  assert.equal(r.status, 1);
});

test('a map point of a draft card fails', () => {
  const config = JSON.stringify({ cards: [{ id: 'evento-exemplo-20' }] });
  const r = run({ 'pt/mapa/index.html': `<script type="application/json" data-map-config>${config}</script>` });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /map points|evento-exemplo/);
});

test('a sitemap line of a draft card fails', () => {
  const r = run({ 'sitemap-0.xml': '<url><loc>https://example.org/en/story/example-event-21/</loc></url>' });
  assert.equal(r.status, 1);
});

test('the title of a draft card in a list fails', () => {
  const r = run({ 'en/index.html': '<html><body><li>Example event 17</li></body></html>' });
  // "Example event 17" is 16 characters: long enough to count as a title.
  assert.equal(r.status, 1);
});

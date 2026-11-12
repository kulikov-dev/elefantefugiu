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

// ---- a story with a day in the future is caught like a draft ----
// A small folder of cards: one published yesterday (visible), one queued for tomorrow (not on the site until the build of that day). The days come from the clock.
import { lisbonToday } from '../src/lib/publication.mjs';

const addDays = (day: string, n: number): string => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const todayInLisbon = lisbonToday();
const card = (id: string, published: string, title: string) =>
  [`id: ${id}`, 'status: ready', `published: '${published}'`, 'slug:', `  pt: ${id}-pt`, `  en: ${id}-en`, `  ru: ${id}-ru`, 'title:', `  pt: ${title} pt`, `  en: ${title} en`, `  ru: ${title} ru`, ''].join('\n');

function runWithCards(files: Record<string, string>, env: Record<string, string> = {}) {
  const events = mkdtempSync(join(tmpdir(), 'events-'));
  writeFileSync(join(events, 'yesterday-story.yaml'), card('yesterday-story', addDays(todayInLisbon, -1), 'The story of yesterday'));
  writeFileSync(join(events, 'tomorrow-story.yaml'), card('tomorrow-story', addDays(todayInLisbon, 1), 'The queued story of tomorrow'));
  try {
    const dist = mkdtempSync(join(tmpdir(), 'dist-'));
    try {
      for (const [name, text] of Object.entries(files)) {
        const path = join(dist, name);
        mkdirSync(join(path, '..'), { recursive: true });
        writeFileSync(path, text);
      }
      return spawnSync(process.execPath, [script], { env: { ...process.env, CHECK_DIST: dist, CHECK_EVENTS: events, ...env }, encoding: 'utf8' });
    } finally {
      rmSync(dist, { recursive: true, force: true });
    }
  } finally {
    rmSync(events, { recursive: true, force: true });
  }
}

test('the story of yesterday may be on the site: a page named after it passes', () => {
  const r = runWithCards({ 'pt/historia/yesterday-story-pt/index.html': '<html><body>The story of yesterday pt</body></html>' });
  assert.equal(r.status, 0, r.stderr);
});

test('a page of the story queued for tomorrow fails, like a draft', () => {
  const r = runWithCards({ 'pt/historia/tomorrow-story-pt/index.html': '<html></html>' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /named after a card that is not published/);
});

test('its QR page, its map point, its sitemap line, its line in a feed and its title in a list fail', () => {
  assert.equal(runWithCards({ 'p/tomorrow-story/index.html': '<html></html>' }).status, 1);
  const config = JSON.stringify({ cards: [{ id: 'tomorrow-story' }] });
  assert.equal(runWithCards({ 'pt/mapa/index.html': `<script type="application/json" data-map-config>${config}</script>` }).status, 1);
  assert.equal(runWithCards({ 'sitemap-0.xml': '<url><loc>https://example.org/en/story/tomorrow-story-en/</loc></url>' }).status, 1);
  assert.equal(runWithCards({ 'rss.xml': '<item><link>https://example.org/en/story/tomorrow-story-en/</link></item>' }).status, 1);
  assert.equal(runWithCards({ 'en/index.html': '<html><body><li>The queued story of tomorrow en</li></body></html>' }).status, 1);
});

test('on the day it is published the same story is allowed (SITE_TODAY is the day of the build)', () => {
  const tomorrow = addDays(todayInLisbon, 1);
  const r = runWithCards({ 'pt/historia/tomorrow-story-pt/index.html': '<html></html>' }, { SITE_TODAY: tomorrow });
  assert.equal(r.status, 0, r.stderr);
});

// ---- the claim of a story of a later day (the game "Myth or fact" takes the claims from the stories) ----
const CLAIM = 'Port wine went to the sea along a road by the river';
const ANSWER = 'There were no roads along the steep banks, so the casks floated.';
const withClaim = (id: string, published: string) =>
  [card(id, published, `The story of ${id}`), 'myth:', '  verdict: myth', '  statement:', `    pt: ${CLAIM} pt`, `    en: ${CLAIM}`, `    ru: ${CLAIM} ru`, '  answer:', `    pt: ${ANSWER} pt`, `    en: ${ANSWER}`, `    ru: ${ANSWER} ru`, ''].join('\n');

function runWithClaim(files: Record<string, string>, env: Record<string, string> = {}) {
  const events = mkdtempSync(join(tmpdir(), 'events-'));
  writeFileSync(join(events, 'yesterday-story.yaml'), card('yesterday-story', addDays(todayInLisbon, -1), 'The story of yesterday'));
  writeFileSync(join(events, 'claim-story.yaml'), withClaim('claim-story', addDays(todayInLisbon, 1)));
  const dist = mkdtempSync(join(tmpdir(), 'dist-'));
  try {
    for (const [name, text] of Object.entries(files)) {
      const path = join(dist, name);
      mkdirSync(join(path, '..'), { recursive: true });
      writeFileSync(path, text);
    }
    return spawnSync(process.execPath, [script], { env: { ...process.env, CHECK_DIST: dist, CHECK_EVENTS: events, ...env }, encoding: 'utf8' });
  } finally {
    rmSync(dist, { recursive: true, force: true });
    rmSync(events, { recursive: true, force: true });
  }
}

test('the claim of the story queued for tomorrow is nowhere: not in the page of the game, not in its preview, not as a card address', () => {
  assert.equal(runWithClaim({ 'en/index.html': '<html><body>Nothing here</body></html>' }).status, 0);
  const leak = runWithClaim({ 'en/myth-or-fact/index.html': `<html><body><p class="myth__statement">${CLAIM}</p></body></html>` });
  assert.equal(leak.status, 1);
  assert.match(leak.stderr, /claim or the answer/);
  assert.equal(runWithClaim({ 'en/myth-or-fact/index.html': `<html><body><p>${ANSWER}</p></body></html>` }).status, 1);
  const picture = runWithClaim({ 'og-myths/claim-story-en-0123456789.jpg': 'x' });
  assert.equal(picture.status, 1);
  assert.match(picture.stderr, /preview picture of a claim/);
});

test('on the day it is published the claim may be in the page of the game', () => {
  const r = runWithClaim({ 'en/myth-or-fact/index.html': `<html><body>${CLAIM}</body></html>`, 'og-myths/claim-story-en-0123456789.jpg': 'x' }, { SITE_TODAY: addDays(todayInLisbon, 1) });
  assert.equal(r.status, 0, r.stderr);
});

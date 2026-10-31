// The language review sees every text of the site (npm run lang:pending): no story, epoch, thread, static page or interface section drops out.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { parse } from 'yaml';
import { STATIC_PAGES } from '../src/data/static-pages';
import { collectTexts, units } from '../scripts/lib/lang-texts';
import { changedFields } from '../scripts/lib/lang-review';

const seen = new Set(units(collectTexts()).map((u) => u.unit));
const read = (f: string) => parse(readFileSync(f, 'utf8')) as any;

test('every published story is a unit of the review', () => {
  for (const f of readdirSync('src/content/events').filter((x) => x.endsWith('.yaml'))) {
    const e = read(`src/content/events/${f}`);
    if (e.status === 'ready' && !e.placeholder) assert.ok(seen.has(`event/${e.id}`), `event/${e.id} is not in the review`);
  }
});

test('every epoch and every thread (Engenho included) is a unit of the review', () => {
  for (const e of read('src/content/epochs.yaml') as any[]) if (e.placeholder !== true) assert.ok(seen.has(`epoch/${e.id}`), `epoch/${e.id}`);
  for (const t of read('src/content/threads.yaml') as any[]) if (t.placeholder !== true) assert.ok(seen.has(`thread/${t.id}`), `thread/${t.id}`);
});

test('every static page and every section of the interface strings is a unit of the review', () => {
  for (const page of Object.keys(STATIC_PAGES)) assert.ok(seen.has(`static/${page}`), `static/${page}`);
  for (const key of Object.keys(JSON.parse(readFileSync('src/i18n/pt.json', 'utf8')))) assert.ok(seen.has(`ui/${key}`), `ui/${key}`);
});

test('changedFields names the keys that are new, changed or gone', () => {
  assert.deepEqual(changedFields({ a: '1', b: '2', c: '3' }, { a: '1', b: '9', d: '4' }), ['b', 'c', 'd']);
  assert.deepEqual(changedFields({ a: '1' }, { a: '1' }), []);
});

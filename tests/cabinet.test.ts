// The cabinet of rarities (src/lib/cabinet.ts, publication.mjs, cabinet-preview.ts, cabinet-places.ts): the switch, the hidden word, the store, the family mode. Inputs are small and own.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import type { CabinetItem } from '../src/data/schemas';
import { CABINET_PREVIEW_SCRIPT } from '../src/lib/cabinet-preview';
import { SARDINE_PLACES } from '../src/lib/cabinet-places';
import { SARDINES, activeItems, foundCount, hiddenPlace, itemsOfHost, parseStore, previewFromQuery, renderWords, stripMarks, visibleItems, withItem, withSardine, wrapWords } from '../src/lib/cabinet';
import { cabinetOpen, isListed, isLive } from '../src/lib/publication.mjs';

const item = (over: Partial<CabinetItem> & { id: string }): CabinetItem => ({
  epoch: 'e1',
  shelf: 1,
  host: 'h1',
  phrase: { pt: 'chá', en: 'tea', ru: 'чай' },
  story: 's1',
  name: { pt: 'N', en: 'N', ru: 'N' },
  summary: { pt: 's', en: 's', ru: 's' },
  hint: { pt: 'h', en: 'h', ru: 'h' },
  ...over,
});

test('the switch: closed on null, open from the day on (Lisbon day of the build)', () => {
  assert.equal(cabinetOpen(null, '2030-01-01'), false);
  assert.equal(cabinetOpen(undefined, '2030-01-01'), false);
  assert.equal(cabinetOpen('2030-01-02', '2030-01-01'), false);
  assert.equal(cabinetOpen('2030-01-01', '2030-01-01'), true);
  assert.equal(cabinetOpen('2029-12-31', '2030-01-01'), true);
  assert.equal(cabinetOpen('tomorrow', '2030-01-01'), false);
});

test('a story of the cabinet is live at once but is on no list', () => {
  const day = '2030-01-01';
  assert.equal(isLive({ status: 'ready', published: '2030-01-01', cabinet: 'x' }, day), true);
  assert.equal(isListed({ status: 'ready', published: '2030-01-01', cabinet: 'x' }, day), false);
  assert.equal(isListed({ status: 'ready', published: '2030-01-01' }, day), true);
  assert.equal(isListed({ status: 'draft', published: '2030-01-01' }, day), false);
});

test('the word: the one place of a phrase, or the numbered place; whole words only, the case counts', () => {
  const texts = ['Ela bebia chá. O chá era caro.', 'Machá não conta; Chá também não.'];
  assert.equal(hiddenPlace(texts, 'chá'), undefined, 'two places and no number: not unique');
  assert.deepEqual(hiddenPlace(texts, 'chá', 1), { text: 0, at: 10 });
  assert.deepEqual(hiddenPlace(texts, 'chá', 2), { text: 0, at: 17 });
  assert.equal(hiddenPlace(texts, 'chá', 3), undefined);
  assert.deepEqual(hiddenPlace(['Rei de Portugal'], 'Rei'), { text: 0, at: 0 });
  assert.equal(hiddenPlace(['rei de Portugal'], 'Rei'), undefined);
  assert.ok(hiddenPlace(['em Grã-Bretanha, e'], 'Grã-Bretanha'));
});

test('the word is wrapped before the markup of the glossary and made a span after it; the reader sees the same text', () => {
  const texts = ['Primeiro chá.', 'Outro chá & mais.'];
  const wrapped = wrapWords(texts, [{ id: 'a', phrase: 'chá', occurrence: 2 }]);
  assert.equal(stripMarks(wrapped[0]!), texts[0]);
  assert.equal(stripMarks(wrapped[1]!), texts[1]);
  assert.equal(renderWords(wrapped[0]!), 'Primeiro chá.');
  assert.equal(renderWords(wrapped[1]!.replace('&', '&amp;')), 'Outro <span class="cw" data-cw="a">chá</span> &amp; mais.');
});

test('the store: damage is dropped, the same thing twice is one, sardine numbers stay in range', () => {
  assert.deepEqual(parseStore(null), { items: [], sardines: [], foundAt: {} });
  assert.deepEqual(parseStore('not json'), { items: [], sardines: [], foundAt: {} });
  const s = parseStore(JSON.stringify({ items: ['a', 'a', 3, 'b'], sardines: [2, 2, 0, 8, 1.5, 7], foundAt: { a: 5, b: 'x' } }));
  assert.deepEqual(s.items, ['a', 'b']);
  assert.deepEqual(s.sardines, [2, 7]);
  assert.deepEqual(s.foundAt, { a: 5 });
  const added = withItem(s, 'c', 9);
  assert.deepEqual(added.items, ['a', 'b', 'c']);
  assert.equal(withItem(added, 'c', 10), added);
  assert.deepEqual(withSardine(s, 1, 3).sardines, [1, 2, 7]);
  assert.equal(withSardine(s, 2, 3), s);
  assert.equal(withSardine(s, SARDINES + 1, 3), s);
});

test('a rarity is on the site only when its host and its story are published; an unknown one is dropped silently', () => {
  const published = new Map([
    ['h1', { min_age: 'all', sensitive: false }],
    ['s1', { min_age: '12', sensitive: false }],
    ['h2', { min_age: 'all', sensitive: false }],
  ]);
  const listed = new Set(['h1', 'h2']);
  const items = [item({ id: 'ok' }), item({ id: 'no-story', host: 'h2', story: 'gone' }), item({ id: 'no-host', host: 'gone' })];
  const active = activeItems(items, published, listed);
  assert.deepEqual(active.map((a) => a.item.id), ['ok']);
  assert.deepEqual(active[0]!.age, { minAge: '12', sensitive: false }, 'the stricter of the host and the story');
  assert.deepEqual(itemsOfHost(active, 'h1').map((a) => a.item.id), ['ok']);
});

test('the family mode counts only the rarities it shows', () => {
  const rows = [
    { item: { id: 'a' }, age: { minAge: 'all', sensitive: false } },
    { item: { id: 'b' }, age: { minAge: '12', sensitive: false } },
    { item: { id: 'c' }, age: { minAge: 'all', sensitive: true } },
  ];
  assert.deepEqual(visibleItems(rows, 'off').map((r) => r.item.id), ['a', 'b', 'c']);
  assert.deepEqual(visibleItems(rows, '12').map((r) => r.item.id), ['a', 'b']);
  assert.deepEqual(visibleItems(rows, 'all').map((r) => r.item.id), ['a']);
  assert.equal(foundCount(visibleItems(rows, 'all'), ['a', 'b', 'gone']), 1, 'an id that is not in the data is not counted');
});

test('?kabinet=preview and ?kabinet=off', () => {
  assert.equal(previewFromQuery('?kabinet=preview'), true);
  assert.equal(previewFromQuery('?x=1&kabinet=off'), false);
  assert.equal(previewFromQuery('?kabinet=maybe'), undefined);
  assert.equal(previewFromQuery(''), undefined);
});

/** Runs the inline preview script against a fake browser. */
function runPreview(search: string, stored: Record<string, string> = {}) {
  const store = new Map(Object.entries(stored));
  const attrs: Record<string, string> = {};
  const location = { search, pathname: '/pt/', hash: '' };
  let replaced = '';
  const ctx = {
    location,
    history: { replaceState: (_a: unknown, _b: unknown, url: string) => (replaced = url) },
    localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) },
    document: { documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) } },
  };
  vm.runInNewContext(CABINET_PREVIEW_SCRIPT, ctx);
  return { attrs, store, replaced };
}

test('the preview script: the parameter turns the flag on and is taken out of the address; the flag marks the page; off clears it', () => {
  const on = runPreview('?kabinet=preview&x=1');
  assert.equal(on.store.get('cabinet.preview'), '1');
  assert.equal(on.attrs['data-cabinet'], 'preview');
  assert.equal(on.replaced, '/pt/?x=1');
  const again = runPreview('', { 'cabinet.preview': '1' });
  assert.equal(again.attrs['data-cabinet'], 'preview');
  const off = runPreview('?kabinet=off', { 'cabinet.preview': '1' });
  assert.equal(off.store.has('cabinet.preview'), false);
  assert.equal(off.attrs['data-cabinet'], undefined);
  assert.equal(runPreview('').attrs['data-cabinet'], undefined);
  assert.equal(runPreview('?kabinet=preview').replaced, '/pt/');
});

test('the seven sardines have seven different numbers, each in one place', () => {
  assert.equal(SARDINE_PLACES.length, SARDINES);
  assert.deepEqual([...SARDINE_PLACES.map((p) => p.n)].sort((a, b) => a - b), Array.from({ length: SARDINES }, (_, i) => i + 1));
  assert.equal(new Set(SARDINE_PLACES.map((p) => `${p.page}${'epoch' in p ? p.epoch : ''}`)).size, SARDINES);
});

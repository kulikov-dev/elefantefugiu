import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { EventData } from '../src/lib/events';
import { epochFeed, epochHasContent, epochSwitcherItems, neighbourEpochs, nextEpochEntry, threadCountsInEpoch, threadSections } from '../src/lib/epochs';

// Synthetic data: only the fields the helpers read.
const ev = (id: string, epoch: string, year: number, threads: string[], status: 'ready' | 'draft' = 'ready') =>
  ({ id, epoch, year, threads, status, place: { name: 'x', lat: 38, lon: -9 } }) as unknown as EventData;
const ep = (id: string, order: number, mvp = true) => ({ id, order, mvp });

const events = [
  ev('b', 'e1', 1420, ['sea']),
  ev('a', 'e1', 1400, ['sea', 'food']),
  ev('draft', 'e1', 1410, ['sea'], 'draft'),
  ev('c', 'e2', 1760, ['food']),
  ev('d', 'e2', 1750, ['sea', 'food']),
];
const epochs = [ep('e2', 2), ep('e1', 1), ep('e3', 3, false)];

test('epochFeed: chronological, published only, own epoch only', () => {
  assert.deepEqual(epochFeed({ id: 'e1' }, events).map((e) => e.id), ['a', 'b']);
  assert.deepEqual(epochFeed({ id: 'e2' }, events).map((e) => e.id), ['d', 'c']);
  assert.deepEqual(epochFeed({ id: 'nope' }, events), []);
});

test('epochHasContent: needs mvp and a published event', () => {
  assert.equal(epochHasContent(ep('e1', 1), events), true);
  assert.equal(epochHasContent(ep('e3', 3, false), [ev('x', 'e3', 1900, ['sea'])]), false);
  assert.equal(epochHasContent(ep('e4', 4), [ev('x', 'e4', 1900, ['sea'], 'draft')]), false);
});

test('neighbourEpochs: the nearest epoch with content on each side; epochs without content are skipped, none means no link', () => {
  const first = neighbourEpochs(ep('e1', 1), epochs, events);
  assert.equal(first.prev, null);
  assert.equal(first.next?.id, 'e2');
  const middle = neighbourEpochs(ep('e2', 2), epochs, events);
  assert.equal(middle.prev?.id, 'e1');
  assert.equal(middle.next, null); // e3 exists but has no content: no dead end, no link
  const last = neighbourEpochs(ep('e3', 3, false), epochs, events);
  assert.equal(last.next, null);
  assert.equal(last.prev?.id, 'e2');
  assert.deepEqual(neighbourEpochs(ep('ghost', 9), epochs, events), { prev: null, next: null });
});

test('neighbourEpochs jumps over a "coming soon" epoch to the next one that has a page', () => {
  const four = [ep('a', 1), ep('b', 2, false), ep('c', 3, false), ep('d', 4)];
  const evs = [ev('x', 'a', 1900, ['sea']), ev('y', 'd', 1950, ['sea'])];
  assert.equal(neighbourEpochs(four[0]!, four, evs).next?.id, 'd');
  assert.equal(neighbourEpochs(four[3]!, four, evs).prev?.id, 'a');
  assert.equal(neighbourEpochs(four[1]!, four, evs).prev?.id, 'a');
  assert.equal(neighbourEpochs(four[1]!, four, evs).next?.id, 'd');
});

test('threadCountsInEpoch counts primary and second thread, published only', () => {
  const e1 = threadCountsInEpoch({ id: 'e1' }, events);
  assert.equal(e1.get('sea'), 2); // a (second thread) + b, the draft is not counted
  assert.equal(e1.get('food'), 1);
  const e2 = threadCountsInEpoch({ id: 'e2' }, events);
  assert.equal(e2.get('sea'), 1);
  assert.equal(e2.get('food'), 2);
});

test('threadSections: grouped by epoch order, empty epochs left out, counts match', () => {
  const sea = threadSections({ id: 'sea' }, epochs, events);
  assert.deepEqual(sea.map((s) => [s.epoch.id, s.events.map((e) => e.id)]), [['e1', ['a', 'b']], ['e2', ['d']]]);
  const food = threadSections({ id: 'food' }, epochs, events);
  assert.deepEqual(food.map((s) => [s.epoch.id, s.events.length]), [['e1', 1], ['e2', 2]]);
  assert.deepEqual(threadSections({ id: 'none' }, epochs, events), []);
  // the page counter and the section size are the same data
  assert.equal(sea[0]!.events.length, threadCountsInEpoch({ id: 'e1' }, events).get('sea'));
});

// ---- the real epochs.yaml: the numbers come from the file, not from this test ----
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { epochSchema } from '../src/data/schemas';
import { epochYearsText } from '../src/lib/epochs';
import { localize } from '../src/lib/localize';

const realEpochs = (parse(readFileSync(new URL('../src/content/epochs.yaml', import.meta.url), 'utf8')) as unknown[]).map((e) =>
  localize(epochSchema.parse(e), true),
);

test('epochs.yaml: orders run 1..N once each, and at least one epoch is open (MVP)', () => {
  const orders = realEpochs.map((e) => e.order).sort((a, b) => a - b);
  assert.deepEqual(orders, orders.map((_, i) => i + 1));
  assert.ok(realEpochs.some((e) => e.mvp));
});

test('epochs.yaml: epochs outside the MVP are real data with a years label in both languages', () => {
  for (const e of realEpochs.filter((x) => !x.mvp)) {
    // Name, years, style and intro are final; the theme phrase and the preview picture of the three epochs prepared for later may still be provisional.
    assert.deepEqual(e.placeholder.filter((f) => f !== 'theme' && f !== 'fallback_image'), [], e.id);
    assert.ok(epochYearsText(e, 'pt') && epochYearsText(e, 'en') && epochYearsText(e, 'ru'), e.id);
  }
});

test('epochYearsText: years before the common era are written with the era', () => {
  assert.equal(epochYearsText({ years: { from: -218, to: 409 } }, 'pt'), '218 a.C.–409');
  assert.equal(epochYearsText({ years: { from: -218, to: 409 } }, 'ru'), '218 до н. э.–409');
});

test('epochYearsText: label wins, numeric range is the fallback', () => {
  assert.equal(epochYearsText({ years: { from: 1385, to: 1580 } }, 'pt'), '1385\u20131580');
  assert.equal(epochYearsText({ years: { from: 1900, to: 1900 } }, 'en'), '1900');
  assert.equal(epochYearsText({ years: { from: 1, to: 2 }, years_label: { pt: 'a', en: 'b', ru: 'c' } }, 'en'), 'b');
  assert.equal(epochYearsText({}, 'pt'), '');
});

test('neighbours in the real data: with no content there is none; with content in two MVP epochs they find each other over the epochs in between', () => {
  const none: EventData[] = [];
  const [a, b] = realEpochs.filter((e) => e.mvp).sort((x, y) => x.order - y.order);
  assert.deepEqual(neighbourEpochs(a!, realEpochs, none), { prev: null, next: null });
  const some = [ev('p', a!.id, 1400, ['sea']), ev('q', b!.id, 1760, ['sea'])];
  assert.equal(neighbourEpochs(a!, realEpochs, some).next?.id, b!.id);
  assert.equal(neighbourEpochs(b!, realEpochs, some).prev?.id, a!.id);
  assert.equal(neighbourEpochs(b!, realEpochs, some).next, null);
});

test('epochSwitcherItems: all epochs by order, current marked, link only with a page, rest "soon"', () => {
  const items = epochSwitcherItems(ep('e2', 2), epochs, events);
  assert.deepEqual(items.map((i) => [i.epoch.id, i.state]), [['e1', 'link'], ['e2', 'current'], ['e3', 'soon']]);
  // an MVP epoch without a published card has no page, so it is not a link
  const empty = epochSwitcherItems(ep('e1', 1), [ep('e1', 1), ep('e9', 9)], events);
  assert.deepEqual(empty.map((i) => i.state), ['current', 'soon']);
});

test('nextEpochEntry: the first story of the nearest later epoch with a page; the mode can skip stories and whole epochs; none at the end', () => {
  const four = [ep('a', 1), ep('b', 2, false), ep('c', 3), ep('d', 4)];
  const evs = [ev('x', 'a', 1900, ['sea']), ev('y', 'c', 1950, ['sea']), ev('z', 'c', 1960, ['sea']), ev('w', 'd', 1990, ['sea'])];
  // "b" has no page: from a the next epoch is c, and its first story is y
  const first = nextEpochEntry(four[0]!, four, evs);
  assert.equal(first?.epoch.id, 'c');
  assert.equal(first?.story.id, 'y');
  // the mode hides y: z is the first it shows
  assert.equal(nextEpochEntry(four[0]!, four, evs, (e) => e.id !== 'y')?.story.id, 'z');
  // the mode hides every story of c: the epoch is skipped
  assert.equal(nextEpochEntry(four[0]!, four, evs, (e) => e.epoch !== 'c')?.epoch.id, 'd');
  // after the last epoch with a page, and when the mode hides everything that follows: none
  assert.equal(nextEpochEntry(four[3]!, four, evs), null);
  assert.equal(nextEpochEntry(four[0]!, four, evs, (e) => e.epoch === 'a'), null);
});

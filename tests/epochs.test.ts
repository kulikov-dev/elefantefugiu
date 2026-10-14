import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { EventData } from '../src/lib/events';
import { epochFeed, epochHasContent, neighbourEpochs, threadCountsInEpoch, threadSections } from '../src/lib/epochs';

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

test('neighbourEpochs: by order, "coming soon" when the neighbour has no content', () => {
  const first = neighbourEpochs(ep('e1', 1), epochs, events);
  assert.equal(first.prev, null);
  assert.deepEqual([first.next?.epoch.id, first.next?.available], ['e2', true]);
  const middle = neighbourEpochs(ep('e2', 2), epochs, events);
  assert.deepEqual([middle.prev?.epoch.id, middle.prev?.available], ['e1', true]);
  assert.deepEqual([middle.next?.epoch.id, middle.next?.available], ['e3', false]); // exists, no content: "Em breve"
  const last = neighbourEpochs(ep('e3', 3, false), epochs, events);
  assert.equal(last.next, null);
  assert.deepEqual(neighbourEpochs(ep('ghost', 9), epochs, events), { prev: null, next: null });
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

// ---- the real epochs.yaml: nine epochs, MVP ones are 4, 6 and 8 ----
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { epochSchema } from '../src/data/schemas';
import { epochYearsText } from '../src/lib/epochs';

const realEpochs = (parse(readFileSync(new URL('../src/content/epochs.yaml', import.meta.url), 'utf8')) as unknown[]).map((e) =>
  epochSchema.parse(e),
);

test('epochs.yaml: orders 1-9 once each, MVP epochs are exactly 4, 6 and 8', () => {
  assert.deepEqual(realEpochs.map((e) => e.order).sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(realEpochs.filter((e) => e.mvp).map((e) => e.order).sort((a, b) => a - b), [4, 6, 8]);
});

test('epochs.yaml: epochs outside the MVP are real data with a years label in both languages', () => {
  for (const e of realEpochs.filter((x) => !x.mvp)) {
    assert.equal(e.placeholder, false, e.id);
    assert.ok(epochYearsText(e, 'pt') && epochYearsText(e, 'en'), e.id);
  }
});

test('epochYearsText: label wins, numeric range is the fallback', () => {
  assert.equal(epochYearsText({ years: { from: 1385, to: 1580 } }, 'pt'), '1385\u20131580');
  assert.equal(epochYearsText({ years: { from: 1900, to: 1900 } }, 'en'), '1900');
  assert.equal(epochYearsText({ years: { from: 1, to: 2 }, years_label: { pt: 'a', en: 'b' } }, 'en'), 'b');
  assert.equal(epochYearsText({}, 'pt'), '');
});

test('neighbours in the real data: epoch 4 has "coming soon" on the left, 6 has "coming soon" on the right', () => {
  const byOrder = (n: number) => realEpochs.find((e) => e.order === n)!;
  const none: EventData[] = [];
  assert.equal(neighbourEpochs(byOrder(4), realEpochs, none).prev?.epoch.order, 3);
  assert.equal(neighbourEpochs(byOrder(4), realEpochs, none).prev?.available, false);
  assert.equal(neighbourEpochs(byOrder(6), realEpochs, none).next?.epoch.order, 7);
  assert.equal(neighbourEpochs(byOrder(6), realEpochs, none).next?.available, false);
});

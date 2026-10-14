import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { EventData } from '../src/lib/events';
import { epochTiles, firstMvpEpoch, pickFeatured, pickSurprise, surpriseCandidates } from '../src/lib/home';

const ev = (id: string, epoch: string, extra: Record<string, unknown> = {}) =>
  ({ id, epoch, year: 1500, threads: ['mar'], status: 'ready', sensitive: false, min_age: 'all', place: { name: 'x', lat: 38, lon: -9 }, ...extra }) as unknown as EventData;
const ep = (id: string, order: number, mvp = true) => ({ id, order, mvp });

const events = [ev('a', 'e4'), ev('b', 'e4'), ev('c', 'e6', { sensitive: true }), ev('d', 'e6', { min_age: '12' }), ev('e', 'e6'), ev('draft', 'e6', { status: 'draft' })];
const epochs = [ep('e9', 9, false), ep('e6', 6), ep('e4', 4), ep('e1', 1, false)];

test('firstMvpEpoch: lowest order among epochs with a page', () => {
  assert.equal(firstMvpEpoch(epochs, events)?.id, 'e4');
  assert.equal(firstMvpEpoch(epochs, events.filter((e) => e.epoch !== 'e4'))?.id, 'e6');
  assert.equal(firstMvpEpoch([ep('e1', 1, false)], events), null);
});

test('epochTiles: all epochs by order, counts from the data, link only with a page', () => {
  const tiles = epochTiles(epochs, events.filter((e) => e.status === 'ready'));
  assert.deepEqual(tiles.map((t) => [t.epoch.id, t.available, t.count]), [['e1', false, 0], ['e4', true, 2], ['e6', true, 3], ['e9', false, 0]]);
});

test('pickFeatured: list order, unpublished and unknown ids skipped', () => {
  assert.deepEqual(pickFeatured(['e', 'zzz', 'a'], events.filter((e) => e.status === 'ready')).map((e) => e.id), ['e', 'a']);
  assert.deepEqual(pickFeatured(['draft'], events.filter((e) => e.status === 'ready')), []);
});

test('surpriseCandidates: published, all ages, not a heavy topic', () => {
  assert.deepEqual(surpriseCandidates(events).map((e) => e.id), ['a', 'b', 'e']);
});

test('pickSurprise: never the last card, many draws; handles one card and none', () => {
  const ids = ['a', 'b', 'e'];
  for (let i = 0; i < 500; i += 1) assert.notEqual(pickSurprise(ids, 'b'), 'b');
  const seen = new Set<string | null>();
  for (let i = 0; i < 200; i += 1) seen.add(pickSurprise(ids, null));
  assert.equal(seen.size, 3);
  assert.equal(pickSurprise(['a'], 'a'), 'a');
  assert.equal(pickSurprise([], null), null);
  // edge of the random range
  assert.equal(pickSurprise(ids, null, () => 0.999999), 'e');
  assert.equal(pickSurprise(ids, null, () => 0), 'a');
});

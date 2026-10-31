import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SESSION_GAP_MS, advanceVisit, dayOf, isNewSince, newCounts, newEras, parseVisit } from '../src/lib/new-marks';

const T0 = Date.UTC(2026, 9, 20, 12, 0, 0);
const MIN = 60_000;

test('parseVisit: nothing, damage and a wrong shape are "never here before"', () => {
  for (const raw of [null, undefined, '', 'x', '[]', '5', '{"prev":1}', '{"last":"a"}', '{"last":-3}']) assert.deepEqual(parseVisit(raw), { prev: null, last: null });
  assert.deepEqual(parseVisit(`{"prev":${T0},"last":${T0 + 1}}`), { prev: T0, last: T0 + 1 });
  assert.deepEqual(parseVisit(`{"prev":"x","last":${T0}}`), { prev: null, last: T0 });
});

test('the first visit: no previous session, last = now', () => {
  assert.deepEqual(advanceVisit({ prev: null, last: null }, T0), { prev: null, last: T0 });
});

test('the same session (30 minutes or less) keeps prev and moves last', () => {
  assert.deepEqual(advanceVisit({ prev: null, last: T0 }, T0 + 5 * MIN), { prev: null, last: T0 + 5 * MIN });
  assert.deepEqual(advanceVisit({ prev: 111, last: T0 }, T0 + SESSION_GAP_MS), { prev: 111, last: T0 + SESSION_GAP_MS });
});

test('a new session (more than 30 minutes): prev = the old last', () => {
  assert.deepEqual(advanceVisit({ prev: 111, last: T0 }, T0 + SESSION_GAP_MS + 1), { prev: T0, last: T0 + SESSION_GAP_MS + 1 });
  assert.deepEqual(advanceVisit({ prev: null, last: T0 }, T0 + 3 * 24 * 60 * MIN).prev, T0);
});

test('a clock set back counts as the same session', () => {
  assert.deepEqual(advanceVisit({ prev: 5, last: T0 }, T0 - MIN), { prev: 5, last: T0 - MIN });
});

test('isNewSince: published after the day of the visit; the same day and no visit are not new', () => {
  assert.equal(dayOf(T0), '2026-10-20');
  assert.equal(isNewSince('2026-10-21', T0), true);
  assert.equal(isNewSince('2026-10-20', T0), false);
  assert.equal(isNewSince('2026-10-01', T0), false);
  assert.equal(isNewSince('2030-01-01', null), false);
});

test('newCounts: unread, new and shown in the mode, per epoch; a story listed twice counts once', () => {
  const s = (id: string, epoch: string, published: string, minAge = 'all', sensitive = false) => ({ id, epoch, published, minAge, sensitive });
  const stories = [s('a', 'e1', '2026-10-25'), s('b', 'e1', '2026-10-26'), s('c', 'e2', '2026-10-27', '12'), s('d', 'e2', '2026-10-10'), s('e', 'e2', '2026-10-28', '16', true), s('a', 'e1', '2026-10-25')];
  assert.deepEqual(newCounts(stories, [], T0, 'off'), { total: 4, byEpoch: { e1: 2, e2: 2 }, eras: [], whole: false });
  assert.deepEqual(newCounts(stories, ['b'], T0, 'off'), { total: 3, byEpoch: { e1: 1, e2: 2 }, eras: [], whole: false });
  assert.deepEqual(newCounts(stories, [], T0, 'all'), { total: 2, byEpoch: { e1: 2 }, eras: [], whole: false });
  assert.deepEqual(newCounts(stories, [], T0, '12'), { total: 3, byEpoch: { e1: 2, e2: 1 }, eras: [], whole: false });
  assert.deepEqual(newCounts(stories, [], null, 'off'), { total: 0, byEpoch: {}, eras: [], whole: false });
});

test('a new era: every story the mode shows in the epoch is new; the home page then speaks of epochs', () => {
  const s = (id: string, epoch: string, published: string, minAge = 'all', sensitive = false) => ({ id, epoch, published, minAge, sensitive });
  // e1 and e3: every story is new. e2: 'd' is old, so the epoch is not new in any mode. e4: one story for ages 12 and over: shown (and new) in 'off' and '12'.
  const stories = [s('a', 'e1', '2026-10-25'), s('b', 'e1', '2026-10-26'), s('c', 'e2', '2026-10-27', '12'), s('d', 'e2', '2026-10-10'), s('f', 'e3', '2026-10-28')];
  const firsts = { e1: { off: '2026-10-25', all: '2026-10-25', '12': '2026-10-25' }, e2: { off: '2026-10-10', all: '2026-10-10', '12': '2026-10-10' }, e3: { off: '2026-10-28', all: '2026-10-28', '12': '2026-10-28' }, e4: { off: '2026-10-27', '12': '2026-10-27' } };
  assert.deepEqual(newEras(firsts, T0, 'off'), ['e1', 'e3', 'e4']);
  assert.deepEqual(newEras(firsts, T0, 'all'), ['e1', 'e3']);
  assert.deepEqual(newEras(firsts, null, 'off'), []);
  assert.equal(newCounts(stories, [], T0, 'off', firsts).whole, false); // e2 has new stories but is not new as a whole
  assert.equal(newCounts(stories.filter((x) => x.epoch !== 'e2'), [], T0, 'off', firsts).whole, true);
  assert.equal(newCounts(stories, [], T0, 'all', firsts).whole, true); // in 'all' the new stories are only in e1 and e3, both new as a whole
});

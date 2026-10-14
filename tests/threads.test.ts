import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countCardsByThread, visibleThreads, MIN_CARDS_PER_THREAD, type ThreadedCard } from '../src/lib/threads';

const threads = [{ id: 'sea' }, { id: 'food' }, { id: 'power' }, { id: 'nature' }];
const card = (...ids: string[]): ThreadedCard => ({ threads: ids, status: 'ready' });
const many = (n: number, ...ids: string[]) => Array.from({ length: n }, () => card(...ids));

test('the threshold is 5 cards', () => {
  assert.equal(MIN_CARDS_PER_THREAD, 5);
});

test('a thread with exactly 5 cards is shown, 4 is not', () => {
  const cards = [...many(5, 'sea'), ...many(4, 'food')];
  assert.deepEqual(visibleThreads(threads, cards).map((t) => t.id), ['sea']);
});

test('the second thread of a card counts the same as the primary one', () => {
  // power: 2 primary + 3 as second thread = 5
  const cards = [...many(2, 'power'), ...many(3, 'sea', 'power'), ...many(5, 'sea')];
  assert.equal(countCardsByThread(cards).get('power'), 5);
  assert.deepEqual(visibleThreads(threads, cards).map((t) => t.id), ['sea', 'power']);
});

test('only second-thread cards are enough to show a thread', () => {
  const cards = many(5, 'sea', 'nature');
  assert.deepEqual(visibleThreads(threads, cards).map((t) => t.id), ['sea', 'nature']);
});

test('drafts are not counted', () => {
  const cards: ThreadedCard[] = [...many(4, 'food'), { threads: ['food'], status: 'draft' }];
  assert.equal(countCardsByThread(cards).get('food'), 4);
  assert.deepEqual(visibleThreads(threads, cards), []);
});

test('a thread listed twice on one card counts once', () => {
  const cards = [card('sea', 'sea'), ...many(3, 'sea')];
  assert.equal(countCardsByThread(cards).get('sea'), 4);
});

test('threads without any cards are hidden and the input order is kept', () => {
  const cards = [...many(6, 'nature'), ...many(5, 'sea')];
  assert.deepEqual(visibleThreads(threads, cards).map((t) => t.id), ['sea', 'nature']);
  assert.deepEqual(visibleThreads(threads, []), []);
});

test('the minimum can be overridden', () => {
  assert.deepEqual(visibleThreads(threads, many(2, 'food'), 2).map((t) => t.id), ['food']);
});

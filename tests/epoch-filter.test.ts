import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchesThread, parseState, serializeState } from '../src/lib/epoch-filter';

const known = ['mar', 'natureza'];

test('parseState: defaults, thread, view, both', () => {
  assert.deepEqual(parseState('', known), { fio: null, grid: false });
  assert.deepEqual(parseState('?fio=mar', known), { fio: 'mar', grid: false });
  assert.deepEqual(parseState('?vista=grelha', known), { fio: null, grid: true });
  assert.deepEqual(parseState('?vista=grelha&fio=natureza', known), { fio: 'natureza', grid: true });
});

test('parseState: unknown thread or view is ignored, other parameters do not matter', () => {
  assert.deepEqual(parseState('?fio=nope&vista=lista&x=1', known), { fio: null, grid: false });
  assert.deepEqual(parseState('?fio=', known), { fio: null, grid: false });
});

test('serializeState: empty for the default, stable order, round trip', () => {
  assert.equal(serializeState({ fio: null, grid: false }), '');
  assert.equal(serializeState({ fio: 'mar', grid: false }), '?fio=mar');
  assert.equal(serializeState({ fio: 'mar', grid: true }), '?fio=mar&vista=grelha');
  for (const state of [{ fio: 'natureza', grid: true }, { fio: null, grid: true }, { fio: 'mar', grid: false }]) {
    assert.deepEqual(parseState(serializeState(state), known), state);
  }
});

test('matchesThread: primary or second thread, everything when the filter is off', () => {
  assert.equal(matchesThread(['mar', 'natureza'], 'natureza'), true);
  assert.equal(matchesThread(['mar'], 'natureza'), false);
  assert.equal(matchesThread(['mar'], null), true);
});

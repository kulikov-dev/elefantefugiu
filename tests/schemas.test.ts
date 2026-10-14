import { test } from 'node:test';
import assert from 'node:assert/strict';
import { minAge } from '../src/data/schemas';

test('min_age is normalised to a string', () => {
  assert.equal(minAge.parse(12), '12');
  assert.equal(minAge.parse('12'), '12');
  assert.equal(minAge.parse(16), '16');
  assert.equal(minAge.parse('16'), '16');
  assert.equal(minAge.parse('all'), 'all');
});

test('min_age rejects other values', () => {
  for (const bad of [14, '14', 'ALL', '', null, undefined, '12+']) {
    assert.equal(minAge.safeParse(bad).success, false, `should reject ${String(bad)}`);
  }
});

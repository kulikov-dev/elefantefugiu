import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SUITES } from '../scripts/qa/suites.mjs';

// QA full runs the suites in parallel jobs, one shard each (scripts/qa/shards.json). A suite that is in no shard would silently never run.
const { shards } = JSON.parse(readFileSync(new URL('../scripts/qa/shards.json', import.meta.url), 'utf8')) as { shards: string[][] };
const names: string[] = SUITES.map((s: { name: string }) => s.name);
const placed = shards.flat();

test('every browser suite is in exactly one shard of scripts/qa/shards.json', () => {
  assert.deepEqual(names.filter((n) => !placed.includes(n)), [], 'in no shard: add it to a shard of scripts/qa/shards.json');
  assert.deepEqual(placed.filter((n, i) => placed.indexOf(n) !== i), [], 'in two shards');
  assert.deepEqual(placed.filter((n) => !names.includes(n)), [], 'in a shard but not in scripts/qa/suites.mjs');
});

test('no shard is empty', () => {
  assert.ok(shards.length >= 1 && shards.every((s) => s.length > 0));
});

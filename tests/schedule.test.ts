// npm run schedule (scripts/schedule.mjs): the queue of stories that wait for their day.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const script = fileURLToPath(new URL('../scripts/schedule.mjs', import.meta.url));
const eventsDir = fileURLToPath(new URL('../src/content/events/', import.meta.url));
const ready = readdirSync(eventsDir)
  .filter((f) => f.endsWith('.yaml'))
  .map((f) => parse(readFileSync(`${eventsDir}${f}`, 'utf8'), { schema: 'core' }) as { id: string; status: string; published: string });
const run = (env: Record<string, string>, ...args: string[]) => spawnSync(process.execPath, [script, ...args], { env: { ...process.env, ...env }, encoding: 'utf8' });

test('the queue on a day before every story lists each ready story once, in the order of the days', () => {
  const stories = ready.filter((s) => s.status === 'ready');
  const first = stories.map((s) => s.published).sort()[0]!;
  const day = new Date(Date.parse(`${first}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  const r = run({ SITE_TODAY: day }, '--weeks=520');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, new RegExp(`${stories.length} stories in the queue`));
  const dates = [...r.stdout.matchAll(/^(\d{4}-\d{2}-\d{2})\s/gm)].map((m) => m[1]);
  assert.equal(dates.length, stories.length);
  assert.deepEqual(dates, [...dates].sort());
});

test('with nothing queued it says so; a day far in the future queues nothing', () => {
  const r = run({ SITE_TODAY: '2099-01-01' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Nothing is queued/);
});

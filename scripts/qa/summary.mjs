// One table of the whole QA full run, from the result files of its shards (the last job of qa-full.yml).
//   node summary.mjs <dir-with-shard-results> [--only "suite suite"]   markdown on stdout; exit code 1 when a suite failed or did not run
// <dir> holds one folder per shard (qa-shard-1/qa-results.json, ...), as actions/download-artifact leaves them.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SUITES } from './suites.mjs';

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith('--')) ?? '.';
const only = (args.find((a) => a.startsWith('--only='))?.slice(7) ?? '').split(/\s+/).filter(Boolean);
const results = {};
const shardOf = {};
for (const d of existsSync(dir) ? readdirSync(dir).sort() : []) {
  const file = join(dir, d, 'qa-results.json');
  if (!existsSync(file)) continue;
  for (const [name, r] of Object.entries(JSON.parse(readFileSync(file, 'utf8')).results ?? {})) {
    results[name] = r;
    shardOf[name] = d.replace(/^\D+/, '');
  }
}
const list = only.length ? SUITES.filter((s) => only.includes(s.name)) : SUITES;
const rows = list.map((s) => {
  const r = results[s.name];
  if (!r) return { s, line: `| ${s.name} | - | not run | - | - |`, bad: true, checks: 0, seconds: 0 };
  const verdict = r.ok ? `PASS${r.skip ? ` (${r.skip} skipped)` : ''}${r.retried ? ' (after a retry)' : ''}` : `**FAIL**${r.fail ? ` (${r.fail} failed)` : ` (${r.note ?? 'exit ' + r.code})`}`;
  return { s, line: `| ${s.name} | ${r.pass + r.fail} | ${verdict} | ${r.seconds} s | ${shardOf[s.name]} |`, bad: !r.ok, checks: r.pass + r.fail, seconds: r.seconds };
});
const shardTime = {};
for (const r of rows) shardTime[shardOf[r.s.name] ?? '?'] = (shardTime[shardOf[r.s.name] ?? '?'] ?? 0) + r.seconds;
const failed = rows.filter((r) => r.bad);
const warnings = rows.flatMap((r) => (results[r.s.name]?.warnings ?? []).map((w) => `- ${r.s.name}: ${w.replace(/^WARN\s+/, '')}`));
console.log('### QA full');
console.log('');
console.log('| suite | checks | result | time | shard |');
console.log('|---|---:|---|---:|---:|');
for (const r of rows) console.log(r.line);
console.log('');
console.log(`${rows.length} suites, ${rows.reduce((n, r) => n + r.checks, 0)} checks, ${failed.length === 0 ? 'all passed' : `${failed.length} failed or not run: ${failed.map((r) => r.s.name).join(', ')}`}`);
if (warnings.length) {
  console.log('');
  console.log('Warnings (not failures):');
  console.log('');
  for (const w of warnings) console.log(w);
}
console.log('');
console.log(`Suite time per shard: ${Object.entries(shardTime).map(([k, v]) => `${k}: ${Math.floor(v / 60)} min ${v % 60} s`).join(', ')}`);
process.exit(failed.length ? 1 : 0);

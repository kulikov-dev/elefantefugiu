// All browser suites with one command, one table at the end.
//   npm run qa                    every suite, then the table (set up and torn down by this script)
//   npm run qa -- <suite> [...]   only the named suites (see --list)
//   npm run qa -- --list          the suites and what they cover
//   npm run qa -- --resume        continue the last run: suites that already have a result are skipped
//   npm run qa -- --budget=250    stop before starting a suite once 250 seconds have passed (exit code 2; use --resume to go on)
//   npm run qa -- --report        print the table of the last run without running anything
//   npm run qa -- --shard=2/4     only the suites of shard 2 of shards.json (QA full runs 4 of them in parallel jobs); ports 4410/4411 for shard 2
//   npm run qa -- --verbose       the whole log of every suite and the table at the end (by default: one line per suite, the failed
//                                 checks of a failing suite and one summary line; in GitHub Actions a failed check is also an annotation)
// BASE_PATH=/elefante npm run qa    the same against a build made with that base path (build with the same BASE_PATH first)
// Needs a finished build (dist/). The script installs scripts/qa/node_modules when it is missing, starts the static server
// (and, for the *-variant suites, builds the variant site of prepare-variant.mjs and serves it too), and stops them at the end.
// Results and logs go to scripts/qa/out/ (git-ignored).
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SUITES } from './suites.mjs';

const here = fileURLToPath(new URL('./', import.meta.url));
const root = fileURLToPath(new URL('../../', import.meta.url));
// The fixture build (prepare-variant.mjs) lives outside the repository.
const VARIANT_DIR = join(process.env.QA_VARIANT_DIR || tmpdir(), 'elefante-variant');
const out = `${here}out/`;
const resultsFile = `${out}qa-results.json`;
const BASE_PATH = (process.env.BASE_PATH ?? '').replace(/\/$/, '');

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const shardArg = (argv.find((a) => a.startsWith('--shard=')) ?? '').slice('--shard='.length);
const [shardNo, shardOf] = shardArg ? shardArg.split('/').map(Number) : [0, 0];
// Each shard has its own pair of ports (shard 1: 4400/4401, shard 2: 4410/4411, ...), so shards may also share a machine.
const MAIN = 4400 + Math.max(0, shardNo - 1) * 10;
const VARIANT = MAIN + 1;

// shards.json: the suites of every shard. A suite that is in no shard (or in two) is an error, so a new suite cannot be forgotten.
const shardList = JSON.parse(readFileSync(`${here}shards.json`, 'utf8')).shards;
{
  const placed = shardList.flat();
  const lost = SUITES.map((s) => s.name).filter((n) => !placed.includes(n));
  const twice = placed.filter((n, i) => placed.indexOf(n) !== i);
  const unknown = placed.filter((n) => !SUITES.some((s) => s.name === n));
  if (lost.length || twice.length || unknown.length) {
    console.error(`shards.json does not match suites.mjs: in no shard [${lost}], twice [${twice}], unknown [${unknown}]`);
    process.exit(1);
  }
}
if (shardArg && !(shardOf === shardList.length && shardNo >= 1 && shardNo <= shardOf)) {
  console.error(`--shard=${shardArg}: shards.json has ${shardList.length} shards, use --shard=1/${shardList.length} ... --shard=${shardList.length}/${shardList.length}`);
  process.exit(1);
}
const budget = Number((argv.find((a) => a.startsWith('--budget=')) ?? '').split('=')[1] || Infinity);
const named = argv.filter((a) => !a.startsWith('--'));
const verbose = flag('verbose');
const inActions = process.env.GITHUB_ACTIONS === 'true';

function load() {
  try {
    return JSON.parse(readFileSync(resultsFile, 'utf8'));
  } catch {
    return { results: {} };
  }
}
function save(data) {
  mkdirSync(out, { recursive: true });
  writeFileSync(resultsFile, JSON.stringify(data, null, 2));
}

function table(results, list) {
  const rows = list.map((s) => {
    const r = results[s.name];
    if (!r) return [s.name, '-', 'not run', '-'];
    const checks = r.pass + r.fail;
    const verdict = r.ok ? `PASS${r.skip ? ` (${r.skip} skipped)` : ''}${r.retried ? ' (after a retry)' : ''}` : `FAIL${r.fail ? ` (${r.fail} failed)` : ` (${r.note ?? 'exit ' + r.code})`}`;
    return [s.name, String(checks), verdict, `${r.seconds}s`];
  });
  const head = ['suite', 'checks', 'result', 'time'];
  const width = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const line = (r) => r.map((c, i) => (i === 1 || i === 3 ? c.padStart(width[i]) : c.padEnd(width[i]))).join('  ');
  const total = rows.reduce((n, r) => n + (Number(r[1]) || 0), 0);
  const failing = rows.filter((r) => r[2].startsWith('FAIL') || r[2] === 'not run').length;
  return [line(head), width.map((w) => '-'.repeat(w)).join('  '), ...rows.map(line), width.map((w) => '-'.repeat(w)).join('  '), `${list.length} suites, ${total} checks, ${failing === 0 ? 'all passed' : `${failing} suite(s) failed or not run`}`].join('\n');
}

if (flag('list')) {
  for (const s of SUITES) console.log(`${s.name.padEnd(22)} ${s.about}${s.variant ? ' (variant build)' : ''}`);
  process.exit(0);
}

const inShard = shardArg ? SUITES.filter((s) => shardList[shardNo - 1].includes(s.name)) : SUITES;
const wanted = named.length ? named.map((n) => SUITES.find((s) => s.name === n) ?? (console.error(`Unknown suite "${n}". Try: npm run qa -- --list`), process.exit(1))).filter((s) => !shardArg || inShard.includes(s)) : inShard;
if (flag('report')) {
  console.log(table(load().results, wanted));
  process.exit(0);
}

if (!existsSync(`${root}dist/index.html`)) {
  console.error('There is no build in dist/. Run npm run build first.');
  process.exit(1);
}
if (!existsSync(`${here}node_modules/puppeteer-core`)) {
  console.log('Installing the browser check tools (scripts/qa, one time)...');
  const r = spawnSync('npm', ['ci'], { cwd: here, stdio: 'inherit', shell: true });
  if (r.status !== 0) process.exit(1);
}

const data = flag('resume') || named.length ? load() : { results: {} };
const children = [];
const stop = () => children.forEach((c) => c.kill());
process.on('exit', stop);
process.on('SIGINT', () => process.exit(130));

function listening(port) {
  return new Promise((resolve) => {
    const c = createConnection({ port }, () => (c.end(), resolve(true)));
    c.on('error', () => resolve(false));
  });
}
async function serve(port, env = {}) {
  if (await listening(port)) return;
  children.push(spawn('node', ['serve.mjs', String(port)], { cwd: here, env: { ...process.env, ...env }, stdio: 'ignore' }));
  for (let i = 0; i < 50; i += 1) {
    if (await listening(port)) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`The static server did not start on port ${port}.`);
}

await serve(MAIN);
const todo = wanted.filter((s) => !(flag('resume') && data.results[s.name]));
if (todo.some((s) => s.variant)) {
  // A fresh run builds the variant from the current sources; --resume reuses the one already there.
  if (!flag('resume') || !existsSync(join(VARIANT_DIR, 'dist/index.html'))) {
    console.log('Building the variant site (prepare-variant.mjs)...');
    const r = spawnSync('node', ['prepare-variant.mjs'], { cwd: here, stdio: 'inherit', env: { ...process.env, QA_VARIANT_DIR: dirname(VARIANT_DIR) } });
    if (r.status !== 0) {
      console.error('The variant build failed.');
      process.exit(1);
    }
  }
  await serve(VARIANT, { DIST: join(VARIANT_DIR, 'dist') });
}

const started = Date.now();
let stoppedEarly = false;
for (const suite of wanted) {
  if (flag('resume') && data.results[suite.name]) continue;
  if ((Date.now() - started) / 1000 > budget) {
    stoppedEarly = true;
    break;
  }
  const t0 = Date.now();
  process.stdout.write(`running ${suite.name} ... `);
  const runOnce = () => new Promise((resolve) => {
    const child = spawn('node', [suite.script, ...(suite.args ?? [])], {
      cwd: here,
      env: { ...process.env, BASE_URL: `http://localhost:${MAIN}${BASE_PATH}`, VARIANT_URL: `http://localhost:${VARIANT}${BASE_PATH}`, ...(suite.env ?? {}) },
    });
    let log = '';
    child.stdout.on('data', (d) => (log += d));
    child.stderr.on('data', (d) => (log += d));
    const timer = setTimeout(() => child.kill(), 15 * 60 * 1000);
    child.on('close', (code) => (clearTimeout(timer), resolve({ code, log })));
  });
  let result = await runOnce();
  // A browser that dies in the middle of a suite (ProtocolError, "Session with given id not found", "Target closed") is a crash of the runner,
  // not a finding: one more try, for every suite. A failed exit with no FAIL line is a crash too; a suite with only FAIL lines is never rerun.
  // The log of the second run starts with a RETRY line that quotes the crash of the first, so a reader of the log knows there was one.
  const CRASH = /ProtocolError|Protocol error|Session with given id not found|Target closed|Navigating frame was detached|Execution context was destroyed|Browser has disconnected|Connection closed/;
  let retried = false;
  if (result.code !== 0 && (!/^FAIL/m.test(result.log) || CRASH.test(result.log))) {
    process.stdout.write('crashed, once more ... ');
    retried = true;
    const lines = result.log.split(/\r?\n/);
    const first = (lines.find((l) => CRASH.test(l)) ?? lines.filter(Boolean).at(-1) ?? '').trim();
    result = await runOnce();
    result.log = `RETRY  the first run crashed (${first.slice(0, 200)}); this is the second run${'\n'}${result.log}`;
  }
  mkdirSync(out, { recursive: true });
  writeFileSync(`${out}${suite.name}.log`, result.log);
  const count = (word) => (result.log.match(new RegExp(`^${word}\\b`, 'gm')) ?? []).length;
  const pass = count('PASS');
  const fail = count('FAIL');
  const ok = result.code === 0 && fail === 0 && pass > 0;
  data.results[suite.name] = { retried: retried || undefined, pass, fail, skip: count('SKIP'), warnings: result.log.split('\n').filter((l) => /^WARN/.test(l)).map((l) => l.trim().slice(0, 300)), code: result.code, ok, seconds: Math.round((Date.now() - t0) / 1000), note: ok || fail ? undefined : pass === 0 ? 'no checks ran, see out/' + suite.name + '.log' : undefined };
  save(data);
  const seconds = Math.round((Date.now() - t0) / 1000);
  console.log(ok ? `${pass} passed (${seconds}s${retried ? ', after a retry' : ''})` : `FAILED (${fail} failed, exit ${result.code}; log: scripts/qa/out/${suite.name}.log)`);
  // A line WARN in a log is a warning, not a check: it is shown (and annotated in GitHub Actions) but does not fail the suite.
  for (const w of data.results[suite.name].warnings) {
    console.log(`    ${w}`);
    if (inActions) console.log(`::warning title=QA ${suite.name}::${w.replace(/[\r\n%]/g, ' ')}`);
  }
  if (verbose) console.log(result.log);
  else if (!ok) {
    // Details only for a failing suite: its failed checks (or the last lines of the log when no check ran), at most 25 lines.
    const lines = result.log.split('\n');
    const failed = lines.filter((l) => /^FAIL\b/.test(l));
    const shown = (failed.length ? failed : lines.filter(Boolean).slice(-12)).slice(0, 25);
    for (const l of shown) console.log(`    ${l}`);
    if (inActions) for (const l of shown) console.log(`::error title=QA ${suite.name}::${l.replace(/[\r\n%]/g, ' ')}`);
  }
}

const resultLines = table(data.results, wanted).split('\n');
// The whole table only with --verbose; by default the summary line (the last one) and, when something failed, the names of the suites.
if (verbose) console.log(`\n${resultLines.join('\n')}`);
else {
  const failedNames = wanted.filter((s) => !data.results[s.name]?.ok).map((s) => s.name);
  console.log(`\n${resultLines.at(-1)}${failedNames.length ? `: ${failedNames.join(', ')}` : ''}`);
}
if (stoppedEarly) {
  console.log(`\nStopped after the ${budget} s budget. Continue with: npm run qa -- --resume`);
  process.exit(2);
}
process.exit(wanted.every((s) => data.results[s.name]?.ok) ? 0 : 1);

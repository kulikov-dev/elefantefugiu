// All browser suites with one command, one table at the end.
//   npm run qa                    every suite, then the table (set up and torn down by this script)
//   npm run qa -- <suite> [...]   only the named suites (see --list)
//   npm run qa -- --list          the suites and what they cover
//   npm run qa -- --resume        continue the last run: suites that already have a result are skipped
//   npm run qa -- --budget=250    stop before starting a suite once 250 seconds have passed (exit code 2; use --resume to go on)
//   npm run qa -- --report        print the table of the last run without running anything
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

const here = fileURLToPath(new URL('./', import.meta.url));
const root = fileURLToPath(new URL('../../', import.meta.url));
// The fixture build (prepare-variant.mjs) lives outside the repository.
const VARIANT_DIR = join(process.env.QA_VARIANT_DIR || tmpdir(), 'elefante-variant');
const out = `${here}out/`;
const resultsFile = `${out}qa-results.json`;
const BASE_PATH = (process.env.BASE_PATH ?? '').replace(/\/$/, '');
const MAIN = 4400;
const VARIANT = 4401;

const SUITES = [
  { name: 'behave', script: 'behave.mjs', about: 'tab order, skip link, focus, no horizontal scroll' },
  { name: 'listings', script: 'listings.mjs', about: 'home, epoch and thread pages in a browser' },
  { name: 'controls', script: 'controls.mjs', about: 'epoch filters, view and pane switches, Surprise me' },
  { name: 'controls-variant', script: 'controls.mjs', args: ['variant'], variant: true, about: 'the same on the fixture build: an epoch with more than 8 cards, so the Timeline / Grid switch appears' },
  { name: 'map-basic', script: 'map.mjs', args: ['nojs', 'tiles', 'filters', 'preview', 'layout'], about: 'map without JS, tiles failing, filters, preview, layout' },
  { name: 'map-more', script: 'map.mjs', args: ['link', 'epoch', 'weight'], about: 'map links, the epoch page map, weight' },
  { name: 'map-limit', script: 'map.mjs', args: ['limit'], about: 'at most 7 markers over a sweep of views' },
  { name: 'map-limit-all', script: 'map.mjs', args: ['limit'], env: { FAMILY: 'all' }, about: 'the same sweep in family mode "all"' },
  { name: 'map-limit-12', script: 'map.mjs', args: ['limit'], env: { FAMILY: '12' }, about: 'the same sweep in family mode "12"' },
  { name: 'bridge', script: 'bridge.mjs', about: 'marker preview, bridge caption, Como chegar (OSM, geo: on Android), bridge block' },
  { name: 'family-controls', script: 'family.mjs', args: ['toggle', 'lists'], about: 'family toggle, feed, grid, threads, tiles, home' },
  { name: 'family-pages', script: 'family.mjs', args: ['recount', 'nearby', 'gate', 'flash', 'blocked', 'surprise'], about: 'recounting, Nearby, the gate, no flash, blocked storage, Surprise me' },
  { name: 'family-map', script: 'family.mjs', args: ['map'], about: 'the map in every family mode' },
  { name: 'interactives', script: 'interactives.mjs', about: 'the dots of Aljubarrota: keyboard, text, motion, no JS, code, colour, family modes' },
  { name: 'theme', script: 'theme.mjs', about: 'theme, palettes, fonts, header, light-dark() fallback' },
  { name: 'theme-variant', script: 'theme.mjs', args: ['variant', 'palette', 'fallback'], variant: true, about: 'palettes of every epoch including Estado Novo (fixture build), the light-dark() fallback per epoch' },
  { name: 'azulejo', script: 'azulejo.mjs', about: 'azulejo patterns in both themes, map waiting tile, reduced motion, layout shifts, neutral header' },
  { name: 'azulejo-variant', script: 'azulejo.mjs', args: ['variant', 'patterns', 'header'], variant: true, about: 'the three patterns and the grey Estado Novo interface (fixture build)' },
  { name: 'ru', script: 'ru.mjs', args: ['menu', 'root', 'banner', 'fonts', 'plural'], about: 'language menu on 320/360 px, root choice, banner and noindex on untranslated cards, Cyrillic fonts only on /ru/, plurals' },
  { name: 'ru-variant', script: 'ru.mjs', args: ['variant', 'banner'], variant: true, about: 'the banner, noindex and hreflang of a card that is not translated (fixture build)' },
  { name: 'pages', script: 'pages.mjs', about: 'static pages, mistake report form (answered by the test), Continue, QR address' },
  { name: 'family-menu', script: 'familymenu.mjs', about: 'family-mode button and menu, the hidden-stories line, the 12+ tooltip' },
  { name: 'epoch-page', script: 'epochpage.mjs', about: 'epoch page: years on the scale, equal compact cards, view switch from 9 stories, active card, more eras list' },
  { name: 'map-tools', script: 'mapnear.mjs', args: ['tools', 'near', 'list', 'world', 'scale'], about: 'map page: Near me, list with hooks and distances, Whole world and the overseas plate, markers and legend, epoch scale' },
  { name: 'map-tools-variant', script: 'mapnear.mjs', args: ['variant', 'markers'], variant: true, about: 'marker styles and the legend: a cluster needs more cards than the marker limit (fixture build, limit 7)' },
  { name: 'service', script: 'service.mjs', about: 'service pages: texts, the mistake form (from a story, thank-you screen), 404 in every language' },
  { name: 'mascot', script: 'mascot.mjs', args: ['logo', 'notfound', 'pager', 'empty', 'dark', 'motion'], about: 'elephant mascot: logo, 404, walking by the pager, empty states, dark halo, reduced motion' },
  { name: 'mascot-variant', script: 'mascot.mjs', args: ['regime'], variant: true, about: 'no elephant on the pages of the regime epoch (fixture build)' },
  { name: 'family-controls-variant', script: 'family.mjs', args: ['variant', 'toggle', 'lists', 'recount', 'nearby', 'gate', 'flash', 'blocked', 'surprise', 'map'], variant: true, about: 'the family checks on the fixture build (more cards, a long epoch with the grid, markers over the limit)' },
  { name: 'family-variant', script: 'family.mjs', args: ['variant', 'variant-epoch'], variant: true, about: 'a 16+ epoch that every mode leaves empty (fixture build)' },
  { name: 'interactives-variant', script: 'interactives.mjs', args: ['variant'], variant: true, about: 'the same for the dots plus the ship scale (a fixture card): the real site has no ship card' },
];

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const budget = Number((argv.find((a) => a.startsWith('--budget=')) ?? '').split('=')[1] || Infinity);
const named = argv.filter((a) => !a.startsWith('--'));

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
    const verdict = r.ok ? `PASS${r.skip ? ` (${r.skip} skipped)` : ''}` : `FAIL${r.fail ? ` (${r.fail} failed)` : ` (${r.note ?? 'exit ' + r.code})`}`;
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

const wanted = named.length ? named.map((n) => SUITES.find((s) => s.name === n) ?? (console.error(`Unknown suite "${n}". Try: npm run qa -- --list`), process.exit(1))) : SUITES;
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
  const result = await new Promise((resolve) => {
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
  mkdirSync(out, { recursive: true });
  writeFileSync(`${out}${suite.name}.log`, result.log);
  const count = (word) => (result.log.match(new RegExp(`^${word}\\b`, 'gm')) ?? []).length;
  const pass = count('PASS');
  const fail = count('FAIL');
  const ok = result.code === 0 && fail === 0 && pass > 0;
  data.results[suite.name] = { pass, fail, skip: count('SKIP'), code: result.code, ok, seconds: Math.round((Date.now() - t0) / 1000), note: ok || fail ? undefined : pass === 0 ? 'no checks ran, see out/' + suite.name + '.log' : undefined };
  save(data);
  console.log(ok ? `${pass} passed` : `FAILED (${fail} failed, exit ${result.code}; log: scripts/qa/out/${suite.name}.log)`);
}

console.log(`\n${table(data.results, wanted)}`);
if (stoppedEarly) {
  console.log(`\nStopped after the ${budget} s budget. Continue with: npm run qa -- --resume`);
  process.exit(2);
}
process.exit(wanted.every((s) => data.results[s.name]?.ok) ? 0 : 1);

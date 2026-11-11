// Checks the data of "Which came first?" in dist/ (docs/spec.md 5.9): /{lang}/order.json is made of the stories published that day and of nothing else.
// Part of postbuild. Every published story of src/content/events that is not a heavy topic, does not begin before the year -2000 (the prologue)
// is in the file of every language; a draft, a story queued for a later day and everything else is not. A label with two years ("1906 e 2020") gives the first year only as the date. The fields are well formed and a page of the game exists in every language.
// CHECK_DIST=<dir> checks another build, CHECK_EVENTS=<dir> reads the stories from another folder (the tests use both), SITE_TODAY sets the day.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { isLive } from '../src/lib/publication.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = process.env.CHECK_DIST || join(root, 'dist');
const eventsDir = process.env.CHECK_EVENTS || join(root, 'src/content/events');
const LANGS = ['pt', 'en', 'ru'];
const PAGES = { pt: 'o-que-veio-primeiro', en: 'which-came-first', ru: 'chto-bylo-ranshe' };
const DEEPEST_YEAR = -2000;
const TWO_YEARS = /\b\d{4}\b[^\d]*\s(e|and|и)\s[^\d]*\b\d{4}\b/u;

const cards = readdirSync(eventsDir)
  .filter((f) => f.endsWith('.yaml'))
  .map((f) => parse(readFileSync(join(eventsDir, f), 'utf8'), { schema: 'core' }));
const first = (c) => (typeof c.year === 'object' ? c.year.from : c.year);
const expected = cards.filter((c) => isLive(c) && c.placeholder !== true && c.sensitive !== true && first(c) >= DEEPEST_YEAR);
const wanted = new Set(expected.map((c) => c.id));
const allIds = new Set(cards.map((c) => c.id));

const errors = [];
for (const lang of LANGS) {
  if (!existsSync(join(dist, lang, PAGES[lang], 'index.html'))) errors.push(`${lang}: the page /${lang}/${PAGES[lang]}/ was not built`);
  const file = join(dist, lang, 'order.json');
  if (!existsSync(file)) {
    errors.push(`${lang}: ${lang}/order.json was not built`);
    continue;
  }
  const list = JSON.parse(readFileSync(file, 'utf8'));
  const got = new Set(list.map((s) => s.id));
  for (const id of wanted) if (!got.has(id)) errors.push(`${lang}: the published story ${id} is not in order.json`);
  for (const id of got) if (!wanted.has(id)) errors.push(`${lang}: ${id} is in order.json but must not be (${allIds.has(id) ? 'a draft, a queued, a heavy or a prologue story' : 'not a story'})`);
  for (const s of list) {
    const bad = [];
    if (typeof s.title !== 'string' || !s.title) bad.push('title');
    if (typeof s.date !== 'string' || !s.date || TWO_YEARS.test(s.date)) bad.push('date');
    if (!Number.isInteger(s.year) || !Number.isInteger(s.from) || !Number.isInteger(s.to) || s.from > s.to || s.year < s.from || s.year > s.to) bad.push('years');
    if (typeof s.rough !== 'boolean') bad.push('rough');
    if (!['all', '12', '16'].includes(s.minAge)) bad.push('minAge');
    if (typeof s.epoch !== 'string' || !s.epoch) bad.push('epoch');
    if (!s.href?.startsWith(`/${lang}/`)) bad.push('href');
    if (!s.img?.src) bad.push('img');
    if (bad.length) errors.push(`${lang}: ${s.id}: bad ${bad.join(', ')}`);
  }
}

if (errors.length) {
  console.error(`Order check failed:\n  ${errors.join('\n  ')}`);
  process.exit(1);
}
console.log(`Order check passed: ${wanted.size} published stories in order.json of each of ${LANGS.length} languages (a heavy topic, the prologue and not-yet-published stories are out), the page of the game is built in every language.`);

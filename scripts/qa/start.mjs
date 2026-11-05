// Browser checks of "Where to start" on the home page (src/lib/start-set.ts, src/scripts/start-set.ts), run against dist/ served by serve.mjs:
//   node start.mjs [anniversary read nojs]
// The day is set with ?hoje=YYYY-MM-DD. The story and the day come from the data (a published story that is not a heavy topic and has `day`):
// the card must be first with its line; a story read in the browser leaves the rotation but not the pins.
import { launchBrowser } from './browser.mjs';
import { need, published } from './data.mjs';

const base = process.env.BASE_URL || 'http://localhost:4400';
const ONLY = process.argv.slice(2);
const want = (name) => ONLY.length === 0 || ONLY.includes(name);

const year = new Date().getFullYear();
// The anniversary of the day: with several stories on one day, the candidates by id and the index year % number (src/lib/start-pins.ts).
const candidates = (day) => published.filter((e) => e.day === day && e.sensitive !== true && typeof e.year === 'number' && e.year > 0).sort((a, b) => (a.id < b.id ? -1 : 1));
const STORY = need('a story that is not a heavy topic with an exact day (`day`)', (list) => list.find((e) => e.day && e.sensitive !== true && typeof e.year === 'number' && e.year > 0));
const pick = candidates(STORY.day)[year % candidates(STORY.day).length];
const HOJE = `${year}-${STORY.day}`;
const LINE = { pt: `Neste dia, em ${pick.year}`, en: `On this day in ${pick.year}`, ru: `В этот день в ${pick.year} году` };

let failed = 0;
const ok = (name, cond, extra = '') => {
  if (!cond) failed += 1;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
};
const browser = await launchBrowser();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const open = async (url, { js = true, read } = {}) => {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  if (!js) await page.setJavaScriptEnabled(false);
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  if (read) await page.evaluateOnNewDocument((ids) => localStorage.setItem('readStories', JSON.stringify(ids)), read);
  await page.goto(`${base}${url}`, { waitUntil: 'load' });
  return page;
};
const cards = (page) =>
  page.$$eval('[data-start-list] > li', (items) => items.map((li) => ({ id: li.querySelector('[data-story]')?.dataset.story ?? '', line: li.querySelector('.showcase__caption')?.textContent?.trim() ?? '', read: li.querySelector('[data-story]')?.hasAttribute('data-read') })));
/** The set after the script has had its turn: the file is fetched and compared (the page marks nothing, so wait for the first card). */
const settled = async (page, firstId) => {
  await page.waitForFunction((id) => document.querySelector('[data-start-list] [data-story]')?.dataset.story === id, { timeout: 8000 }, firstId).catch(() => {});
  await wait(300);
  return cards(page);
};

if (want('anniversary')) {
  for (const lang of ['pt', 'en', 'ru']) {
    const page = await open(`/${lang}/?hoje=${HOJE}`);
    const set = await settled(page, pick.id);
    ok(`${lang}: ${HOJE}: the story of the day is first, with its line`, set[0]?.id === pick.id && set[0]?.line === LINE[lang], JSON.stringify(set[0]));
    ok(`${lang}: three cards, the other two without a line`, set.length === 3 && set.slice(1).every((c) => c.line === '' && c.id !== pick.id), JSON.stringify(set.map((c) => c.id)));
    ok(`${lang}: no script error`, page.errors.length === 0, page.errors.join('; '));
    await page.close();
  }
  const page = await open(`/pt/`);
  const url = await page.$eval('[data-showcase]', (el) => el.dataset.startUrl);
  const response = await fetch(new URL(url, base));
  const json = await response.json().catch(() => null);
  ok('the data file of the language is there, in JSON', response.ok && Array.isArray(json?.stories) && typeof json?.cards === 'object', url);
  await page.close();
}

if (want('read')) {
  const first = await open(`/pt/?hoje=${HOJE}`);
  const before = await settled(first, pick.id);
  await first.close();
  const rotating = before.filter((c) => c.id !== pick.id).map((c) => c.id);
  // A rotation story read: it leaves, a new one comes; the pinned story stays even when it is read too.
  const page = await open(`/pt/?hoje=${HOJE}`, { read: [rotating[0], pick.id] });
  const after = await settled(page, pick.id);
  ok('a story read leaves the rotation', !after.some((c) => c.id === rotating[0]) && after.length === 3, JSON.stringify(after.map((c) => c.id)));
  ok('the pinned story stays although read, and carries the read mark', after[0]?.id === pick.id && after[0]?.line === LINE.pt && after[0]?.read === true, JSON.stringify(after[0]));
  ok('the other rotation story stays', after.some((c) => c.id === rotating[1]));
  await page.close();
}

if (want('nojs')) {
  const page = await open(`/pt/`, { js: false });
  const set = await cards(page);
  ok('without JavaScript the built set shows three cards', set.length === 3 && set.every((c) => c.id), JSON.stringify(set.map((c) => c.id)));
  await page.close();
}

await browser.close();
console.log(failed === 0 ? '\nAll start checks passed' : `\n${failed} check(s) failed`);
process.exit(failed === 0 ? 0 : 1);

// Browser checks of "New since your last visit": the mark on cards and list items, "+N" and "new era" on the epochs of the home page, the line
// on the home page, new epochs, family mode, no JS, blocked storage, the reset button. Run against dist/ served by serve.mjs:   node newmarks.mjs
// lastVisit and readStories are put in localStorage before the page runs; every number comes from the data (src/content): the stories published
// after the day of the visit the test sets. Two visits: one before everything (every epoch is new), one in the middle (some epochs are new as a
// whole, some only have new stories), both found in the data.
import { launchBrowser } from './browser.mjs';
import { epochPath, need, pt, published, readyEpochs, threadPath, threads, ui } from './data.mjs';

const base = process.env.BASE_URL || 'http://localhost:4400';
let failed = 0;
const ok = (name, cond, extra = '') => {
  if (!cond) failed += 1;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
};
const browser = await launchBrowser();
const DAY = 24 * 60 * 60 * 1000;

// The family rule, written out here (not read from src/lib/family.ts).
const shownIn = (e, mode) => mode === 'off' || (!e.sensitive && (e.min_age === 'all' || (mode === '12' && e.min_age === '12')));
const dayOf = (ms) => new Date(ms).toISOString().slice(0, 10);
const at = (day) => Date.parse(`${day}T12:00:00Z`); // a visit on that day: the stories published after it are new
const days = [...new Set(published.map((e) => e.published))].sort();

/** What the pages must show for a visit on `last`: the new stories (unread, shown in the mode), the epochs that are new as a whole, the marks. */
function calc(last, mode = 'off', read = []) {
  const c = dayOf(last);
  const shown = published.filter((e) => shownIn(e, mode));
  const eras = readyEpochs.map((ep) => ep.id).filter((id) => { const list = shown.filter((e) => e.epoch === id); return list.length > 0 && list.every((e) => e.published > c); });
  const fresh = shown.filter((e) => e.published > c && !read.includes(e.id));
  const byEpoch = {};
  for (const e of fresh) byEpoch[e.epoch] = (byEpoch[e.epoch] ?? 0) + 1;
  return { fresh, byEpoch, eras, marked: fresh.filter((e) => !eras.includes(e.epoch)).map((e) => e.id), whole: fresh.length > 0 && Object.keys(byEpoch).every((id) => eras.includes(id)) };
}

// Visit A: before every story. Every epoch is new as a whole.
const LAST_A = at(days[0]) - 2 * DAY;
// Visit B: on a day when some epoch has new stories and some of its stories are older, and, if the data has it, another epoch is new as a whole.
const LAST_B = at(need('a day when an epoch has some new and some old stories', () => days.find((d) => readyEpochs.some((ep) => { const l = published.filter((e) => e.epoch === ep.id); return l.some((e) => e.published > d) && l.some((e) => e.published <= d); }))));
const A = calc(LAST_A);
const B = calc(LAST_B);
const PARTIAL = need('an epoch with new and old stories at visit B', () => readyEpochs.find((ep) => B.marked.some((id) => published.find((e) => e.id === id).epoch === ep.id)));
const MARKED = published.find((e) => e.id === B.marked[0]);
const PARTIAL_PATH = epochPath(PARTIAL);
const ERA = readyEpochs.find((ep) => B.eras.includes(ep.id));

/** A page with lastVisit {prev: null, last} and the reads put in storage once (the first document of the tab). */
const open = async ({ path, last = LAST_B, read = [], mode = 'off', js = true, blocked = false, width = 360 } = {}) => {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 900, isMobile: width < 700, hasTouch: width < 700 });
  if (!js) await page.setJavaScriptEnabled(false);
  page.errors = [];
  page.on('pageerror', (e) => !/ViewTransition opt-in disabled/.test(e.message) && page.errors.push(e.message));
  if (blocked) {
    await page.evaluateOnNewDocument(() => Object.defineProperty(window, 'localStorage', { get: () => { throw new DOMException('blocked', 'SecurityError'); } }));
  } else {
    await page.evaluateOnNewDocument((seed) => {
      if (sessionStorage.getItem('__seeded')) return;
      sessionStorage.setItem('__seeded', '1');
      localStorage.clear();
      localStorage.setItem('family', seed.mode);
      if (seed.last !== null) localStorage.setItem('lastVisit', JSON.stringify({ prev: null, last: seed.last }));
      if (seed.read.length) localStorage.setItem('readStories', JSON.stringify(seed.read));
    }, { last, read, mode });
  }
  await page.goto(`${base}${path}`, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 300));
  return page;
};
const marked = (page) => page.evaluate(() => [...new Set([...document.querySelectorAll('[data-published][data-new]')].map((el) => el.dataset.story))].sort());
/** The stories whose mark on the page differs from what `want` says (ids that must be marked). */
const everyItem = (page, want) =>
  page.evaluate((ids) => [...document.querySelectorAll('[data-published]')].filter((el) => el.hasAttribute('data-new') !== ids.includes(el.dataset.story)).map((el) => el.dataset.story), want);
const visit = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('lastVisit') ?? 'null'));
const forms = (key, n) => ui(`${key}_${n === 1 ? 'one' : 'other'}`).replace('{n}', String(n));
const plus = (n) => forms('plural.new_plus', n);
const homeState = (page) =>
  page.evaluate(() => ({
    line: document.querySelector('[data-new-line]').hidden ? null : document.querySelector('[data-new-line]').textContent,
    links: [...document.querySelectorAll('[data-new-line] a')].map((a) => a.textContent),
    tiles: Object.fromEntries([...document.querySelectorAll('[data-new-epoch]')].filter((el) => !el.hidden).map((el) => [el.dataset.newEpoch, el.textContent])),
  }));

// 1. The first visit: no lastVisit. No marks anywhere, no line, and the visit is kept for the next time.
for (const [what, path] of [['epoch page', PARTIAL_PATH], ['home page', '/pt/']]) {
  const page = await open({ path, last: null });
  ok(`first visit: ${what} has no mark`, (await marked(page)).length === 0);
  if (what === 'home page') {
    const home = await homeState(page);
    ok('first visit: no line on the home page, nothing on the epochs', home.line === null && Object.keys(home.tiles).length === 0, JSON.stringify(home));
    const v = await visit(page);
    ok('first visit: lastVisit is kept as {prev: null, last: now}', v && v.prev === null && Math.abs(v.last - Date.now()) < 60_000, JSON.stringify(v));
  }
  await page.close();
}

// 2. A return in the middle (visit B): marks on the epoch with new and old stories, none on a new epoch.
{
  const page = await open({ path: PARTIAL_PATH });
  const want = B.marked.filter((id) => published.find((e) => e.id === id).epoch === PARTIAL.id);
  const got = await marked(page);
  ok(`return: the epoch page marks the stories published after the visit (${want.length})`, JSON.stringify(got) === JSON.stringify([...want].sort()) && want.length > 0, `${got} / ${want}`);
  ok('return: every other card of the page has no mark', (await everyItem(page, B.marked)).length === 0);
  const card = await page.evaluate((id) => {
    const el = document.querySelector(`.ecard[data-story="${id}"]`);
    const vis = (s) => getComputedStyle(el.querySelector(s)).visibility;
    return { word: el.querySelector('.new-mark').textContent, newMark: vis('.new-mark'), readMark: vis('.read-mark'), height: Math.round(el.getBoundingClientRect().height) };
  }, MARKED.id);
  ok('return: the card shows the word "Novo" and not the "read" tick', card.word === ui('ui.new') && card.newMark === 'visible' && card.readMark === 'hidden', JSON.stringify(card));
  await page.close();
  const plain = await open({ path: PARTIAL_PATH, last: null });
  const h = await plain.evaluate((id) => Math.round(document.querySelector(`.ecard[data-story="${id}"]`).getBoundingClientRect().height), MARKED.id);
  ok('return: the mark does not change the height of the card', h === card.height, `${h} / ${card.height}`);
  await plain.close();
}
{
  const thread = threads.find((th) => B.marked.some((id) => published.find((e) => e.id === id).threads?.includes(th.id)));
  if (thread) {
    const page = await open({ path: threadPath(thread) });
    ok('return: the thread page marks exactly the new stories of epochs that are not new as a whole', (await everyItem(page, B.marked)).length === 0 && (await marked(page)).length > 0, `${(await marked(page)).length} marked`);
    await page.close();
  }
  const bad = [];
  for (const story of published.slice(0, 6)) {
    const page = await open({ path: pt(story) });
    const wrong = await everyItem(page, B.marked);
    if (wrong.length) bad.push(`${story.id}: ${wrong}`);
    await page.close();
  }
  ok('return: "Nearby" on story pages marks exactly those stories', bad.length === 0, bad.join(' | '));
}

// 3. A new era: no marks on its cards, on the strip "new era" in place of "+N".
if (ERA) {
  const page = await open({ path: epochPath(ERA) });
  ok(`new era: the cards of "${ERA.name.pt}" carry no mark although every story is new`, (await marked(page)).length === 0);
  await page.close();
  const home = await open({ path: '/pt/' });
  const state = await homeState(home);
  ok(`new era: the strip says "${ui('home.new_era')}" for it`, state.tiles[ERA.id] === ui('home.new_era'), JSON.stringify(state.tiles));
  const partial = Object.keys(B.byEpoch).find((id) => !B.eras.includes(id));
  ok('new era: an epoch with only some new stories says "+N"', !partial || state.tiles[partial] === plus(B.byEpoch[partial]), JSON.stringify(state.tiles));
  await home.close();
} else {
  console.log('SKIP  new era: at visit B no epoch is new as a whole (the data has none for it); visit A covers it below');
}
{
  // Visit A: every epoch is new. No card has a mark; the line speaks of epochs and links to all of them.
  const page = await open({ path: PARTIAL_PATH, last: LAST_A });
  ok('every epoch new: no card of an epoch page has a mark', (await marked(page)).length === 0);
  await page.close();
  const home = await open({ path: '/pt/', last: LAST_A });
  const state = await homeState(home);
  const text = `${ui('home.new_since').replace('{text}', '')}${forms('plural.new_epochs', A.eras.length)}`;
  ok(`every epoch new: the line says "${text}" and links to the epochs by name, without numbers`, A.whole && state.line?.startsWith(`${text} — `) && JSON.stringify(state.links) === JSON.stringify(readyEpochs.filter((ep) => A.byEpoch[ep.id]).map((ep) => ep.name.pt)) && !/\d/.test(state.line.slice(text.length)), `${state.line}`);
  ok('every epoch new: every epoch of the strip says "new era"', A.eras.every((id) => state.tiles[id] === ui('home.new_era')), JSON.stringify(state.tiles));
  await home.close();
}

// 4. The home page at visit B: the short line, with the number of stories (some epochs only have new stories) and the names of the epochs.
{
  const page = await open({ path: '/pt/' });
  const state = await homeState(page);
  const n = B.fresh.length;
  const text = `${ui('home.new_since').replace('{text}', '')}${B.whole ? forms('plural.new_epochs', Object.keys(B.byEpoch).length) : forms('plural.new_stories', n)}`;
  ok(`home: the line says "${text}" and links to the epochs by name, without numbers`, state.line?.startsWith(`${text} — `) && JSON.stringify(state.links) === JSON.stringify(readyEpochs.filter((ep) => B.byEpoch[ep.id]).map((ep) => ep.name.pt)) && !/\d/.test(state.line.slice(text.length)), `${state.line}`);
  await page.close();
}

// 5. A story that is read has no mark and is not counted.
{
  const page = await open({ path: PARTIAL_PATH, read: [MARKED.id] });
  const got = await marked(page);
  ok('read: a read story has no mark (and the read tick shows)', !got.includes(MARKED.id) && (await page.evaluate((id) => getComputedStyle(document.querySelector(`.ecard[data-story="${id}"] .read-mark`)).visibility, MARKED.id)) === 'visible');
  await page.close();
  const home = await open({ path: '/pt/', read: [MARKED.id] });
  const state = await homeState(home);
  const R = calc(LAST_B, 'off', [MARKED.id]);
  const text = R.fresh.length === 0 ? null : `${ui('home.new_since').replace('{text}', '')}${R.whole ? forms('plural.new_epochs', Object.keys(R.byEpoch).length) : forms('plural.new_stories', R.fresh.length)}`;
  ok(`read: the line on the home page counts ${R.fresh.length} without it`, text === null ? state.line === null : Boolean(state.line?.startsWith(text)), String(state.line));
  await home.close();
}

// 6. The same session does not move prev: a second page keeps prev, moves last; after more than 30 minutes the last visit becomes prev.
{
  const page = await open({ path: PARTIAL_PATH });
  const first = await visit(page);
  await page.goto(`${base}/pt/`, { waitUntil: 'networkidle0' });
  const second = await visit(page);
  ok('session: a second page of the same session keeps prev and moves last', first.prev === LAST_B && second.prev === LAST_B && second.last >= first.last, `${JSON.stringify(first)} -> ${JSON.stringify(second)}`);
  ok('session: the marks are still there on the second page', (await homeState(page)).line !== null);
  await page.evaluate(() => { const v = JSON.parse(localStorage.getItem('lastVisit')); localStorage.setItem('lastVisit', JSON.stringify({ prev: v.prev, last: Date.now() - 31 * 60 * 1000 })); });
  const before = await visit(page);
  await page.goto(`${base}/pt/`, { waitUntil: 'networkidle0' });
  const later = await visit(page);
  ok('session: after more than 30 minutes prev becomes the last page before', later.prev === before.last && later.last > before.last, `${JSON.stringify(before)} -> ${JSON.stringify(later)}`);
  await page.close();
}

// 7. Family mode counts only the stories it shows.
for (const mode of ['all', '12']) {
  const M = calc(LAST_B, mode);
  const page = await open({ path: '/pt/', mode });
  const state = await homeState(page);
  const text = M.fresh.length === 0 ? null : `${ui('home.new_since').replace('{text}', '')}${M.whole ? forms('plural.new_epochs', Object.keys(M.byEpoch).length) : forms('plural.new_stories', M.fresh.length)}`;
  ok(`family ${mode}: the line counts ${M.fresh.length} story(ies) of the mode`, text === null ? state.line === null : Boolean(state.line?.startsWith(text)), String(state.line));
  await page.close();
}

// 8. Without JavaScript, and with blocked storage: nothing is shown.
{
  const page = await open({ path: PARTIAL_PATH, js: false });
  const shown = await page.evaluate(() => [...document.querySelectorAll('.new-mark')].filter((el) => getComputedStyle(el).visibility === 'visible').length);
  ok('no JavaScript: no mark is shown', shown === 0, String(shown));
  await page.close();
  const home = await open({ path: '/pt/', js: false });
  ok('no JavaScript: the line on the home page is hidden', await home.evaluate(() => getComputedStyle(document.querySelector('[data-new-line]')).display === 'none'));
  await home.close();
  const blocked = await open({ path: '/pt/', blocked: true });
  const state = await blocked.evaluate(() => ({ line: !document.querySelector('[data-new-line]').hidden, marks: document.querySelectorAll('[data-new]').length }));
  ok('blocked storage: no marks, no line, no error', !state.line && state.marks === 0 && blocked.errors.length === 0, `${JSON.stringify(state)} ${blocked.errors}`);
  await blocked.close();
}

// 9. The legal page: the sentence about the date, and the reset button clears the visit too.
{
  const page = await open({ path: '/pt/legal/' });
  const text = await page.evaluate(() => document.body.innerText);
  ok('legal: one sentence says that the date of the last visit is kept', /data da (sua )?última visita/.test(text));
  const before = await visit(page);
  await page.click('[data-read-reset]');
  await new Promise((r) => setTimeout(r, 300));
  const after = await page.evaluate(() => localStorage.getItem('lastVisit'));
  ok('legal: the reset button clears lastVisit as well', before !== null && after === null, String(after));
  await page.goto(`${base}/pt/`, { waitUntil: 'networkidle0' });
  ok('legal: after the reset the next visit is a first one (no line)', await page.evaluate(() => document.querySelector('[data-new-line]').hidden));
  await page.close();
}

await browser.close();
console.log(failed === 0 ? '\nAll new-marks checks passed' : `\n${failed} check(s) failed`);
process.exit(failed === 0 ? 0 : 1);

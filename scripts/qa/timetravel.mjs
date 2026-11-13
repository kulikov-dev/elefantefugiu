// Browser checks of "Through the centuries" (pt "Através dos séculos", en "Through the centuries", ru "Сквозь века"), the mode of the map page that plays the stories
// of the window in the order of time (src/scripts/timetravel.ts, src/lib/timetravel.ts, docs/spec.md 5.4). Against dist/ served by serve.mjs:
//   node timetravel.mjs [order window hint chips queue family controls back motion events address final nojs layout]
// Everything the suite expects is counted from the data (data.mjs): the stories, their order, the places of the chips, the count of a place. Nothing is a number of the content.
import { launchBrowser } from './browser.mjs';
import { epochs, events, need, published, ui } from './data.mjs';
import { isLive } from '../../src/lib/publication.mjs';

const base = process.env.BASE_URL || 'http://localhost:4400';
const ONLY = process.argv.slice(2);
const want = (name) => ONLY.length === 0 || ONLY.includes(name);
const MAP = { pt: '/pt/mapa/', en: '/en/map/', ru: '/ru/karta/' };
const DWELL_MS = 4000;

let failed = 0;
const ok = (name, cond, extra = '') => {
  if (!cond) failed += 1;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
/** With many stories in the window the start asks first: "all in order" is the answer of the suites that walk the whole list. */
const choose = async (page) => {
  await wait(300);
  await page.evaluate(() => document.querySelector('[data-tt-all]')?.click());
};
const browser = await launchBrowser();

// ---- the data, as the build reads it ------------------------------------------------------------------------------------

const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const placeKey = (e) => slug(e.place.short?.pt?.trim() || e.place.name.pt.split(/[,(]/)[0].trim());
const range = (e) => (typeof e.year === 'number' ? [e.year, e.year] : [e.year.from, e.year.to]);
const epochOrder = Object.fromEntries(epochs.map((e) => [e.id, e.order]));
const byTime = (a, b) => (epochOrder[a.epoch] ?? 0) - (epochOrder[b.epoch] ?? 0) || range(a)[0] - range(b)[0] || range(a)[1] - range(b)[1] || a.id.localeCompare(b.id);
const MAINLAND = { south: 36.8, north: 42.2, west: -9.6, east: -6.1 };
const onMainland = (e) => e.bridge.lat >= MAINLAND.south && e.bridge.lat <= MAINLAND.north && e.bridge.lon >= MAINLAND.west && e.bridge.lon <= MAINLAND.east;
const shownIn = (e, mode) => mode === 'off' || (!e.sensitive && ((e.min_age ?? 'all') === 'all' || (mode === '12' && e.min_age === '12')));
const slugPt = (e) => e.slug.pt;

const counts = new Map();
for (const e of published) counts.set(placeKey(e), (counts.get(placeKey(e)) ?? 0) + 1);
const CHIPS = [...counts].filter(([, n]) => n >= 4).sort((a, b) => b[1] - a[1]);
const biggest = CHIPS[0];
if (!biggest) throw new Error('The suites need a place with at least 4 published stories (a chip of "Through the centuries"). None found in src/content/events.');
const PLACE = biggest[0];
const inPlace = (mode = 'off') => published.filter((e) => placeKey(e) === PLACE && shownIn(e, mode)).sort(byTime);
// "All in order" plays Portugal with the islands (a story abroad, a hollow diamond on the map, is not in the show); the islands are not in the window of the map.
const REGIONS = [MAINLAND, { south: 32.3, north: 33.2, west: -17.4, east: -16.2 }, { south: 36.8, north: 39.9, west: -31.4, east: -24.9 }];
const inRegion = (r, lat, lon) => lat >= r.south && lat <= r.north && lon >= r.west && lon <= r.east;
const abroad = (e) => !REGIONS.some((r) => inRegion(r, e.place.lat, e.place.lon));
const island = (e) => !inRegion(MAINLAND, e.bridge.lat, e.bridge.lon) && REGIONS.some((r) => inRegion(r, e.bridge.lat, e.bridge.lon));
const whole = (mode = 'off') => published.filter((e) => !abroad(e) && (onMainland(e) || island(e)) && shownIn(e, mode)).sort(byTime);
const ISLANDS = published.filter((e) => !abroad(e) && island(e)).length;
const queued = events.filter((e) => e.status === 'ready' && !isLive(e));

// ---- the page --------------------------------------------------------------------------------------------------------------

const open = async (path, { width = 1280, height = 900, reduced = false, family = null, read = null, js = true, counter = true } = {}) => {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  page.close = () => context.close();
  await page.setViewport({ width, height });
  if (reduced) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  await page.evaluateOnNewDocument(
    (family_, read_, counter_) => {
      if (family_) localStorage.setItem('family', family_);
      if (read_) localStorage.setItem('readStories', JSON.stringify(read_));
      // The counter of the site is not on a local build: a stand-in that keeps what it is told for the whole tab.
      // A build for a real address has the counter's own config script and count.js, which set window.goatcounter and its count(): the stand-in keeps its count().
      if (counter_) {
        const mine = (v) => {
          const a = JSON.parse(sessionStorage.getItem('__gc') || '[]');
          a.push(v.path);
          sessionStorage.setItem('__gc', JSON.stringify(a));
        };
        const stand = {};
        Object.defineProperty(stand, 'count', { get: () => mine, set: () => {}, enumerable: true });
        Object.defineProperty(window, 'goatcounter', { get: () => stand, set: (v) => { for (const k of Object.keys(v ?? {})) if (k !== 'count') stand[k] = v[k]; }, configurable: true });
      }
    },
    family,
    read,
    counter,
  );
  if (!js) await page.setJavaScriptEnabled(false);
  await page.goto(`${base}${path}`, { waitUntil: 'networkidle0' });
  if (js) await page.waitForSelector('.map[data-state="ready"]', { timeout: 20000 });
  if (js && path.includes('era=')) {
    await wait(500);
    await choose(page);
  }
  return page;
};

const START = '[data-tt-start]';
const state = (page) =>
  page.evaluate(() => {
    const card = document.querySelector('.tt-card');
    const shown = (el) => !!el && el.checkVisibility();
    return {
      on: shown(card),
      pressed: document.querySelector('[data-tt-start]')?.getAttribute('aria-pressed'),
      year: document.querySelector('.tt-card__year')?.textContent ?? '',
      title: document.querySelector('.tt-card__title')?.textContent ?? '',
      count: document.querySelector('.tt-card__count')?.textContent ?? '',
      href: document.querySelector('.tt-card__read')?.getAttribute('href') ?? '',
      playVisible: shown(document.querySelector('.tt-card__play')),
      other: shown(document.querySelector('.tt-card__other')) ? document.querySelector('.tt-card__other').innerText : '',
      toggle: document.querySelector('.tt-card__acts .tt-btn[aria-label]:nth-of-type(2)')?.getAttribute('aria-label') ?? '',
      markers: document.querySelectorAll('.mk').length,
      cur: document.querySelectorAll('.mk--tt-cur').length,
      dim: document.querySelectorAll('.mk--tt-dim').length,
      clusters: document.querySelectorAll('.mk--cluster').length,
    };
  });
const total = (s) => Number(s.count.match(/(\d+)\D*$/)?.[1] ?? NaN);
const index = (s) => Number(s.count.match(/^\D*(\d+)/)?.[1] ?? NaN);
const press = (page, label) => page.evaluate((l) => document.querySelector(`.tt-card [aria-label="${l}"]`)?.click(), label);
const next = (page, lang = 'pt') => press(page, ui('map.tt_next', lang));
const prev = (page, lang = 'pt') => press(page, ui('map.tt_prev', lang));
const hrefs = (list) => list.map((e) => `/pt/historia/${e.slug.pt}/`);
const hasJsNoScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

/** Steps through the whole show by "next" and returns the links of the cards, in the order they were shown. */
async function walk(page, lang = 'pt') {
  const seen = [];
  for (let guard = 0; guard < 400; guard += 1) {
    const s = await state(page);
    if (!s.playVisible) break;
    seen.push(s.href);
    await next(page, lang);
    await wait(40);
  }
  return seen;
}

// ---------- 1. the order ----------
if (want('order')) {
  const page = await open(`${MAP.pt}?era=portugal`);
  await page.waitForSelector('.tt-card:not([hidden])', { timeout: 10000 });
  await wait(300);
  const first = await state(page);
  ok('order: the button of a place chip is not needed: ?era=portugal starts the show on arrival', first.on && first.pressed === 'true');
  await page.evaluate(() => document.querySelector('.tt-card__acts .tt-btn:nth-of-type(2)')?.click()); // pause, so the walk is ours
  const seen = await walk(page);
  const expected = hrefs(whole());
  ok(`order: the stories of the window come in the order of the epoch feed (epoch, start year, end year, id): ${expected.length} stories`, JSON.stringify(seen) === JSON.stringify(expected), `${seen.length} shown`);
  ok('order: a story that waits for a later day is nowhere in the show', queued.every((e) => !seen.includes(`/pt/historia/${e.slug.pt}/`)), `${queued.length} queued`);
  const config = await page.evaluate(() => JSON.parse(document.querySelector('[data-map-config]').textContent).tt.info);
  ok('order: the data of the map page holds no story that waits for its day', queued.every((e) => !(e.id in config)));
  await page.close();
}

// ---------- 2. only the stories of the window ----------
if (want('window')) {
  const page = await open(MAP.pt);
  await page.click(START);
  await choose(page);
  await page.waitForSelector('.tt-card:not([hidden])');
  await wait(300);
  let s = await state(page);
  const all = total(s);
  ok('window: from the button the show plays the stories of the view (not more than the site has, every one has a marker of its own, no clusters)', all >= 3 && all <= published.length && s.markers >= all - ISLANDS && s.clusters === 0, JSON.stringify({ all, markers: s.markers }));
  ok('window: one point is the current one, the points after it are dim', s.cur === 1 && s.dim >= all - ISLANDS - 1, JSON.stringify({ cur: s.cur, dim: s.dim }));
  // Zoom in on the map: the window shrinks, so does the show (counted again at the next start); at the end there are fewer than three and the card says so.
  let last = all;
  let hint = false;
  for (let i = 0; i < 12 && !hint; i += 1) {
    await page.evaluate(() => document.querySelector('.tt-card__close, .tt-card__acts .tt-btn:last-child')?.click());
    // The start fits the stories into the part of the map the card leaves free (it may zoom out), so one step in is not always a smaller window: three steps.
    for (let k = 0; k < 3; k += 1) await page.evaluate(() => document.querySelector('.leaflet-control-zoom-in').click());
    await wait(900);
    await page.click(START);
  await choose(page);
    await wait(500);
    s = await state(page);
    if (s.other && !s.playVisible) hint = true;
    else last = total(s);
  }
  ok('window: with the map zoomed in the show is shorter and a window with fewer than three stories gets the hint instead', hint && last <= all, `${all} -> ${last}`);
  ok('window: the hint is the one of the language', s.other.includes(ui('map.tt_hint_title', 'pt')) && s.other.includes(ui('map.tt_hint_text', 'pt')), s.other.slice(0, 80));
  await page.close();
}

// ---------- 3. the hint and the chips ----------
if (want('hint') || want('chips')) {
  // A story far from the others: its link zooms the map so close that fewer than three stories are in the window (the window is wider than 0.1 degree nowhere).
  const lonely = (e) => published.filter((o) => Math.abs(o.bridge.lat - e.bridge.lat) < 0.1 && Math.abs(o.bridge.lon - e.bridge.lon) < 0.15).length < 3;
  const target = need('a story with fewer than two others within 0.1 degree of its bridge (the hint of the mode)', (list) => list.find(lonely));
  const page = await open(`${MAP.pt}?id=${target.id}`);
  await page.click(START);
  await choose(page);
  await wait(500);
  const s = await state(page);
  ok('hint: a window with fewer than three stories shows the hint, no scale, no show', !s.playVisible && s.other.includes(ui('map.tt_hint_title', 'pt')) && (await page.evaluate(() => !document.querySelector('[data-tt-scale]').checkVisibility())), s.other.slice(0, 60));
  const chips = await page.evaluate(() => [...document.querySelectorAll('[data-tt-place]')].map((b) => [b.dataset.ttPlace, b.querySelector('small')?.textContent ?? '']));
  const want_ = [...CHIPS.map(([k, n]) => [k, String(n)]), ['portugal', '']];
  ok('chips: the places are counted from the data (at least four published stories each), the most stories first, then "All of Portugal"', JSON.stringify(chips) === JSON.stringify(want_), JSON.stringify(chips));
  const close = await page.evaluate(() => { const c = document.querySelector('.tt-card__close'); const card = document.querySelector('.tt-card').getBoundingClientRect(); const r = c.getBoundingClientRect(); return { top: r.top - card.top < 24, right: card.right - r.right < 24 }; });
  ok('hint: the cross is in the top right corner of the card', close.top && close.right, JSON.stringify(close));
  await page.click(`[data-tt-place="${PLACE}"]`);
  await wait(900);
  const after = await state(page);
  ok('chips: a press on a place shows it and starts the show with the stories of the place', after.playVisible && total(after) === inPlace().length, `${after.count} (data: ${inPlace().length})`);
  ok('chips: the address says which place (so the link can be shared)', (await page.evaluate(() => location.search)).includes(`era=${PLACE}`));
  await page.close();
}

// ---------- 4. the queue ----------
if (want('queue')) {
  const ids = (await (await open(MAP.pt)).evaluate(() => Object.keys(JSON.parse(document.querySelector('[data-map-config]').textContent).tt.info))) ?? [];
  ok('queue: only the stories of the day are known to the show (the build counts a published story, not one waiting for its day)', published.every((e) => ids.includes(e.id)) && queued.every((e) => !ids.includes(e.id)), `${ids.length} of ${published.length} + ${queued.length} queued`);
}

// ---------- 5. family mode ----------
if (want('family')) {
  for (const mode of ['all', '12']) {
    const page = await open(`${MAP.pt}?era=${PLACE}`, { family: mode });
    await page.waitForSelector('.tt-card:not([hidden])');
    await wait(300);
    const s = await state(page);
    const expected = inPlace(mode);
    if (expected.length < 3) ok(`family (${mode}): fewer than three stories of the place are shown, so the hint`, !s.playVisible && s.other.length > 0);
    else {
      await page.evaluate(() => document.querySelector('.tt-card__acts .tt-btn:nth-of-type(2)')?.click());
      const seen = await walk(page);
      ok(`family (${mode}): the show plays the stories the mode shows, counted from the data (${expected.length})`, JSON.stringify(seen) === JSON.stringify(hrefs(expected)));
    }
    await page.close();
  }
}

// ---------- 6. the controls ----------
if (want('controls')) {
  const page = await open(`${MAP.pt}?era=${PLACE}`);
  await page.waitForSelector('.tt-card:not([hidden])');
  await wait(300);
  const n = total(await state(page));
  let s = await state(page);
  ok('controls: the show starts on the first story with the filter on all epochs', index(s) === 1 && (await page.evaluate(() => !location.search.includes('epoca='))));
  await page.mouse.move(5, 5); // off the card: the mouse over it holds the show
  await wait(DWELL_MS + 700);
  s = await state(page);
  ok('controls: every story stays about four seconds, then the next one comes', index(s) === 2, s.count);
  await page.evaluate(() => document.querySelector('.tt-card__acts .tt-btn:nth-of-type(2)').click());
  await wait(DWELL_MS + 700);
  s = await state(page);
  ok('controls: a pause holds the story', index(s) === 2 && s.toggle === ui('map.tt_play', 'pt'), `${s.count} / ${s.toggle}`);
  await next(page);
  await wait(100);
  s = await state(page);
  ok('controls: next goes on by one and keeps the pause', index(s) === 3 && s.toggle === ui('map.tt_play', 'pt'), s.count);
  await prev(page);
  s = await state(page);
  ok('controls: previous goes back by one', index(s) === 2);
  await page.keyboard.press('ArrowRight');
  s = await state(page);
  ok('controls: the arrow keys go along the stories', index(s) === 3);
  await page.keyboard.press('ArrowLeft');
  await page.mouse.move(5, 5);
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('Space');
  s = await state(page);
  ok('controls: Space starts and stops the show', s.toggle === ui('map.tt_pause', 'pt'), s.toggle);
  await page.keyboard.press('Space');
  // a press on a point shows its story and waits (the map may still be panning after the keys: let it rest)
  await wait(700);
  const titles = inPlace().map((e) => e.title.pt);
  const target = await page.evaluate((titles_) => {
    // a dim point of the show clear of the current one (two points close together are spread, but the large current one may still touch its neighbour)
    const cur = document.querySelector('.mk--tt-cur').getBoundingClientRect();
    const m = [...document.querySelectorAll('.mk--tt-dim')].filter((d) => { const b = d.getBoundingClientRect(); return document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)?.closest('.mk') === d; }).filter((d) => titles_.some((t) => d.querySelector('.visually-hidden').textContent.startsWith(t))).find((d) => Math.hypot(d.getBoundingClientRect().x - cur.x, d.getBoundingClientRect().y - cur.y) > 80 && d.checkVisibility()) ?? document.querySelector('.mk--tt-dim');
    const r = m.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, label: m.querySelector('.visually-hidden').textContent };
  }, titles);
  await page.mouse.click(target.x, target.y);
  await wait(200);
  s = await state(page);
  ok('controls: a press on a point shows its card and puts the show on pause', target.label.startsWith(s.title) && s.toggle === ui('map.tt_play', 'pt'), `${target.label} | ${s.title}`);
  // the swipe of the card
  const before = index(s);
  const box = await page.evaluate(() => { const r = document.querySelector('.tt-card__title').getBoundingClientRect(); return { x: r.x + 20, y: r.y + r.height / 2 }; });
  await page.mouse.move(box.x + 120, box.y);
  await page.mouse.down();
  await page.mouse.move(box.x + 40, box.y, { steps: 4 });
  await page.mouse.up();
  await wait(100);
  s = await state(page);
  ok('controls: a swipe of the card to the left shows the next story', index(s) === Math.min(before + 1, n) || before === n, `${before} -> ${s.count}`);
  await page.keyboard.press('Escape');
  s = await state(page);
  ok('controls: Esc ends the show: the card and the scale go, the marks go, the button is released and has the focus', !s.on && s.pressed === 'false' && s.cur === 0 && s.dim === 0 && (await page.evaluate(() => document.activeElement?.matches('[data-tt-start]') && !document.querySelector('[data-tt-scale]').checkVisibility())), JSON.stringify(s));
  const hidden = await page.evaluate(() => getComputedStyle(document.querySelector('.map-near')).display !== 'none');
  ok('controls: after the show "Near me" is back', hidden);
  await page.close();
}

// ---------- 7. the way back from a story ----------
if (want('back')) {
  const page = await open(`${MAP.pt}?era=${PLACE}`);
  await page.waitForSelector('.tt-card:not([hidden])');
  await page.evaluate(() => document.querySelector('.tt-card__acts .tt-btn:nth-of-type(2)').click());
  await next(page);
  await next(page);
  const s = await state(page);
  const nearBefore = await page.evaluate(() => getComputedStyle(document.querySelector('.map-near')).display);
  ok('back: with the show on "Near me" is out of the way', nearBefore === 'none');
  await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), page.click('.tt-card__read')]);
  ok('back: "Read" opens the story of the card', (await page.evaluate(() => location.pathname)) === s.href);
  await page.goBack({ waitUntil: 'load' });
  await page.waitForSelector('.tt-card:not([hidden])', { timeout: 15000 });
  await wait(500);
  const back = await state(page);
  ok('back: "Back" lands on the map with the show on the same story, on pause', back.on && back.title === s.title && back.toggle === ui('map.tt_play', 'pt'), `${back.title} | ${back.toggle}`);
  await page.close();
}

// ---------- 8. less motion ----------
if (want('motion')) {
  const page = await open(`${MAP.pt}?era=${PLACE}`, { reduced: true });
  await page.waitForSelector('.tt-card:not([hidden])');
  await wait(300);
  const s0 = await state(page);
  await page.mouse.move(5, 5);
  await wait(DWELL_MS + 1500);
  const s1 = await state(page);
  ok('motion: with less motion nothing moves on its own', index(s0) === 1 && index(s1) === 1, `${s0.count} -> ${s1.count}`);
  const ui_ = await page.evaluate(() => ({ toggle: [...document.querySelectorAll('.tt-card__acts .tt-btn')].filter((b) => b.checkVisibility()).length, pulse: getComputedStyle(document.querySelector('.mk--tt-cur .mk__shape'), '::after').display, bar: document.querySelector('.tt-card__prog').checkVisibility() }));
  ok('motion: only previous and next stay (no pause button, no progress strip, no pulse)', ui_.toggle === 3 && ui_.pulse === 'none' && !ui_.bar, JSON.stringify(ui_)); // previous, next, close
  await next(page);
  ok('motion: next still works', index(await state(page)) === 2);
  await page.close();
  const normal = await open(`${MAP.pt}?era=${PLACE}`);
  await normal.waitForSelector('.tt-card:not([hidden])');
  const pulse = await normal.evaluate(() => { const a = getComputedStyle(document.querySelector('.mk--tt-cur .mk__shape'), '::after'); return { name: a.animationName, count: a.animationIterationCount }; });
  ok('motion: otherwise the current point gives one pulse', pulse.name === 'tt-pulse' && pulse.count === '1', JSON.stringify(pulse));
  await normal.close();
}

// ---------- 9. the events of the counter ----------
if (want('events')) {
  const page = await open(MAP.pt);
  await page.click(START);
  await choose(page);
  await wait(500);
  let log = await page.evaluate(() => JSON.parse(sessionStorage.getItem('__gc') || '[]'));
  ok('events: a start from the button is one event, timetravel-start-view', JSON.stringify(log) === '["timetravel-start-view"]', JSON.stringify(log));
  await page.evaluate(() => document.querySelector('.tt-card__acts .tt-btn:nth-of-type(2)').click());
  await next(page);
  await page.evaluate(() => document.querySelector('.tt-card__close, .tt-card__acts .tt-btn:last-child').click());
  await page.goto(`${base}${MAP.pt}?era=${PLACE}`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.tt-card:not([hidden])');
  await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), page.click('.tt-card__read')]);
  log = await page.evaluate(() => JSON.parse(sessionStorage.getItem('__gc') || '[]'));
  ok('events: a start from a place and a press of "Read" are timetravel-start-<place> and timetravel-read, nothing else', JSON.stringify(log) === JSON.stringify(['timetravel-start-view', `timetravel-start-${PLACE}`, 'timetravel-read']), JSON.stringify(log));
  await page.close();
}

// ---------- 10. the address ----------
if (want('address')) {
  const page = await open(`${MAP.pt}?era=${PLACE}`);
  await page.waitForSelector('.tt-card:not([hidden])');
  const r = await page.evaluate(() => ({ robots: document.querySelector('meta[name="robots"]')?.content, canonical: document.querySelector('link[rel=canonical]')?.href, search: location.search }));
  ok('address: ?era=<place> starts the show at once, the address keeps the place, the page asks not to be indexed', r.robots === 'noindex' && r.search.includes(`era=${PLACE}`) && !(r.canonical ?? '').includes('era='), JSON.stringify(r));
  await page.close();
  const unknown = await open(`${MAP.pt}?era=no-such-place`);
  ok('address: an unknown place starts nothing', !(await state(unknown)).on);
  await unknown.close();
  // the thread filter narrows the list
  const thread = (inPlace()[0].threads ?? [])[0];
  const filtered = await open(`${MAP.pt}?fio=${thread}&era=${PLACE}`);
  await filtered.waitForSelector('.tt-card:not([hidden])');
  const expected = inPlace().filter((e) => (e.threads ?? []).includes(thread));
  const s = await state(filtered);
  ok('address: the thread filter of the map is applied to the show', expected.length < 3 ? !s.playVisible : total(s) === expected.length, `${s.count} (data: ${expected.length})`);
  await filtered.close();
}

// ---------- 11. the end ----------
if (want('final')) {
  const list = inPlace();
  const done = list.slice(0, 2).map((e) => e.id);
  const page = await open(`${MAP.pt}?era=${PLACE}`, { read: done });
  await page.waitForSelector('.tt-card:not([hidden])');
  await page.evaluate(() => document.querySelector('.tt-card__acts .tt-btn:nth-of-type(2)').click());
  await walk(page);
  const s = await state(page);
  // the short year of the data (year_scale), else the first year; the first centuries and BC years have their era, so a story without a short year is not checked by its figure
  const label = (e) => e.year_scale?.pt ?? (range(e)[0] >= 1000 ? String(range(e)[0]) : '');
  const lastLabel = label;
  ok('final: the summary says how many stories of the place and from which year to which', s.other.includes(String(list.length)) && s.other.includes(label(list[0])) && s.other.includes(lastLabel(list[list.length - 1])) && !/(^|[ \n])1([ \n]|$)/.test(s.other) && s.other.split('\n').length >= 2, JSON.stringify(s.other));
  ok(`final: "Unread: K" counts the stories not read (${list.length - done.length})`, s.other.toLowerCase().includes(ui('map.tt_unread', 'pt').replace('{n}', String(list.length - done.length)).toLowerCase()), s.other);
  await page.click('.tt-card__final-acts .button:not(.button--secondary)');
  const unread = await page.evaluate(() => [...document.querySelectorAll('.tt-card__unread a')].map((a) => a.getAttribute('href')));
  ok('final: the list holds the unread stories, in order', JSON.stringify(unread) === JSON.stringify(hrefs(list.filter((e) => !done.includes(e.id)))));
  await page.evaluate(() => [...document.querySelectorAll('.tt-card__other .button--secondary')].pop().click());
  await page.evaluate(() => document.querySelector('.tt-card__final-acts .button--secondary').click());
  const again = await state(page);
  ok('final: "Start over" begins again from the first story', index(again) === 1 && again.playVisible);
  await page.close();
}

// ---------- 12. without JavaScript ----------
if (want('nojs')) {
  const page = await open(MAP.pt, { js: false });
  ok('nojs: there is no button without JavaScript', !(await page.evaluate(() => document.querySelector('[data-tt-start]').checkVisibility())));
  await page.close();
}

// ---------- 13. layout ----------
if (want('layout')) {
  for (const [lang, path] of Object.entries(MAP)) {
    const page = await open(`${path}?era=${PLACE}`, { width: 360, height: 740 });
    await page.waitForSelector('.tt-card:not([hidden])');
    await wait(300);
    const s = await state(page);
    const geometry = await page.evaluate(() => {
      const card = document.querySelector('.tt-card').getBoundingClientRect();
      const stage = document.querySelector('.map__stage').getBoundingClientRect();
      return { fits: card.left >= stage.left - 1 && card.right <= stage.right + 1, share: card.height / stage.height, noScroll: document.documentElement.scrollWidth <= document.documentElement.clientWidth, label: document.querySelector('[data-tt-start]').textContent.trim() };
    });
    ok(`layout (${lang}, 360 px): the card spans the map, is at most 45% of it, no horizontal scroll, the button has the name of the mode`, geometry.fits && geometry.share <= 0.46 && geometry.noScroll && geometry.label === ui('map.tt_button', lang), JSON.stringify(geometry));
    ok(`layout (${lang}, 360 px): the long hook is not cut (the card grows or scrolls)`, await page.evaluate(() => { const h = document.querySelector('.tt-card__hook'); return h.scrollHeight <= h.clientHeight + 1; }));
    await page.evaluate(() => document.querySelector('.tt-card__acts .tt-btn:nth-of-type(2)')?.click());
    await walk(page, lang);
    ok(`layout (${lang}, 360 px): the summary has no horizontal scroll`, await hasJsNoScroll(page));
    await page.close();
  }
  const wide = await open(`${MAP.pt}?era=${PLACE}`, { width: 1280, height: 800 });
  await wide.waitForSelector('.tt-card:not([hidden])');
  const g = await wide.evaluate(() => { const c = document.querySelector('.tt-card').getBoundingClientRect(); const s = document.querySelector('.map__stage').getBoundingClientRect(); return { w: c.width, right: s.right - c.right, bottom: s.bottom - c.bottom }; });
  ok('layout (1280 px): the card is a plate of 400 px at the bottom right of the map', Math.abs(g.w - 400) <= 6 && g.right < 24 && g.bottom < 24, JSON.stringify(g));
  await wide.close();
}

await browser.close();
console.log(failed === 0 ? '\nAll "Through the centuries" checks passed' : `\n${failed} check(s) failed`);
process.exit(failed === 0 ? 0 : 1);

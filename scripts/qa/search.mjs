// Browser checks for the search (docs/spec.md "Поиск"): the magnifier in the header, the bar (1280) and the sheet (390), the keys, the queries in three languages,
// the empty result, the map line and ?place=, the family mode, the events, and the page of the search without JavaScript.
// The stories, the places and the words come from src/content (data.mjs): no title, place or count is written here but a word that a test needs
// from the data and says so (`need`). Run against dist/ served by serve.mjs (base path "/"), the index made by scripts/make-search.mjs:
//   node search.mjs [open keys queries empty map family events nojs lazy]
import { launchBrowser } from './browser.mjs';
import { need, real, ui } from './data.mjs';

const base = process.env.BASE_URL || 'http://localhost:4400';
const ONLY = process.argv.slice(2);
const want = (name) => ONLY.length === 0 || ONLY.includes(name);
const events = real.published;

let failed = 0;
const ok = (name, cond, extra = '') => {
  if (!cond) failed += 1;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
};
const browser = await launchBrowser();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const LANGS = ['pt', 'en', 'ru'];
const HOME = { pt: '/pt/', en: '/en/', ru: '/ru/' };
const MAP = { pt: '/pt/mapa/', en: '/en/map/', ru: '/ru/karta/' };
const SEARCH_PAGE = { pt: '/pt/pesquisa/', en: '/en/search/', ru: '/ru/poisk/' };
const STORY = { pt: 'historia', en: 'story', ru: 'istoriya' };
const href = (e, lang) => `/${lang}/${STORY[lang]}/${e.slug[lang]}/`;

// The place of a story as the site names it: the short name, else the part of the name before the first comma or bracket; the key is its Portuguese slug (src/lib/timetravel.ts).
const placeShort = (e, lang) => (e.place.short?.[lang] ?? e.place.name[lang].split(/[,(]/)[0]).trim();
const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const placeKey = (e) => slug(placeShort(e, 'pt'));
const shownIn = (e, mode) => mode === 'off' || (!e.sensitive && (String(e.min_age) === 'all' || (mode === '12' && String(e.min_age) === '12')));
const places = new Map();
for (const e of events) places.set(placeKey(e), [...(places.get(placeKey(e)) ?? []), e]);
const bigPlace = [...places.entries()].sort((a, b) => b[1].length - a[1].length)[0];
const spread = (list) => Math.max(...list.map((e) => e.bridge.lat)) - Math.min(...list.map((e) => e.bridge.lat)) + Math.max(...list.map((e) => e.bridge.lon)) - Math.min(...list.map((e) => e.bridge.lon));
const smallPlace = [...places.entries()].filter(([, list]) => list.length >= 1).sort((a, b) => spread(a[1]) - spread(b[1]))[0];

const open = async (path, { width = 1280, height = 900, family = null, js = true, counter = false } = {}) => {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  page.close = () => context.close();
  await page.setViewport({ width, height });
  if (!js) await page.setJavaScriptEnabled(false);
  if (family) await page.evaluateOnNewDocument((mode) => localStorage.setItem('family', mode), family);
  // A stand-in for GoatCounter: what the search tells it is kept in sessionStorage (the map line leaves the page).
  // The page's own count.js and its settings would replace it, so neither window.goatcounter nor its count can be written over.
  if (counter) await page.evaluateOnNewDocument(() => { const gc = {}; Object.defineProperty(gc, 'count', { value: (v) => sessionStorage.setItem('gc', JSON.stringify([...JSON.parse(sessionStorage.getItem('gc') || '[]'), v])) }); Object.defineProperty(window, 'goatcounter', { value: gc }); });
  page.errors = [];
  page.requests = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('request', (r) => page.requests.push(r.url()));
  await page.goto(`${base}${path}`, { waitUntil: 'networkidle0' });
  return page;
};
const openSearch = async (page) => {
  await page.click('[data-search-open]');
  await page.waitForSelector('.search__input');
  await page.waitForFunction(() => document.querySelector('.search__input')?.placeholder);
};
const type = async (page, text) => {
  await page.click('.search__input', { clickCount: 3 });
  await page.keyboard.press('Backspace');
  await page.type('.search__input', text);
  await page.waitForFunction(() => !['loading', 'idle', 'hint'].includes(document.querySelector('.search')?.dataset.state), { timeout: 15000 });
  await wait(100);
};
const top = (page, n = 3) => page.evaluate((n) => [...document.querySelectorAll('.search__item a')].slice(0, n).map((a) => a.getAttribute('href')), n);

// ---------- 1. Open and close ----------
if (want('open')) {
  for (const [width, layout] of [[1280, 'bar'], [800, 'bar'], [390, 'sheet']]) {
    const page = await open(HOME.pt, { width, height: width === 390 ? 800 : 900 });
    const label = ui('search.open', 'pt');
    const btn = await page.evaluate(() => { const b = document.querySelector('.site-header [data-search-open]'); const r = b.getBoundingClientRect(); return { label: b.getAttribute('aria-label'), w: r.width, h: r.height, expanded: b.getAttribute('aria-expanded'), tag: b.tagName }; });
    ok(`open (${width}): the magnifier is a link of at least 44 px named "${label}"`, btn.tag === 'A' && btn.label === label && btn.w >= 44 && btn.h >= 44 && btn.expanded === 'false', JSON.stringify(btn));
    await openSearch(page);
    const s = await page.evaluate(() => ({ layout: document.querySelector('.search').dataset.layout, focus: document.activeElement.className, expanded: document.querySelector('[data-search-open]').getAttribute('aria-expanded'), role: document.querySelector('.search').getAttribute('role'), placeholder: document.querySelector('.search__input').placeholder }));
    ok(`open (${width}): the ${layout} layout, the field has the focus, the magnifier says it is expanded`, s.layout === layout && /search__input/.test(s.focus) && s.expanded === 'true' && s.role === 'dialog' && s.placeholder === ui('search.placeholder', 'pt'), JSON.stringify(s));
    if (layout === 'sheet') {
      const box = await page.evaluate(() => { const r = document.querySelector('.search').getBoundingClientRect(); return { w: r.width, h: r.height, inert: document.querySelector('main').inert }; });
      ok('open (390): the sheet fills the screen and the page under it is inert', box.w === 390 && box.h === 800 && box.inert, JSON.stringify(box));
    } else {
      const bar = await page.evaluate(() => { const r = document.querySelector('.search').getBoundingClientRect(); const h = document.querySelector('.site-header').getBoundingClientRect(); return { inHeader: r.top >= h.top - 1 && r.bottom <= h.bottom + 1, nav: getComputedStyle(document.querySelector('.site-nav')).display }; });
      ok(`open (${width}): the field stands in the header in place of the menu`, bar.inHeader && bar.nav === 'none', JSON.stringify(bar));
    }
    await page.keyboard.press('Escape');
    await wait(100);
    const closed = await page.evaluate(() => ({ gone: !document.querySelector('.search'), focusIsMagnifier: document.activeElement === document.querySelector('.site-header [data-search-open]'), expanded: document.querySelector('[data-search-open]').getAttribute('aria-expanded'), inert: document.querySelector('main').inert }));
    ok(`open (${width}): Esc closes, the focus goes back to the magnifier`, closed.gone && closed.focusIsMagnifier && closed.expanded === 'false' && !closed.inert, JSON.stringify(closed));
    await openSearch(page);
    await page.click('.search__close');
    const viaClose = await page.evaluate(() => ({ gone: !document.querySelector('.search'), focusIsMagnifier: document.activeElement === document.querySelector('.site-header [data-search-open]') }));
    ok(`open (${width}): the "×" closes it too, the focus goes back to the magnifier`, viaClose.gone && viaClose.focusIsMagnifier, JSON.stringify(viaClose));
    if (layout === 'bar') {
      await openSearch(page);
      await type(page, bigPlace[1][0].title.pt.slice(0, 4));
      await wait(600);
      const edges = await page.evaluate(() => { const f = document.querySelector('.search__field').getBoundingClientRect(); const r = document.querySelector('.search__results').getBoundingClientRect(); return { field: [f.left, f.right, f.bottom], results: [r.left, r.right, r.top] }; });
      ok(`open (${width}): the results hang under the field, as wide as it`, Math.abs(edges.field[0] - edges.results[0]) <= 1 && Math.abs(edges.field[1] - edges.results[1]) <= 1 && edges.results[2] >= edges.field[2], JSON.stringify(edges));
      await page.mouse.click(4, 890);
      await wait(100);
      ok(`open (${width}): a click outside the results closes the bar`, (await page.$('.search')) === null);
    }
    ok(`open (${width}): no script error`, page.errors.length === 0, page.errors.join(' | '));
    await page.close();
  }
}

// ---------- 2. The keys and the shortest query ----------
if (want('keys')) {
  const page = await open(HOME.pt);
  await openSearch(page);
  const sample = bigPlace[1][0];
  await page.type('.search__input', sample.title.pt[0]);
  await wait(500);
  ok('keys: one character searches nothing (the hint is shown, no result)', (await page.evaluate(() => document.querySelector('.search').dataset.state)) === 'hint' && (await top(page)).length === 0);
  await type(page, placeShort(sample, 'pt'));
  const first = await page.evaluate(() => ({ n: document.querySelectorAll('.search__item').length, map: !document.querySelector('.search__map').hidden }));
  ok('keys: a query of a place gives at most 10 results and the line of the map', first.n >= 1 && first.n <= 10 && first.map, JSON.stringify(first));
  await page.keyboard.press('ArrowDown');
  const down1 = await page.evaluate(() => document.activeElement.className);
  // The lines above the results are links of the class search__map: the map, and the page of the place when the place has one (one or two lines).
  let lines = 1;
  let onResult = false;
  while (!onResult && lines <= 3) {
    await page.keyboard.press('ArrowDown');
    onResult = await page.evaluate(() => document.activeElement.closest('.search__item') !== null);
    if (!onResult) lines += 1;
  }
  ok('keys: ↓ goes to the line of the map (and the page of the place), then to the first result', /search__map/.test(down1) && onResult && lines <= 2, `${down1} ${lines}`);
  for (let i = 0; i < lines + 1; i++) await page.keyboard.press('ArrowUp');
  ok('keys: ↑ goes back up to the field', (await page.evaluate(() => document.activeElement.className)).includes('search__input'));
  const firstHref = (await top(page, 1))[0];
  await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded' }), page.keyboard.press('Enter')]);
  ok('keys: Enter in the field opens the first result', new URL(page.url()).pathname === firstHref, `${page.url()} vs ${firstHref}`);
  await page.close();
}

// ---------- 3. The queries: words, forms, places, in each language ----------
if (want('queries')) {
  // A word of the data for a language: a story whose title has it.
  const byTitle = (lang, word) => need(`a story with "${word}" in its ${lang} title`, () => events.find((e) => e.title[lang].toLowerCase().includes(word)));
  const checks = [];
  // A place: the name as written, and (Russian) the name with an ending, as a reader types it.
  const consonant = (name) => /[бвгджзклмнпрстфхцчшщ]$/i.test(name);
  for (const lang of LANGS) {
    const [key, list] = bigPlace;
    const name = placeShort(list[0], lang);
    checks.push({ lang, query: name, expect: list.map((e) => href(e, lang)), all: list.length >= 3, what: `the place "${name}"` });
    if (lang === 'ru') {
      const inflect = [...places.entries()].find(([, l]) => consonant(placeShort(l[0], 'ru')) && l.length >= 1);
      if (inflect) checks.push({ lang, query: `${placeShort(inflect[1][0], 'ru')}е`, expect: inflect[1].map((e) => href(e, lang)), all: inflect[1].length >= 3, what: 'a place with an ending' });
    }
    void key;
  }
  const rhino = byTitle('ru', 'носорог');
  checks.push({ lang: 'ru', query: 'носорог', expect: [href(rhino, 'ru')], what: '"носорог"' }, { lang: 'ru', query: 'носорога', expect: [href(rhino, 'ru')], what: '"носорога" (another form)' });
  const quake = byTitle('pt', 'terramoto');
  checks.push({ lang: 'pt', query: 'terramoto', expect: [href(quake, 'pt')], what: '"terramoto"' });
  const quakeEn = byTitle('en', 'earthquake');
  checks.push({ lang: 'en', query: 'earthquake', expect: [href(quakeEn, 'en')], what: '"earthquake"' });
  for (const c of checks) {
    const page = await open(HOME[c.lang]);
    await openSearch(page);
    await type(page, c.query);
    const got = await top(page, 3);
    const hit = c.all ? got.length === 3 && got.every((h) => c.expect.includes(h)) : got.some((h) => c.expect.includes(h));
    ok(`queries (${c.lang}): ${c.what} ("${c.query}") gives ${c.all ? 'its stories' : 'the story'} first in the top three`, hit, JSON.stringify(got));
    ok(`queries (${c.lang}): "${c.query}" no script error`, page.errors.length === 0, page.errors.join(' | '));
    await page.close();
  }
}

// ---------- 4. The empty result ----------
if (want('empty')) {
  for (const width of [390, 1280]) {
    const page = await open(HOME.ru, { width, height: 800 });
    await openSearch(page);
    await type(page, 'щщщзз');
    const e = await page.evaluate(() => ({ state: document.querySelector('.search').dataset.state, items: document.querySelectorAll('.search__item').length, text: document.querySelector('.search__empty-text')?.textContent, links: [...document.querySelectorAll('.search__empty-list a')].map((a) => a.getAttribute('href')), map: !document.querySelector('.search__map').hidden }));
    const eras = Math.min(3, real.readyEpochs.length);
    ok(`empty (${width}): the text, ${eras} epochs and "Surprise me", no map line`, e.state === 'empty' && e.items === 0 && e.text === ui('search.empty', 'ru') && e.links.length === eras + 1 && e.links.at(-1) === '/ru/udivi-menya/' && e.links.slice(0, eras).every((l) => /^\/ru\/epoha\//.test(l)) && !e.map, JSON.stringify(e));
    await page.close();
  }
}

// ---------- 5. The map line and ?place= ----------
if (want('map')) {
  const [key, list] = smallPlace;
  const lang = 'pt';
  const zoomOf = async (page) => {
    await page.waitForSelector('.map[data-state="ready"]', { timeout: 15000 });
    await wait(900);
    return page.evaluate(() => history.state?.mapView ?? null);
  };
  const plain = await open(MAP[lang]);
  const zoomPlain = await zoomOf(plain);
  await plain.close();
  const page = await open(`${MAP[lang]}?place=${key}`);
  const v = await zoomOf(page);
  const r = await page.evaluate(() => ({ url: location.search, count: document.querySelector('[data-list-count]').textContent }));
  const lats = list.map((e) => e.bridge.lat);
  const lons = list.map((e) => e.bridge.lon);
  ok(`map: ?place=${key} brings the map close to the place (zoom ${v?.zoom} against ${zoomPlain?.zoom}), the centre among its stories`, v && zoomPlain && v.zoom > zoomPlain.zoom && v.lat >= Math.min(...lats) - 0.5 && v.lat <= Math.max(...lats) + 0.5 && v.lon >= Math.min(...lons) - 0.5 && v.lon <= Math.max(...lons) + 0.5, JSON.stringify(v));
  ok('map: the parameter is read once and taken out of the address', !/place=/.test(r.url), r.url);
  ok('map: the list of the area holds at least the stories of the place', Number(r.count) >= list.length, `${r.count} >= ${list.length}`);
  await page.close();
  // From the search: the line leads to the map at that place, and the event is told without the words.
  const s = await open(HOME.pt, { counter: true });
  await openSearch(s);
  await type(s, placeShort(list[0], 'pt'));
  const line = await s.evaluate(() => { const a = document.querySelector('.search__map'); return a.hidden ? null : { href: a.getAttribute('href'), text: a.textContent }; });
  ok(`map: the line says how many stories and where, and leads to ${MAP.pt}?place=${key}`, line && line.href === `${MAP.pt}?place=${key}` && line.text.includes(String(list.length)) && line.text.includes(placeShort(list[0], 'pt')), JSON.stringify(line));
  await Promise.all([s.waitForNavigation({ waitUntil: 'domcontentloaded' }), s.click('.search__map')]);
  await s.waitForSelector('.map[data-state="ready"]', { timeout: 15000 });
  const told = await s.evaluate(() => JSON.parse(sessionStorage.getItem('gc') || '[]'));
  ok('map: GoatCounter is told "search" once and "search-map" once, as events, with no words of the query', told.length === 2 && told[0].path === 'search' && told[1].path === 'search-map' && told.every((x) => x.event === true) && !JSON.stringify(told).toLowerCase().includes(placeShort(list[0], 'pt').toLowerCase()), JSON.stringify(told));
  await s.close();
}

// ---------- 6. The family mode ----------
if (want('family')) {
  const heavy = need('a heavy-topic story', () => events.find((e) => e.sensitive));
  const query = heavy.title.pt.split(/\s+/).filter((w) => w.length >= 5)[0] ?? heavy.title.pt;
  for (const mode of ['off', 'all', '12']) {
    const page = await open(HOME.pt, { family: mode });
    await openSearch(page);
    await type(page, heavy.title.pt);
    const got = await page.evaluate(() => [...document.querySelectorAll('.search__item a')].map((a) => a.getAttribute('href')));
    const expected = shownIn(heavy, mode);
    ok(`family (${mode}): the heavy story "${heavy.title.pt}" is ${expected ? 'found' : 'hidden'} (query "${heavy.title.pt}")`, got.includes(href(heavy, 'pt')) === expected, JSON.stringify(got.slice(0, 4)));
    if (mode !== 'off') {
      const hidden = events.filter((e) => !shownIn(e, mode)).map((e) => href(e, 'pt'));
      await type(page, query);
      const again = await page.evaluate(() => [...document.querySelectorAll('.search__item a')].map((a) => a.getAttribute('href')));
      ok(`family (${mode}): no story the mode hides is in any result (query "${query}")`, again.every((h) => !hidden.includes(h)), JSON.stringify(again));
    }
    await page.close();
  }
}

// ---------- 7. Without JavaScript, and the page of the search ----------
if (want('nojs')) {
  for (const lang of LANGS) {
    const page = await open(HOME[lang], { js: false });
    const link = await page.evaluate(() => { const a = document.querySelector('.site-header [data-search-open]'); return a ? { href: a.getAttribute('href'), visible: a.checkVisibility() } : null; });
    ok(`nojs (${lang}): the magnifier is a visible link to the page of the search`, link && link.href === SEARCH_PAGE[lang] && link.visible, JSON.stringify(link));
    await page.goto(`${base}${SEARCH_PAGE[lang]}`, { waitUntil: 'networkidle0' });
    const p = await page.evaluate(() => ({ nojs: document.querySelector('.search-page__nojs')?.checkVisibility(), links: [...document.querySelectorAll('.search-page__nojs a')].map((a) => a.getAttribute('href')), input: document.querySelector('.search__input'), robots: document.querySelector('meta[name="robots"]')?.content }));
    ok(`nojs (${lang}): the page says that the search needs JavaScript and links to the epochs, no field, noindex`, p.nojs && p.links.length === 1 && /#epocas$/.test(p.links[0]) && !p.input && /noindex/.test(p.robots), JSON.stringify(p));
    await page.close();
    const withJs = await open(SEARCH_PAGE[lang]);
    const q = await withJs.evaluate(() => ({ input: !!document.querySelector('[data-search-page] .search__input'), nojs: getComputedStyle(document.querySelector('.search-page__nojs')).display, focus: document.activeElement.className }));
    ok(`nojs (${lang}): with JavaScript the page of the search holds the field, with the focus, and not the text for the reader without it`, q.input && q.nojs === 'none' && /search__input/.test(q.focus), JSON.stringify(q));
    if (lang === 'pt') {
      await type(withJs, placeShort(bigPlace[1][0], 'pt'));
      ok('nojs (pt): the page of the search answers a query', (await top(withJs, 1)).length === 1);
      await withJs.click('[data-search-open]');
      ok('nojs (pt): the magnifier of the page takes the focus to the field and does not leave the page', (await withJs.evaluate(() => document.activeElement.className)).includes('search__input') && withJs.url().endsWith(SEARCH_PAGE.pt));
    }
    await withJs.close();
  }
}

// ---------- 8. Nothing of the search is read before it is opened ----------
if (want('lazy')) {
  const page = await open(HOME.pt);
  const early = page.requests.filter((u) => /search-ui|pagefind|search\.json/.test(u));
  ok('lazy: a page load reads no script, style, index or data of the search', early.length === 0, JSON.stringify(early));
  const styleEarly = await page.evaluate(() => [...document.querySelectorAll('style, link[rel=stylesheet]')].some((n) => (n.textContent ?? '').includes('.search__field')));
  ok('lazy: the style of the search is not in the page before it is opened', !styleEarly);
  await openSearch(page);
  await type(page, placeShort(bigPlace[1][0], 'pt'));
  const late = page.requests.filter((u) => /search-ui|pagefind|search\.json/.test(u));
  ok('lazy: opening it does not read the code of the map', !late.some((u) => /map-island|leaflet/.test(u)), JSON.stringify(late.filter((u) => /map-island|leaflet/.test(u))));
  ok('lazy: opening it reads the script, the data and the index and puts the style into the page', ['search-ui', 'search.json', 'pagefind.js'].every((k) => late.some((u) => u.includes(k))) && (await page.evaluate(() => [...document.querySelectorAll('style')].some((n) => n.textContent.includes('.search__field')))), JSON.stringify(late.map((u) => u.replace(base, ''))));
  await page.close();
}

await browser.close();
console.log(failed === 0 ? '\nAll search checks passed' : `\n${failed} check(s) failed`);
process.exit(failed === 0 ? 0 : 1);

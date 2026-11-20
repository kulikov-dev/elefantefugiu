// Browser checks of the cabinet of rarities (src/lib/cabinet.ts, src/scripts/cabinet.ts, src/views/CabinetView.astro, docs/spec.md "Кабинет редкостей"), against the fixture build
// (VARIANT_URL, prepare-variant.mjs: the cabinet is open there and there is one story of the cabinet) and, for the closed site, against the real build (BASE_URL):
//   word      a hidden word is a button with the name of the rarity; a press saves the rarity, shows the card ("You found a rarity", the summary, "Open the story", "To the cabinet"); a second press says
//             "Already in the cabinet"; Esc closes the card and the focus goes back to the word; no horizontal scroll at 320; the dark theme keeps the dashed underline, unlike the dotted grey one of the glossary
//   pop-ups   one logic everywhere: a press opens, a press outside, a second press on the same place or Esc closes; no cross; the tin has no hover card; the pills keep a light text on hover
//   page      the cabinet shows what is found (a thumbnail in a frame) and what is not (a dashed tile): the counter, the tiles, the card of a found tile ("Open the story") and of a missing one (the hint);
//             Esc closes; without JavaScript the short text; no horizontal scroll at 320 in both themes
//   direct    a story of a rarity opened by its address adds nothing; the story of the cabinet has the ribbon, the way back, no read mark, noindex, and is on no list of the site
//   sardines  seven places, each on its own page; a press: the sardine swims away (a class, none under reduced motion), the card "Sardine N of 7 in the tin" and "To the cabinet"; found, it is gone from
//             its page; the sardine of the result of the myths is one on the page of a range; seven give the garlands and the line of the holiday on the cabinet page
//   closed    the real build: no card in the hub, no link in the footer, words are plain text; ?kabinet=preview turns everything on in this browser (note on the cabinet page), ?kabinet=off turns it off
import { existsSync, readFileSync } from 'node:fs';
import { launchBrowser } from './browser.mjs';
import { cabinetItems, cabinetStories as realCabinetStories, byId, epochs, published } from './data.mjs';
import { CABINET_FIXTURE, MOVED_TO } from './variant-plan.mjs';

const VARIANT = process.env.VARIANT_URL || 'http://localhost:4401';
const REAL = process.env.BASE_URL || 'http://localhost:4400';
const ONLY = process.argv.slice(2);
const want = (name) => ONLY.length === 0 || ONLY.includes(name);
let failed = 0;
const ok = (name, cond, extra = '') => {
  if (!cond) failed += 1;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
};
const rgb = (css) => (css.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
const lum = (c) => c.map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
const ratio = (a, b) => { const [x, y] = [lum(rgb(a)), lum(rgb(b))].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
/** The pills of a card on hover and on keyboard focus keep a readable text (the text was dark red on red once). */
const pillContrast = async (page) => {
  const out = [];
  for (const sel of ['.cab-pop__button:not(.cab-pop__button--ghost)', '.cab-pop__button--ghost']) {
    await page.hover(sel);
    await wait(150);
    const c = await page.$eval(sel, (b) => { const s = getComputedStyle(b); return { color: s.color, bg: s.backgroundColor }; });
    out.push(ratio(c.color, c.bg));
  }
  return out;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await launchBrowser();

const SEG = { pt: 'historia', en: 'story', ru: 'istoriya' };
const CAB = { pt: 'gabinete', en: 'cabinet', ru: 'kabinet' };
const PAGES = {
  about: { pt: 'sobre', en: 'about', ru: 'o-proekte' },
  method: { pt: 'metodo', en: 'method', ru: 'metod' },
  map: { pt: 'mapa', en: 'map', ru: 'karta' },
  games: { pt: 'jogos', en: 'games', ru: 'igry' },
  myths: { pt: 'mito-ou-verdade', en: 'myth-or-fact', ru: 'mif-ili-pravda' },
};
const RANKSEG = { pt: 'titulo', en: 'rank', ru: 'zvanie' };
const EPOCHSEG = { pt: 'epoca', en: 'era', ru: 'epoha' };
const KEY = 'cabinet.v1';

if (cabinetItems.length === 0) throw new Error('The suite needs a rarity of cabinet.yaml whose host and story are published (need: one rarity).');
// The stories of the cabinet in the fixture build: the real ones (none yet) and the fixture of prepare-variant.mjs (its slug is its id, in the epoch MOVED_TO).
const cabinetStories = [...realCabinetStories, { id: CABINET_FIXTURE.id, slug: { pt: CABINET_FIXTURE.id, en: CABINET_FIXTURE.id, ru: CABINET_FIXTURE.id }, epoch: MOVED_TO }];
const item = cabinetItems[0];
const host = byId(item.host);
const storyOf = (i) => byId(i.story);
// The places of the sardines, read from the source of the page (one list, not repeated here).
const PLACES = [...readFileSync(new URL('../../src/lib/cabinet-places.ts', import.meta.url), 'utf8').matchAll(/\{ n: (\d+), page: '([\w-]+)'(?:, epoch: '([\w-]+)')?/g)].map((m) => ({ n: Number(m[1]), page: m[2], epoch: m[3] }));
if (PLACES.length < 2) throw new Error('The suite could not read the places of the sardines from src/lib/cabinet-places.ts.');
const placePath = (place, lang = 'pt') => {
  if (place.page === 'notfound') return '/pt/nao-existe-esta-pagina/';
  if (place.page === 'epoch') return `/${lang}/${EPOCHSEG[lang]}/${epochs.find((e) => e.id === place.epoch).slug[lang]}/`;
  if (place.page === 'myths-result') return `/${lang}/${PAGES.myths[lang]}/${RANKSEG[lang]}/high/`;
  return `/${lang}/${PAGES[place.page][lang]}/`;
};

const open = async (base, path, { width = 390, scheme = 'light', js = true, reduced = false, storage, lang = 'pt' } = {}) => {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 900, isMobile: width < 700, hasTouch: false });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }, { name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }]);
  if (!js) await page.setJavaScriptEnabled(false);
  page.errors = [];
  page.on('pageerror', (e) => !/ViewTransition opt-in disabled/.test(e.message) && page.errors.push(e.message));
  // A clean browser for every page: the storage of the one before is cleared first (same address, so the same storage), then the kept data is put in.
  await page.goto(`${base}/${lang}/`, { waitUntil: 'domcontentloaded' });
  await page.evaluate((kept) => {
    localStorage.clear();
    if (kept) for (const [k, v] of Object.entries(kept)) localStorage.setItem(k, v);
  }, storage ?? null);
  await page.goto(`${base}${path}`, { waitUntil: 'networkidle0' });
  await wait(300);
  return page;
};
const store = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), KEY);
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
const popText = (page) => page.evaluate(() => { const p = document.querySelector('.cab-pop'); return p && !p.hidden ? p.textContent : null; });
const reveal = (page, selector) => page.$eval(selector, (el) => { document.documentElement.style.scrollBehavior = 'auto'; el.closest('details')?.setAttribute('open', ''); el.scrollIntoView({ block: 'center' }); });
const findWordPage = async (lang) => {
  for (const e of published.filter((s) => s.id === item.host)) return `/${lang}/${SEG[lang]}/${e.slug[lang] ?? e.slug.en}/`;
  return undefined;
};

if (want('word')) {
  for (const lang of ['pt', 'ru']) {
    const path = await findWordPage(lang);
    const page = await open(VARIANT, path, { lang });
    const sel = `button.cw[data-cw="${item.id}"]`;
    ok(`word (${lang}): the hidden word of the host is a button with the name of the rarity`, (await page.$(sel)) !== null && /:/.test((await page.$eval(sel, (b) => b.getAttribute('aria-label'))) ?? ''), page.errors.join('; '));
    await reveal(page, sel);
    await wait(200);
    await page.click(sel);
    await wait(300);
    const text = await popText(page);
    ok(`word (${lang}): a press opens the card with the name and the summary`, !!text && text.includes(item.name[lang]) && text.includes(item.summary[lang]), String(text).slice(0, 80));
    if (lang === 'pt') ok('word: on hover the pills of the card keep a text of 4.5:1 or more (light theme)', (await pillContrast(page)).every((r) => r >= 4.5));
    ok(`word (${lang}): the rarity is saved`, (await store(page))?.items?.includes(item.id) === true);
    ok(`word (${lang}): the card has "Open the story" and "To the cabinet" as links`, (await page.$$eval('.cab-pop a', (a) => a.map((x) => x.getAttribute('href')))).some((h) => h?.includes(`/${CAB[lang]}/`)));
    await page.keyboard.press('Escape');
    await wait(150);
    ok(`word (${lang}): Esc closes the card and the focus is back on the word`, (await popText(page)) === null && (await page.evaluate((s) => document.activeElement?.matches(s), sel)));
    await page.click(sel);
    await wait(200);
    ok(`word (${lang}): the second press says it is in the cabinet already`, /./.test((await popText(page)) ?? '') && !(await popText(page)).includes('Вы нашли') && !(await popText(page)).includes('You found'));
    await page.close();
  }
  const narrow = await open(VARIANT, await findWordPage('pt'), { width: 320 });
  ok('word: no horizontal scroll at 320', !(await overflow(narrow)));
  await narrow.close();
  const dark = await open(VARIANT, await findWordPage('pt'), { scheme: 'dark' });
  const deco = await dark.$eval(`button.cw[data-cw="${item.id}"]`, (b) => { const s = getComputedStyle(b); return { line: s.textDecorationLine, style: s.textDecorationStyle, width: s.textDecorationThickness, color: s.textDecorationColor, bg: getComputedStyle(document.body).backgroundColor }; });
  await reveal(dark, `button.cw[data-cw="${item.id}"]`);
  await dark.click(`button.cw[data-cw="${item.id}"]`);
  await wait(250);
  ok('word: on hover the pills of the card keep a text of 4.5:1 or more (dark theme)', (await pillContrast(dark)).every((r) => r >= 4.5));
  ok('word: no cross in the card', (await dark.$('.cab-pop__close')) === null);
  ok('word: the dashed underline 1.5 px in the dark theme, in a colour that is not the background', deco.line.includes('underline') && deco.style === 'dashed' && parseFloat(deco.width) === 1.5 && deco.color !== deco.bg, JSON.stringify(deco));
  await dark.close();
}

if (want('page')) {
  const found = cabinetItems.slice(0, 1).map((i) => i.id);
  for (const scheme of ['light', 'dark']) {
    const page = await open(VARIANT, `/pt/${CAB.pt}/`, { scheme, storage: { [KEY]: JSON.stringify({ items: found, sardines: [], foundAt: {} }) } });
    const tiles = await page.$$eval('.cab-obj:not([hidden])', (t) => t.map((x) => ({ id: x.dataset.item, found: x.hasAttribute('data-found') })));
    ok(`page (${scheme}): a tile for every rarity of the data`, tiles.length === cabinetItems.length, `${tiles.length} of ${cabinetItems.length}`);
    ok(`page (${scheme}): only the found one is a thumbnail, the others are dashed`, tiles.filter((t) => t.found).map((t) => t.id).join() === found.join());
    const line = await page.$eval('[data-found-line]', (e) => e.textContent);
    ok(`page (${scheme}): the counter counts the found ones`, line.includes(`${found.length}`) && line.includes(`${cabinetItems.length}`), line);
    ok(`page (${scheme}): no text "undefined" on the page`, await page.evaluate(() => !document.body.innerText.includes('undefined')));
    ok(`page (${scheme}): no horizontal scroll at 390`, !(await overflow(page)));
    if (scheme === 'light') {
      await page.click(`.cab-obj[data-item="${found[0]}"]`);
      await wait(250);
      let text = await popText(page);
      ok('page: a found tile opens the name, the summary and a link to the story, no kicker, no cross', !!text && text.includes(item.summary.pt) && text.includes(item.name.pt) && (await page.$$eval('.cab-pop a', (a) => a.length)) === 1 && (await page.$('.cab-pop__kicker, .cab-pop__close')) === null, String(text).slice(0, 60));
      await page.click(`.cab-obj[data-item="${found[0]}"]`);
      await wait(150);
      ok('pop-ups: a second press on the same tile closes the card', (await popText(page)) === null);
      await page.click(`.cab-obj[data-item="${found[0]}"]`);
      await wait(150);
      await page.mouse.click(5, 5);
      await wait(150);
      ok('pop-ups: a press outside closes the card', (await popText(page)) === null);
      await page.click(`.cab-obj[data-item="${found[0]}"]`);
      await wait(150);
      await page.keyboard.press('Escape');
      await wait(150);
      ok('page: Esc closes the card', (await popText(page)) === null);
      const missing = cabinetItems.find((i) => !found.includes(i.id));
      if (missing) {
        await page.click(`.cab-obj[data-item="${missing.id}"]`);
        await wait(250);
        text = await popText(page);
        ok('page: a missing tile shows the hint only (no kicker, no title), not the summary', !!text && text.trim() === missing.hint.pt.trim() && !text.includes(missing.summary.pt), String(text).slice(0, 60));
        await page.keyboard.press('Escape');
      }
      await page.hover('[data-tin]');
      await wait(250);
      ok('pop-ups: the tin has no card on hover', (await popText(page)) === null);
      await page.click('[data-tin]');
      await wait(250);
      const tinText = (await popText(page)) ?? '';
      ok('page: a press on the tin shows one phrase, no title', tinText.length > 20 && (await page.$$eval('.cab-pop p', (p) => p.length)) === 1, tinText);
      await page.click('[data-tin]');
      await wait(150);
      ok('pop-ups: a second press on the tin closes the card', (await popText(page)) === null);
      ok('page: no focus ring on the tin or on the page at load', (await open(VARIANT, `/pt/${CAB.pt}/`).then(async (p) => { const r = await p.evaluate(() => !document.querySelector(':focus-visible')); await p.close(); return r; })));
      await page.click('[data-tin]');
      await wait(150);
      await page.keyboard.press('Escape');
      await wait(150);
      ok('page: Esc closes the hint of the tin', (await popText(page)) === null);
      ok('page: the tin is the picture of the tin with seven places (the found ones are pictures, the rest dashed)', await page.$$eval('.tin .tin__fish', (f) => f.length === 7));
    }
    await page.close();
  }
  const narrow = await open(VARIANT, `/pt/${CAB.pt}/`, { width: 320 });
  ok('page: no horizontal scroll at 320', !(await overflow(narrow)));
  await narrow.close();
  const nojs = await open(VARIANT, `/pt/${CAB.pt}/`, { js: false });
  ok('page: without JavaScript the short text is shown', await nojs.$eval('.cabinet__no-js', (e) => getComputedStyle(e).display !== 'none'));
  await nojs.close();
}

if (want('direct')) {
  const story = storyOf(item);
  const page = await open(VARIANT, `/pt/${SEG.pt}/${story.slug.pt}/`);
  ok('direct: opening the story of a rarity by its address adds nothing', (await store(page)) === null || (await store(page))?.items?.length === 0);
  await page.close();
  for (const s of cabinetStories) {
    const p = await open(VARIANT, `/pt/${SEG.pt}/${s.slug.pt}/`);
    ok(`direct (${s.id}): noindex, the ribbon, the way back to the cabinet, no read mark`, await p.evaluate((cab) => !!document.querySelector('meta[name=robots][content=noindex]') && !!document.querySelector('.cab-ribbon') && !!document.querySelector(`.cab-back a[href*="/${cab}/"]`) && !document.querySelector('[data-story-end]'), CAB.pt));
    ok(`direct (${s.id}): opening it adds nothing`, (await store(p)) === null || (await store(p))?.items?.length === 0);
    await p.close();
    // On no list: not on the home page, the map data, the epoch page, the games or the feeds.
    const needle = `/${SEG.pt}/${s.slug.pt}/`;
    const spots = ['/pt/', `/pt/${EPOCHSEG.pt}/${epochs.find((e) => e.id === s.epoch).slug.pt}/`, `/pt/${PAGES.map.pt}/`, `/pt/rss.xml`, '/pt/search.json', '/pt/surprise.json', '/pt/order.json', '/sitemap.xml'];
    let hits = [];
    for (const spot of spots) {
      const res = await fetch(`${VARIANT}${spot}`);
      if (res.ok && (await res.text()).includes(needle)) hits.push(spot);
    }
    ok(`direct (${s.id}): on no list, feed, sitemap or page of a game`, hits.length === 0, hits.join(' '));
  }
}

if (want('sardines')) {
  for (const place of PLACES) {
    const path = placePath(place);
    const page = await open(VARIANT, path);
    const found = await page.$('.cab-sardine');
    ok(`sardines (${place.n}, ${place.page}): the sardine is on its page`, found !== null, path);
    if (!found) {
      await page.close();
      continue;
    }
    ok(`sardines (${place.n}): one sardine on the page, none in the text of a story`, (await page.$$('.cab-sardine')).length === 1 && (await page.$$('.prose .cab-sardine')).length === 0);
    ok(`sardines (${place.n}): no horizontal scroll`, !(await overflow(page)));
    const target = await page.$eval('.cab-sardine', (b) => { const r = b.getBoundingClientRect(); return { w: r.width, h: r.height }; });
    ok(`sardines (${place.n}): the target is not under 44 x 44`, target.w >= 44 && target.h >= 44, JSON.stringify(target));
    await page.click('.cab-sardine');
    await wait(1400);
    const text = await popText(page);
    ok(`sardines (${place.n}): a press shows "Sardine 1 of 7" and the way to the cabinet`, !!text && /1\D+7/.test(text) && (await page.$$eval('.cab-pop a', (a, cab) => a.some((x) => x.getAttribute('href')?.includes(`/${cab}/`)), CAB.pt)), String(text).slice(0, 60));
    ok(`sardines (${place.n}): saved under its own number`, (await store(page))?.sardines?.join() === String(place.n));
    await page.keyboard.press('Escape');
    await wait(150);
    ok(`sardines (${place.n}): Esc closes the card`, (await popText(page)) === null);
    await page.reload({ waitUntil: 'networkidle0' });
    await wait(300);
    ok(`sardines (${place.n}): the found sardine is not shown again`, (await page.$('.cab-sardine')) === null);
    await page.close();
  }
  // The swim: a class while it goes, none with reduced motion; the card comes after it.
  const first = PLACES[0];
  const swim = await open(VARIANT, placePath(first));
  await swim.click('.cab-sardine');
  await wait(150);
  ok('sardines: the sardine swims away (the class of the animation while it goes)', (await swim.$('.cab-sardine--swim')) !== null);
  await swim.close();
  const still = await open(VARIANT, placePath(first), { reduced: true });
  await still.click('.cab-sardine');
  await wait(150);
  ok('sardines: no animation with prefers-reduced-motion, the card at once', (await still.$('.cab-sardine--swim')) === null && !!(await popText(still)));
  await still.close();
  // One sardine of the myths: the same on the page of every range.
  const myths = PLACES.find((p) => p.page === 'myths-result');
  if (myths) {
    const a = await open(VARIANT, placePath(myths), { storage: { [KEY]: JSON.stringify({ items: [], sardines: [myths.n], foundAt: {} }) } });
    const b = await open(VARIANT, `/pt/${PAGES.myths.pt}/${RANKSEG.pt}/low/`, { storage: { [KEY]: JSON.stringify({ items: [], sardines: [myths.n], foundAt: {} }) } });
    ok('sardines: the sardine of the result of the myths is one, found on one range it is gone from the others', (await a.$('.cab-sardine')) === null && (await b.$('.cab-sardine')) === null);
    await a.close();
    await b.close();
    // In the game itself the sardine waits in the result block and comes out when the result is shown (here the block is shown by hand: no round is played).
    const game = await open(VARIANT, `/pt/${PAGES.myths.pt}/`);
    ok('sardines: in the game the sardine is not there before the result', (await game.$('.cab-sardine')) === null);
    await game.evaluate(() => { document.querySelector('[data-final]').hidden = false; });
    await wait(500);
    ok('sardines: and it is in the result block once the result is shown', (await game.$('[data-final] .cab-sardine')) !== null);
    await game.close();
  }
  // Seven: the garlands and the line of the holiday on the cabinet page.
  const all = { items: [], sardines: PLACES.map((p) => p.n), foundAt: {} };
  const done = await open(VARIANT, `/pt/${CAB.pt}/`, { storage: { [KEY]: JSON.stringify(all) } });
  ok('sardines: seven in the tin show the garlands and the line of the holiday', await done.$eval('[data-party]', (e) => getComputedStyle(e).display !== 'none' && e.querySelector('svg') !== null && e.textContent.trim().length > 20));
  ok('sardines: the tin says it is full', /7/.test(await done.$eval('[data-tin-count]', (e) => e.textContent)));
  await done.close();
  const partial = await open(VARIANT, `/pt/${CAB.pt}/`, { storage: { [KEY]: JSON.stringify({ items: [], sardines: [PLACES[0].n], foundAt: {} }) } });
  ok('sardines: with fewer than seven no garlands', await partial.$eval('[data-party]', (e) => getComputedStyle(e).display === 'none'));
  await partial.close();
}

if (want('closed')) {
  if (!existsSync(new URL('../../dist/index.html', import.meta.url))) throw new Error('There is no build in dist/.');
  const hub = await open(REAL, `/pt/${PAGES.games.pt}/`);
  const closed = await hub.evaluate(() => ({ card: !!document.querySelector('[data-cabinet-card]'), link: !!document.querySelector('.site-footer a[href*="/gabinete/"]'), mark: document.documentElement.dataset.cabinet ?? '' }));
  ok('closed: no card in the hub, no link in the footer, no mark on the page', !closed.card && !closed.link && closed.mark === '', JSON.stringify(closed));
  await hub.close();
  const word = await open(REAL, await findWordPage('pt'));
  ok('closed: the word is plain text (a span, no button, no underline)', (await word.$('button.cw')) === null && (await word.$eval(`span.cw[data-cw="${item.id}"]`, (e) => getComputedStyle(e).textDecorationLine)) === 'none');
  await word.close();
  const sardine = await open(REAL, placePath(PLACES.find((p) => p.page === 'about') ?? PLACES[0]));
  ok('closed: no sardine', (await sardine.$('.cab-sardine')) === null);
  await sardine.close();
  const page = await open(REAL, `/pt/${CAB.pt}/`);
  ok('closed: the page of the cabinet is noindex and has no preview note', await page.evaluate(() => !!document.querySelector('meta[name=robots][content=noindex]') && document.querySelector('[data-preview-note]').hidden));
  await page.close();
  // The preview: the parameter sets the flag, takes itself out of the address, and everything works in this browser.
  const pre = await open(REAL, `/pt/${PAGES.games.pt}/?kabinet=preview`);
  await wait(400);
  ok('preview: ?kabinet=preview leaves the address clean and sets the flag', await pre.evaluate(() => !location.search.includes('kabinet') && localStorage.getItem('cabinet.preview') === '1' && document.documentElement.dataset.cabinet === 'preview'));
  ok('preview: the card in the hub leads to the cabinet and has its picture; the footer has no link to it', await pre.evaluate(() => { const a = document.querySelector('[data-cabinet-card] a'); return !!a && a.getAttribute('href').includes('/gabinete/') && !!a.querySelector('img.game-card__picture') && !document.querySelector('.site-footer a[href*="/gabinete/"]'); }));
  ok('preview: no text "undefined" in the hub', await pre.evaluate(() => !document.body.innerText.includes('undefined')));
  await pre.goto(`${REAL}${await findWordPage('pt')}`, { waitUntil: 'networkidle0' });
  await wait(400);
  ok('preview: the word of a story is a button', (await pre.$(`button.cw[data-cw="${item.id}"]`)) !== null);
  await pre.goto(`${REAL}/pt/${CAB.pt}/`, { waitUntil: 'networkidle0' });
  await wait(400);
  ok('preview: the cabinet page shows the note "preview, the cabinet is still closed"', await pre.$eval('[data-preview-note]', (e) => !e.hidden && e.textContent.length > 10));
  await pre.goto(`${REAL}/pt/?kabinet=off`, { waitUntil: 'networkidle0' });
  await wait(300);
  ok('preview: ?kabinet=off takes the flag away', await pre.evaluate(() => localStorage.getItem('cabinet.preview') === null && !document.documentElement.dataset.cabinet));
  await pre.close();
}

await browser.close();
console.log(failed === 0 ? '\nAll checks passed.' : `\n${failed} check(s) failed.`);
process.exit(failed === 0 ? 0 : 1);

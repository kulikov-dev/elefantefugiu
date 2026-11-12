// Browser checks of the page "Games" and of the pages of shared results (src/views/GamesView.astro, src/pages/[lang]/[segment]/[rankseg]/[rank].astro, docs/spec.md 5.10) against dist/ served by serve.mjs:   node games.mjs [page state layout rank myths]
//   page    /ru/igry/ in every language: H1, two cards (the picture whole 3:2 with the line that it is AI-made, the name, one line of invitation with the number of the claims taken from the data, the state "Start"), side by side
//           from 768 px and one under the other on a phone; indexable, hreflang, in the sitemap; the preview picture is the two pictures side by side (1200x630, there)
//   state   under a game its state in this browser: "Continue (question 5 of N)", "Continue (pair 4 of 10)", the caption of a finished result; read from what the games keep, nothing written
//   layout  no horizontal scroll at 320 px
//   rank    the page of every range of both games in every language: the page of the game itself (its start), noindex, its own canonical address (not the game: a messenger takes the preview from the canonical address), not in the sitemap, an og:title with the caption of the range,
//           the description of the result (not of the game), the picture of the game as og:image (absolute, there, JPEG 1200x630); the page of the myths and of the order game have their own og:title and og:description, the number of the claims from the data
import { launchBrowser } from './browser.mjs';
import { myths, ui } from './data.mjs';

const base = process.env.BASE_URL || 'http://localhost:4400';
const ONLY = process.argv.slice(2);
const want = (name) => ONLY.length === 0 || ONLY.includes(name);
let failed = 0;
const ok = (name, cond, extra = '') => {
  if (!cond) failed += 1;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await launchBrowser();

const LANGS = ['pt', 'en', 'ru'];
const LOCALE = { pt: 'pt-PT', en: 'en-US', ru: 'ru-RU' };
const GAMES = { pt: 'jogos', en: 'games', ru: 'igry' };
const SEG = { myths: { pt: 'mito-ou-verdade', en: 'myth-or-fact', ru: 'mif-ili-pravda' }, order: { pt: 'o-que-veio-primeiro', en: 'which-came-first', ru: 'chto-bylo-ranshe' } };
const RANKSEG = { pt: 'titulo', en: 'rank', ru: 'zvanie' };
if (myths.length < 2) throw new Error('The suite needs at least two claims in published stories (the field `myth` in src/content/events) (need: two claims).');
const bandsOf = (game, lang) => Object.keys(ui(game === 'myths' ? 'myths' : 'order', lang)).filter((k) => k.startsWith('band_')).map((k) => k.slice(5));
const rankDesc = (game, lang) => {
  if (game === 'order') return ui('order.rank_og_description', lang);
  return ui('myths.rank_og_description', lang);
};
const fill = (tpl, vars) => tpl.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
const sitemap = await fetch(`${base}/sitemap.xml`).then((r) => r.text());
// The address of a build on its own site ("https://elefantefugiu.pt/ru/...") as the address on this server.
const local = (url) => (url ? base + new URL(url).pathname : '');

const open = async ({ lang, path, width = 390, js = true, storage = {} }) => {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 900, isMobile: width < 700, hasTouch: width < 700 });
  if (!js) await page.setJavaScriptEnabled(false);
  page.errors = [];
  page.on('pageerror', (e) => !/ViewTransition opt-in disabled/.test(e.message) && page.errors.push(e.message));
  await page.evaluateOnNewDocument((kept) => {
    try {
      if (!sessionStorage.getItem('qa-fresh')) {
        localStorage.removeItem('order:game');
        localStorage.removeItem('myths:game');
        for (const [k, v] of Object.entries(kept)) localStorage.setItem(k, v);
        sessionStorage.setItem('qa-fresh', '1');
      }
    } catch {}
  }, storage);
  await page.goto(`${base}/${lang}/${path}`, { waitUntil: 'networkidle0' });
  await wait(150);
  return page;
};
const head = (page) =>
  page.evaluate(() => ({
    robots: document.querySelector('meta[name="robots"]')?.content ?? '',
    canonical: document.querySelector('link[rel="canonical"]')?.href ?? '',
    alt: [...document.querySelectorAll('link[rel="alternate"][hreflang]')].map((l) => l.getAttribute('hreflang')).sort().join(),
    ogTitle: document.querySelector('meta[property="og:title"]')?.content ?? '',
    ogDesc: document.querySelector('meta[property="og:description"]')?.content ?? '',
    ogImage: document.querySelector('meta[property="og:image"]')?.content ?? '',
    h1: document.querySelector('h1')?.textContent.trim(),
  }));
// A picture of the site: fetched, a JPEG of 1200x630 (read from the header of the file).
const jpegSize = async (url) => {
  const r = await fetch(url);
  const buf = Buffer.from(await r.arrayBuffer());
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) break;
    const marker = buf[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return { status: r.status, type: r.headers.get('content-type'), width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5), bytes: buf.length };
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return { status: r.status, type: r.headers.get('content-type'), width: 0, height: 0, bytes: buf.length };
};

if (want('page')) {
  for (const lang of LANGS) {
    const page = await open({ lang, path: `${GAMES[lang]}/` });
    const h = await head(page);
    ok(`${lang}: one h1, "${ui('pages.games.title', lang)}", for screen readers only (it repeats the active item of the menu: visually hidden)`, h.h1 === ui('pages.games.title', lang) && (await page.$$eval('h1', (l) => l.length)) === 1 && (await page.$eval('h1', (e) => e.classList.contains('visually-hidden') && e.getBoundingClientRect().width <= 1)), h.h1);
    ok(`${lang}: indexable, hreflang for the three languages, in the sitemap`, !/noindex/.test(h.robots) && ['en', 'pt', 'ru'].every((l) => h.alt.includes(l)) && sitemap.includes(`/${lang}/${GAMES[lang]}/`), `${h.robots} ${h.alt}`);
    const cards = await page.evaluate(() => [...document.querySelectorAll('.game-card')].map((c) => {
      const img = c.querySelector('img');
      const r = img?.getBoundingClientRect();
      return { href: c.getAttribute('href'), name: c.querySelector('h2')?.textContent.trim(), line: c.querySelector('.game-card__line')?.textContent.trim(), state: c.querySelector('[data-state]')?.textContent.trim(), ai: c.querySelector('figcaption')?.textContent.trim(), loaded: !!img && img.complete && img.naturalWidth > 0, ratio: r ? r.width / r.height : 0, natural: img ? img.naturalWidth / img.naturalHeight : 0, alt: img?.getAttribute('alt') };
    }));
    ok(`${lang}: two cards, the myths first, the links lead to the games`, cards.length === 2 && cards[0].href === `/${lang}/${SEG.myths[lang]}/` && cards[1].href === `/${lang}/${SEG.order[lang]}/`, JSON.stringify(cards.map((c) => c.href)));
    ok(`${lang}: the names are the titles of the games`, cards[0].name === ui('pages.myths.title', lang) && cards[1].name === ui('pages.order.title', lang));
    ok(`${lang}: the line of the myths is the invitation, with no number of the pool (a round is ten)`, cards[0].line === ui('games.myths_line', lang) && !/[0-9]/.test(cards[0].line), cards[0].line);
    for (const key of ['home.myths_line', 'myths.og_description_page', 'myths.rank_og_description', 'games.myths_line']) ok(`${lang}: ${key} has no number (the size of the pool is not told, a round is ten)`, ui(key, lang) && !/[0-9{]/.test(ui(key, lang)), ui(key, lang));
    ok(`${lang}: the line of the order game is the invitation`, cards[1].line === ui('games.order_line', lang));
    ok(`${lang}: the state of a game not begun is "${ui('games.start', lang)}"`, cards.every((c) => c.state === ui('games.start', lang)), cards.map((c) => c.state).join(' | '));
    ok(`${lang}: the picture of each game is whole (3:2), decorative, loaded, and nothing is written under it (no line about AI)`, cards.every((c) => c.loaded && Math.abs(c.ratio - 1.5) < 0.03 && Math.abs(c.natural - 1.5) < 0.03 && c.alt === '' && c.ai === undefined), JSON.stringify(cards.map((c) => [c.ratio, c.natural, c.ai])));
    ok(`${lang}: the preview picture is the two pictures side by side, 1200x630`, await (async () => { const s = await jpegSize(local(h.ogImage)); return /\/og-games\/games-[0-9a-f]+\.jpg$/.test(h.ogImage) && s.status === 200 && s.type === 'image/jpeg' && s.width === 1200 && s.height === 630 && s.bytes < 200 * 1024; })(), h.ogImage);
    ok(`${lang}: an og:title and an og:description of its own`, h.ogTitle === ui('games.og_title', lang) && h.ogDesc === ui('games.og_description', lang), `${h.ogTitle} | ${h.ogDesc}`);
    ok(`${lang}: no script error`, page.errors.length === 0, page.errors.join('; '));
    await page.close();
    for (const [width, side] of [[1280, true], [390, false]]) {
      const w = await open({ lang, path: `${GAMES[lang]}/`, width });
      const boxes = await w.$$eval('.game-card', (l) => l.map((c) => { const r = c.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top)]; }));
      ok(`${lang} ${width} px: the cards are ${side ? 'side by side' : 'one under the other'}`, side ? boxes[0][1] === boxes[1][1] && boxes[1][0] > boxes[0][0] : boxes[0][0] === boxes[1][0] && boxes[1][1] > boxes[0][1], JSON.stringify(boxes));
      await w.close();
    }
  }
}

if (want('state')) {
  for (const lang of LANGS) {
    const total = Math.min(10, myths.length);
    const outcomes = (n, hit) => Array.from({ length: total }, (_, i) => (i < n ? (hit ? 'hit' : 'miss') : null));
    const mythsGame = (marks) => JSON.stringify({ order: myths.slice(0, total).map((m) => m.id), marks });
    const orderGame = (picks, hits, index) => JSON.stringify({ pairs: picks.map(() => ['a', 'b']), picks, hits, index });
    const state = async (storage, game) => { const p = await open({ lang, path: `${GAMES[lang]}/`, storage }); const t = await p.$eval(`[data-game-card="${game}"] [data-state]`, (e) => e.textContent.trim()); await p.close(); return t; };
    const k = Math.min(4, total - 1);
    ok(`${lang}: a myths game on its way: "Continue (question ${k + 1} of ${total})"`, (await state({ 'myths:game': mythsGame(outcomes(k, true)) }, 'myths')) === ui('games.continue_myths', lang).replace('{done}', String(k + 1)).replace('{total}', String(total)));
    ok(`${lang}: a finished myths game with every answer right: the caption of the highest range`, (await state({ 'myths:game': mythsGame(outcomes(total, true)) }, 'myths')) === ui('myths.band_high', lang));
    ok(`${lang}: a finished myths game with every answer wrong: the caption of the lowest range`, (await state({ 'myths:game': mythsGame(outcomes(total, false)) }, 'myths')) === ui('myths.band_low', lang));
    ok(`${lang}: a myths game kept of other claims is nothing: "Start"`, (await state({ 'myths:game': JSON.stringify({ order: ['no-such-claim'], marks: [null] }) }, 'myths')) === ui('games.start', lang));
    const ten = (n) => Array.from({ length: 10 }, (_, i) => (i < n ? 0 : null));
    ok(`${lang}: an order round on its way: "Continue (pair 4 of 10)"`, (await state({ 'order:game': orderGame(ten(3), Array.from({ length: 10 }, (_, i) => (i < 3 ? true : null)), 3) }, 'order')) === ui('games.continue_order', lang).replace('{done}', '4').replace('{total}', '10'));
    ok(`${lang}: a new round with nothing answered: "Start"`, (await state({ 'order:game': orderGame(ten(0), Array(10).fill(null), 0) }, 'order')) === ui('games.start', lang));
    ok(`${lang}: a finished round with ten right: the caption of the top range; with none right: the lowest`, (await state({ 'order:game': orderGame(Array(10).fill(0), Array(10).fill(true), 10) }, 'order')) === ui('order.band_top', lang) && (await state({ 'order:game': orderGame(Array(10).fill(0), Array(10).fill(false), 10) }, 'order')) === ui('order.band_low', lang));
    ok(`${lang}: a broken round is nothing: "Start"`, (await state({ 'order:game': '{"pairs":' }, 'order')) === ui('games.start', lang));
    // The page writes nothing.
    const p = await open({ lang, path: `${GAMES[lang]}/`, storage: { 'order:game': orderGame(ten(2), Array.from({ length: 10 }, (_, i) => (i < 2 ? true : null)), 2) } });
    const after = await p.evaluate(() => JSON.stringify(Object.entries(localStorage).filter(([k]) => k === 'order:game' || k === 'myths:game')));
    ok(`${lang}: the page only reads what the games keep`, after === JSON.stringify([['order:game', orderGame(ten(2), Array.from({ length: 10 }, (_, i) => (i < 2 ? true : null)), 2)]]));
    await p.close();
  }
}

if (want('layout')) {
  for (const lang of LANGS) {
    const page = await open({ lang, path: `${GAMES[lang]}/`, width: 320 });
    ok(`${lang} 320 px: no horizontal scroll on the page "Games"`, await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
    await page.close();
  }
}

if (want('rank')) {
  for (const game of ['myths', 'order']) {
    for (const lang of LANGS) {
      const gameHead = await (async () => { const p = await open({ lang, path: `${SEG[game][lang]}/` }); const h = await head(p); await p.close(); return h; })();
      const bands = bandsOf(game, lang);
      ok(`${lang} ${game}: the ranges are the captions of the result (${bands.join(', ')})`, bands.length >= 3);
      for (const band of bands) {
        const path = `${SEG[game][lang]}/${RANKSEG[lang]}/${band}/`;
        const page = await open({ lang, path });
        const h = await head(page);
        const gameUrl = `${base}/${lang}/${SEG[game][lang]}/`;
        const caption = ui(`${game === 'myths' ? 'myths' : 'order'}.band_${band}`, lang);
        const tag = `${lang} ${game} ${band}`;
        ok(`${tag}: the page exists, is the game itself (the same h1 and the start), noindex`, /noindex/.test(h.robots) && h.h1 === gameHead.h1 && (game === 'order' ? await page.$('[data-pair] button') !== null : await page.$('[data-myth]') !== null), `${h.robots} ${h.h1}`);
        ok(`${tag}: noindex, canonical to its own address (not to the game: a messenger takes the preview from the canonical address), not in the sitemap`, local(h.canonical) === `${base}/${lang}/${path}` && !sitemap.includes(`/${path}`), h.canonical);
        ok(`${tag}: og:title has the caption of the range`, h.ogTitle === ui(`${game === 'myths' ? 'myths' : 'order'}.rank_og_title`, lang).replace('{band}', caption), h.ogTitle);
        ok(`${tag}: og:description is the one of the result (not the description of the game, which the game page has)`, h.ogDesc === rankDesc(game, lang) && h.ogDesc !== gameHead.ogDesc && h.ogTitle !== gameHead.ogTitle, `${h.ogDesc}`);
        const size = await jpegSize(local(h.ogImage));
        ok(`${tag}: og:image is the picture of the game: absolute, there, JPEG 1200x630`, /^https?:\/\//.test(h.ogImage) && h.ogImage === gameHead.ogImage && new RegExp(`/og-games/${game}-[0-9a-f]+\\.jpg$`).test(h.ogImage) && size.status === 200 && size.type === 'image/jpeg' && size.width === 1200 && size.height === 630, `${h.ogImage} ${JSON.stringify(size)}`);
        await page.close();
      }
    }
  }
}

if (want('myths')) {
  // The page of the myths: an og:title and an og:description of its own, the number of the claims from the data, the picture of the game as og:image; the pages of the cards keep theirs.
  for (const lang of LANGS) {
    const page = await open({ lang, path: `${SEG.myths[lang]}/` });
    const h = await head(page);
    ok(`${lang}: the myths: og:title and og:description of their own, no number of the pool`, h.ogTitle === ui('myths.og_title_page', lang) && h.ogDesc === ui('myths.og_description_page', lang) && !/[0-9]/.test(h.ogDesc), `${h.ogTitle} | ${h.ogDesc}`);
    ok(`${lang}: the myths: the picture of the game as og:image`, /\/og-games\/myths-[0-9a-f]+\.jpg$/.test(h.ogImage) && (await jpegSize(local(h.ogImage))).width === 1200, h.ogImage);
    await page.close();
    const card = await open({ lang, path: `${SEG.myths[lang]}/${myths[0].id}/` });
    const c = await head(card);
    ok(`${lang}: the page of one claim keeps its own preview (not the picture of the game)`, c.ogTitle !== ui('myths.og_title_page', lang) && !/og-games/.test(c.ogImage), c.ogImage);
    await card.close();
  }
}

await browser.close();
console.log(failed === 0 ? '\nAll "Games" checks passed' : `\n${failed} check(s) failed`);
process.exit(failed === 0 ? 0 : 1);

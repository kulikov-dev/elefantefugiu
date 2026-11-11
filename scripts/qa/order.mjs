// Browser checks of "Which came first?" (src/views/OrderView.astro, src/scripts/order.ts, src/lib/order.ts, /{lang}/order.json) against dist/ served by serve.mjs:   node order.mjs [page question answer result family nojs nav layout]
//   page      the page in every language: one h1, the switch of the two games with the current one marked, the lead, the address, the footer link, indexable with hreflang and an og of its own
//   question  ten pairs; a card has a picture and a title and no year, no name of an epoch (no epoch colour either); two cards, side by side from 640 px and one under the other on a phone
//   answer    a press marks the card pressed, turns both off, shows both dates (those of the data), exactly one mark "First" (on the story that came first), the years between, "You got it" or "Not this time",
//             a link to each story, Next; nothing else is shown before the press
//   result    after ten answers the screen of the game (a title by the range, the tiles, the misses as pairs with links, Share, Another round); one counter event `order-finish` and no other; nothing is kept in the browser;
//             "Another round" gives other pairs
//   family    in the mode "all" every story of every pair carries the age label "all" (the same rule as "Surprise me")
//   nojs      without JavaScript: the line about JavaScript and the link to the myths, no game
//   nav       the tab "Games" is current on both game pages and leads to the myths; the switch has the two links; the footer has both
//   layout    no horizontal scroll at 320 px (a question, an answered question, the result)
import { launchBrowser } from './browser.mjs';
import { epochs, published, ui } from './data.mjs';
import { hookGivesDate } from '../../src/lib/order-hint.mjs';

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
const SEG = { pt: 'o-que-veio-primeiro', en: 'which-came-first', ru: 'chto-bylo-ranshe' };
const MYTHS = { pt: 'mito-ou-verdade', en: 'myth-or-fact', ru: 'mif-ili-pravda' };
const pageUrl = (lang) => `${base}/${lang}/${SEG[lang]}/`;
const ROUND = 10;

const open = async ({ lang = 'pt', width = 390, js = true, family = '' } = {}) => {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 900, isMobile: width < 700, hasTouch: width < 700 });
  if (!js) await page.setJavaScriptEnabled(false);
  page.errors = [];
  page.on('pageerror', (e) => !/ViewTransition opt-in disabled/.test(e.message) && page.errors.push(e.message));
  await page.evaluateOnNewDocument((mode) => {
    window.__counted = [];
    if (mode) try { localStorage.setItem('family', mode); } catch {}
    // The counter of the site is not loaded on a local address: a stand-in records what the page would send (the real build keeps its own, the recorder takes the events only).
    const stub = {};
    Object.defineProperty(stub, 'count', { get: () => (v) => { if (v && v.event) window.__counted.push(v); }, set: () => {} });
    Object.defineProperty(window, 'goatcounter', { configurable: true, get: () => stub, set: () => {} });
  }, family);
  await page.goto(pageUrl(lang), { waitUntil: 'networkidle0' });
  if (js) await page.waitForSelector('[data-pair] button', { timeout: 10000 });
  await wait(150);
  return page;
};
const visible = (page, selector) => page.evaluate((s) => { const el = document.querySelector(s); return el ? el.checkVisibility() && el.getBoundingClientRect().height > 0 : false; }, selector);
const listOf = (lang) => fetch(`${base}/${lang}/order.json`).then((r) => r.json());
// The two stories of the open pair, found in the list by their titles.
const pairOf = async (page, list) => {
  const titles = await page.$$eval('[data-pair] .order__title', (l) => l.map((x) => x.textContent));
  return titles.map((t) => list.find((s) => s.title === t));
};
const press = async (page, k) => {
  await page.$$eval('[data-pair] button', (b, i) => b[i].click(), k);
  await wait(60);
};
const next = async (page) => {
  await page.click('[data-next]');
  await wait(60);
};
// Plays a round with the first card each time; returns the stories of every pair.
const playRound = async (page, list) => {
  const pairs = [];
  for (let i = 0; i < ROUND; i += 1) {
    if (!(await visible(page, '[data-pair]'))) break;
    pairs.push(await pairOf(page, list));
    await press(page, 0);
    await next(page);
  }
  return pairs;
};
const fits = (page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

if (want('page')) {
  for (const lang of LANGS) {
    const page = await open({ lang });
    ok(`${lang}: one h1 and the switch of the two games`, (await page.$$eval('h1', (l) => l.length)) === 1 && (await page.$$eval('.games-switch a', (l) => l.length)) === 2);
    const head = await page.evaluate(() => ({
      robots: document.querySelector('meta[name="robots"]')?.content ?? '',
      alt: [...document.querySelectorAll('link[rel="alternate"][hreflang]')].map((l) => l.getAttribute('hreflang')).sort().join(),
      og: document.querySelector('meta[property="og:title"]')?.content ?? '',
      ogd: document.querySelector('meta[property="og:description"]')?.content ?? '',
      title: document.title,
      foot: [...document.querySelectorAll('.site-footer a')].map((a) => a.getAttribute('href')),
      lead: document.querySelector('.order__lead')?.textContent.trim(),
    }));
    ok(`${lang}: indexable, hreflang for the three languages`, !/noindex/.test(head.robots) && head.alt.includes('pt') && head.alt.includes('en') && head.alt.includes('ru'), `${head.robots} ${head.alt}`);
    ok(`${lang}: an og:title and an og:description of its own`, head.og.length > 10 && head.ogd.length > 20 && head.og !== head.ogd, `${head.og} | ${head.ogd}`);
    ok(`${lang}: the footer links to the game and to the myths`, head.foot.includes(`/${lang}/${SEG[lang]}/`) && head.foot.includes(`/${lang}/${MYTHS[lang]}/`), head.foot.join(' '));
    ok(`${lang}: the lead is there`, !!head.lead && head.lead.length > 20);
    ok(`${lang}: no script error`, page.errors.length === 0, page.errors.join('; '));
    await page.close();
  }
  const ru = await open({ lang: 'ru' });
  ok('ru: the lead is the one of the owner', (await ru.$eval('.order__lead', (e) => e.textContent.trim())) === 'Два события из прошлого Португалии. Какое случилось раньше? Десять пар.');
  await ru.close();
}

if (want('question')) {
  for (const lang of LANGS) {
    const list = await listOf(lang);
    const page = await open({ lang });
    ok(`${lang}: the list is not empty`, list.length > 2 * ROUND, String(list.length));
    const q = await page.evaluate(() => ({
      step: document.querySelector('[data-step]')?.textContent.trim(),
      tiles: document.querySelectorAll('[data-squares] .sq').length,
      cards: [...document.querySelectorAll('[data-pair] .order__card')].map((c) => ({ text: c.innerText, img: !!c.querySelector('img'), alt: c.querySelector('img')?.getAttribute('alt'), attrs: [...c.attributes].map((a) => a.name).join(), disabled: c.disabled })),
      answer: document.querySelector('[data-answer]')?.checkVisibility(),
      h2: document.querySelectorAll('.order h2:not([data-score])').length,
    }));
    ok(`${lang}: "Pair 1 of ${ROUND}" and ${ROUND} tiles`, /\b1\b.*\b10\b/.test(q.step) && q.tiles === ROUND, `${q.step} ${q.tiles}`);
    ok(`${lang}: two cards with a picture and a title, enabled`, q.cards.length === 2 && q.cards.every((c) => c.img && c.alt === '' && c.text.trim().length > 3 && !c.disabled));
    // A title may hold a number of its own ("A bridge that serves 1900 years"): what must not be on a card is anything but the title, so no date.
    // A card is its title and the line under it (the hook, or order_hint) when the story has one; a hook that gives the date away is not in the list at all.
    const lines = q.cards.map((c) => c.text.trim().split('\n').map((x) => x.trim()).filter(Boolean));
    ok(`${lang}: a card is its title and the line under it, nothing more (no year, no date)`, lines.every(([t, h, ...rest]) => rest.length === 0 && list.some((s) => s.title === t && (s.hint ?? undefined) === h)), q.cards.map((c) => c.text).join(' | '));
    ok(`${lang}: no line under a title gives the date away (a year, a century, a Roman numeral, an era), unless it is the order_hint of the story`, list.every((s) => !s.hint || !hookGivesDate(s.hint) || published.some((e) => e.id === s.id && e.order_hint?.[lang] === s.hint)), list.filter((s) => s.hint && hookGivesDate(s.hint)).map((s) => s.id).join());
    ok(`${lang}: the line is smaller and muted, two lines at most (the hook is not cut by the size)`, await page.evaluate(() => { const h = document.querySelector('.order__hint'); if (!h) return true; const t = document.querySelector('.order__title'); const sh = getComputedStyle(h); return parseFloat(sh.fontSize) < parseFloat(getComputedStyle(t).fontSize) && sh.color !== getComputedStyle(t).color && /2/.test(sh.webkitLineClamp || sh.lineClamp) && h.getBoundingClientRect().height <= 2 * parseFloat(sh.lineHeight) + parseFloat(sh.paddingBottom) + 1; }));
    const names = epochs.flatMap((e) => Object.values(e.name ?? {}).filter((n) => typeof n === 'string'));
    ok(`${lang}: no name of an epoch on a card`, q.cards.every((c) => names.every((n) => !c.text.includes(n))));
    ok(`${lang}: no epoch mark on a card or in the pair (no data-epoch, no colour of an epoch)`, (await page.$$eval('[data-pair] [data-epoch], [data-pair] [class*="epoch"], [data-pair] [style*="epoch"]', (l) => l.length)) === 0);
    ok(`${lang}: no second heading above the pair, no answer before the press`, q.h2 === 0 && !q.answer);
    ok(`${lang}: the dates are not in the page before the press`, (await page.$$eval('[data-pair] .order__date, [data-pair] .order__when, [data-pair] .order__first', (l) => l.length)) === 0);
    await page.close();
  }
  // A story whose label has two years ("1906 e 2020") is in the game with the first year only.
  for (const lang of LANGS) {
    const list = await listOf(lang);
    const two = published.filter((e) => Object.values(e.year_label ?? {}).some((l) => /\b\d{4}\b[^\d]*\s(e|and|и)\s[^\d]*\b\d{4}\b/u.test(String(l))));
    ok(`${lang}: a story with two years in its label is in the list, with its first year as the date`, two.every((e) => { const s = list.find((x) => x.id === e.id); return s && s.date === String(e.year) && s.year === e.year; }), two.map((e) => e.id).join());
  }
  const narrow = await open({ lang: 'pt', width: 390 });
  const tops = await narrow.$$eval('[data-pair] .order__card', (l) => l.map((c) => { const r = c.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width)]; }));
  ok('phone: the cards are one under the other', tops.length === 2 && tops[0][0] === tops[1][0] && tops[1][1] > tops[0][1], JSON.stringify(tops));
  await narrow.close();
  const wide = await open({ lang: 'pt', width: 1280 });
  const side = await wide.$$eval('[data-pair] .order__card', (l) => l.map((c) => { const r = c.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top)]; }));
  ok('1280 px: the cards are side by side', side.length === 2 && side[0][1] === side[1][1] && side[1][0] > side[0][0], JSON.stringify(side));
  await wide.close();
}

if (want('answer')) {
  for (const lang of LANGS) {
    const list = await listOf(lang);
    const page = await open({ lang });
    const [a, b] = await pairOf(page, list);
    ok(`${lang}: both stories of the pair are in the list of the data`, !!a && !!b);
    const firstId = a.year <= b.year ? a.id : b.id;
    const stored = await page.evaluate(() => JSON.stringify(Object.entries(localStorage)));
    await press(page, 1);
    const r = await page.evaluate(() => ({
      pressed: [...document.querySelectorAll('[data-pair] .order__card')].map((c) => c.getAttribute('aria-pressed')),
      disabled: [...document.querySelectorAll('[data-pair] .order__card')].map((c) => c.disabled),
      dates: [...document.querySelectorAll('[data-pair] .order__date')].map((d) => d.textContent.trim()),
      marks: [...document.querySelectorAll('[data-pair] .order__first')].map((m) => m.closest('.order__cell')?.querySelector('.order__title')?.textContent),
      outcome: document.querySelector('[data-outcome]')?.textContent.trim(),
      between: document.querySelector('[data-between]')?.textContent.trim(),
      links: [...document.querySelectorAll('[data-pair] .order__read')].map((x) => x.getAttribute('href')),
      next: document.querySelector('[data-next]')?.checkVisibility(),
      tiles: [...document.querySelectorAll('[data-squares] .sq')].slice(0, 2).map((s) => s.className),
    }));
    ok(`${lang}: the pressed card is marked and both are off`, r.pressed.join() === 'false,true' && r.disabled.every(Boolean), r.pressed.join());
    ok(`${lang}: both dates are shown, as the data has them`, r.dates.join() === [a.date, b.date].join(), `${r.dates.join(' | ')} vs ${a.date} | ${b.date}`);
    ok(`${lang}: exactly one mark "First", on the story that came first`, r.marks.length === 1 && r.marks[0] === list.find((s) => s.id === firstId).title, r.marks.join());
    ok(`${lang}: the years between are given`, /\d/.test(r.between), r.between);
    ok(`${lang}: a line says whether the guess was right`, [ui('order.outcome_hit', lang), ui('order.outcome_miss', lang)].includes(r.outcome), r.outcome);
    ok(`${lang}: a link to each story`, r.links.length === 2 && r.links.join() === [a.href, b.href].join(), r.links.join());
    ok(`${lang}: Next is shown and the tile of the pair is filled`, r.next && /sq--(hit|miss)/.test(r.tiles[0]), r.tiles.join());
    ok(`${lang}: a press keeps nothing in the browser`, (await page.evaluate(() => JSON.stringify(Object.entries(localStorage)))) === stored);
    ok(`${lang}: a pressed card does not send an event`, (await page.evaluate(() => window.__counted.length)) === 0);
    await page.close();
  }
  // The mark "First" is on the earlier story whichever card is pressed, and a right pick says so.
  const list = await listOf('en');
  const page = await open({ lang: 'en' });
  const [a, b] = await pairOf(page, list);
  const right = a.year <= b.year ? 0 : 1;
  await press(page, right);
  ok('en: the right pick says "You got it", the tile is a hit', (await page.$eval('[data-outcome]', (e) => e.textContent.trim())) === 'You got it' && (await page.$eval('[data-squares] .sq', (e) => e.classList.contains('sq--hit'))));
  await page.close();
  const wrong = await open({ lang: 'en' });
  const [c, d] = await pairOf(wrong, list);
  await press(wrong, c.year <= d.year ? 1 : 0);
  ok('en: the wrong pick says "Not this time", the tile is a miss', (await wrong.$eval('[data-outcome]', (e) => e.textContent.trim())) === 'Not this time' && (await wrong.$eval('[data-squares] .sq', (e) => e.classList.contains('sq--miss'))));
  await wrong.close();
}

if (want('result')) {
  for (const lang of LANGS) {
    const list = await listOf(lang);
    const page = await open({ lang });
    const stored = await page.evaluate(() => JSON.stringify(Object.entries(localStorage)));
    ok(`${lang}: the result is not shown before the end`, !(await visible(page, '[data-final]')));
    const pairs = await playRound(page, list);
    ok(`${lang}: ten pairs in a round`, pairs.length === ROUND, String(pairs.length));
    ok(`${lang}: the result screen after ten answers, the game is gone`, (await visible(page, '[data-final]')) && !(await visible(page, '[data-pair]')));
    const fin = await page.evaluate(() => ({
      title: document.querySelector('[data-score]')?.textContent.trim(),
      tiles: [...document.querySelectorAll('[data-final-squares] .sq')].map((e) => e.className),
      buttons: [...document.querySelectorAll('[data-final] .button')].map((b) => b.textContent.trim()),
      misses: [...document.querySelectorAll('[data-misses] li')].map((li) => [...li.querySelectorAll('a')].length),
      missText: [...document.querySelectorAll('[data-misses] li')].map((li) => li.textContent),
      focus: document.activeElement?.hasAttribute('data-score'),
      digits: /\d/.test(document.querySelector('[data-final]').innerText.replace(/\b10\b/, '')),
    }));
    ok(`${lang}: a title by the range, no score, no percent`, fin.title.length > 5 && !/[\d%]/.test(fin.title), fin.title);
    ok(`${lang}: ten tiles, a hit or a miss each`, fin.tiles.length === ROUND && fin.tiles.every((c) => /sq--(hit|miss)/.test(c)));
    ok(`${lang}: Share, Another round and a link on; focus on the title`, fin.buttons.length === 3 && fin.focus, fin.buttons.join(' | '));
    ok(`${lang}: the misses are pairs with two links each`, fin.misses.length === fin.tiles.filter((c) => c.includes('sq--miss')).length && fin.misses.every((n) => n === 2), fin.misses.join());
    // Each line of the misses: the story that came first, then the other, each with its date (as the data has it).
    const byTitle = new Map(list.map((s) => [s.title, s]));
    const linesOk = fin.missText.every((text) => {
      const [x, y] = text.split(' — ').map((part) => { const m = /^(.*) \((.+)\)$/.exec(part); return m && { story: byTitle.get(m[1]), date: m[2] }; });
      return x && y && x.story && y.story && x.date === x.story.date && y.date === y.story.date && x.story.year <= y.story.year;
    });
    ok(`${lang}: every miss reads "first (date) — second (date)", the earlier story first`, fin.missText.length === 0 || linesOk, fin.missText.join(' | '));
    const counted = await page.evaluate(() => window.__counted.map((c) => c.path));
    ok(`${lang}: one counter event, order-finish, and no other`, counted.length === 1 && counted[0] === 'order-finish', counted.join());
    ok(`${lang}: nothing is kept in the browser`, (await page.evaluate(() => JSON.stringify(Object.entries(localStorage)))) === stored);
    await page.close();
  }
  const list = await listOf('pt');
  const page = await open({ lang: 'pt' });
  const first = await playRound(page, list);
  await page.click('[data-again]');
  await wait(200);
  ok('pt: "Another round" brings the game back, with the first pair of the new round', (await visible(page, '[data-pair]')) && !(await visible(page, '[data-final]')));
  const second = await playRound(page, list);
  const key = (r) => r.map((p) => p.map((s) => s.id).sort().join('+')).join();
  ok('pt: the new round has other pairs', key(first) !== key(second));
  ok('pt: a second result, a second event', (await page.evaluate(() => window.__counted.length)) === 2);
  await page.close();
}

if (want('family')) {
  for (const mode of ['all', '12']) {
    const list = await listOf('pt');
    const page = await open({ lang: 'pt', family: mode });
    const allowed = mode === 'all' ? ['all'] : ['all', '12'];
    let bad = 0;
    for (let round = 0; round < 3; round += 1) {
      const pairs = await playRound(page, list);
      bad += pairs.flat().filter((s) => !allowed.includes(s.minAge)).length;
      if (round < 2) {
        await page.click('[data-again]');
        await wait(200);
      }
    }
    ok(`family mode "${mode}": every story of three rounds has an age label the mode allows`, bad === 0, `${bad} stories outside`);
    await page.close();
  }
}

if (want('nojs')) {
  for (const lang of LANGS) {
    const page = await open({ lang, js: false });
    const r = await page.evaluate(() => ({ line: document.querySelector('.order__nojs')?.checkVisibility(), href: document.querySelector('.order__nojs a')?.getAttribute('href'), game: document.querySelector('[data-game]')?.checkVisibility(), result: document.querySelector('[data-final]')?.checkVisibility() }));
    ok(`${lang}: without JavaScript the line and the link to the myths, no game`, r.line && r.href === `/${lang}/${MYTHS[lang]}/` && !r.game && !r.result, JSON.stringify(r));
    await page.close();
  }
  const ru = await open({ lang: 'ru', js: false });
  ok('ru: the line says the game needs JavaScript', (await ru.$eval('.order__nojs', (e) => e.textContent)).includes('Игра работает с включённым JavaScript'));
  await ru.close();
}

if (want('nav')) {
  for (const lang of LANGS) {
    for (const [name, seg] of [['order', SEG[lang]], ['myths', MYTHS[lang]]]) {
      const page = await browser.newPage();
      await page.setViewport({ width: 390, height: 900, isMobile: true, hasTouch: true });
      await page.goto(`${base}/${lang}/${seg}/`, { waitUntil: 'networkidle0' });
      const n = await page.evaluate(() => ({
        tab: [...document.querySelectorAll('.tabbar a[aria-current="page"]')].map((a) => ({ href: a.getAttribute('href'), text: a.textContent.trim() })),
        tabs: document.querySelectorAll('.tabbar a').length,
        sw: [...document.querySelectorAll('.games-switch a')].map((a) => ({ href: a.getAttribute('href'), cur: a.getAttribute('aria-current') })),
      }));
      ok(`${lang} ${name}: the tab "Games" is the current one and leads to the myths`, n.tab.length === 1 && n.tab[0].href === `/${lang}/${MYTHS[lang]}/` && n.tabs === 5, JSON.stringify(n.tab));
      ok(`${lang} ${name}: the tab is called "Games"`, n.tab[0]?.text === { pt: 'Jogos', en: 'Games', ru: 'Игры' }[lang], n.tab[0]?.text);
      ok(`${lang} ${name}: the switch has the two games, the current one marked`, n.sw.length === 2 && n.sw.filter((x) => x.cur === 'page').length === 1 && n.sw.find((x) => x.cur === 'page').href === `/${lang}/${seg}/` && n.sw.some((x) => x.href === `/${lang}/${SEG[lang]}/`) && n.sw.some((x) => x.href === `/${lang}/${MYTHS[lang]}/`), JSON.stringify(n.sw));
      await page.close();
    }
  }
  // The menu of the header (from 768 px): "Games" between "Map" and "Surprise me", current on both game pages, leads to the myths.
  for (const lang of LANGS) {
    for (const seg of [SEG[lang], MYTHS[lang]]) {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 900 });
      await page.goto(`${base}/${lang}/${seg}/`, { waitUntil: 'networkidle0' });
      const m = await page.evaluate(() => [...document.querySelectorAll('.site-nav a')].map((a) => ({ href: a.getAttribute('href'), cur: a.getAttribute('aria-current') })));
      const at = m.findIndex((x) => x.href === `/${lang}/${MYTHS[lang]}/`);
      ok(`${lang} ${seg}: the header menu has "Games" (to the myths) between the map and "Surprise me", current`, at === 2 && m.length === 4 && m[at].cur === 'page' && m.filter((x) => x.cur).length === 1 && m[3].href.includes(lang === 'pt' ? 'surpreende' : lang === 'en' ? 'surprise' : 'udivi'), JSON.stringify(m));
      await page.close();
    }
  }
  const home = await browser.newPage();
  await home.goto(`${base}/pt/`, { waitUntil: 'networkidle0' });
  ok('home: nothing about the new game on the home page', (await home.$$eval(`a[href="/pt/${SEG.pt}/"]:not(.site-footer a)`, (l) => l.length)) === 0);
  await home.close();
}

if (want('layout')) {
  for (const lang of LANGS) {
    const list = await listOf(lang);
    const page = await open({ lang, width: 320 });
    ok(`${lang} 320 px: no horizontal scroll on a question`, await fits(page), String(await page.evaluate(() => document.documentElement.scrollWidth)));
    await press(page, 0);
    ok(`${lang} 320 px: no horizontal scroll on an answered question`, await fits(page));
    await next(page);
    for (let i = 1; i < ROUND; i += 1) {
      await press(page, 0);
      await next(page);
    }
    ok(`${lang} 320 px: no horizontal scroll on the result`, await fits(page), String(await page.evaluate(() => document.documentElement.scrollWidth)));
    const low = await page.$$eval('[data-final] .button, .tabbar a', (l) => l.filter((b) => b.getBoundingClientRect().height < 44).length);
    ok(`${lang} 320 px: the buttons of the result are at least 44 px high`, low === 0);
    void list;
    await page.close();
  }
}

await browser.close();
console.log(failed === 0 ? '\nAll "Which came first?" checks passed' : `\n${failed} check(s) failed`);
process.exit(failed === 0 ? 0 : 1);

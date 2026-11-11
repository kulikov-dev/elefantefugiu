// Browser checks of "Which came first?" (src/views/OrderView.astro, src/scripts/order.ts, src/lib/order.ts, /{lang}/order.json) against dist/ served by serve.mjs:   node order.mjs [page question answer resume result family nojs nav scroll layout]
//   page      the page in every language: one h1, the switch of the two games with the current one marked, the lead, the address, the footer link, indexable with hreflang and an og of its own
//   question  ten pairs; a card has a picture and a title and no year, no name of an epoch (no epoch colour either); two cards, side by side from 640 px and one under the other on a phone
//   answer    a press frames the card pressed and marks it "Your pick" (no dark fill); after it every card is a link to its story (the whole card, "Whole story →" at its foot), both dates, exactly one mark "First", the label of the verdict in the
//             colours of the myths with the years between beside it as plain text (no line of what came first, no separate plates, no small "Read" links), Next; nothing else is shown before the press
//   resume    the round is kept (`order:game`): back from a story, a reload, the pair answered, a finished round shows its result (no second event) until "Another round"; a story that is gone: a new round, silently
//   result    after ten answers the screen of the game (a title by the range, the tiles, the misses as pairs with links, Share, Another round); one counter event `order-finish` and no other; nothing is kept in the browser;
//             "Another round" gives other pairs
//   family    in the mode "all" every story of every pair carries the age label "all" (the same rule as "Surprise me")
//   nojs      without JavaScript: the line about JavaScript and the link to the myths, no game
//   nav       the tab "Games" is current on both game pages and leads to the myths; the switch has the two links; the footer has both
//   scroll    after Next and Another round: the focus on the first card, the scroll to "Pair N of 10" (at once under reduced motion), both cards above the tab bar at 390 x 844
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
const GAMES = { pt: 'jogos', en: 'games', ru: 'igry' };
const RANKSEG = { pt: 'titulo', en: 'rank', ru: 'zvanie' };
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
    window.__copied = '';
    // The browser is shared by the pages of the suite: the first load of a page starts without a round kept by an earlier one (a reload, or a return to the page, keeps its own).
    try { if (!sessionStorage.getItem('qa-fresh')) { localStorage.removeItem('order:game'); sessionStorage.setItem('qa-fresh', '1'); } } catch {}
    try { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }); Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t) => { window.__copied = t; } }, configurable: true }); } catch {}
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
      image: document.querySelector('meta[property="og:image"]')?.content ?? '',
      ogd: document.querySelector('meta[property="og:description"]')?.content ?? '',
      title: document.title,
      foot: [...document.querySelectorAll('.site-footer a')].map((a) => a.getAttribute('href')),
      lead: document.querySelector('.order__lead')?.textContent.trim(),
    }));
    ok(`${lang}: indexable, hreflang for the three languages`, !/noindex/.test(head.robots) && head.alt.includes('pt') && head.alt.includes('en') && head.alt.includes('ru'), `${head.robots} ${head.alt}`);
    ok(`${lang}: an og:title and an og:description of its own, the picture of the game as og:image`, head.og.length > 10 && head.ogd.length > 20 && head.og !== head.ogd && /\/og-games\/order-[0-9a-f]+\.jpg$/.test(head.image), `${head.og} | ${head.ogd} | ${head.image}`);
    ok(`${lang}: the footer has one link, "Games", for both games`, head.foot.includes(`/${lang}/${GAMES[lang]}/`) && !head.foot.includes(`/${lang}/${SEG[lang]}/`) && !head.foot.includes(`/${lang}/${MYTHS[lang]}/`), head.foot.join(' '));
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
    const first = a.year <= b.year ? a : b;
    const later = first === a ? b : a;
    const others = () => page.evaluate(() => JSON.stringify(Object.entries(localStorage).filter(([k]) => k !== 'order:game')));
    const stored = await others();
    await press(page, 1);
    const r = await page.evaluate(() => {
      const probe = (css) => { const e = document.createElement('i'); e.style.color = css; document.body.append(e); const c = getComputedStyle(e).color; e.remove(); return c; };
      const luminance = (rgb) => { const m = /rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/.exec(rgb); return m ? { l: (0.299 * m[1] + 0.587 * m[2] + 0.114 * m[3]) / 255, alpha: m[4] === undefined ? 1 : Number(m[4]) } : { l: 1, alpha: 0 }; };
      const cards = [...document.querySelectorAll('[data-pair] .order__card')];
const picked = cards.find((c) => c.getAttribute('data-picked') === 'true');
      const title = picked.querySelector('.order__title');
      const verdict = document.querySelector('[data-verdict] .verdict');
      const between = document.querySelector('[data-between]');
      const body = getComputedStyle(document.body);
      return {
pressed: cards.map((c) => c.getAttribute('data-picked')),
tags: cards.map((c) => c.tagName),
        dates: [...document.querySelectorAll('[data-pair] .order__date')].map((d) => d.textContent.trim()),
        marks: [...document.querySelectorAll('[data-pair] .order__first')].map((m) => m.closest('.order__cell')?.querySelector('.order__title')?.textContent),
        yours: [...document.querySelectorAll('.order__yours')].map((y) => y.closest('.order__card') === picked ? y.textContent.trim() : 'other'),
        border: getComputedStyle(picked).borderTopColor,
        borderWidth: getComputedStyle(picked).borderTopWidth,
        accent: probe('var(--color-accent)'),
        titleBg: luminance(getComputedStyle(title).backgroundColor),
        titleInk: luminance(getComputedStyle(title).color).l,
        cardBg: luminance(getComputedStyle(picked).backgroundColor),
        verdictClass: verdict?.className,
        verdictText: verdict?.textContent.trim(),
        verdictIcon: !!verdict?.querySelector('svg'),
        verdictColor: verdict ? getComputedStyle(verdict).color : '',
        verdictInk: { fact: probe('var(--color-verdict-fact-ink)'), myth: probe('var(--color-verdict-myth-ink)') },
        row: { same: document.querySelector('.order__verdict').contains(verdict) && document.querySelector('.order__verdict').contains(between), order: verdict.compareDocumentPosition(between) & 4 },
        betweenColor: getComputedStyle(between).color,
        betweenWeight: Number(getComputedStyle(between).fontWeight),
        bodyColor: body.color,
        between: between.textContent.trim(),
        links: cards.map((c) => ({ href: c.getAttribute('href'), more: c.querySelector('.order__more')?.textContent, thumb: !!c.querySelector('img.order__thumb'), title: !!c.querySelector('.order__title'), buttons: c.querySelectorAll('button').length })),
        legacy: document.querySelectorAll('.order__read, .story-plate, [data-plates], [data-outcome], [data-pair] button').length,
        next: document.querySelector('[data-next]')?.checkVisibility(),
        tiles: [...document.querySelectorAll('[data-squares] .sq')].slice(0, 2).map((s) => s.className),
        kept: JSON.parse(localStorage.getItem('order:game') ?? 'null'),
      };
    });
    const hit = first === b;
    ok(`${lang}: the pressed card is marked, and both cards are links now (no buttons left)`, r.pressed.join() === 'false,true' && r.tags.every((t) => t === 'A'), r.pressed.join() + ' ' + r.tags.join());
    ok(`${lang}: the pressed card has a frame of 2 px in the colour of a link and the small mark "Your pick" over its title, only on it`, r.border === r.accent && r.borderWidth === '2px' && r.yours.join() === ui('order.yours', lang), `${r.border} ${r.accent} ${r.borderWidth} ${r.yours.join()}`);
    ok(`${lang}: the title of the pressed card is on the surface of the card: no dark fill`, (r.titleBg.alpha === 0 || r.titleBg.l > 0.5 === r.cardBg.l > 0.5) && (r.titleBg.alpha === 0 || Math.abs(r.titleBg.l - r.cardBg.l) < 0.15) && r.titleInk < 0.5, JSON.stringify([r.titleBg, r.cardBg, r.titleInk]));
    ok(`${lang}: both dates are shown, as the data has them`, r.dates.join() === [a.date, b.date].join(), `${r.dates.join(" | ")} vs ${a.date} | ${b.date}`);
    ok(`${lang}: exactly one mark "First", on the story that came first`, r.marks.length === 1 && r.marks[0] === first.title, r.marks.join());
    ok(`${lang}: the label of the verdict is the one of the myths: a check on green for a right guess, a cross on terracotta for a wrong one`, r.verdictClass === `verdict verdict--${hit ? "fact" : "myth"}` && r.verdictText === ui(`order.verdict_${hit ? "hit" : "miss"}`, lang) && r.verdictIcon && r.verdictColor === r.verdictInk[hit ? 'fact' : 'myth'], `${r.verdictClass} ${r.verdictText} ${r.verdictColor}`);
    ok(`${lang}: no line of what came first: the answer is the label of the verdict with the years between beside it, in one row`, r.row.same && r.row.order > 0 && r.legacy === 0, JSON.stringify(r.row) + ' ' + r.legacy);
    ok(`${lang}: the years between are plain text beside the label (not grey, not bold)`, /\d/.test(r.between) && r.betweenColor === r.bodyColor && r.betweenWeight < 600, `${r.between} ${r.betweenColor} ${r.bodyColor}`);
    ok(`${lang}: each card is the link to its own story (the whole card: picture, title, dates), with "Whole story →" at its foot; no plates, no small "Read" links`, r.links.length === 2 && r.links[0].href === a.href && r.links[1].href === b.href && r.links.every((x) => x.more === ui('myths.full_story', lang) && x.thumb && x.title && x.buttons === 0), JSON.stringify(r.links));
    ok(`${lang}: Next is shown and the tile of the pair is filled`, r.next && /sq--(hit|miss)/.test(r.tiles[0]), r.tiles.join());
    ok(`${lang}: a press keeps only the round (order:game: the pairs, the pick, whether it was right), nothing else in the browser`, r.kept && r.kept.picks[0] === 1 && r.kept.hits[0] === hit && r.kept.index === 0 && (await others()) === stored, JSON.stringify(r.kept));
    ok(`${lang}: a pressed card does not send an event`, (await page.evaluate(() => window.__counted.length)) === 0);
    await page.close();
  }
  // The right pick says so, the wrong one too: the label and the tile.
  const list = await listOf('en');
  const page = await open({ lang: 'en' });
  const [a, b] = await pairOf(page, list);
  const right = a.year <= b.year ? 0 : 1;
  await press(page, right);
  ok('en: the right pick: the label "You got it" on green, the tile is a hit', (await page.$eval('[data-verdict] .verdict', (e) => e.textContent.trim() + ' ' + e.className)) === 'You got it verdict verdict--fact' && (await page.$eval('[data-squares] .sq', (e) => e.classList.contains('sq--hit'))));
  await page.close();
  const wrong = await open({ lang: 'en' });
  const [c, d] = await pairOf(wrong, list);
  await press(wrong, c.year <= d.year ? 1 : 0);
  ok('en: the wrong pick: the label "Not this time" on terracotta, the tile is a miss', (await wrong.$eval('[data-verdict] .verdict', (e) => e.textContent.trim() + ' ' + e.className)) === 'Not this time verdict verdict--myth' && (await wrong.$eval('[data-squares] .sq', (e) => e.classList.contains('sq--miss'))));
  await wrong.close();
}

if (want('resume')) {
  for (const lang of LANGS) {
    const list = await listOf(lang);
    const page = await open({ lang });
    const stepText = () => page.$eval('[data-step]', (e) => e.textContent.trim());
    const answered = () => page.evaluate(() => !document.querySelector('[data-answer]').hidden);
    const titles = () => page.$$eval('[data-pair] .order__title', (l) => l.map((x) => x.textContent));
    // Three pairs answered, the fourth pressed and left open.
    const done = [];
    for (let i = 0; i < 3; i += 1) { done.push(await pairOf(page, list)); await press(page, 0); await next(page); }
    const fourth = await pairOf(page, list);
    await press(page, 1);
    const before = { step: await stepText(), titles: await titles(), tiles: await page.$$eval('[data-squares] .sq', (l) => l.map((x) => x.className)) };
    // To a story and back.
    const href = await page.$eval('[data-pair] a.order__card', (a) => a.getAttribute('href'));
    await page.goto(base + href, { waitUntil: 'networkidle0' });
    await page.goBack({ waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-pair] .order__card', { timeout: 10000 });
    await wait(200);
    ok(`${lang}: back from a story the same pair is there, answered, with its answer`, (await stepText()) === before.step && JSON.stringify(await titles()) === JSON.stringify(before.titles) && (await answered()) && (await page.$eval('[data-pair] .order__card[data-picked="true"]', () => true)), `${await stepText()} ${before.step}`);
    ok(`${lang}: the tiles are the ones of before`, JSON.stringify(await page.$$eval('[data-squares] .sq', (l) => l.map((x) => x.className))) === JSON.stringify(before.tiles));
    // A reload; then Next, and a reload on the next pair.
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-pair] .order__card', { timeout: 10000 });
    ok(`${lang}: a reload keeps the pair too`, (await stepText()) === before.step && (await answered()));
    await next(page);
    const fifthTitles = await titles();
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-pair] .order__card', { timeout: 10000 });
    ok(`${lang}: after Next a reload shows the next pair, not answered`, /\b5\b/.test(await stepText()) && !(await answered()) && JSON.stringify(await titles()) === JSON.stringify(fifthTitles) && fifthTitles.join() !== before.titles.join(), await stepText());
    // The page "Games" says where the reader is.
    const gamesPage = await browser.newPage();
    await gamesPage.goto(`${base}/${lang}/${GAMES[lang]}/`, { waitUntil: 'networkidle0' });
    const state = await gamesPage.$eval('[data-game-card="order"] [data-state]', (e) => e.textContent.trim());
    ok(`${lang}: the page "Games" says "Continue (pair 5 of 10)" for this round`, state === ui('games.continue_order', lang).replace('{done}', '5').replace('{total}', '10'), state);
    await gamesPage.close();
    // To the end: the result; one event; a reload shows the result again and sends nothing.
    for (let i = 4; i < ROUND; i += 1) { await press(page, 0); await next(page); }
    ok(`${lang}: the result after ten pairs`, await visible(page, '[data-final]'));
    ok(`${lang}: one event order-finish`, (await page.evaluate(() => window.__counted.map((c) => c.path).join())) === 'order-finish');
    const title = await page.$eval('[data-score]', (e) => e.textContent.trim());
    const tiles = await page.$$eval('[data-final-squares] .sq', (l) => l.map((x) => x.className).join());
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-final]', { timeout: 10000 });
    await wait(300);
    ok(`${lang}: after a reload the result of the round is shown, the same, and the event is not sent again`, (await visible(page, '[data-final]')) && !(await visible(page, '[data-pair]')) && (await page.$eval('[data-score]', (e) => e.textContent.trim())) === title && (await page.$$eval('[data-final-squares] .sq', (l) => l.map((x) => x.className).join())) === tiles && (await page.evaluate(() => window.__counted.length)) === 0);
    const gamesAgain = await browser.newPage();
    await gamesAgain.goto(`${base}/${lang}/${GAMES[lang]}/`, { waitUntil: 'networkidle0' });
    ok(`${lang}: the page "Games" shows the caption of the result`, (await gamesAgain.$eval('[data-game-card="order"] [data-state]', (e) => e.textContent.trim())) === title, title);
    await gamesAgain.close();
    // Another round: new pairs, and a reload stays in them.
    await page.click('[data-again]');
    await wait(300);
    const newTitles = await titles();
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-pair] button', { timeout: 10000 });
    ok(`${lang}: after "Another round" a reload shows the new round at its first pair, not the old result`, /\b1\b/.test(await stepText()) && !(await visible(page, '[data-final]')) && JSON.stringify(await titles()) === JSON.stringify(newTitles));
    // A story that is gone from the list: a new round, without a word.
    await page.evaluate(() => { const g = JSON.parse(localStorage.getItem('order:game')); g.pairs[0][0] = 'story-that-is-gone'; localStorage.setItem('order:game', JSON.stringify(g)); });
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-pair] button', { timeout: 10000 });
    const kept = await page.evaluate(() => localStorage.getItem('order:game'));
    ok(`${lang}: a pair with a story that is not in the list: a new round at the first pair, no message, the kept round replaced`, /\b1\b/.test(await stepText()) && !kept.includes('story-that-is-gone') && (await page.evaluate(() => document.querySelector('[data-empty]').hidden)) && page.errors.length === 0, page.errors.join('; '));
    void fourth; void done;
    await page.close();
  }
}

if (want('result')) {
  for (const lang of LANGS) {
    const list = await listOf(lang);
    const page = await open({ lang });
    const stored = await page.evaluate(() => JSON.stringify(Object.entries(localStorage).filter(([k]) => k !== 'order:game')));
    ok(`${lang}: the result is not shown before the end`, !(await visible(page, '[data-final]')));
    const pairs = await playRound(page, list);
    ok(`${lang}: ten pairs in a round`, pairs.length === ROUND, String(pairs.length));
    ok(`${lang}: the result screen after ten answers, the game is gone`, (await visible(page, '[data-final]')) && !(await visible(page, '[data-pair]')));
    await page.evaluate(() => document.querySelector('[data-final]').scrollIntoView());
    await page.waitForFunction(() => document.querySelector('.game-result__banner')?.complete !== false, { timeout: 5000 }).catch(() => {});
    const fin = await page.evaluate(() => {
      const box = (e) => e?.getBoundingClientRect();
      const miss = [...document.querySelectorAll('[data-misses] li')];
      const share = document.querySelector('[data-final-share]');
      const again = document.querySelector('[data-again]');
      const banner = document.querySelector('.game-result__banner');
      return {
        title: document.querySelector('[data-score]')?.textContent.trim(),
        tiles: [...document.querySelectorAll('[data-final-squares] .sq')].map((e) => e.className),
        tileWidth: box(document.querySelector('[data-final-squares] .sq'))?.width,
        buttons: [...document.querySelectorAll('[data-final] .button')].map((b) => b.textContent.trim()),
        shareClass: share?.className,
        againClass: again?.className,
        read: document.querySelector('[data-final] .game-result__read a')?.getAttribute('href'),
        readIsButton: !!document.querySelector('[data-final] a.button'),
        banner: banner ? { loaded: banner.complete && banner.naturalWidth > 0, ratio: box(banner).width / box(banner).height, natural: banner.naturalWidth / banner.naturalHeight, alt: banner.getAttribute('alt'), top: box(banner).top - box(document.querySelector('[data-final]')).top, above: banner.compareDocumentPosition(document.querySelector('[data-score]')) & Node.DOCUMENT_POSITION_FOLLOWING } : null,
        ai: document.querySelector('.game-result__ai')?.textContent.trim(),
        pairs: miss.map((li) => ({ classes: li.className, listStyle: getComputedStyle(li).listStyleType, border: getComputedStyle(li).borderTopWidth, rows: [...li.querySelectorAll('.miss-row')].map((r) => ({ date: r.querySelector('.miss-date')?.textContent, bold: Number(getComputedStyle(r.querySelector('.miss-date')).fontWeight), title: r.querySelector('a')?.textContent, href: r.querySelector('a')?.getAttribute('href'), dateLeft: box(r.querySelector('.miss-date')).left, titleLeft: box(r.querySelector('a')).left })) })),
        focus: document.activeElement?.hasAttribute('data-score'),
      };
    });
    ok(`${lang}: a title by the range, no score, no percent`, fin.title.length > 5 && !/[\d%]/.test(fin.title), fin.title);
    ok(`${lang}: ten tiles, a hit or a miss each, at least 28 px wide`, fin.tiles.length === ROUND && fin.tiles.every((c) => /sq--(hit|miss)/.test(c)) && fin.tileWidth >= 28, String(fin.tileWidth));
    ok(`${lang}: the picture of the game is on top, whole (3:2), with the line that it is AI-made under it and the title under that`, fin.banner && fin.banner.loaded && Math.abs(fin.banner.ratio - 1.5) < 0.03 && Math.abs(fin.banner.natural - 1.5) < 0.03 && fin.banner.alt === '' && fin.banner.top < 2 && fin.banner.above !== 0 && fin.ai === ui('games.ai_caption', lang), JSON.stringify(fin.banner) + ' ' + fin.ai);
    ok(`${lang}: Share is the main button, Another round the second, "Read the stories" a link (not a button); focus on the title`, fin.buttons.length === 2 && fin.shareClass === 'button' && /button--secondary/.test(fin.againClass) && !fin.readIsButton && fin.read === `/${lang}/` && fin.focus, fin.buttons.join(' | '));
    const byTitle = new Map(list.map((x) => [x.title, x]));
    const nMiss = fin.tiles.filter((c) => c.includes('sq--miss')).length;
    ok(`${lang}: the misses are pairs: two rows each, the date in bold on the left, the title (a link) on the right, no bullets, a thin line between the pairs`, fin.pairs.length === nMiss && fin.pairs.every((x, i) => x.rows.length === 2 && x.listStyle === 'none' && x.rows.every((r) => r.bold >= 600 && r.dateLeft < r.titleLeft && r.href) && (i === 0 || x.border === '1px')), JSON.stringify(fin.pairs.slice(0, 1)));
    ok(`${lang}: each row has the date and the title of its story, the one that came first on top`, fin.pairs.every((x) => { const [u, v] = x.rows.map((r) => ({ story: byTitle.get(r.title), date: r.date })); return u.story && v.story && u.date === u.story.date && v.date === v.story.date && u.story.year <= v.story.year; }), JSON.stringify(fin.pairs.map((x) => x.rows.map((r) => r.date))));
    // Share: the text is the caption, the tiles, the question and the link to the page of the range, with ?src=share.
    await page.click('[data-final-share]');
    await wait(100);
    const copied = await page.evaluate(() => window.__copied);
    const lines = copied.split('\n');
    const hits = fin.tiles.filter((c) => c.includes('sq--hit')).length;
    const band = hits === ROUND ? 'top' : hits / ROUND >= 0.7 ? 'high' : hits / ROUND >= 0.4 ? 'mid' : 'low';
    ok(`${lang}: the copied text is one line (the game, the caption of the result, the tiles, the question) and the link to the page of the range with ?src=share`, lines.length === 2 && lines[0] === ui('order.result_text', lang).replace('{band}', ui(`order.band_${band}`, lang)).replace('{tiles}', fin.tiles.map((c) => (c.includes('sq--hit') ? '🟦' : '⬜')).join('')) && lines[1].endsWith(`/${lang}/${SEG[lang]}/${RANKSEG[lang]}/${band}/?src=share`), JSON.stringify(lines));
    ok(`${lang}: sharing sends no event`, (await page.evaluate(() => window.__counted.length)) === 1);
    const counted = await page.evaluate(() => window.__counted.map((c) => c.path));
    ok(`${lang}: one counter event, order-finish, and no other`, counted.length === 1 && counted[0] === 'order-finish', counted.join());
    ok(`${lang}: nothing is kept in the browser but the round`, (await page.evaluate(() => JSON.stringify(Object.entries(localStorage).filter(([k]) => k !== 'order:game')))) === stored);
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
    for (const [name, seg] of [['order', SEG[lang]], ['myths', MYTHS[lang]], ['games', GAMES[lang]]]) {
      const page = await browser.newPage();
      await page.setViewport({ width: 390, height: 900, isMobile: true, hasTouch: true });
      await page.goto(`${base}/${lang}/${seg}/`, { waitUntil: 'networkidle0' });
      const n = await page.evaluate(() => ({
        tab: [...document.querySelectorAll('.tabbar a[aria-current="page"]')].map((a) => ({ href: a.getAttribute('href'), text: a.textContent.trim() })),
        tabs: document.querySelectorAll('.tabbar a').length,
        sw: [...document.querySelectorAll('.games-switch a')].map((a) => ({ href: a.getAttribute('href'), cur: a.getAttribute('aria-current') })),
      }));
      ok(`${lang} ${name}: the tab "Games" is the current one and leads to the page "Games"`, n.tab.length === 1 && n.tab[0].href === `/${lang}/${GAMES[lang]}/` && n.tabs === 5, JSON.stringify(n.tab));
      ok(`${lang} ${name}: the tab is called "Games"`, n.tab[0]?.text === { pt: 'Jogos', en: 'Games', ru: 'Игры' }[lang], n.tab[0]?.text);
      ok(`${lang} ${name}: the switch has the two games, the current one marked (the page "Games" has none)`, name === 'games' ? n.sw.length === 0 : n.sw.length === 2 && n.sw.filter((x) => x.cur === 'page').length === 1 && n.sw.find((x) => x.cur === 'page').href === `/${lang}/${seg}/` && n.sw.some((x) => x.href === `/${lang}/${SEG[lang]}/`) && n.sw.some((x) => x.href === `/${lang}/${MYTHS[lang]}/`), JSON.stringify(n.sw));
      await page.close();
    }
  }
  // The menu of the header (from 768 px): "Games" between "Map" and "Surprise me", current on both game pages, leads to the myths.
  for (const lang of LANGS) {
    for (const seg of [SEG[lang], MYTHS[lang], GAMES[lang]]) {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 900 });
      await page.goto(`${base}/${lang}/${seg}/`, { waitUntil: 'networkidle0' });
      const m = await page.evaluate(() => [...document.querySelectorAll('.site-nav a')].map((a) => ({ href: a.getAttribute('href'), cur: a.getAttribute('aria-current') })));
      const at = m.findIndex((x) => x.href === `/${lang}/${GAMES[lang]}/`);
      ok(`${lang} ${seg}: the header menu has "Games" (to the page "Games") between the map and "Surprise me", current`, at === 2 && m.length === 4 && m[at].cur === 'page' && m.filter((x) => x.cur).length === 1 && m[3].href.includes(lang === 'pt' ? 'surpreende' : lang === 'en' ? 'surprise' : 'udivi'), JSON.stringify(m));
      await page.close();
    }
  }
  const home = await browser.newPage();
  await home.goto(`${base}/pt/`, { waitUntil: 'networkidle0' });
  ok('home: nothing about the new game on the home page', (await home.$$eval(`a[href="/pt/${SEG.pt}/"]:not(.site-footer a)`, (l) => l.length)) === 0);
  await home.close();
}

if (want('scroll')) {
  // After "Next" and "Another round": the focus on the first card and the scroll to the line "Pair N of 10" (smooth; at once under reduced motion), so both cards of the pair are in view above the tab bar (390 x 844).
  for (const reduced of [false, true]) {
    for (const lang of LANGS) {
      const page = await browser.newPage();
      await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
      if (reduced) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
      await page.evaluateOnNewDocument(() => { try { if (!sessionStorage.getItem('qa-fresh')) { localStorage.removeItem('order:game'); sessionStorage.setItem('qa-fresh', '1'); } } catch {} });
      await page.goto(pageUrl(lang), { waitUntil: 'networkidle0' });
      await page.waitForSelector('[data-pair] button');
      const state = () => page.evaluate(() => ({ y: Math.round(scrollY), step: Math.round(document.querySelector('[data-step]').getBoundingClientRect().top), cards: [...document.querySelectorAll('[data-pair] .order__card')].map((c) => Math.round(c.getBoundingClientRect().bottom)), tab: Math.round(document.querySelector('.tabbar').getBoundingClientRect().top), focus: document.activeElement?.matches('[data-pair] [data-pick="0"]') }));
      for (const [label, action] of [['Next', 'next'], ['Another round', 'again']]) {
        if (action === 'again') {
          for (let i = 1; i < ROUND; i += 1) { await press(page, 0); await next(page); } // pairs 2 to 10: the first was answered above
          await page.evaluate(() => document.querySelector('[data-again]').scrollIntoView());
          await page.click('[data-again]');
        } else {
          await press(page, 0);
          await page.evaluate(() => document.querySelector('[data-next]').scrollIntoView());
          await page.click('[data-next]');
        }
        await wait(reduced ? 80 : 40);
        const early = await state();
        await wait(1300);
        const late = await state();
        const tag = `${lang} ${reduced ? 'reduced motion' : 'motion'}, after ${label}`;
        ok(`${tag}: the line "Pair N" is at the top of the screen`, late.step >= 0 && late.step <= 40, JSON.stringify(late));
        ok(`${tag}: both cards of the pair are above the tab bar`, late.cards.length === 2 && late.cards.every((b) => b <= late.tab), JSON.stringify(late));
        ok(`${tag}: the focus is on the first card`, late.focus);
        if (reduced) ok(`${tag}: the scroll is at once`, early.y === late.y, `${early.y} then ${late.y}`);
      }
      await page.close();
    }
  }
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

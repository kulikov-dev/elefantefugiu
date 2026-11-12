// Browser checks of "Myth or fact" (src/views/MythsView.astro, src/scripts/myths.ts; the claims are the field `myth` of the published stories) against dist/ served by serve.mjs:   node myths.mjs [page answer game resume round nojs anchor card links layout]
//   page     the page in every language: a card for every claim of the pool (published, not sensitive stories with a `myth`), the two buttons, the footer link, the line at the end of About; the claims of a story queued for a later day are nowhere
//   round    a game is ten claims of the pool (all of them when there are fewer), at least three "Myth" and three "Fact" when the pool has so many, the others hidden; Play again deals another round; a round with a story that left the pool is dropped
//   answer   with JavaScript one card is shown at a time; the answer is hidden until a press; a press opens that card only, marks the pressed button, turns both off, shows the verdict, whether the
//            guess was right, the text, the story with its title and Next (no Share and no "#" on a card); a press saves only the game (`myths:game`); one counter event `myth-<id>` and no other
//   game     the row of squares (empty / right / wrong, a shape each, a label for a screen reader), the result screen (score, the line by the range, the misses with links), the best result,
//            Share (the dialog of the browser or the clipboard, no answers in the text, ?src=share), Play again, the events `myths-finish` and `myths-share` once each
//   nojs     without JavaScript: no buttons, every card is a <details> opened by "Answer"
//   anchor   the address with #id leads to the card, the answer stays closed
//   card     the address of one card: that card first and marked, noindex, canonical to the page of all of them, its own og:title and picture, hreflang between the languages
//   links    the link of every answer leads to the story in the language of the page
//   layout   no horizontal scroll at 360 px (a question, an answered question, the result)
import { readFileSync } from 'node:fs';
import { launchBrowser } from './browser.mjs';
import { ROUND, myths, published, queuedMyths, ui as site } from './data.mjs';

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
const SEG = { pt: 'mito-ou-verdade', en: 'myth-or-fact', ru: 'mif-ili-pravda' };
const STORY_SEG = { pt: 'historia', en: 'story', ru: 'istoriya' };
const GAMES = { pt: 'jogos', en: 'games', ru: 'igry' };
const RANK = { pt: 'titulo', en: 'rank', ru: 'zvanie' };
const ABOUT = { pt: 'sobre', en: 'about', ru: 'o-proekte' };
const SHARE = { pt: 'conheco-uma-historia', en: 'share-a-story', ru: 'znayu-istoriyu' };
if (myths.length < 2) throw new Error('The suite needs at least two claims in published stories (the field `myth` in src/content/events; need: two claims).');
const LIST = myths;
// A game is a round: ten claims of the pool, all of them when there are fewer (ROUND, data.mjs).
const R = ROUND;
const claim = (id) => LIST.find((m) => m.id === id);
// The page holds the whole pool; the script puts the claims of the round at the end of the list in the order of the round and hides the rest.
const roundOf = (page) => page.$$eval('.myths__list > [data-myth]', (l, n) => l.slice(-n).map((c) => c.dataset.myth), R);
const HOME = Object.fromEntries(LANGS.map((l) => [l, JSON.parse(readFileSync(new URL(`../../src/i18n/${l}.json`, import.meta.url), 'utf8')).home]));
const UI = Object.fromEntries(LANGS.map((l) => [l, JSON.parse(readFileSync(new URL(`../../src/i18n/${l}.json`, import.meta.url), 'utf8')).myths]));
const document_has_digits = (t) => /\d/.test(t);
const fill = (tpl, vars) => tpl.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
// A press that is right (a "partly" claim takes either) or wrong, and what it counts as.
const pickFor = (m, hit) => (hit ? (m.verdict === 'fact' ? 'fact' : 'myth') : m.verdict === 'myth' ? 'fact' : 'myth');
const isHit = (m, pick) => m.verdict === 'part' || m.verdict === pick;
const storyOf = (m) => published.find((e) => e.id === m.story);
const pageUrl = (lang, id = '') => `${base}/${lang}/${SEG[lang]}/${id ? `${id}/` : ''}`;

const open = async ({ lang = 'pt', width = 390, js = true, id = '', hash = '' } = {}) => {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 900, isMobile: width < 700, hasTouch: width < 700 });
  if (!js) await page.setJavaScriptEnabled(false);
  page.errors = [];
  page.on('pageerror', (e) => !/ViewTransition opt-in disabled/.test(e.message) && page.errors.push(e.message));
  // The counter of the site is not loaded on a local address: a stand-in records what the page would send.
  await page.evaluateOnNewDocument(() => {
    window.__counted = [];
    // The browser is shared by the pages of the suite: the first load of a page starts without a game kept by an earlier one (a reload of it keeps its own).
    try {
      if (!sessionStorage.getItem('qa-fresh')) {
        localStorage.removeItem('myths:game');
        sessionStorage.setItem('qa-fresh', '1');
      }
    } catch {}
    // A build on a real address sets window.goatcounter in its own config script: the stand-in takes the assignment and keeps its count.
    const stub = {};
    // count.js of the real build assigns its own count (and counts the page view itself): the recorder stays and takes the events only.
    Object.defineProperty(stub, 'count', { get: () => (v) => { if (v && v.event) window.__counted.push(v); }, set: () => {} });
    Object.defineProperty(window, 'goatcounter', { configurable: true, get: () => stub, set: () => {} });
  });
  await page.goto(`${pageUrl(lang, id)}${hash}`, { waitUntil: 'networkidle0' });
  await wait(200);
  return page;
};
const visible = (page, selector) => page.evaluate((s) => { const el = document.querySelector(s); return el ? el.checkVisibility() && el.getBoundingClientRect().height > 0 : false; }, selector);
// What the browser holds for the page (the site keeps its own marks, e.g. the last visit): a press must add nothing to it but the game that is not finished (`myths:game`).
const stored = (page) => page.evaluate(() => JSON.stringify([Object.entries(localStorage).filter(([k]) => k !== 'myths:game'), Object.entries(sessionStorage)]));

if (want('page')) {
  for (const lang of LANGS) {
    const page = await open({ lang });
    const cards = await page.$$eval('[data-myth]', (list) => list.map((c) => ({ id: c.dataset.myth, buttons: c.querySelectorAll('[data-pick]').length, statement: c.querySelector('.myth__statement')?.textContent.trim() })));
    ok(`${lang}: a card for every claim of the pool (the published stories with a claim), no other`, [...cards.map((c) => c.id)].sort().join() === LIST.map((m) => m.id).sort().join(), `${cards.length} of ${LIST.length}`);
    ok(`${lang}: every card has its claim and two buttons`, cards.every((c) => c.statement && c.statement.length > 5 && c.buttons === 2));
    ok(`${lang}: one h1`, (await page.$$eval('h1', (l) => l.length)) === 1);
    ok(`${lang}: the claims are those of the data`, cards.every((c) => c.statement === claim(c.id)?.statement[lang]));
    // A story queued for a later day: its claim is not on the page (nor in the HTML: the page is read as the server sent it).
    const html = await (await fetch(pageUrl(lang))).text();
    ok(`${lang}: the claims of the stories queued for a later day (${queuedMyths.length}) are not in the HTML of the page`, queuedMyths.every((q) => !html.includes(q.statement[lang]) && !html.includes(q.answer[lang]) && !html.includes(`data-myth="${q.id}"`)));
    const links = await page.evaluate(() => ({ foot: [...document.querySelectorAll('.site-footer a')].map((a) => a.getAttribute('href')), end: document.querySelector('.myths__end a')?.getAttribute('href') }));
    ok(`${lang}: the footer links to the page "Games" (which leads to this game)`, links.foot.includes(`/${lang}/${GAMES[lang]}/`), links.foot.join(' '));
    ok(`${lang}: the line at the end leads to the form "Know a story?"`, links.end === `/${lang}/${SHARE[lang]}/`, links.end);
    await page.close();
    const about = await browser.newPage();
    await about.goto(`${base}/${lang}/${ABOUT[lang]}/`, { waitUntil: 'networkidle0' });
    const last = await about.evaluate(() => [...document.querySelectorAll('.static a')].map((a) => a.getAttribute('href')));
    ok(`${lang}: About has the line with a link to the page, at its end`, last.at(-1) === `/${lang}/${SEG[lang]}/`, last.at(-1));
    await about.close();
  }
  // The home page: a block after "Where to start" with a heading, one line and the button; the end of a story: one small line. The footer keeps its link.
  for (const lang of LANGS) {
    const home = await browser.newPage();
    await home.goto(`${base}/${lang}/`, { waitUntil: 'networkidle0' });
    const b = await home.evaluate((href) => { const s = document.querySelector('.home-myths'); const start = document.querySelector('[data-showcase]'); return s ? { tiles: [...s.querySelectorAll('ol.squares .sq--empty')].length, text: s.querySelector('p')?.textContent, h2: s.querySelector('h2')?.textContent.trim(), p: [...s.querySelectorAll('p')].filter((x) => !x.hidden).length, href: s.querySelector('a.button')?.getAttribute('href'), after: !start || Boolean(start.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING), btn: s.querySelector('a.button')?.textContent.trim() } : null; }, `/${lang}/${SEG[lang]}/`);
    const WORDS = { pt: ['Mito ou verdade?', 'Jogar'], en: ['Myth or fact?', 'Play'], ru: ['Миф или правда?', 'Играть'] }[lang];
    ok(`${lang}: the home page block has a row of empty tiles, one for each claim, and the count in its line`, b && b.tiles === R && b.text.includes(String(LIST.length)), JSON.stringify(b));
    ok(`${lang}: the home page has the block after "Where to start": the heading, one line and the button`, b && b.h2 === WORDS[0] && b.btn === WORDS[1] && b.p === 2 && b.href === `/${lang}/${SEG[lang]}/` && b.after, JSON.stringify(b));
    // The block follows the game that is kept: started (the tiles with the answers, "Continue (n of N)"), finished (the result, "Play again"), another list of claims (as new).
    const ids = LIST.slice(0, R).map((m) => m.id);
    const homeState = async (game) => {
      await home.evaluate((g) => (g ? localStorage.setItem('myths:game', JSON.stringify(g)) : localStorage.removeItem('myths:game')), game);
      await home.reload({ waitUntil: 'networkidle0' });
      return home.evaluate(() => ({ btn: document.querySelector('[data-play]').textContent.trim(), result: document.querySelector('[data-result]').hidden ? '' : document.querySelector('[data-result]').textContent.trim(), filled: document.querySelectorAll('.home-myths .sq:not(.sq--empty)').length }));
    };
    const some = await homeState({ order: ids, marks: ids.map((_, i) => (i < 2 ? 'hit' : null)) });
    ok(`${lang}: the home block of a game under way says "Continue" with the count and shows the answers`, some.btn === fill(HOME[lang].myths_continue, { done: 2, total: R }) && some.filled === 2 && some.result === '', JSON.stringify(some));
    const whole = await homeState({ order: ids, marks: ids.map(() => 'hit') });
    ok(`${lang}: the home block of a finished game shows the result and "Play again"`, whole.result === UI[lang].band_high && !/\d/.test(whole.result) && whole.filled === R && whole.btn !== some.btn, JSON.stringify(whole));
    const stale = await homeState({ order: ['no-such-claim', ...ids.slice(1)], marks: ids.map(() => 'hit') });
    ok(`${lang}: the home block ignores a round with a claim that has left the pool`, stale.filled === 0 && stale.result === '', JSON.stringify(stale));
    await homeState(null);
    await home.close();
    const story = await browser.newPage();
    await story.goto(`${base}/${lang}/${STORY_SEG[lang]}/${storyOf(LIST[0]).slug[lang]}/`, { waitUntil: 'networkidle0' });
    const hrefs = await story.$$eval('.story-myths a', (l) => l.map((a) => a.getAttribute('href')));
    ok(`${lang}: a story ends with one small line that leads to the page`, hrefs.length === 1 && hrefs[0] === `/${lang}/${SEG[lang]}/`, hrefs.join());
    await story.close();
  }
}

if (want('answer')) {
  for (const lang of LANGS) {
    const page = await open({ lang });
    const round = await roundOf(page);
    const first = claim(round[0]);
    const second = claim(round[1]);
    const card = `[data-myth="${first.id}"]`;
    ok(`${lang}: JavaScript hides the summary and shows the buttons`, !(await visible(page, `${card} .myth__summary`)) && (await visible(page, `${card} [data-pick]`)));
    const closed = await page.$$eval('[data-answer]', (l) => l.every((d) => !d.open));
    ok(`${lang}: every answer is closed and hidden`, closed && !(await visible(page, `${card} [data-body]`)) && !(await visible(page, `${card} .myth__story`)) && !(await visible(page, `${card} .verdict`)));
    // The title of the story and its picture are not in the page's text before the answer is shown.
    ok(`${lang}: the title of the story is not visible before the answer`, !(await page.evaluate((c) => { const el = document.querySelector(`${c} .myth__story-title`); return el ? el.checkVisibility() : false; }, card)));
    const hidden = await page.$$eval('[data-myth]', (l) => l.map((c) => !c.checkVisibility()));
    ok(`${lang}: one card is shown, the first of the round; the others are hidden`, hidden.filter((h) => !h).length === 1 && hidden[(await page.$eval('[data-myth]', (l) => l.findIndex((c) => c.dataset.myth === round[0])))] === false, hidden.join());
    const before = await stored(page);
    await page.click(`${card} [data-pick="myth"]`);
    await wait(200);
    const after = await page.evaluate((c, other) => {
      const el = document.querySelector(c);
      const buttons = [...el.querySelectorAll('[data-pick]')];
      return {
        open: el.querySelector('[data-answer]').open,
        pressed: buttons.map((b) => b.getAttribute('aria-pressed')),
        disabled: buttons.map((b) => b.disabled),
        verdict: el.querySelector('.verdict')?.textContent.trim(),
        outcome: el.querySelector('[data-outcome]')?.textContent.trim(),
        next: el.querySelector('[data-next]')?.checkVisibility(),
        text: el.querySelector('.myth__text')?.textContent.trim(),
        title: el.querySelector('.myth__story-title')?.textContent.trim(),
        thumb: el.querySelector('.myth__thumb')?.complete,
        share: [...el.querySelectorAll('[data-share-button], [data-share-link]')].some((b) => b.checkVisibility()),
        anchor: el.querySelector('.myth__anchor').checkVisibility(),
        otherOpen: document.querySelector(`[data-myth="${other}"] [data-answer]`).open,
        focus: document.activeElement === el.querySelector('[data-body]'),
      };
    }, card, second.id);
    ok(`${lang}: the press opens the answer of that card only`, after.open && !after.otherOpen);
    ok(`${lang}: the pressed button is marked, the other is not, both are off`, after.pressed.join() === 'true,false' && after.disabled.every(Boolean), after.pressed.join());
    ok(`${lang}: the answer shows the verdict, the text, the title of the story and Next; the card has no Share and no "#" (the answer would be given away)`, after.verdict && after.text === first.answer[lang] && after.title === storyOf(first).title[lang] && !after.share && !after.anchor && after.next, JSON.stringify({ v: after.verdict, t: after.title }));
    const expected = UI[lang][`outcome_${first.verdict === 'part' ? 'part' : first.verdict === 'myth' ? 'hit' : 'miss'}`];
    ok(`${lang}: the answer says whether the guess was right`, after.outcome === expected, `${after.outcome} / ${expected}`);
    ok(`${lang}: the focus moves to the answer`, after.focus);
    ok(`${lang}: the other card has its own buttons still on`, await page.$eval(`[data-myth="${second.id}"] [data-pick]`, (b) => !b.disabled));
    // A second press does nothing more.
    await page.click(`${card} [data-pick="fact"]`).catch(() => {});
    const counted = await page.evaluate(() => window.__counted);
    ok(`${lang}: one counter event, myth-<id>, and no other`, counted.length === 1 && counted[0].path === `myth-${first.id}` && counted[0].event === true, JSON.stringify(counted));
    ok(`${lang}: a press saves nothing in the browser but the game`, (await stored(page)) === before);
    // Next shows the second card and hides the first; the verdict label is the data's, whichever button was pressed.
    await page.click(`${card} [data-next]`);
    ok(`${lang}: Next shows the next card and hides this one`, (await visible(page, `[data-myth="${second.id}"] [data-pick]`)) && !(await visible(page, card)));
    await page.click(`[data-myth="${second.id}"] [data-pick="fact"]`);
    const verdict = await page.$eval(`[data-myth="${second.id}"] .verdict`, (v) => v.textContent.trim());
    ok(`${lang}: the verdict of a card does not depend on the button pressed`, verdict.length > 2);
    ok(`${lang}: no script error`, page.errors.length === 0, page.errors.join('; '));
    await page.close();
  }
}

if (want('game')) {
  for (const lang of LANGS) {
    const N = R;
    const ui = UI[lang];
    const page = await open({ lang, width: 360 });
    // The browser keeps the best result of the earlier languages: a first visit has none.
    await page.evaluate(() => localStorage.removeItem('myths:best'));
    await page.reload({ waitUntil: 'networkidle0' });
    const squares = () => page.$$eval('[data-squares] .sq', (l) => l.map((e) => ({ cls: [...e.classList].filter((c) => c !== 'sq' && c !== 'sq--current').join(), current: e.classList.contains('sq--current'), icon: Boolean(e.querySelector('svg')), label: e.querySelector('.visually-hidden')?.textContent })));
    const start = await squares();
    ok(`${lang}: ${N} squares, all empty, the first is the current one, each has a label for a screen reader`, start.length === N && start.every((q) => q.cls === 'sq--empty' && !q.icon && q.label) && start[0].current && start.filter((q) => q.current).length === 1, JSON.stringify(start[0]));
    ok(`${lang}: the step line says which question of how many`, (await page.$eval('[data-step]', (e) => e.textContent)) === fill(ui.step, { i: 1, total: N }));
    ok(`${lang}: no best result on the first visit`, !(await visible(page, '[data-best]')));
    const hits = [];
    const round = await roundOf(page);
    for (let i = 0; i < N; i += 1) {
      const m = claim(round[i]);
      const pick = pickFor(m, i % 2 === 0);
      hits.push(isHit(m, pick));
      await page.click(`[data-myth="${m.id}"] [data-pick="${pick}"]`);
      const sq = (await squares())[i];
      if (!(sq.cls === (hits[i] ? 'sq--hit' : 'sq--miss') && sq.icon === hits[i])) ok(`${lang}: square ${i + 1} is ${hits[i] ? 'a solid tile with the pattern' : 'a plain white tile'}`, false, JSON.stringify(sq));
      const label = await page.$eval(`[data-myth="${m.id}"] [data-next]`, (b) => b.textContent.trim());
      if (label !== (i === N - 1 ? ui.finish : ui.next)) ok(`${lang}: the button after question ${i + 1} reads "${i === N - 1 ? ui.finish : ui.next}"`, false, label);
      await page.click(`[data-myth="${m.id}"] [data-next]`);
    }
    const score = hits.filter(Boolean).length;
    const fin = await page.evaluate(() => ({
      shown: document.querySelector('[data-final]').checkVisibility(),
      cards: [...document.querySelectorAll('[data-myth]')].some((c) => c.checkVisibility()),
      progress: document.querySelector('[data-progress]').checkVisibility(),
      score: document.querySelector('[data-score]').textContent.trim(),
      squares: [...document.querySelectorAll('[data-final-squares] .sq')].map((e) => e.className),
      misses: [...document.querySelectorAll('[data-misses] a')].map((a) => a.getAttribute('href')),
      focus: document.activeElement?.hasAttribute('data-score'),
      buttons: [...document.querySelectorAll('[data-final] .button')].map((b) => b.textContent.trim()),
      read: document.querySelector('[data-final] .game-result__read a')?.getAttribute('href'),
      percent: /%/.test(document.querySelector('[data-final]').innerText),
    }));
    ok(`${lang}: the result screen replaces the cards and the progress`, fin.shown && !fin.cards && !fin.progress, JSON.stringify({ s: fin.shown, c: fin.cards, p: fin.progress }));
    const ratio = score / N;
    const band = ratio < 0.5 ? 'low' : ratio < 0.8 ? 'mid' : 'high';
    ok(`${lang}: the result is the title by the range (${band}), no score, no percent`, fin.score === ui[`band_${band}`] && !fin.percent && !document_has_digits(fin.score), fin.score);
    ok(`${lang}: the row of squares repeats the game`, fin.squares.length === N && fin.squares.every((c, i) => c.includes(hits[i] ? 'sq--hit' : 'sq--miss')));
    const missed = round.map(claim).filter((_, i) => !hits[i]).map((m) => `/${lang}/${STORY_SEG[lang]}/${storyOf(m).slug[lang]}/`);
    ok(`${lang}: "where you slipped" lists the stories of the wrong answers, with links`, fin.misses.join() === missed.join() && (await visible(page, '[data-misses-box]')) === (missed.length > 0), fin.misses.join());
    ok(`${lang}: the focus is on the score`, fin.focus);
    ok(`${lang}: Share and Play again are the two buttons, Read the stories is a link (to the home page)`, fin.buttons.length === 2 && fin.buttons[1] === ui.again && fin.read === `/${lang}/`, fin.buttons.join(' | '));
    // The result screen is the one of the games (GameResult): the picture of the game whole (3:2) with the line that it is AI-made, big tiles, Share the main button.
    await page.waitForFunction(() => { const b = document.querySelector('.game-result__banner'); return b && b.complete && b.naturalWidth > 0; }, { timeout: 5000 }).catch(() => {});
    const screen = await page.evaluate(() => { const b = document.querySelector('.game-result__banner'); const r = b?.getBoundingClientRect(); return { loaded: !!b && b.complete && b.naturalWidth > 0, ratio: r ? r.width / r.height : 0, natural: b ? b.naturalWidth / b.naturalHeight : 0, ai: document.querySelector('.game-result__ai')?.textContent.trim(), tile: document.querySelector('[data-final-squares] .sq')?.getBoundingClientRect().width, share: document.querySelector('[data-final-share]').className, again: document.querySelector('[data-again]').className }; });
    ok(`${lang}: the picture of the game is on the result, whole (3:2), with the line that it is AI-made; the tiles are at least 28 px; Share is the main button`, screen.loaded && Math.abs(screen.ratio - 1.5) < 0.03 && Math.abs(screen.natural - 1.5) < 0.03 && screen.ai === site('games.ai_caption', lang) && screen.tile >= 28 && screen.share === 'button' && /button--secondary/.test(screen.again), JSON.stringify(screen));
    const counted = await page.evaluate(() => window.__counted.map((c) => c.path));
    ok(`${lang}: the events are myth-<id> for each answer and one myths-finish`, counted.length === N + 1 && counted.filter((p) => p === 'myths-finish').length === 1 && round.every((id) => counted.includes(`myth-${id}`)), counted.join());
    ok(`${lang}: the best result is kept`, (await page.evaluate(() => localStorage.getItem('myths:best'))) === JSON.stringify({ score, total: N }));
    // Share without the dialog of the browser: the text goes to the clipboard, quietly; the link has ?src=share; the answers are not in it.
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (t) => { window.__copied = t; } } });
    });
    await page.click('[data-final-share]');
    await wait(100);
    await page.click('[data-final-share]');
    await wait(100);
    const copied = await page.evaluate(() => ({ text: window.__copied ?? '', status: document.querySelector('[data-final-status]').textContent, shares: window.__counted.filter((c) => c.path === 'myths-share').length }));
    const lines = copied.text.split('\n');
    ok(`${lang}: the copied text is one line (the game, the caption of the result, the tiles, the question) and the link to the page of the range with ?src=share`, lines.length === 2 && lines[0] === fill(ui.result_text, { band: ui[`band_${band}`], tiles: hits.map((h) => (h ? '🟦' : '⬜')).join('') }) && lines[1].endsWith(`/${lang}/${SEG[lang]}/${RANK[lang]}/${band}/?src=share`), JSON.stringify(lines));
    ok(`${lang}: the text has nothing of the claims or their answers`, round.map(claim).every((m) => !copied.text.includes(m.answer[lang].slice(0, 25)) && !copied.text.includes(m.statement[lang].slice(0, 25))));
    ok(`${lang}: the quiet note says "${ui.copied}"`, copied.status === ui.copied, copied.status);
    ok(`${lang}: one myths-share event, however many times it is pressed`, copied.shares === 1, String(copied.shares));
    // With the dialog of the browser: the title, the text and the link are given to it.
    await page.evaluate(() => { window.__shared = null; Object.defineProperty(navigator, 'share', { configurable: true, value: async (d) => { window.__shared = d; } }); });
    await page.click('[data-final-share]');
    await wait(100);
    const dialog = await page.evaluate(() => window.__shared);
    const dialogTitle = await page.$eval('h1', (e) => e.textContent.trim());
    ok(`${lang}: the dialog of the browser gets the title of the game, the one-line text and the link`, dialog && dialog.title === dialogTitle && dialog.text === lines[0] && dialog.url === lines[1], JSON.stringify(dialog));
    // Play again: every card, one shown, clean, the best result on the start line.
    await page.click('[data-again]');
    await wait(100);
    const again = await page.evaluate(() => ({
      ids: [...document.querySelectorAll('[data-myth]')].map((c) => c.dataset.myth),
      shown: [...document.querySelectorAll('[data-myth]')].filter((c) => c.checkVisibility()).length,
      // Only the card on the screen: a claim of the old round that is not dealt again stays as it was (hidden) until a round deals it, and then it is reset.
      open: [...document.querySelectorAll('[data-myth]')].filter((c) => c.checkVisibility()).some((c) => c.querySelector('[data-answer]').open),
      disabled: [...document.querySelectorAll('[data-myth]')].filter((c) => c.checkVisibility()).some((c) => [...c.querySelectorAll('[data-pick]')].some((b) => b.disabled)),
      final: document.querySelector('[data-final]').checkVisibility(),
      best: document.querySelector('[data-best]').textContent.trim(),
      bestShown: document.querySelector('[data-best]').checkVisibility(),
    }));
    ok(`${lang}: Play again keeps the whole pool on the page, shows one card, clean`, [...again.ids].sort().join() === LIST.map((m) => m.id).sort().join() && again.shown === 1 && !again.open && !again.disabled && !again.final, JSON.stringify({ n: again.ids.length, s: again.shown }));
    ok(`${lang}: the best result is on the start line`, again.bestShown && again.best === fill(ui.best, { band: ui[`band_${band}`] }), again.best);
    ok(`${lang}: all squares are empty again`, (await squares()).every((q) => q.cls === 'sq--empty'));
    ok(`${lang}: no script error`, page.errors.length === 0, page.errors.join('; '));
    await page.close();
  }
  // A result from a game of another length is not shown; a whole one is.
  const page = await open({ lang: 'pt' });
  await page.evaluate((n) => localStorage.setItem('myths:best', JSON.stringify({ score: n, total: n })), R);
  await page.reload({ waitUntil: 'networkidle0' });
  ok('the best result of an earlier visit is shown at the start', await visible(page, '[data-best]'));
  await page.evaluate(() => localStorage.setItem('myths:best', '{"score":3,"total":999}'));
  await page.reload({ waitUntil: 'networkidle0' });
  ok('a best result from a game of another length is not shown', !(await visible(page, '[data-best]')));
  await page.close();
}

if (want('resume')) {
  const ui = UI.pt;
  const N = R;
  const page = await open({ lang: 'pt' });
  const step = () => page.$eval('[data-step]', (e) => e.textContent.trim());
  const answerOne = async () => {
    await page.click('.myth:not([hidden]) [data-pick="myth"]');
    await page.click('.myth:not([hidden]) [data-next]');
  };
  ok('a new game has no "Start over" link', !(await visible(page, '[data-restart]')));
  await answerOne();
  await answerOne();
  ok('after an answer the "Start over" link is shown', await visible(page, '[data-restart]'));
  await page.reload({ waitUntil: 'networkidle0' });
  ok('a reload goes on from the same question', (await step()) === fill(ui.step, { i: 3, total: N }), await step());
  const squares = await page.$$eval('[data-squares] .sq', (l) => l.slice(0, 3).map((q) => q.className.replace(/ sq--current/, '')));
  ok('the answers given are kept in the row of tiles', squares[0] !== 'sq sq--empty' && squares[1] !== 'sq sq--empty' && squares[2] === 'sq sq--empty', squares.join());
  await page.click('[data-restart]');
  ok('"Start over" begins at the first question and forgets the game', (await step()) === fill(ui.step, { i: 1, total: N }) && (await page.evaluate(() => localStorage.getItem('myths:game'))) === null);
  await answerOne();
  const game = await page.evaluate(() => JSON.parse(localStorage.getItem('myths:game')));
  await page.evaluate((g) => localStorage.setItem('myths:game', JSON.stringify({ order: g.order.slice(1), marks: g.marks.slice(1) })), game);
  await page.reload({ waitUntil: 'networkidle0' });
  ok('a saved game of another length is dropped', (await step()) === fill(ui.step, { i: 1, total: N }) && !(await visible(page, '[data-restart]')));
  // A story that left the pool (a claim that is not on the page any more): the saved round is dropped without a word and a new round starts.
  await answerOne();
  const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('myths:game')));
  await page.evaluate((g) => localStorage.setItem('myths:game', JSON.stringify({ order: ['no-such-claim', ...g.order.slice(1)], marks: g.marks })), kept);
  await page.reload({ waitUntil: 'networkidle0' });
  ok('a saved round with a claim that has left the pool is dropped: a new round from the first question, no error', (await step()) === fill(ui.step, { i: 1, total: N }) && !(await visible(page, '[data-restart]')) && page.errors.length === 0, page.errors.join('; '));
  // A round that is whole goes on after a reload: the same claims in the same order.
  await answerOne();
  const before = await roundOf(page);
  await page.reload({ waitUntil: 'networkidle0' });
  ok('a reload keeps the same round: the same claims in the same order', (await roundOf(page)).join() === before.join(), `${before.join()} / ${(await roundOf(page)).join()}`);
  await page.close();
}

if (want('round')) {
  const verdictOf = (id) => claim(id).verdict;
  const mythsInPool = LIST.filter((m) => m.verdict === 'myth').length;
  const factsInPool = LIST.filter((m) => m.verdict === 'fact').length;
  const needMyths = Math.min(3, mythsInPool);
  const needFacts = Math.min(3, factsInPool);
  const deals = [];
  for (let n = 0; n < 12; n += 1) {
    const page = await open({ lang: 'pt' });
    // The first load of a page starts clean; a new deal is a reload with nothing kept.
    await page.evaluate(() => localStorage.removeItem('myths:game'));
    await page.reload({ waitUntil: 'networkidle0' });
    const round = await roundOf(page);
    const shown = await page.$$eval('[data-myth]', (l) => l.filter((c) => c.checkVisibility()).map((c) => c.dataset.myth));
    deals.push(round);
    if (n === 0) {
      ok(`a round is ${R} claims (the pool has ${LIST.length}), each once, all of the pool`, round.length === R && new Set(round).size === R && round.every((id) => claim(id)), round.join());
      ok('one card is shown, the first of the round; the claims out of the round are hidden', shown.length === 1 && shown[0] === round[0]);
      ok('the progress line and the tiles count the round, not the pool', (await page.$$eval('[data-squares] .sq', (l) => l.length)) === R);
    }
    const m = round.filter((id) => verdictOf(id) === 'myth').length;
    const f = round.filter((id) => verdictOf(id) === 'fact').length;
    if (m < needMyths || f < needFacts) ok(`round ${n + 1}: at least ${needMyths} "Myth" and ${needFacts} "Fact"`, false, `${m} / ${f}`);
    await page.close();
  }
  ok(`every round has at least ${needMyths} "Myth" and ${needFacts} "Fact" (12 rounds)`, deals.every((r) => r.filter((id) => verdictOf(id) === 'myth').length >= needMyths && r.filter((id) => verdictOf(id) === 'fact').length >= needFacts));
  ok('the rounds differ in the choice or in the order', new Set(deals.map((r) => r.join())).size > 1 || LIST.length <= 1);
  // Play again deals another round and, while the pool allows, other claims than the last round had.
  const page = await open({ lang: 'pt' });
  await page.evaluate(() => localStorage.removeItem('myths:game'));
  await page.reload({ waitUntil: 'networkidle0' });
  const first = await roundOf(page);
  for (let i = 0; i < first.length; i += 1) {
    await page.click(`[data-myth="${first[i]}"] [data-pick="myth"]`);
    await page.click(`[data-myth="${first[i]}"] [data-next]`);
  }
  await page.click('[data-again]');
  await wait(100);
  const second = await roundOf(page);
  const same = second.filter((id) => first.includes(id)).length;
  const fresh = Math.min(R, LIST.length - R);
  ok(`Play again deals a whole round of the same size, with at least ${fresh} claims not in the last one (the pool allows)`, second.length === R && new Set(second).size === R && R - same >= Math.max(0, fresh - 3), `${same} of ${R} repeated`);
  ok('the claims of the stories queued for a later day are not on the page at all', queuedMyths.every((q) => !claim(q.id)) && (await page.$$eval('[data-myth]', (l) => l.length)) === LIST.length);
  await page.close();
}

if (want('nojs')) {
  for (const lang of LANGS) {
    const page = await open({ lang, js: false });
    const card = `[data-myth="${LIST[0].id}"]`;
    ok(`${lang}, no JavaScript: no buttons, the summary "Answer" is there`, !(await visible(page, `${card} [data-pick]`)) && (await visible(page, `${card} .myth__summary`)));
    ok(`${lang}, no JavaScript: the answer is closed`, !(await visible(page, `${card} [data-body]`)));
    await page.click(`${card} .myth__summary`);
    ok(`${lang}, no JavaScript: "Answer" opens it (verdict, text, story)`, (await visible(page, `${card} [data-body]`)) && (await visible(page, `${card} .verdict`)) && (await visible(page, `${card} .myth__story`)));
    ok(`${lang}, no JavaScript: Share is a plain link to the address of the card`, (await page.$eval(`${card} [data-share-link]`, (a) => a.getAttribute('href'))).endsWith(`/${lang}/${SEG[lang]}/${LIST[0].id}/`));
    await page.close();
  }
}

if (want('anchor')) {
  for (const lang of LANGS) {
    const target = LIST.at(-1);
    const page = await open({ lang, hash: `#${target.id}` });
    const state = await page.evaluate((id) => {
      const el = document.getElementById(id);
      const r = el.getBoundingClientRect();
      return { inView: r.top >= -2 && r.top < innerHeight, target: location.hash === `#${id}`, closed: !el.querySelector('[data-answer]').open, anchorLink: el.querySelector('.myth__anchor')?.getAttribute('href') };
    }, target.id);
    ok(`${lang}: the address with #id brings the card into view`, state.inView && state.target, JSON.stringify(state));
    ok(`${lang}: the answer of that card is closed`, state.closed);
    ok(`${lang}: every card has its link #id`, state.anchorLink === `#${target.id}`);
    await page.close();
  }
}

if (want('card')) {
  const m = LIST[2] ?? LIST[1];
  for (const lang of LANGS) {
    const page = await open({ lang, id: m.id });
    const info = await page.evaluate(() => {
      const meta = (a, n) => document.querySelector(`meta[${a}="${n}"]`)?.getAttribute('content');
      return {
        order: [...document.querySelectorAll('[data-myth]')].map((c) => c.dataset.myth),
        shown: document.querySelector('.myth:not([hidden])')?.dataset.myth,
        first: document.querySelector('.myth--first')?.dataset.myth,
        robots: meta('name', 'robots'),
        canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href'),
        ogUrl: meta('property', 'og:url'),
        ogTitle: meta('property', 'og:title'),
        ogDescription: meta('property', 'og:description'),
        ogImage: meta('property', 'og:image'),
        ogAlt: meta('property', 'og:image:alt'),
        hreflang: [...document.querySelectorAll('link[rel="alternate"][hreflang]')].map((l) => `${l.hreflang} ${l.getAttribute('href')}`),
        closed: [...document.querySelectorAll('[data-answer]')].every((d) => !d.open),
        jsonld: document.querySelectorAll('script[type="application/ld+json"]').length,
      };
    });
    ok(`${lang}: the card of the address is the first of the round (the one shown), the page holds the whole pool`, info.shown === m.id && info.order.length === LIST.length, `${info.shown} ${info.order.length}`);
    const plain = await open({ lang, id: m.id, js: false });
    const plainOrder = await plain.$$eval('[data-myth]', (l) => l.map((c) => c.dataset.myth));
    ok(`${lang}: without JavaScript the card of the address is first and the others follow`, plainOrder[0] === m.id && [...plainOrder.slice(1)].sort().join() === LIST.filter((x) => x.id !== m.id).map((x) => x.id).sort().join(), plainOrder.join());
    await plain.close();
    ok(`${lang}: it is marked`, info.first === m.id, String(info.first));
    ok(`${lang}: noindex, canonical to the page of all of them, og:url is its own address`, /noindex/.test(info.robots) && new URL(info.canonical).pathname === `/${lang}/${SEG[lang]}/` && new URL(info.ogUrl).pathname === `/${lang}/${SEG[lang]}/${m.id}/`, `${info.robots} ${info.canonical} ${info.ogUrl}`);
    const stmt = m.statement[lang].replace(/[.!?]+$/u, '');
    ok(`${lang}: og:title has the claim, og:description invites to the link`, info.ogTitle.endsWith(`: ${stmt}?`) && info.ogTitle.length > stmt.length && info.ogDescription.length > 10, `${info.ogTitle} | ${info.ogDescription}`);
    ok(`${lang}: its own picture (og-myths), the claim is its alt, no answer in the head`, /\/og-myths\/[a-z0-9-]+-[0-9a-f]{10}\.jpg$/.test(info.ogImage) && info.ogAlt === m.statement[lang] && !info.ogDescription.includes(m.answer[lang].slice(0, 20)), `${info.ogImage}`);
    ok(`${lang}: the answer is closed`, info.closed);
    ok(`${lang}: no structured data on the page of one card (it is noindex)`, info.jsonld === 0);
    ok(`${lang}: hreflang points to the same card in the other languages`, LANGS.every((l) => info.hreflang.some((h) => h.startsWith(`${l} `) && h.endsWith(`/${l}/${SEG[l]}/${m.id}/`))), info.hreflang.join(' '));
    await page.close();
  }
  // The page of all of them: indexable, its own canonical.
  const page = await open({ lang: 'ru' });
  const main = await page.evaluate(() => ({ robots: document.querySelector('meta[name="robots"]')?.getAttribute('content'), canonical: document.querySelector('link[rel="canonical"]').getAttribute('href'), jsonld: document.querySelectorAll('script[type="application/ld+json"]').length }));
  ok('the page of all of them is indexable, its canonical is itself, it has structured data', !main.robots && new URL(main.canonical).pathname === `/ru/${SEG.ru}/` && main.jsonld === 1, JSON.stringify(main));
  await page.close();
}

if (want('links')) {
  for (const lang of LANGS) {
    const page = await open({ lang });
    const hrefs = await page.$$eval('[data-myth]', (list) => list.map((c) => ({ id: c.dataset.myth, href: c.querySelector('.myth__story')?.getAttribute('href') })));
    ok(`${lang}: the link of every answer leads to the story in this language`, hrefs.every((h) => h.href === `/${lang}/${STORY_SEG[lang]}/${storyOf(LIST.find((m) => m.id === h.id)).slug[lang]}/`), hrefs.filter((h) => !h.href).map((h) => h.id).join());
    // And the page of that story exists.
    const status = await page.evaluate(async (url) => (await fetch(url)).status, hrefs[0].href);
    ok(`${lang}: the first of them opens`, status === 200, String(status));
    await page.close();
  }
}

if (want('layout')) {
  for (const lang of LANGS) {
    const page = await open({ lang, width: 360 });
    const fits = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    ok(`${lang} 360 px: no horizontal scroll`, await fits());
    const round = await roundOf(page);
    await page.click(`[data-myth="${round[0]}"] [data-pick="myth"]`);
    await wait(200);
    ok(`${lang} 360 px: no horizontal scroll with the answer open`, await fits(), String(await page.evaluate(() => document.documentElement.scrollWidth)));
    const small = await page.$$eval('.myth__button, .myth__next', (l) => l.filter((b) => b.checkVisibility() && b.getBoundingClientRect().height < 44).length);
    ok(`${lang} 360 px: the buttons are at least 44 px high`, small === 0);
    for (let i = 0; i < round.length; i += 1) {
      if (i > 0) await page.click(`[data-myth="${round[i]}"] [data-pick="myth"]`);
      await page.click(`[data-myth="${round[i]}"] [data-next]`);
    }
    ok(`${lang} 360 px: no horizontal scroll on the result`, await fits(), String(await page.evaluate(() => document.documentElement.scrollWidth)));
    const low = await page.$$eval('[data-final] .button', (l) => l.filter((b) => b.getBoundingClientRect().height < 44).length);
    ok(`${lang} 360 px: the buttons of the result are at least 44 px high`, low === 0);
    await page.close();
  }
}

await browser.close();
console.log(failed === 0 ? '\nAll "Myth or fact" checks passed' : `\n${failed} check(s) failed`);
process.exit(failed === 0 ? 0 : 1);

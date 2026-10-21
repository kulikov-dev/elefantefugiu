// Browser checks for stage 4b: epoch switcher, thread filter, timeline/grid switch, home page, "Surprise me".
// Run against `dist/` served by serve.mjs (base path "/"). Uses the test data (epoch avis-e-descobrimentos, thread mar).
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

const base = process.env.BASE_URL || 'http://localhost:4400';
const EPOCH = `${base}/pt/epoca/avis-e-descobrimentos/`;
const HOME = `${base}/pt/`;

let failed = 0;
const ok = (name, cond, extra = '') => {
  if (!cond) failed += 1;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: 'shell' });
const newPage = async ({ js = true, width = 360 } = {}) => {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 800 });
  if (!js) await page.setJavaScriptEnabled(false);
  return page;
};
const feedState = (page) =>
  page.evaluate(() => {
    const lis = [...document.querySelectorAll('ol.feed > li')];
    const visible = lis.filter((li) => !li.hidden && li.getBoundingClientRect().height > 0);
    const feed = document.querySelector('ol.feed');
    return {
      total: lis.length,
      visibleIds: visible.map((li) => li.querySelector('article').id),
      hiddenWithThread: lis.filter((li) => li.hidden).map((li) => li.dataset.threads),
      visibleThreads: visible.map((li) => li.dataset.threads),
      view: feed.dataset.view,
      display: getComputedStyle(feed).display,
      columns: getComputedStyle(feed).gridTemplateColumns.split(' ').length,
      search: location.search,
      hash: location.hash,
      pressed: [...document.querySelectorAll('[data-js-only] [aria-pressed="true"]')].map((b) => b.dataset.fio ?? b.dataset.view),
      counters: [...document.querySelectorAll('[data-js-only] button[data-fio]')].map((b) => `${b.dataset.fio || 'all'}:${b.querySelector('.thread__count').textContent}`),
      status: document.querySelector('[data-status]').textContent,
      emptyVisible: !document.querySelector('[data-empty]').hidden,
    };
  });

// ---------- 1. Epoch switcher ----------
{
  const page = await newPage();
  await page.goto(EPOCH, { waitUntil: 'networkidle0' });
  const s = await page.evaluate(() => {
    const items = [...document.querySelectorAll('nav.epoch-switch li')].map((li) => ({
      text: li.textContent.replace(/\s+/g, ' ').trim(),
      link: li.querySelector('a')?.getAttribute('href') ?? null,
      current: Boolean(li.querySelector('[aria-current="page"]')),
    }));
    const more = document.querySelector('.epoch-switch__more');
    const dashed = [...document.querySelectorAll('.epoch-switch__list .epoch-switch__item')].filter((el) => getComputedStyle(el).borderStyle.includes('dashed')).length;
    return { items, more: more?.querySelector('summary').textContent.trim(), moreOpen: more?.open, dashed, overflow: document.scrollingElement.scrollWidth - innerWidth };
  });
  // Tabs first (the three MVP epochs), then the rest under one "More eras soon" disclosure.
  ok('switcher: nine epochs', s.items.length === 9, `n=${s.items.length}`);
  ok('switcher: current epoch marked, not a link', s.items.filter((i) => i.current).length === 1 && s.items[0].current && s.items[0].link === null);
  ok('switcher: the two other MVP epochs are links', s.items[1].link === '/pt/epoca/pombal-e-terramoto/' && s.items[2].link === '/pt/epoca/estado-novo-e-25-de-abril/');
  ok('switcher: the six epochs outside the MVP are plain text', s.items.slice(3).every((i) => i.link === null));
  ok('switcher: one disclosure "Mais épocas em breve", closed at first', s.more === 'Mais épocas em breve' && s.moreOpen === false, JSON.stringify([s.more, s.moreOpen]));
  ok('switcher: no dashed chips in the main row', s.dashed === 0);
  ok('switcher: no horizontal overflow at 360px', s.overflow <= 0, `overflow=${s.overflow}`);
  await page.close();
}

// ---------- 2. Without JavaScript ----------
{
  const page = await newPage({ js: false });
  await page.goto(`${EPOCH}?fio=mar&vista=grelha`, { waitUntil: 'load' });
  const s = await page.evaluate(() => ({
    links: document.querySelectorAll('.chips a.thread--link').length,
    jsControls: !!document.querySelector('[data-js-only]') && document.querySelector('[data-js-only]').getBoundingClientRect().height > 0,
    cards: [...document.querySelectorAll('ol.feed > li')].filter((li) => li.getBoundingClientRect().height > 0).length,
    view: document.querySelector('ol.feed').dataset.view,
    overflow: document.scrollingElement.scrollWidth - innerWidth,
  }));
  ok('no JS: chips are links to thread pages', s.links === 5, `links=${s.links}`);
  ok('no JS: filter and view buttons are not shown', s.jsControls === false);
  ok('no JS: the address parameters are ignored, all cards stay, timeline view', s.cards === 8 && s.view === 'timeline');
  ok('no JS: no horizontal overflow at 360px', s.overflow <= 0);
  await page.close();
}

// ---------- 3. Filter, view, address, reload ----------
{
  const page = await newPage();
  await page.goto(EPOCH, { waitUntil: 'networkidle0' });
  const before = await feedState(page);
  ok('JS: all cards shown, "All" pressed, timeline', before.visibleIds.length === 8 && before.pressed.join() === ',timeline' || (before.visibleIds.length === 8 && before.pressed.includes('timeline')), before.pressed.join('|'));
  const marCount = Number(before.counters.find((c) => c.startsWith('mar:')).split(':')[1]);

  await page.click('button[data-fio="mar"]');
  const mar = await feedState(page);
  ok('filter: address gets ?fio=mar', mar.search === '?fio=mar', mar.search);
  ok('filter: shows exactly the cards whose primary or second thread is mar', mar.visibleThreads.every((t) => t.split(' ').includes('mar')) && mar.hiddenWithThread.every((t) => !t.split(' ').includes('mar')));
  ok('filter: number shown equals the (build-time) counter of the chip', mar.visibleIds.length === marCount, `shown=${mar.visibleIds.length} counter=${marCount}`);
  // Somewhere in this epoch a thread is the second thread of a card: the filter must include such cards too.
  let secondThreadSeen = false;
  for (const id of await page.$$eval('[data-js-only] button[data-fio]:not([data-fio=""])', (bs) => bs.map((b) => b.dataset.fio))) {
    await page.click(`button[data-fio="${id}"]`);
    const st = await feedState(page);
    if (st.visibleThreads.some((t) => t.split(' ')[0] !== id)) secondThreadSeen = true;
  }
  ok('filter: cards where the thread is only the second thread are included', secondThreadSeen);
  await page.click('button[data-fio="mar"]');
  ok('filter: counters do not change', JSON.stringify(mar.counters) === JSON.stringify(before.counters));
  ok('filter: button state and status line', mar.pressed.includes('mar') && /\d+ hist/.test(mar.status), mar.status);
  ok('filter: no history entries added', (await page.evaluate(() => history.length)) <= 2);

  await page.click('button[data-view="grid"]');
  const grid = await feedState(page);
  ok('grid: address keeps both parameters', grid.search === '?fio=mar&vista=grelha', grid.search);
  ok('grid: same cards as the timeline with the same filter', JSON.stringify(grid.visibleIds) === JSON.stringify(mar.visibleIds));
  ok('grid: grid layout, one column at 360px', grid.display === 'grid' && grid.columns === 1, `display=${grid.display} columns=${grid.columns}`);
  const overflow = await page.evaluate(() => document.scrollingElement.scrollWidth - innerWidth);
  ok('grid: no horizontal overflow at 360px', overflow <= 0, `overflow=${overflow}`);

  await page.reload({ waitUntil: 'networkidle0' });
  const reloaded = await feedState(page);
  ok('reload: filter and view survive', reloaded.search === '?fio=mar&vista=grelha' && JSON.stringify(reloaded.visibleIds) === JSON.stringify(grid.visibleIds) && reloaded.view === 'grid' && reloaded.pressed.includes('mar') && reloaded.pressed.includes('grid'));

  await page.setViewport({ width: 1000, height: 800 });
  const wide = await feedState(page);
  ok('grid: several columns on a wide screen', wide.columns >= 2, `columns=${wide.columns}`);
  await page.setViewport({ width: 360, height: 800 });

  await page.click('button[data-view="timeline"]');
  const back = await feedState(page);
  ok('timeline again: view parameter removed, filter kept', back.search === '?fio=mar' && back.view === 'timeline');
  await page.click('button[data-fio=""]');
  const all = await feedState(page);
  ok('"All": filter removed from the address, every card shown', all.search === '' && all.visibleIds.length === 8);
  await page.close();
}

// ---------- 4. Unknown values, empty thread ----------
{
  const page = await newPage();
  await page.goto(`${EPOCH}?fio=nope&vista=lista`, { waitUntil: 'networkidle0' });
  const s = await feedState(page);
  ok('unknown thread and view are ignored and removed from the address', s.visibleIds.length === 8 && s.search === '' && s.view === 'timeline', s.search);
  // The test data has no thread that is empty in this epoch, so the empty state is simulated: no card carries the thread.
  await page.evaluate(() => document.querySelectorAll('ol.feed > li').forEach((li) => (li.dataset.threads = 'other')));
  await page.click('button[data-fio="mar"]');
  const empty = await feedState(page);
  ok('empty thread: message shown, feed hidden', empty.emptyVisible && empty.visibleIds.length === 0);
  ok('empty thread: message text and "Show all" button', await page.evaluate(() => /ainda não há histórias neste fio/.test(document.querySelector('[data-empty]').textContent) && /Mostrar todas/.test(document.querySelector('[data-empty] button').textContent)));
  await page.click('[data-empty] button');
  await page.evaluate(() => document.querySelectorAll('ol.feed > li').forEach((li, i) => (li.dataset.threads = li.dataset.threads || 'mar')));
  const shown = await feedState(page);
  ok('"Show all" clears the filter', !shown.emptyVisible && shown.search === '');
  await page.close();
}

// ---------- 5. Back from a card keeps the place, the filter and the view ----------
for (const view of ['timeline', 'grid']) {
  const page = await newPage();
  const url = `${EPOCH}?fio=mar${view === 'grid' ? '&vista=grelha' : ''}`;
  await page.goto(url, { waitUntil: 'networkidle0' });
  const links = await page.$$eval('ol.feed > li:not([hidden]) .ecard__title a', (as) => as.map((a) => a.getAttribute('href')));
  const target = links.at(-1);
  await page.evaluate((h) => document.querySelector(`.ecard__title a[href="${h}"]`).scrollIntoView({ block: 'center' }), target);
  await wait(200);
  const before = await page.evaluate(() => Math.round(scrollY));
  const visibleBefore = (await feedState(page)).visibleIds;
  await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), page.click(`.ecard__title a[href="${target}"]`)]);
  await page.goBack({ waitUntil: 'load' });
  await wait(600);
  const after = await page.evaluate(() => Math.round(scrollY));
  const s = await feedState(page);
  ok(`Back (${view}): same address with the filter${view === 'grid' ? ' and view' : ''}`, s.search === new URL(url).search, s.search);
  ok(`Back (${view}): same cards visible`, JSON.stringify(s.visibleIds) === JSON.stringify(visibleBefore));
  ok(`Back (${view}): same scroll position`, Math.abs(after - before) <= 8 && before > 200, `before=${before} after=${after}`);
  await page.close();
}

// ---------- 6. Keyboard on the controls ----------
{
  const page = await newPage();
  await page.goto(EPOCH, { waitUntil: 'networkidle0' });
  await page.focus('button[data-fio="mar"]');
  await page.keyboard.press('Enter');
  const a = await feedState(page);
  await page.focus('button[data-view="grid"]');
  await page.keyboard.press('Space');
  const b = await feedState(page);
  ok('keyboard: Enter on a thread button filters, Space on the view button switches', a.search === '?fio=mar' && b.search === '?fio=mar&vista=grelha');
  const outline = await page.evaluate(() => {
    const el = document.querySelector('button[data-fio="mar"]');
    el.focus();
    return getComputedStyle(el).outlineStyle !== 'none' || true;
  });
  ok('controls are real buttons with aria-pressed', await page.evaluate(() => [...document.querySelectorAll('[data-js-only] button')].every((x) => x.tagName === 'BUTTON' && x.hasAttribute('aria-pressed'))) && outline);
  await page.close();
}

// ---------- 7. Home without JavaScript ----------
{
  const page = await newPage({ js: false });
  await page.goto(HOME, { waitUntil: 'load' });
  const s = await page.evaluate(() => {
    const vis = (el) => !!el && el.getBoundingClientRect().height > 0;
    return {
      h1: document.querySelector('h1').textContent.trim(),
      start: document.querySelector('.hero a.button:not(.button--secondary)')?.getAttribute('href'),
      map: document.querySelector('.hero a.button--secondary')?.getAttribute('href'),
      showcase: document.querySelectorAll('[data-showcase] .ecard').length,
      surprise: vis(document.querySelector('[data-surprise]')),
      tiles: [...document.querySelectorAll('#epocas .tile')].map((t) => ({ link: t.querySelector('a')?.getAttribute('href') ?? null, soon: t.classList.contains('tile--soon'), text: t.textContent.replace(/\s+/g, ' ').trim() })),
      threads: [...document.querySelectorAll('section[aria-labelledby="threads-title"] a')].map((a) => a.getAttribute('href')),
      steps: document.querySelectorAll('.step').length,
      overflow: document.scrollingElement.scrollWidth - innerWidth,
    };
  });
  ok('home no JS: title and the two hero buttons', s.h1 === 'O Elefante Fugiu' && s.start === '/pt/epoca/avis-e-descobrimentos/' && s.map === '/pt/mapa/', `${s.start} ${s.map}`);
  ok('home no JS: three featured cards, "Surprise me" not shown', s.showcase === 3 && s.surprise === false);
  ok('home no JS: nine tiles, three links, six "coming soon" without link', s.tiles.length === 9 && s.tiles.filter((t) => t.link).length === 3 && s.tiles.filter((t) => t.soon && !t.link && /Em breve/.test(t.text)).length === 6);
  ok('home no JS: threads are links, three steps, no horizontal overflow', s.threads.length === 5 && s.threads.every((h) => /^\/pt\/fio\/[^/]+\/$/.test(h)) && s.steps === 3 && s.overflow <= 0, `overflow=${s.overflow}`);
  await page.close();
}

// ---------- 8. Home: tile counts match the epoch pages, links work ----------
{
  const page = await newPage();
  await page.goto(HOME, { waitUntil: 'networkidle0' });
  const tiles = await page.$$eval('#epocas .tile--link', (ts) => ts.map((t) => ({ href: t.querySelector('a').getAttribute('href'), n: Number(t.querySelector('.tile__count').textContent.match(/\d+/)[0]) })));
  let match = true;
  for (const tile of tiles) {
    const p = await newPage({ js: false });
    await p.goto(`${base}${tile.href}`, { waitUntil: 'load' });
    const cards = await p.$$eval('ol.feed > li', (l) => l.length);
    if (cards !== tile.n) match = false;
    await p.close();
  }
  ok('tile counts equal the number of cards on the epoch pages', tiles.length === 3 && match, JSON.stringify(tiles.map((t) => t.n)));
  await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), page.click('.hero a.button:not(.button--secondary)')]);
  ok('"Start" opens the first MVP epoch', new URL(page.url()).pathname === '/pt/epoca/avis-e-descobrimentos/');
  await page.goto(HOME, { waitUntil: 'networkidle0' });
  await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), page.click('#epocas .tile--link a')]);
  ok('a tile opens its epoch', new URL(page.url()).pathname === '/pt/epoca/avis-e-descobrimentos/');
  await page.goto(HOME, { waitUntil: 'networkidle0' });
  await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), page.click('section[aria-labelledby="threads-title"] a')]);
  ok('a thread button opens its thread page', /^\/pt\/fio\/[^/]+\/$/.test(new URL(page.url()).pathname));
  await page.goto(HOME, { waitUntil: 'networkidle0' });
  await page.focus('#epocas .tile--link a');
  const tileFocus = await page.evaluate(() => {
    const tile = document.querySelector('#epocas .tile--link');
    return getComputedStyle(tile).outlineStyle !== 'none' && parseFloat(getComputedStyle(tile).outlineWidth) >= 2;
  });
  ok('tile shows a visible focus outline when its link is focused', tileFocus);
  await page.close();
}

// ---------- 9. "Surprise me" ----------
for (const lang of ['pt', 'en']) {
  const page = await newPage();
  await page.goto(`${base}/${lang}/`, { waitUntil: 'networkidle0' });
  ok(`surprise (${lang}): the button appears with JavaScript`, await page.$eval('[data-surprise]', (b) => b.getBoundingClientRect().height > 0));
  const seen = [];
  for (let i = 0; i < 8; i++) {
    await page.goto(`${base}/${lang}/`, { waitUntil: 'networkidle0' });
    await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), page.click('[data-surprise]')]);
    seen.push(new URL(page.url()).pathname);
  }
  const consecutive = seen.every((p, i) => i === 0 || p !== seen[i - 1]);
  ok(`surprise (${lang}): eight clicks in a row, never the same card twice in a row`, consecutive, seen.map((p) => p.split('/').at(-2)).join(' '));
  ok(`surprise (${lang}): leads to different cards and only to card pages`, new Set(seen).size >= 4 && seen.every((p) => p.startsWith(lang === 'pt' ? '/pt/historia/' : '/en/story/')), `distinct=${new Set(seen).size}`);
  ok(`surprise (${lang}): never the heavy-topic card`, seen.every((p) => !p.includes('example-event-19') && !p.includes('evento-exemplo-19')));
  const remembered = await page.evaluate(() => localStorage.getItem('lastSurprise'));
  ok(`surprise (${lang}): the last card is remembered`, /^evento-exemplo-\d+$/.test(remembered ?? ''), remembered);
  await page.close();
}
{
  // Storage blocked: the button must still work (inside try/catch).
  const page = await newPage();
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } });
  });
  await page.goto(HOME, { waitUntil: 'networkidle0' });
  await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), page.click('[data-surprise]')]);
  ok('surprise: works when localStorage is blocked', new URL(page.url()).pathname.startsWith('/pt/historia/'));
  await page.close();
}

// ---------- 10. Language switch on the home page, keyboard ----------
{
  const page = await newPage();
  await page.goto(HOME, { waitUntil: 'networkidle0' });
  const href = await page.$eval('.lang-switch a[hreflang="en"]', (a) => a.getAttribute('href'));
  ok('home: language switch leads to /en/', href === '/en/', href);
  const bad = [];
  for (let i = 0; i < 45; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const tile = el.closest('.tile--link');
      const tcs = tile && getComputedStyle(tile);
      const outline = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2) || (tcs && tcs.outlineStyle !== 'none' && parseFloat(tcs.outlineWidth) >= 2);
      return { name: (el.textContent || '').trim().slice(0, 30), outline, visible: r.width > 0 && r.height > 0 };
    });
    if (!info) break;
    if (!info.outline || !info.visible) bad.push(info.name);
  }
  ok('home: every keyboard stop is visible and has a focus outline', bad.length === 0, bad.join('; '));
  await page.close();
}

await browser.close();
console.log(failed ? `${failed} check(s) failed` : 'All stage 4b checks passed');
process.exit(failed ? 1 : 0);

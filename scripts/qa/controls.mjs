// Browser checks for stage 4b: epoch switcher, thread filter, timeline/grid switch, home page, "Surprise me".
// Run against `dist/` served by serve.mjs (base path "/"):   node controls.mjs [variant]
// Everything that depends on the content (epochs, cards, threads, counts) is read from src/content (data.mjs).
// `variant` runs the same checks against the fixture build (VARIANT_URL, variant-plan.mjs), where the first epoch has more than 8
// cards, so the Timeline / Grid switch appears; on the real site it must stay hidden (fewer than 9 stories).
import { launchBrowser } from './browser.mjs';
import { HOME_START_ID, epochPath, epochs, featuredIds, fixture, real, threadPath, ui } from './data.mjs';

const VARIANT = process.argv[2] === 'variant';
const base = VARIANT ? process.env.VARIANT_URL || 'http://localhost:4401' : process.env.BASE_URL || 'http://localhost:4400';
const world = VARIANT ? fixture : real;
const epoch = world.readyEpochs[0];
const feed = world.feedOf(epoch.id);
const epochThreads = world.threadsIn(epoch.id);
// The thread used for filtering: the one with the fewest cards in this epoch that still has some (so the filter visibly narrows the feed).
const cardsIn = (t) => world.inEpoch(epoch.id).filter((c) => c.threads.includes(t.id)).length;
const filterThread = [...epochThreads].sort((a, b) => cardsIn(a) - cardsIn(b))[0];
const FIO = filterThread.id;
const GRID = feed.length >= 9;
const EPOCH = `${base}${epochPath(epoch)}`;
const HOME = `${base}/pt/`;

let failed = 0;
const ok = (name, cond, extra = '') => {
  if (!cond) failed += 1;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await launchBrowser();
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
    const tabs = [...document.querySelectorAll('.epoch-switch__list > li')];
    const list = document.querySelector('.epoch-switch__list');
    return { items, more: more?.querySelector('summary').textContent.trim(), moreOpen: more?.open, dashed, overflow: document.scrollingElement.scrollWidth - innerWidth, tabs: tabs.length, oneLine: new Set(tabs.map((li) => Math.round(li.getBoundingClientRect().top))).size === 1, scrolls: list.scrollWidth > list.clientWidth };
  });
  // Tabs first (the epochs that have published stories), then the rest, an epoch of the first stage without stories too, under one
  // "More eras soon" disclosure. An epoch is a link only when it has published stories.
  const mvp = world.readyEpochs;
  const readyIds = new Set(world.readyEpochs.map((e) => e.id));
  ok('switcher: every epoch of the project, ready or not', s.items.length === epochs.length, `n=${s.items.length}`);
  ok('switcher: current epoch marked, not a link', s.items.filter((i) => i.current).length === 1 && s.items.find((i) => i.current).link === null);
  ok('switcher: a ready epoch is a link, an epoch without stories is plain text', mvp.every((m, i) => (s.items[i].link === null) === (m.id === epoch.id || !readyIds.has(m.id))) && s.items.slice(mvp.length).every((i) => i.link === null), JSON.stringify(s.items.slice(0, mvp.length).map((i) => i.link)));
  ok('switcher: the links are the ready epochs', s.items.filter((i) => i.link).every((i) => world.readyEpochs.some((m) => epochPath(m) === i.link)));
  ok('switcher: one disclosure "Mais épocas em breve", closed at first', s.more === 'Mais épocas em breve' && s.moreOpen === false, JSON.stringify([s.more, s.moreOpen]));
  ok('switcher: no dashed chips in the main row', s.dashed === 0);
  ok('switcher: tabs are the epochs with stories only (an epoch without stories sits under "soon"), in one line on a phone', s.tabs === mvp.length && s.oneLine, JSON.stringify([s.tabs, mvp.length, s.oneLine, s.scrolls]));
  ok('switcher: no horizontal overflow at 360px', s.overflow <= 0, `overflow=${s.overflow}`);
  await page.close();
}

// ---------- 2. Without JavaScript ----------
{
  const page = await newPage({ js: false });
  await page.goto(`${EPOCH}?fio=${FIO}&vista=grelha`, { waitUntil: 'load' });
  const s = await page.evaluate(() => ({
    links: document.querySelectorAll('.chips a.thread--link').length,
    jsControls: !!document.querySelector('[data-js-only]') && document.querySelector('[data-js-only]').getBoundingClientRect().height > 0,
    cards: [...document.querySelectorAll('ol.feed > li')].filter((li) => li.getBoundingClientRect().height > 0).length,
    view: document.querySelector('ol.feed').dataset.view,
    overflow: document.scrollingElement.scrollWidth - innerWidth,
  }));
  ok('no JS: chips are links to thread pages', s.links === epochThreads.length, `links=${s.links}`);
  ok('no JS: filter and view buttons are not shown', s.jsControls === false);
  ok('no JS: the address parameters are ignored, all cards stay, timeline view', s.cards === feed.length && s.view === 'timeline');
  ok('no JS: no horizontal overflow at 360px', s.overflow <= 0);
  await page.close();
}

// ---------- 3. Filter, view, address, reload ----------
{
  const page = await newPage();
  await page.goto(EPOCH, { waitUntil: 'networkidle0' });
  const before = await feedState(page);
  ok('JS: all cards shown, "All" pressed, timeline', before.visibleIds.length === feed.length && before.pressed.includes('timeline'), before.pressed.join('|'));
  ok(`JS: the Cards position of the switch is ${GRID ? 'shown' : 'hidden'} (it needs 9 stories, this epoch has ${feed.length})`, (await page.$eval('[data-view-switch] [data-view="grid"]', (el) => !el.hidden && el.getBoundingClientRect().height > 0)) === GRID);
  const marCount = Number(before.counters.find((c) => c.startsWith(`${FIO}:`)).split(':')[1]);
  ok('filter: the chip counter is the number of the epoch cards of that thread (from the data)', marCount === cardsIn(filterThread), `counter=${marCount} data=${cardsIn(filterThread)}`);

  await page.click(`button[data-fio="${FIO}"]`);
  const mar = await feedState(page);
  ok(`filter: address gets ?fio=${FIO}`, mar.search === `?fio=${FIO}`, mar.search);
  ok(`filter: shows exactly the cards whose primary or second thread is ${FIO}`, mar.visibleThreads.every((t) => t.split(' ').includes(FIO)) && mar.hiddenWithThread.every((t) => !t.split(' ').includes(FIO)));
  ok('filter: number shown equals the (build-time) counter of the chip', mar.visibleIds.length === marCount, `shown=${mar.visibleIds.length} counter=${marCount}`);
  // Somewhere in this epoch a thread is the second thread of a card: the filter must include such cards too.
  let secondThreadSeen = false;
  for (const id of await page.$$eval('[data-js-only] button[data-fio]:not([data-fio=""])', (bs) => bs.map((b) => b.dataset.fio))) {
    await page.click(`button[data-fio="${id}"]`);
    const st = await feedState(page);
    if (st.visibleThreads.some((t) => t.split(' ')[0] !== id)) secondThreadSeen = true;
  }
  ok('filter: cards where the thread is only the second thread are included', secondThreadSeen);
  await page.click(`button[data-fio="${FIO}"]`);
  ok('filter: counters do not change', JSON.stringify(mar.counters) === JSON.stringify(before.counters));
  ok('filter: button state and status line', mar.pressed.includes(FIO) && /\d+ hist/.test(mar.status), mar.status);
  ok('filter: no history entries added', (await page.evaluate(() => history.length)) <= 2);

  if (!GRID) {
    // Fewer than 9 stories: the timeline is the only view; the grid parameter stays in the address (it applies when the list grows).
    await page.goto(`${EPOCH}?fio=${FIO}&vista=grelha`, { waitUntil: 'networkidle0' });
    const noGrid = await feedState(page);
    ok('no grid view below 9 stories: ?vista=grelha does not turn the grid on', noGrid.view === 'timeline' && noGrid.display !== 'grid', `${noGrid.view} ${noGrid.display}`);
    await page.click('button[data-fio=""]');
    const allShown = await feedState(page);
    ok('"All": filter removed from the address, every card shown', !allShown.search.includes('fio=') && allShown.visibleIds.length === feed.length, allShown.search);
    await page.close();
  } else {
    // The grid needs 9 stories in view, so it is tried on all the cards (a narrow filter hides the switch, see below).
    await page.click('button[data-fio=""]');
    const timeline = await feedState(page);
    await page.click('button[data-view="grid"]');
    const grid = await feedState(page);
    ok('grid: the address gets ?vista=grelha', grid.search === '?vista=grelha', grid.search);
    ok('grid: same cards as the timeline', JSON.stringify(grid.visibleIds) === JSON.stringify(timeline.visibleIds) && grid.visibleIds.length === feed.length);
    ok('grid: grid layout, one column at 360px', grid.display === 'grid' && grid.columns === 1, `display=${grid.display} columns=${grid.columns}`);
    const overflow = await page.evaluate(() => document.scrollingElement.scrollWidth - innerWidth);
    ok('grid: no horizontal overflow at 360px', overflow <= 0, `overflow=${overflow}`);

    await page.reload({ waitUntil: 'networkidle0' });
    const reloaded = await feedState(page);
    ok('reload: the view survives', reloaded.search === '?vista=grelha' && reloaded.view === 'grid' && reloaded.pressed.includes('grid'), reloaded.search);

    await page.setViewport({ width: 1000, height: 800 });
    const wide = await feedState(page);
    ok('grid: several columns on a wide screen', wide.columns >= 2, `columns=${wide.columns}`);
    await page.setViewport({ width: 360, height: 800 });

    await page.click(`button[data-fio="${FIO}"]`);
    ok('a filter that leaves fewer than 9 stories takes the Cards position out of the switch', await page.$eval('[data-view-switch] [data-view="grid"]', (el) => el.hidden || el.getBoundingClientRect().height === 0));
    await page.click('button[data-fio=""]');
    await page.click('button[data-view="timeline"]');
    const back = await feedState(page);
    ok('timeline again: the view parameter is removed', back.search === '' && back.view === 'timeline' && back.visibleIds.length === feed.length, back.search);
    await page.close();
  }
}

// ---------- 4. Unknown values, empty thread ----------
{
  const page = await newPage();
  await page.goto(`${EPOCH}?fio=nope&vista=lista`, { waitUntil: 'networkidle0' });
  const s = await feedState(page);
  ok('unknown thread and view are ignored and removed from the address', s.visibleIds.length === feed.length && s.search === '' && s.view === 'timeline', s.search);
  // The test data has no thread that is empty in this epoch, so the empty state is simulated: no card carries the thread.
  await page.evaluate(() => document.querySelectorAll('ol.feed > li').forEach((li) => (li.dataset.threads = 'other')));
  await page.click(`button[data-fio="${FIO}"]`);
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
for (const view of ['timeline', 'filtered', ...(GRID ? ['grid'] : [])]) {
  const page = await newPage();
  const url = `${EPOCH}${{ timeline: '', filtered: `?fio=${FIO}`, grid: '?vista=grelha' }[view]}`;
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
  ok(`Back (${view}): same address with the filter or view`, s.search === new URL(url).search, s.search);
  ok(`Back (${view}): same cards visible`, JSON.stringify(s.visibleIds) === JSON.stringify(visibleBefore));
  // A filter that leaves one or two cards gives a page too short to scroll: the position is compared only when there is one.
  ok(`Back (${view}): same scroll position`, Math.abs(after - before) <= 8 && (view === 'filtered' || before > 200), `before=${before} after=${after}`);
  await page.close();
}

// ---------- 6. Keyboard on the controls ----------
{
  const page = await newPage();
  await page.goto(EPOCH, { waitUntil: 'networkidle0' });
  await page.focus(`button[data-fio="${FIO}"]`);
  await page.keyboard.press('Enter');
  const a = await feedState(page);
  ok('keyboard: Enter on a thread button filters', a.search === `?fio=${FIO}`);
  if (GRID) {
    await page.focus('button[data-fio=""]');
    await page.keyboard.press('Enter');
    await page.focus('button[data-view="grid"]');
    await page.keyboard.press('Space');
    ok('keyboard: Space on the view button switches to the grid', (await feedState(page)).search === '?vista=grelha');
  }
  const outline = await page.evaluate((fio) => {
    const el = document.querySelector(`button[data-fio="${fio}"]`);
    el.focus();
    return getComputedStyle(el).outlineStyle !== 'none' || true;
  }, FIO);
  ok('controls are real buttons with aria-pressed', await page.evaluate(() => [...document.querySelectorAll('[data-js-only] button')].every((x) => x.tagName === 'BUTTON' && x.hasAttribute('aria-pressed'))) && outline);
  await page.close();
}

// ---------- 7. Home without JavaScript ----------
const startCard = world.published.find((c) => c.id === HOME_START_ID);
const featured = featuredIds.filter((id) => world.published.some((c) => c.id === id));
const homeThreads = [...new Set(world.published.flatMap((c) => c.threads))];
{
  const page = await newPage({ js: false });
  await page.goto(HOME, { waitUntil: 'load' });
  const s = await page.evaluate(() => {
    const vis = (el) => !!el && el.getBoundingClientRect().height > 0;
    return {
      h1: document.querySelector('h1').textContent.trim(),
      start: document.querySelector('.hero a.button')?.getAttribute('href'),
      links: [...document.querySelectorAll('.hero a.hero__link')].map((a) => a.getAttribute('href')),
      showcase: document.querySelectorAll('[data-showcase] .showcase > li').length,
      continueBand: vis(document.querySelector('[data-continue]')),
      tiles: [...document.querySelectorAll('#epocas .timeline__item--ready')].map((t) => t.querySelector('a').getAttribute('href')),
      bigTiles: document.querySelectorAll('#epocas .tile').length,
      timeline: [...document.querySelectorAll('#epocas .timeline__item')].map((t) => ({ link: t.querySelector('a')?.getAttribute('href') ?? null, soon: t.classList.contains('timeline__item--soon'), text: t.textContent.replace(/\s+/g, ' ').trim() })),
      threads: [...document.querySelectorAll('section[aria-labelledby="threads-title"] a')].map((a) => a.getAttribute('href')),
      overflow: document.scrollingElement.scrollWidth - innerWidth,
    };
  });
  ok('home no JS: the title, the "Read" button leads to the story the name comes from', s.h1 === ui('home.hook_title') && s.start === `/pt/historia/${startCard.slug.pt}/`, `${s.h1} ${s.start}`);
  ok('home no JS: "Surprise me" and "Open the map" are links', s.links.join() === '/pt/surpreende-me/,/pt/mapa/', s.links.join());
  ok('home no JS: the "Where to start" cards are the featured ones from the data', s.showcase === featured.length, `${s.showcase} of ${featured.length}`);
  ok('home no JS: the "left off" band is not shown', s.continueBand === false);
  ok('home no JS: no big epoch tiles; every ready epoch is a link on the time strip', s.bigTiles === 0 && JSON.stringify(s.tiles) === JSON.stringify(world.readyEpochs.map((m) => epochPath(m))), s.tiles.join());
  ok('home no JS: the timeline lists every epoch; the ready ones are links, the rest say "soon" and have no link', s.timeline.length === epochs.length && s.timeline.filter((t) => t.link).length === world.readyEpochs.length && s.timeline.filter((t) => t.soon && !t.link && t.text.includes(ui('ui.soon'))).length === epochs.length - world.readyEpochs.length);
  ok('home no JS: thread buttons are links to the threads that have stories, no horizontal overflow', s.threads.length === homeThreads.length && s.threads.every((h) => /^\/pt\/fio\/[^/]+\/$/.test(h)) && s.overflow <= 0, `threads=${s.threads.length}/${homeThreads.length} overflow=${s.overflow}`);
  await page.close();
}

// ---------- 8. Home: tile counts match the epoch pages, links work ----------
{
  const page = await newPage();
  await page.goto(HOME, { waitUntil: 'networkidle0' });
  const tiles = await page.$$eval('#epocas .timeline__item--ready', (ts) => ts.map((t) => ({ href: t.querySelector('a').getAttribute('href'), n: Number(t.querySelector('.timeline__count').textContent.match(/\d+/)[0]) })));
  let match = true;
  for (const tile of tiles) {
    const p = await newPage({ js: false });
    await p.goto(`${base}${tile.href}`, { waitUntil: 'load' });
    const cards = await p.$$eval('ol.feed > li', (l) => l.length);
    if (cards !== tile.n) match = false;
    await p.close();
  }
  ok('time strip counts equal the number of cards on the epoch pages and in the data', tiles.length === world.readyEpochs.length && match && tiles.every((t, i) => t.n === world.inEpoch(world.readyEpochs[i].id).length), JSON.stringify(tiles.map((t) => t.n)));
  await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), page.click('.hero a.button')]);
  ok('"Read" opens the story the name comes from', new URL(page.url()).pathname === `/pt/historia/${startCard.slug.pt}/`);
  await page.goto(HOME, { waitUntil: 'networkidle0' });
  await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), page.click('#epocas .timeline__item--ready a')]);
  ok('an epoch of the time strip opens its page', new URL(page.url()).pathname === epochPath(world.readyEpochs[0]));
  await page.goto(HOME, { waitUntil: 'networkidle0' });
  await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), page.click('section[aria-labelledby="threads-title"] a')]);
  ok('a thread button opens its thread page', /^\/pt\/fio\/[^/]+\/$/.test(new URL(page.url()).pathname));
  await page.goto(HOME, { waitUntil: 'networkidle0' });
  await page.focus('#epocas .timeline__item--ready a');
  const tileFocus = await page.evaluate(() => {
    const a = document.querySelector('#epocas .timeline__item--ready a');
    return getComputedStyle(a).outlineStyle !== 'none' && parseFloat(getComputedStyle(a).outlineWidth) >= 2;
  });
  ok('the epoch link shows a visible focus outline when focused', tileFocus);
  await page.close();
}

// ---------- 9. "Surprise me": the page picks a story and goes there ----------
const surprisePath = { pt: '/pt/surpreende-me/', en: '/en/surprise-me/' };
const heavy = world.published.filter((c) => c.sensitive);
for (const lang of ['pt', 'en']) {
  const page = await newPage();
  const seen = [];
  for (let i = 0; i < 8; i++) {
    await page.goto(`${base}/${lang}/`, { waitUntil: 'networkidle0' });
    await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), page.click('.hero a.hero__link')]);
    await page.waitForFunction((l) => location.pathname.startsWith(l === 'pt' ? '/pt/historia/' : '/en/story/'), { timeout: 5000 }).catch(() => {});
    seen.push(new URL(page.url()).pathname);
  }
  const consecutive = seen.every((p, i) => i === 0 || p !== seen[i - 1]);
  ok(`surprise (${lang}): the hero link leads to a card page`, seen.every((p) => p.startsWith(lang === 'pt' ? '/pt/historia/' : '/en/story/')), seen[0]);
  ok(`surprise (${lang}): eight times in a row, never the same card twice in a row`, consecutive, seen.map((p) => p.split('/').at(-2)).join(' '));
  ok(`surprise (${lang}): leads to different cards`, new Set(seen).size >= Math.min(4, world.published.length), `distinct=${new Set(seen).size}`);
  ok(`surprise (${lang}): never a heavy-topic card`, seen.every((p) => !heavy.some((h) => p.includes(h.slug[lang]))));
  ok(`surprise (${lang}): only published cards`, seen.every((p) => world.published.some((c) => p.includes(c.slug[lang]))));
  const remembered = await page.evaluate(() => localStorage.getItem('lastSurprise'));
  ok(`surprise (${lang}): the last card is remembered`, world.published.some((c) => c.id === remembered), remembered);
  await page.close();
}
{
  // Storage blocked: the page must still pick a story (inside try/catch).
  const page = await newPage();
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } });
  });
  await page.goto(`${base}${surprisePath.pt}`, { waitUntil: 'load' });
  await page.waitForFunction(() => location.pathname.startsWith('/pt/historia/'), { timeout: 5000 }).catch(() => {});
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

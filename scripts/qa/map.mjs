// Browser checks for stage 5: the map page (and, as the stage goes on, links to it and the map on epoch pages).
// Run against `dist/` served by serve.mjs (base path "/"). Tiles are answered with a grey picture, nothing leaves the machine.
//   node map.mjs [variant] [nojs tiles limit filters preview layout link epoch weight]     FAMILY=all|12 runs it in a family mode
// The cards, threads and epochs come from src/content (data.mjs). `variant` runs against the fixture build, whose marker limit is 7
// (variant-plan.mjs) and which has more cards than that, so clusters and "Show more" exist; the real site has a limit of 30.
import { launchBrowser } from './browser.mjs';
import { epochs, en as enPath, fixture, need, pt, real, threads as threadsData } from './data.mjs';

const VARIANT = process.argv[2] === 'variant';
const base = VARIANT ? process.env.VARIANT_URL || 'http://localhost:4401' : process.env.BASE_URL || 'http://localhost:4400';
const world = VARIANT ? fixture : real;
const MAP = { pt: `${base}/pt/mapa/`, en: `${base}/en/map/` };
const THREADS = threadsData.map((t) => t.id);
const EPOCHS = world.readyEpochs.map((m) => m.id);
// Cards the family mode (FAMILY=all|12, default off) leaves on the map: counted from the data with the rules written out here.
const cards = world.published;
const MODE = process.env.FAMILY || 'off';
const TOTAL = cards.filter((e) => MODE === 'off' || (!e.sensitive && (String(e.min_age) === 'all' || (MODE === '12' && String(e.min_age) === '12')))).length;
const LIMIT = VARIANT ? 7 : 30; // DEFAULT_LIMIT in src/lib/markers.ts (the fixture build lowers it to 7)
// Epochs, threads and a card used by name below: the first ready epoch, the second (or the first), a thread that has some but not all
// of the cards, and one with cards in the second epoch.
const EP1 = EPOCHS[0];
const EP2 = EPOCHS[1] ?? EPOCHS[0];
const T1 = need('a thread with some but not all cards', () => threadsData.find((t) => cards.some((c) => c.threads.includes(t.id)) && cards.some((c) => !c.threads.includes(t.id)))).id;
const T2 = need('a thread with cards in the second ready epoch', () => threadsData.find((t) => world.inEpoch(EP2).some((c) => c.threads.includes(t.id)))).id;
// A thread that has a key (frame) card: its map shows a frame marker.
const TF = need('a thread with a frame card', () => threadsData.find((t) => cards.some((c) => c.level === 'frame' && c.threads.includes(t.id)))).id;
const N1 = world.inEpoch(EP1).length; // the cards of the first epoch; the Timeline / Grid switch exists from 9
const C0 = need('a card of the first ready epoch', () => world.inEpoch(EP1)[0]);
const STEP = 5;
const ONLY = process.argv.slice(2).filter((a) => a !== 'variant'); // optional section names: node map.mjs page nojs ...

let failed = 0;
const ok = (name, cond, extra = '') => {
  if (!cond) failed += 1;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const want = (name) => ONLY.length === 0 || ONLY.includes(name);

// 1x1 grey PNG
const TILE = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mO8/58BAAMCAQDvVTZlAAAAAElFTkSuQmCC', 'base64');
const browser = await launchBrowser();

/** Opens a page. `tiles`: 'ok' answers with a picture, 'fail' makes every tile request fail. */
const newPage = async ({ js = true, width = 360, height = 740, tiles = 'ok' } = {}) => {
  const page = await browser.newPage();
  await page.setViewport({ width, height, isMobile: width < 700, hasTouch: width < 700 });
  if (!js) await page.setJavaScriptEnabled(false);
  // FAMILY=all|12 runs the whole suite in a family mode (the limit of 7 must hold in every mode).
  if (process.env.FAMILY) await page.evaluateOnNewDocument((m) => localStorage.setItem('family', m), process.env.FAMILY);
  const requests = [];
  page.requests = requests;
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request', (r) => {
    requests.push(r.url());
    if (/tile\.openstreetmap\.org/.test(r.url())) {
      if (tiles === 'ok') r.respond({ status: 200, contentType: 'image/png', body: TILE });
      else r.abort('failed');
    } else r.continue();
  });
  return page;
};
const ready = (page) => page.waitForFunction(() => document.querySelector('[data-map]')?.dataset.state === 'ready', { timeout: 15000 });

/** What the map draws now and what the "In this area" list says. */
const snapshot = (page) =>
  page.evaluate(() => {
    const marks = [...document.querySelectorAll('.mk')].map((el) => el.dataset.key);
    const singles = marks.filter((k) => !k.startsWith('cluster:'));
    const clusters = marks.filter((k) => k.startsWith('cluster:')).map((k) => k.slice('cluster:'.length).split('+'));
    const list = [...document.querySelectorAll('[data-list-items] > li')].map((li) => li.dataset.id);
    const more = document.querySelector('[data-more]');
    return {
      total: marks.length,
      singles,
      clusters,
      covered: [...singles, ...clusters.flat()].sort(),
      list: list.slice().sort(),
      listCount: document.querySelector('[data-list-count]').textContent,
      moreVisible: !more.hidden && more.getBoundingClientRect().height > 0,
      search: location.search,
    };
  });
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

// ---------- 1. Without JavaScript ----------
if (want('nojs'))
  for (const lang of ['pt', 'en']) {
    const page = await newPage({ js: false });
    await page.goto(MAP[lang], { waitUntil: 'load' });
    const s = await page.evaluate(() => {
      const vis = (el) => !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0;
      const staticBlock = document.querySelector('[data-map-static]');
      return {
        mapVisible: vis(document.querySelector('[data-map]')),
        filtersVisible: vis(document.querySelector('.map-filters')),
        staticVisible: vis(staticBlock),
        links: [...staticBlock.querySelectorAll('li > a')].map((a) => a.getAttribute('href')),
        groups: staticBlock.querySelectorAll('h3').length,
        overflow: document.scrollingElement.scrollWidth - innerWidth,
      };
    });
    ok(`no JS (${lang}): the map block and the filters are not shown`, !s.mapVisible && !s.filtersVisible);
    ok(`no JS (${lang}): plain list of all cards by epoch (${TOTAL} cards, ${EPOCHS.length} epochs)`, s.staticVisible && s.links.length === TOTAL && s.groups === EPOCHS.length, `links=${s.links.length} groups=${s.groups}`);
    ok(`no JS (${lang}): every link leads to a card page`, s.links.every((h) => /\/(historia|story)\/[a-z0-9-]+\/$/.test(h)));
    ok(`no JS (${lang}): no horizontal overflow at 360px`, s.overflow <= 0, `overflow=${s.overflow}`);
    await page.close();
  }

// ---------- 2. Tiles do not load ----------
if (want('tiles')) {
  const page = await newPage({ tiles: 'fail' });
  await page.goto(MAP.pt, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => document.querySelector('[data-map]')?.dataset.state === 'unavailable', { timeout: 20000 }).catch(() => {});
  const s = await page.evaluate(() => {
    const vis = (el) => !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0;
    return {
      state: document.querySelector('[data-map]').dataset.state,
      message: document.querySelector('[data-map-unavailable]').textContent.trim(),
      messageVisible: vis(document.querySelector('[data-map-unavailable]')),
      staticVisible: vis(document.querySelector('[data-map-static]')),
      staticLinks: document.querySelectorAll('[data-map-static] li > a').length,
    };
  });
  ok('tiles fail: state "unavailable" and the message is shown', s.state === 'unavailable' && s.messageVisible && /indispon/i.test(s.message), s.message);
  ok('tiles fail: the plain list of all cards is shown', s.staticVisible && s.staticLinks === TOTAL, `links=${s.staticLinks}`);
  await page.close();
}

// ---------- 3. The map: limit, list equals markers, filters, zoom ----------
if (want('limit')) {
  const page = await newPage({ width: 1280, height: 900 });
  await page.goto(MAP.pt, { waitUntil: 'networkidle0' });
  await ready(page);
  await wait(700);

  let s = await snapshot(page);
  ok('map: whole country at first, within the marker limit', s.total >= 1 && s.total <= LIMIT, `total=${s.total}`);
  ok('map: markers and clusters together cover exactly the cards of the list "In this area"', same(s.covered, s.list), `covered=${s.covered.length} list=${s.list.length}`);
  ok('map: the list counter equals the list', Number(s.listCount) === s.list.length, `counter=${s.listCount}`);
  ok(`map: at first the list holds all ${TOTAL} cards the mode shows`, s.list.length === TOTAL, `n=${s.list.length}`);

  const attributionState = (p) =>
    p.evaluate(() => {
      const a = document.querySelector('.leaflet-control-attribution a[href*="openstreetmap.org/copyright"]');
      if (!a) return null;
      a.scrollIntoView({ block: 'center' });
      const r = a.getBoundingClientRect();
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return { visible: r.width > 0 && r.height > 0, clickable: hit === a || a.contains(hit), text: a.textContent };
    });
  const attribution = await attributionState(page);
  ok('map: attribution is visible and clickable (desktop)', attribution?.visible && attribution.clickable, JSON.stringify(attribution));
  {
    const phone = await newPage({ width: 360, height: 740 });
    await phone.goto(MAP.pt, { waitUntil: 'networkidle0' });
    await ready(phone);
    await wait(500);
    const closed = await attributionState(phone);
    ok('map: attribution is visible and clickable on a phone, sheet closed', closed?.visible && closed.clickable, JSON.stringify(closed));
    await phone.click('[data-sheet-toggle]');
    await wait(300);
    const opened = await attributionState(phone);
    ok('map: attribution is visible and clickable on a phone, sheet open', opened?.visible && opened.clickable, JSON.stringify(opened));
    await phone.close();
  }

  const zoom = async (p, dir) => {
    await p.click(`.leaflet-control-zoom-${dir}`).catch(() => {}); // a disabled button at the zoom limit is fine
    await wait(650);
  };

  const sample = async (p, label, results) => {
    const snap = await snapshot(p);
    results.n += 1;
    if (snap.total > 0) results.nonEmpty += 1;
    if (snap.total > LIMIT) results.over.push(`${label}: ${snap.total}`);
    if (!same(snap.covered, snap.list)) results.mismatch.push(`${label}: covered ${snap.covered.length} vs list ${snap.list.length}`);
    results.max = Math.max(results.max, snap.total);
    return snap;
  };

  // every thread, every epoch: from 3 steps out to 9 steps in. A fresh page for each, because a reload keeps the last view.
  const results = { n: 0, nonEmpty: 0, over: [], mismatch: [], max: 0 };
  const combos = [
    ...THREADS.map((fio) => ({ fio, epoca: null })),
    ...EPOCHS.map((epoca) => ({ fio: null, epoca })),
    { fio: T1, epoca: EP1 },
    { fio: null, epoca: null },
  ];
  for (const c of combos) {
    const p = await newPage({ width: 1280, height: 900 });
    await p.goto(MAP.pt, { waitUntil: 'networkidle0' });
    await ready(p);
    if (c.fio) await p.click(`.map-filters button[data-fio="${c.fio}"]`);
    if (c.epoca) await p.click(`.epoch-scale button[data-epoca="${c.epoca}"]`);
    await wait(700);
    const tag = `fio=${c.fio} epoca=${c.epoca}`;
    for (let i = 0; i < 3; i += 1) {
      await zoom(p, 'out');
      await sample(p, `${tag} out${i + 1}`, results);
    }
    for (let i = 0; i < 12; i += 1) {
      await zoom(p, 'in');
      await sample(p, `${tag} in${i + 1}`, results);
    }
    page.errors.push(...p.errors);
    await p.close();
  }
  // around cards: the link "?id=" centres the map on a card at zoom 14; look from there out to the whole country and in to the street
  const allIds = await page.evaluate(() => [...document.querySelectorAll('[data-list-items] > li')].map((li) => li.dataset.id));
  const around = allIds.filter((_, i) => i % 3 === 0);
  for (const id of around) {
    const p = await newPage({ width: 1280, height: 900 });
    await p.goto(`${MAP.pt}?id=${id}`, { waitUntil: 'networkidle0' });
    await ready(p);
    await wait(700);
    await sample(p, `id=${id} start`, results);
    for (let i = 0; i < 4; i += 1) {
      await zoom(p, 'in');
      await sample(p, `id=${id} in${i + 1}`, results);
    }
    for (let i = 0; i < 10; i += 1) {
      await zoom(p, 'out');
      await sample(p, `id=${id} out${i + 1}`, results);
    }
    page.errors.push(...p.errors);
    await p.close();
  }
  ok(`map: never more than ${LIMIT} markers and clusters (${results.n} views: every thread, every epoch, around ${around.length} cards, zoom out and in)`, results.over.length === 0, results.over.slice(0, 3).join('; ') || `max=${results.max}`);
  ok('map: in every view the list equals what the markers and clusters cover', results.mismatch.length === 0, results.mismatch.slice(0, 3).join('; '));
  ok('map: the sampling is not empty (at least 100 views show something)', results.nonEmpty >= 100, `${results.nonEmpty} of ${results.n}`);

  // "Show more": 7 -> 12 -> 17 for the same area, list unchanged
  await page.goto(MAP.pt, { waitUntil: 'networkidle0' });
  await ready(page);
  await wait(700);
  const before = await snapshot(page);
  // With fewer stories than the limit there are no clusters and the button is hidden; the mechanism is covered by tests/vitest/markers.spec.ts.
  const mechanism = TOTAL > LIMIT;
  ok('show more: the button is offered only while there are clusters', before.moreVisible === (before.clusters.length > 0));
  const totals = [before.total];
  for (let i = 0; mechanism && i < 2; i += 1) {
    await page.click('[data-more]');
    await wait(300);
    const snap = await snapshot(page);
    totals.push(snap.total);
    ok(`show more: press ${i + 1} stays within ${LIMIT + STEP * (i + 1)} and keeps the list`, snap.total <= LIMIT + STEP * (i + 1) && same(snap.list, before.list), `total=${snap.total}`);
  }
  ok('show more: each press draws more than the one before', !mechanism || totals[1] > totals[0] && totals[2] >= totals[1], totals.join(' -> '));
  let presses = 2;
  for (let i = 0; i < 10 && (await snapshot(page)).moreVisible; i += 1) {
    await page.click('[data-more]');
    presses += 1;
    await wait(250);
  }
  const done = await snapshot(page);
  ok('show more: enough presses draw every card as a single marker', !done.moreVisible && done.clusters.length === 0 && done.singles.length === TOTAL, `presses=${presses} singles=${done.singles.length}`);

  // a pan with the keyboard does not break the limit
  await page.goto(MAP.pt, { waitUntil: 'networkidle0' });
  await ready(page);
  await page.click('.leaflet-control-zoom-in');
  await wait(650);
  await page.focus('[data-map-canvas]');
  const pans = { n: 0, nonEmpty: 0, over: [], mismatch: [], max: 0 };
  for (const key of ['ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowRight', 'ArrowRight']) {
    for (let i = 0; i < 3; i += 1) await page.keyboard.press(key);
    await wait(500);
    await sample(page, `pan ${key}`, pans);
  }
  ok('map: panning keeps the limit and the list equals the markers', pans.over.length === 0 && pans.mismatch.length === 0, `max=${pans.max}`);
  ok('map: no script errors', page.errors.length === 0, page.errors.join('; '));
  await page.close();
}

// ---------- 4. Filters and the address ----------
if (want('filters')) {
  const page = await newPage({ width: 1280, height: 900 });
  await page.goto(`${MAP.pt}?fio=${T2}&epoca=${EP2}&utm=x&fio2=zzz`, { waitUntil: 'networkidle0' });
  await ready(page);
  await wait(600);
  let s = await page.evaluate(() => ({
    pressed: [...document.querySelectorAll('.map-filters [aria-pressed="true"], .epoch-scale [aria-pressed="true"]')].map((b) => b.dataset.fio ?? b.dataset.epoca),
    search: location.search,
  }));
  ok('filters: ?fio= and ?epoca= are read, unknown parameters are dropped from the address', s.pressed.includes(T2) && s.pressed.includes(EP2) && s.search === `?fio=${T2}&epoca=${EP2}`, `${s.pressed} ${s.search}`);
  let snap = await snapshot(page);
  ok('filters: the list holds only the cards of that thread and epoch', snap.list.length > 0 && snap.list.length < TOTAL, `n=${snap.list.length}`);
  await page.reload({ waitUntil: 'networkidle0' });
  await ready(page);
  s = await page.evaluate(() => location.search);
  ok('filters: state survives a reload', s === `?fio=${T2}&epoca=${EP2}`, s);

  await page.click('.map-filters button[data-fio=""]');
  await page.click('.epoch-scale button[data-epoca=""]');
  await wait(500);
  s = await page.evaluate(() => location.search);
  snap = await snapshot(page);
  ok('filters: "all" clears the address and the list shows every card again', s === '' && snap.list.length === TOTAL, `${s} ${snap.list.length}`);
  const hist = await page.evaluate(() => history.length);
  await page.click('.map-filters button[data-fio="mar"]');
  await page.click(`.epoch-scale button[data-epoca="${EP1}"]`);
  ok('filters: choosing chips does not grow the history', (await page.evaluate(() => history.length)) === hist);
  await page.close();
}

// ---------- 5. Preview and keyboard ----------
if (want('preview')) {
  const page = await newPage({ width: 360, height: 740 });
  await page.goto(MAP.pt, { waitUntil: 'networkidle0' });
  await ready(page);
  await wait(600);
  const marker = await page.evaluate(() => {
    const el = document.querySelector('.mk--frame');
    return { role: el.getAttribute('role'), tabindex: el.getAttribute('tabindex'), name: el.textContent.trim(), key: el.dataset.key };
  });
  ok('keyboard: a marker is a focusable button with a name', marker.role === 'button' && marker.tabindex === '0' && marker.name.length > 3, JSON.stringify(marker));

  // reach the marker with Tab (from the filters), open it with Enter
  await page.focus('.epoch-scale button[data-epoca=""]');
  let found = false;
  for (let i = 0; i < 30 && !found; i += 1) {
    await page.keyboard.press('Tab');
    found = await page.evaluate(() => document.activeElement?.classList.contains('mk--frame'));
  }
  ok('keyboard: Tab reaches the markers', found);
  const focusedKey = await page.evaluate(() => document.activeElement.dataset.key);
  await page.keyboard.press('Enter');
  await wait(400);
  let s = await page.evaluate(() => {
    const p = document.querySelector('[data-map-preview]');
    return {
      visible: !p.hidden && p.getBoundingClientRect().height > 0,
      focusInside: p.contains(document.activeElement) || document.activeElement === p,
      title: p.querySelector('[data-preview-title]').textContent,
      hook: p.querySelector('[data-preview-hook]').textContent,
      threads: [...p.querySelectorAll('.map__thread')].map((x) => x.textContent),
      href: p.querySelector('[data-preview-open]').getAttribute('href'),
      open: p.querySelector('[data-preview-open]').textContent.trim(),
      search: location.search,
    };
  });
  ok('preview: opens with Enter, focus moves into it', s.visible && s.focusInside);
  ok('preview: hook, thread and an "Open" button to the card', s.hook.length > 5 && s.threads.length >= 1 && /\/historia\/[a-z0-9-]+\/$/.test(s.href) && s.open === 'Abrir', `${s.title} | ${s.threads} | ${s.href}`);
  ok('preview: the address holds ?id= of the card', s.search === `?id=${focusedKey}`, s.search);
  await page.keyboard.press('Escape');
  await wait(300);
  s = await page.evaluate(() => ({
    hidden: document.querySelector('[data-map-preview]').hidden,
    focusOnMarker: document.activeElement?.dataset?.key,
    search: location.search,
  }));
  ok('preview: Escape closes it, focus returns to the marker, ?id= is gone', s.hidden && s.focusOnMarker === focusedKey && s.search === '', JSON.stringify(s));

  // cluster: a click zooms in, the limit holds
  const clusterKey = await page.evaluate(() => document.querySelector('.mk--cluster')?.dataset.key);
  if (clusterKey) {
    await page.click('.mk--cluster');
    await wait(900);
    const snap = await snapshot(page);
    ok('cluster: a click opens it (zooms in or shows more), the limit holds', snap.total <= LIMIT + STEP && !snap.singles.includes(clusterKey), `total=${snap.total}`);
  }
  await page.close();
}

// ---------- 6. List: sheet on a phone, column on a desktop ----------
if (want('layout')) {
  const phone = await newPage({ width: 360, height: 740 });
  await phone.goto(MAP.pt, { waitUntil: 'networkidle0' });
  await ready(phone);
  const p = await phone.evaluate(() => {
    const r = (sel) => document.querySelector(sel).getBoundingClientRect();
    const toggle = document.querySelector('[data-sheet-toggle]');
    return { list: r('[data-map-list]').toJSON(), stage: r('.map__stage').toJSON(), overflow: document.scrollingElement.scrollWidth - innerWidth, expanded: toggle.getAttribute('aria-expanded'), bodyShown: getComputedStyle(document.querySelector('[data-list-body]')).display !== 'none' };
  });
  ok('phone: the list is a sheet at the bottom of the map, closed at first', Math.abs(p.list.bottom - p.stage.bottom) < 4 && p.expanded === 'false' && !p.bodyShown, `listBottom=${p.list.bottom} stageBottom=${p.stage.bottom}`);
  ok('phone: no horizontal overflow at 360px', p.overflow <= 0, `overflow=${p.overflow}`);
  await phone.click('[data-sheet-toggle]');
  await wait(200);
  const open = await phone.evaluate(() => ({ expanded: document.querySelector('[data-sheet-toggle]').getAttribute('aria-expanded'), items: document.querySelectorAll('[data-list-items] > li').length, shown: getComputedStyle(document.querySelector('[data-list-body]')).display !== 'none' }));
  ok('phone: the toggle opens the sheet (aria-expanded) and the list is usable', open.expanded === 'true' && open.shown && open.items > 0);
  await phone.close();

  const desk = await newPage({ width: 1280, height: 900 });
  await desk.goto(MAP.pt, { waitUntil: 'networkidle0' });
  await ready(desk);
  const d = await desk.evaluate(() => {
    const r = (sel) => document.querySelector(sel).getBoundingClientRect();
    return { stage: r('.map__stage').toJSON(), list: r('[data-map-list]').toJSON(), toggle: getComputedStyle(document.querySelector('[data-sheet-toggle]')).display, overflow: document.scrollingElement.scrollWidth - innerWidth };
  });
  ok('desktop: the list is a column to the right of the map, always open', d.list.left >= d.stage.right - 1 && d.toggle === 'none', `listLeft=${d.list.left} stageRight=${d.stage.right}`);
  ok('desktop: no horizontal overflow', d.overflow <= 0);
  await desk.close();
}

// ---------- 7. Link from the card, and Back ----------
if (want('link')) {
  // the cards, as the map page knows them
  const probe = await newPage({ width: 1280, height: 900 });
  await probe.goto(MAP.pt, { waitUntil: 'networkidle0' });
  const cards = await probe.evaluate(() => JSON.parse(document.querySelector('[data-map-config]').textContent).cards);
  await probe.close();

  const centred = (p) =>
    p.evaluate(() => {
      const c = document.querySelector('[data-map-canvas]').getBoundingClientRect();
      const sel = document.querySelector('.mk--selected');
      const prev = document.querySelector('[data-map-preview]');
      if (!sel) return { selected: false };
      const r = sel.getBoundingClientRect();
      return {
        selected: true,
        key: sel.dataset.key,
        dx: Math.round(r.x + r.width / 2 - (c.x + c.width / 2)),
        dy: Math.round(r.y + r.height / 2 - (c.y + c.height / 2)),
        previewOpen: !prev.hidden,
        previewTitle: prev.querySelector('[data-preview-title]').textContent,
        search: location.search,
      };
    });

  // 1. every card: "Open on the map" centres the map on it and opens its preview
  const bad = [];
  for (const card of cards) {
    const p = await newPage({ width: 1280, height: 900 });
    // the bridge block is in layer 3, which #detalhes opens
    await p.goto(new URL(card.href, base).href + "#detalhes", { waitUntil: "networkidle0" });
    await Promise.all([p.waitForNavigation({ waitUntil: 'networkidle0' }), p.click('.bridge a[href*="/mapa/"]')]);
    await ready(p);
    await wait(500);
    const s = await centred(p);
    const okCard = s.selected && s.key === card.id && Math.abs(s.dx) <= 3 && Math.abs(s.dy) <= 3 && s.previewOpen && s.previewTitle === card.title && s.search === `?id=${card.id}`;
    if (!okCard) bad.push(`${card.id} ${JSON.stringify(s)}`);
    await p.close();
  }
  ok(`link: "Open on the map" centres the map on the card and opens its preview (all ${cards.length} cards, pt)`, bad.length === 0, bad.slice(0, 2).join(' | '));

  const en = await newPage({ width: 360, height: 740 });
  await en.goto(`${base}${enPath(C0)}#detalhes`, { waitUntil: 'networkidle0' });
  await Promise.all([en.waitForNavigation({ waitUntil: 'networkidle0' }), en.click('.bridge a[href*="/map/"]')]);
  await ready(en);
  await wait(500);
  const se = await centred(en);
  ok('link: the same in English on a phone', se.selected && Math.abs(se.dx) <= 3 && Math.abs(se.dy) <= 3 && se.previewOpen && new RegExp(`\\?id=${C0.id}$`).test(se.search), JSON.stringify(se));
  const pageUrl = en.url();
  await en.close();
  ok('link: the address is /en/map/?id=<id>', new RegExp(`/en/map/\\?id=${C0.id}$`).test(pageUrl), pageUrl);

  // 2. filters that would hide the card are cleared, so the link always shows its card
  const odd = cards.find((c) => !c.threads.includes(T1));
  const f = await newPage({ width: 1280, height: 900 });
  await f.goto(`${MAP.pt}?fio=${T1}&id=${odd.id}`, { waitUntil: 'networkidle0' });
  await ready(f);
  await wait(500);
  const sf = await centred(f);
  const pressed = await f.evaluate(() => [...document.querySelectorAll('.map-filters [aria-pressed="true"], .epoch-scale [aria-pressed="true"]')].map((b) => b.dataset.fio ?? b.dataset.epoca));
  ok('link: filters that would hide the card are cleared', sf.selected && sf.key === odd.id && pressed.every((v) => v === '') && sf.search === `?id=${odd.id}`, JSON.stringify({ sf, pressed }));
  await f.close();

  // 3. Unknown id is ignored
  const u = await newPage({ width: 1280, height: 900 });
  await u.goto(`${MAP.pt}?id=nao-existe`, { waitUntil: 'networkidle0' });
  await ready(u);
  const su = await u.evaluate(() => ({ preview: !document.querySelector('[data-map-preview]').hidden, search: location.search }));
  ok('link: an unknown id is ignored (no preview, address cleaned)', !su.preview && su.search === '', JSON.stringify(su));
  await u.close();

  // 4. Preview -> card -> Back: same address, same preview, same place on the screen
  for (const [label, query, zoomSteps] of [
    ['all cards', '', 1],
    ['thread filter', `?fio=${TF}`, 0],
  ]) {
    const p = await newPage({ width: 1280, height: 900 });
    await p.goto(`${MAP.pt}${query}`, { waitUntil: 'networkidle0' });
    await ready(p);
    await wait(600);
    for (let i = 0; i < zoomSteps; i += 1) {
      await p.click('.leaflet-control-zoom-in');
      await wait(650);
    }
    // pick a single frame marker that is on the screen and not covered
    const key = await p.evaluate(() => document.querySelector('.mk--frame')?.dataset.key);
    await p.click(`.mk[data-key="${key}"]`);
    await wait(500);
    const before = await centred(p);
    const beforeList = (await snapshot(p)).list;
    await Promise.all([p.waitForNavigation({ waitUntil: 'networkidle0' }), p.click('[data-preview-open]')]);
    const onCard = /\/historia\//.test(p.url());
    await Promise.all([p.waitForNavigation({ waitUntil: 'networkidle0' }), p.goBack()]);
    await ready(p);
    await wait(700);
    const after = await centred(p);
    const afterList = (await snapshot(p)).list;
    const pressed = await p.evaluate(() => [...document.querySelectorAll('.map-filters [aria-pressed="true"], .epoch-scale [aria-pressed="true"]')].map((b) => b.dataset.fio ?? b.dataset.epoca));
    ok(
      `back (${label}): the map returns to the same address, preview, filters and place on the screen`,
      onCard && after.selected && after.key === before.key && after.previewOpen && after.search === before.search && Math.abs(after.dx - before.dx) <= 3 && Math.abs(after.dy - before.dy) <= 3 && same(afterList, beforeList) && pressed.includes(query ? TF : ''),
      JSON.stringify({ before, after })
    );
    await p.close();
  }
}

// ---------- 7b. Map on the epoch page ----------
if (want('epoch')) {
  const EPOCH = `${base}/pt/epoca/${EP1}/`;
  const marks = (p) =>
    p.evaluate(() => {
      const keys = [...document.querySelectorAll('.mk')].map((el) => el.dataset.key);
      const singles = keys.filter((k) => !k.startsWith('cluster:'));
      const clusters = keys.filter((k) => k.startsWith('cluster:')).map((k) => k.slice(8).split('+'));
      return { total: keys.length, singles, covered: [...singles, ...clusters.flat()].sort(), selected: document.querySelector('.mk--selected')?.dataset.key ?? null };
    });
  const cfgCards = (p) => p.evaluate(() => JSON.parse(document.querySelector('[data-map-config]').textContent).cards);
  const inView = (p, sel) =>
    p.evaluate((q) => {
      const r = document.querySelector(q).getBoundingClientRect();
      return r.top >= 0 && r.top < innerHeight && r.bottom > 0;
    }, sel);

  // 1. Without JavaScript: the plain feed, nothing about the map
  {
    const p = await newPage({ js: false, width: 1280, height: 900 });
    await p.goto(EPOCH, { waitUntil: 'load' });
    const s = await p.evaluate(() => {
      const vis = (el) => !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0;
      return { aside: vis(document.querySelector('[data-epoch-aside]')), panes: vis(document.querySelector('.panes')), map: vis(document.querySelector('[data-map]')), cards: document.querySelectorAll('ol.feed > li').length, feedWidth: document.querySelector('.epoch__feed').getBoundingClientRect().width, overflow: document.scrollingElement.scrollWidth - innerWidth };
    });
    ok('epoch, no JS: no map, no pane switch, the whole feed', !s.aside && !s.panes && !s.map && s.cards === N1 && s.overflow <= 0, JSON.stringify(s));
    await p.close();
  }

  // 2. Desktop: feed left, map right and sticky
  {
    const p = await newPage({ width: 1280, height: 800 });
    await p.goto(EPOCH, { waitUntil: 'networkidle0' });
    await ready(p);
    await wait(500);
    const before = await p.evaluate(() => ({ feed: document.querySelector('.epoch__feed').getBoundingClientRect().toJSON(), aside: document.querySelector('.epoch__aside').getBoundingClientRect().toJSON(), panes: getComputedStyle(document.querySelector('.panes')).display }));
    ok('epoch, desktop: feed on the left, map on the right, no pane switch', before.aside.left >= before.feed.right - 1 && before.panes === 'none', JSON.stringify({ feedRight: before.feed.right, asideLeft: before.aside.left }));
    // "Sticky" only means something when the feed is longer than the map: the fixture build has a long epoch, the real one (five cards) does not.
    const room = await p.evaluate(() => document.querySelector('.epoch__feed').getBoundingClientRect().height - document.querySelector('.epoch__aside').getBoundingClientRect().height);
    await p.evaluate(() => document.querySelector('.epoch__body').scrollIntoView());
    await p.evaluate(() => window.scrollBy(0, 700));
    await wait(300);
    const after = await p.evaluate(() => document.querySelector('.epoch__aside').getBoundingClientRect().toJSON());
    if (room > 800) ok('epoch, desktop: the map stays on screen while the feed scrolls', after.top >= 0 && after.top < 100 && after.bottom <= 800, JSON.stringify(after));
    else ok('epoch, desktop: a short feed (shorter than the map plus a screen): the map scrolls away with the page, nothing is pinned over the footer', after.bottom > 0 || after.top < 0, `room=${Math.round(room)} ${JSON.stringify(after)}`);
    await p.close();
  }

  // 3. Phone: pane switch, and the map code waits for the Map pane
  {
    const p = await newPage({ width: 360, height: 740 });
    await p.goto(EPOCH, { waitUntil: 'networkidle0' });
    await wait(600);
    const st = () =>
      p.evaluate(() => {
        const vis = (el) => getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0;
        return { feed: vis(document.querySelector('.epoch__feed')), map: vis(document.querySelector('.epoch__aside')), view: vis(document.querySelector('.view-switch')), pressed: [...document.querySelectorAll('[data-pane-btn][aria-pressed="true"]')].map((b) => b.dataset.paneBtn), overflow: document.scrollingElement.scrollWidth - innerWidth };
      });
    let s = await st();
    ok('epoch, phone: the timeline is shown first, the map is not', s.feed && !s.map && s.view === (N1 >= 9) && s.pressed[0] === 'feed', JSON.stringify(s));
    // The map code is fetched as soon as the page has loaded (map-loader.ts), but the map is drawn, and its tiles fetched, only when
    // the pane that holds it is on the screen.
    ok('epoch, phone: the map code is fetched at once, but no tile before the Map pane is opened', p.requests.some((u) => /map-island/.test(u)) && p.requests.filter((u) => /tile\.openstreetmap/i.test(u)).length === 0);
    await p.click('[data-pane-btn="map"]');
    await ready(p);
    await wait(600);
    s = await st();
    ok('epoch, phone: the Map pane shows the map and hides the feed and the grid switch', !s.feed && s.map && !s.view && s.pressed[0] === 'map' && s.overflow <= 0, JSON.stringify(s));
    ok('epoch, phone: ...and now the map code is loaded', p.requests.some((u) => /map-island/.test(u)));
    const m = await marks(p);
    ok('epoch, phone: within the marker limit', m.total >= 1 && m.total <= LIMIT, `total=${m.total}`);
    // choose a marker on the map, then go back to the feed: the record is highlighted and scrolled into view
    await p.click('.mk--frame');
    await wait(400);
    const chosen = (await marks(p)).selected;
    await p.click('[data-pane-btn="feed"]');
    await wait(900);
    const rec = await p.evaluate((id) => { const li = document.getElementById(`c-${id}`)?.closest('li'); return li ? { active: li.hasAttribute('data-active'), top: li.getBoundingClientRect().top, h: innerHeight } : null; }, chosen);
    ok('epoch, phone: back on the timeline the record of the chosen marker is highlighted and in view', chosen && rec?.active && rec.top > -50 && rec.top < rec.h, JSON.stringify({ chosen, rec }));
    await p.close();
  }

  // 4. Marker <-> feed record
  {
    const p = await newPage({ width: 1280, height: 800 });
    await p.goto(EPOCH, { waitUntil: 'networkidle0' });
    await ready(p);
    await wait(600);
    const key = await p.evaluate(() => [...document.querySelectorAll('.mk--frame')].map((e) => e.dataset.key).pop());
    await p.click(`.mk[data-key="${key}"]`);
    await wait(1200);
    const r = await p.evaluate((id) => { const li = document.getElementById(`c-${id}`).closest('li'); const b = li.getBoundingClientRect(); return { active: li.hasAttribute('data-active'), others: document.querySelectorAll('.feed > li[data-active]').length, inView: b.top >= 0 && b.bottom <= innerHeight, shadow: getComputedStyle(li.querySelector('article')).boxShadow }; }, key);
    ok('epoch: a marker highlights its record in the feed and scrolls to it', r.active && r.others === 1 && r.inView && r.shadow !== 'none', JSON.stringify(r));

    // a record chosen in the feed highlights its marker (the first record, then the last)
    const ids = await p.evaluate(() => [...document.querySelectorAll('.feed > li article')].map((a) => a.id.slice(2)));
    for (const id of [ids[0], ids[ids.length - 1]]) {
      await p.evaluate((x) => document.getElementById(`c-${x}`).scrollIntoView({ block: 'center' }), id);
      await p.click(`#c-${id} .ecard__meta`);
      await wait(700);
      const m = await marks(p);
      ok(`epoch: choosing the record ${id} highlights its marker`, m.selected === id && m.singles.includes(id), JSON.stringify(m.selected));
    }

    // the keyboard: reaching a record with Tab chooses its marker too
    await p.evaluate((x) => document.getElementById(`c-${x}`).scrollIntoView({ block: 'center' }), ids[2]);
    await p.focus(`#c-${ids[2]} .ecard__title a`);
    await wait(700);
    ok('epoch: a record reached with the keyboard highlights its marker', (await marks(p)).selected === ids[2]);
    await p.close();
  }

  // 5. Thread filter drives the map; limit holds
  {
    for (const fio of THREADS) {
      const p = await newPage({ width: 1280, height: 900 });
      await p.goto(EPOCH, { waitUntil: 'networkidle0' });
      await ready(p);
      await wait(500);
      const cards = await cfgCards(p);
      const wanted = cards.filter((c) => c.threads.includes(fio)).map((c) => c.id).sort();
      await p.click(`[data-epoch-tools] button[data-fio="${fio}"]`);
      await wait(900);
      let worst = 0;
      let coveredOk = true;
      for (let i = 0; i < 6; i += 1) {
        const m = await marks(p);
        worst = Math.max(worst, m.total);
        if (m.covered.some((id) => !wanted.includes(id))) coveredOk = false;
        await p.click('.leaflet-control-zoom-out').catch(() => {});
        await wait(500);
      }
      const m0 = await marks(p);
      ok(`epoch: thread ${fio}: the map shows only its cards (${wanted.length}), at most ${LIMIT} markers and clusters`, coveredOk && worst <= LIMIT && worst >= (wanted.length ? 1 : 0), `worst=${worst}`);
      const feedIds = await p.evaluate(() => [...document.querySelectorAll('.feed > li:not([hidden]) article')].map((a) => a.id.slice(2)).sort());
      ok(`epoch: thread ${fio}: feed and map have the same cards`, feedIds.join() === wanted.join() && m0.covered.every((id) => feedIds.includes(id)), `${feedIds.length} vs ${wanted.length}`);
      await p.close();
    }
    // the address: ?fio= at load, and "All" again
    const p = await newPage({ width: 1280, height: 900 });
    await p.goto(`${EPOCH}?fio=${T1}`, { waitUntil: 'networkidle0' });
    await ready(p);
    await wait(900);
    const cards = await cfgCards(p);
    const mar = cards.filter((c) => c.threads.includes(T1)).map((c) => c.id);
    let m = await marks(p);
    ok('epoch: ?fio=thread at load: the map shows only that thread', m.covered.length > 0 && m.covered.every((id) => mar.includes(id)), `covered=${m.covered.length} mar=${mar.length}`);
    await p.click('[data-epoch-tools] button[data-fio=""]');
    await wait(900);
    m = await marks(p);
    ok('epoch: "All" brings every card back to the map', m.covered.length === cards.length, `covered=${m.covered.length} of ${cards.length}`);
    await p.close();
  }

  // 6. Tiles fail: the feed takes the whole width
  {
    const p = await newPage({ width: 1280, height: 900, tiles: 'fail' });
    await p.goto(EPOCH, { waitUntil: 'networkidle0' });
    await p.waitForFunction(() => document.querySelector('[data-epoch-page]')?.dataset.map === 'unavailable', { timeout: 20000 }).catch(() => {});
    const s = await p.evaluate(() => ({ map: document.querySelector('[data-epoch-page]').dataset.map, aside: !document.querySelector('[data-epoch-aside]').hidden, panes: !document.querySelector('.panes').hidden, feed: document.querySelector('.epoch__feed').getBoundingClientRect().width, container: document.querySelector('.epoch').getBoundingClientRect().width, cards: document.querySelectorAll('.feed > li').length }));
    ok('epoch, tiles fail: the map and the pane switch go away, the feed stays and gets the width', s.map === 'unavailable' && !s.aside && !s.panes && s.cards === N1 && s.feed > s.container * 0.9, JSON.stringify(s));
    await p.close();
  }

  // 7. Feed and grid at the widths where the feed column is narrower (docs/visual-notes.md, note 3)
  for (const width of [900, 960, 1100, 1280, 1440]) {
    const p = await newPage({ width, height: 900 });
    for (const vista of ['', '?vista=grelha']) {
      await p.goto(`${EPOCH}${vista}`, { waitUntil: 'networkidle0' });
      await wait(300);
      const s = await p.evaluate(() => {
        const feed = document.querySelector('ol.feed');
        const cols = getComputedStyle(feed).gridTemplateColumns;
        const cards = [...document.querySelectorAll('.ecard')];
        const wide = cards.filter((c) => c.scrollWidth > c.clientWidth + 1).length;
        return { overflow: document.scrollingElement.scrollWidth - innerWidth, columns: feed.dataset.view === 'grid' ? cols.split(' ').length : 1, clipped: wide, feed: Math.round(document.querySelector('.epoch__feed').getBoundingClientRect().width) };
      });
      ok(`epoch ${width}px ${vista ? 'grid' : 'timeline'}: no overflow, no clipped card`, s.overflow <= 0 && s.clipped === 0, JSON.stringify(s));
    }
    await p.close();
  }
}

// ---------- 8. Map code only where a map is ----------
if (want('weight')) {
  const heavy = /map-island|leaflet/i;
  const pages = [
    ['card', `${base}${pt(C0)}`],
    ['thread', `${base}/pt/fio/mar/`],
    ['about', `${base}/pt/sobre/`],
  ];
  for (const [name, url] of pages) {
    const page = await newPage();
    await page.goto(url, { waitUntil: 'networkidle0' });
    const found = page.requests.filter((u) => heavy.test(u));
    ok(`weight: ${name} does not load map code`, found.length === 0, found.join(' '));
    await page.close();
  }
  // The home page has no map: it never loads map code, even when scrolled to the bottom.
  for (const lang of ['pt', 'en']) {
    const home = await newPage({ width: 1280, height: 500 });
    await home.goto(`${base}/${lang}/`, { waitUntil: 'networkidle0' });
    await home.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await wait(1000);
    ok(`weight: home ${lang} loads no map code`, home.requests.filter((u) => heavy.test(u) || /home-map|leaflet/i.test(u)).length === 0, home.requests.filter((u) => heavy.test(u)).join(' '));
    await home.close();
  }
  // The map code is fetched as soon as the page has loaded (map-loader.ts), but the map is drawn, and its tiles fetched, only when
    // the pane that holds it is on the screen.
    ok('epoch, phone: the map code is fetched at once, but no tile before the Map pane is opened', p.requests.some((u) => /map-island/.test(u)) && p.requests.filter((u) => /tile\.openstreetmap/i.test(u)).length === 0);
    await p.click('[data-pane-btn="map"]');
    await ready(p);
    await wait(600);
    s = await st();
    ok('epoch, phone: the Map pane shows the map and hides the feed and the grid switch', !s.feed && s.map && !s.view && s.pressed[0] === 'map' && s.overflow <= 0, JSON.stringify(s));
    ok('epoch, phone: ...and now the map code is loaded', p.requests.some((u) => /map-island/.test(u)));
    const m = await marks(p);
    ok('epoch, phone: within the marker limit', m.total >= 1 && m.total <= LIMIT, `total=${m.total}`);
    // choose a marker on the map, then go back to the feed: the record is highlighted and scrolled into view
    await p.click('.mk--frame');
    await wait(400);
    const chosen = (await marks(p)).selected;
    await p.click('[data-pane-btn="feed"]');
    await wait(900);
    const rec = await p.evaluate((id) => { const li = document.getElementById(`c-${id}`)?.closest('li'); return li ? { active: li.hasAttribute('data-active'), top: li.getBoundingClientRect().top, h: innerHeight } : null; }, chosen);
    ok('epoch, phone: back on the timeline the record of the chosen marker is highlighted and in view', chosen && rec?.active && rec.top > -50 && rec.top < rec.h, JSON.stringify({ chosen, rec }));
    await p.close();
  }

  // 4. Marker <-> feed record
  {
    const p = await newPage({ width: 1280, height: 800 });
    await p.goto(EPOCH, { waitUntil: 'networkidle0' });
    await ready(p);
    await wait(600);
    const key = await p.evaluate(() => [...document.querySelectorAll('.mk--frame')].map((e) => e.dataset.key).pop());
    await p.click(`.mk[data-key="${key}"]`);
    await wait(1200);
    const r = await p.evaluate((id) => { const li = document.getElementById(`c-${id}`).closest('li'); const b = li.getBoundingClientRect(); return { active: li.hasAttribute('data-active'), others: document.querySelectorAll('.feed > li[data-active]').length, inView: b.top >= 0 && b.bottom <= innerHeight, shadow: getComputedStyle(li.querySelector('article')).boxShadow }; }, key);
    ok('epoch: a marker highlights its record in the feed and scrolls to it', r.active && r.others === 1 && r.inView && r.shadow !== 'none', JSON.stringify(r));

    // a record chosen in the feed highlights its marker (the first record, then the last)
    const ids = await p.evaluate(() => [...document.querySelectorAll('.feed > li article')].map((a) => a.id.slice(2)));
    for (const id of [ids[0], ids[ids.length - 1]]) {
      await p.evaluate((x) => document.getElementById(`c-${x}`).scrollIntoView({ block: 'center' }), id);
      await p.click(`#c-${id} .ecard__meta`);
      await wait(700);
      const m = await marks(p);
      ok(`epoch: choosing the record ${id} highlights its marker`, m.selected === id && m.singles.includes(id), JSON.stringify(m.selected));
    }

    // the keyboard: reaching a record with Tab chooses its marker too
    await p.evaluate((x) => document.getElementById(`c-${x}`).scrollIntoView({ block: 'center' }), ids[2]);
    await p.focus(`#c-${ids[2]} .ecard__title a`);
    await wait(700);
    ok('epoch: a record reached with the keyboard highlights its marker', (await marks(p)).selected === ids[2]);
    await p.close();
  }

  // 5. Thread filter drives the map; limit holds
  {
    for (const fio of THREADS) {
      const p = await newPage({ width: 1280, height: 900 });
      await p.goto(EPOCH, { waitUntil: 'networkidle0' });
      await ready(p);
      await wait(500);
      const cards = await cfgCards(p);
      const wanted = cards.filter((c) => c.threads.includes(fio)).map((c) => c.id).sort();
      await p.click(`[data-epoch-tools] button[data-fio="${fio}"]`);
      await wait(900);
      let worst = 0;
      let coveredOk = true;
      for (let i = 0; i < 6; i += 1) {
        const m = await marks(p);
        worst = Math.max(worst, m.total);
        if (m.covered.some((id) => !wanted.includes(id))) coveredOk = false;
        await p.click('.leaflet-control-zoom-out').catch(() => {});
        await wait(500);
      }
      const m0 = await marks(p);
      ok(`epoch: thread ${fio}: the map shows only its cards (${wanted.length}), at most ${LIMIT} markers and clusters`, coveredOk && worst <= LIMIT && worst >= (wanted.length ? 1 : 0), `worst=${worst}`);
      const feedIds = await p.evaluate(() => [...document.querySelectorAll('.feed > li:not([hidden]) article')].map((a) => a.id.slice(2)).sort());
      ok(`epoch: thread ${fio}: feed and map have the same cards`, feedIds.join() === wanted.join() && m0.covered.every((id) => feedIds.includes(id)), `${feedIds.length} vs ${wanted.length}`);
      await p.close();
    }
    // the address: ?fio= at load, and "All" again
    const p = await newPage({ width: 1280, height: 900 });
    await p.goto(`${EPOCH}?fio=${T1}`, { waitUntil: 'networkidle0' });
    await ready(p);
    await wait(900);
    const cards = await cfgCards(p);
    const mar = cards.filter((c) => c.threads.includes(T1)).map((c) => c.id);
    let m = await marks(p);
    ok('epoch: ?fio=thread at load: the map shows only that thread', m.covered.length > 0 && m.covered.every((id) => mar.includes(id)), `covered=${m.covered.length} mar=${mar.length}`);
    await p.click('[data-epoch-tools] button[data-fio=""]');
    await wait(900);
    m = await marks(p);
    ok('epoch: "All" brings every card back to the map', m.covered.length === cards.length, `covered=${m.covered.length} of ${cards.length}`);
    await p.close();
  }

  // 6. Tiles fail: the feed takes the whole width
  {
    const p = await newPage({ width: 1280, height: 900, tiles: 'fail' });
    await p.goto(EPOCH, { waitUntil: 'networkidle0' });
    await p.waitForFunction(() => document.querySelector('[data-epoch-page]')?.dataset.map === 'unavailable', { timeout: 20000 }).catch(() => {});
    const s = await p.evaluate(() => ({ map: document.querySelector('[data-epoch-page]').dataset.map, aside: !document.querySelector('[data-epoch-aside]').hidden, panes: !document.querySelector('.panes').hidden, feed: document.querySelector('.epoch__feed').getBoundingClientRect().width, container: document.querySelector('.epoch').getBoundingClientRect().width, cards: document.querySelectorAll('.feed > li').length }));
    ok('epoch, tiles fail: the map and the pane switch go away, the feed stays and gets the width', s.map === 'unavailable' && !s.aside && !s.panes && s.cards === N1 && s.feed > s.container * 0.9, JSON.stringify(s));
    await p.close();
  }

  // 7. Feed and grid at the widths where the feed column is narrower (docs/visual-notes.md, note 3)
  for (const width of [900, 960, 1100, 1280, 1440]) {
    const p = await newPage({ width, height: 900 });
    for (const vista of ['', '?vista=grelha']) {
      await p.goto(`${EPOCH}${vista}`, { waitUntil: 'networkidle0' });
      await wait(300);
      const s = await p.evaluate(() => {
        const feed = document.querySelector('ol.feed');
        const cols = getComputedStyle(feed).gridTemplateColumns;
        const cards = [...document.querySelectorAll('.ecard')];
        const wide = cards.filter((c) => c.scrollWidth > c.clientWidth + 1).length;
        return { overflow: document.scrollingElement.scrollWidth - innerWidth, columns: feed.dataset.view === 'grid' ? cols.split(' ').length : 1, clipped: wide, feed: Math.round(document.querySelector('.epoch__feed').getBoundingClientRect().width) };
      });
      ok(`epoch ${width}px ${vista ? 'grid' : 'timeline'}: no overflow, no clipped card`, s.overflow <= 0 && s.clipped === 0, JSON.stringify(s));
    }
    await p.close();
  }
}

// ---------- 8. Map code only where a map is ----------
if (want('weight')) {
  const heavy = /map-island|leaflet/i;
  const pages = [
    ['card', `${base}${pt(C0)}`],
    ['thread', `${base}/pt/fio/mar/`],
    ['about', `${base}/pt/sobre/`],
  ];
  for (const [name, url] of pages) {
    const page = await newPage();
    await page.goto(url, { waitUntil: 'networkidle0' });
    const found = page.requests.filter((u) => heavy.test(u));
    ok(`weight: ${name} does not load map code`, found.length === 0, found.join(' '));
    await page.close();
  }
  // The home page has no map: it never loads map code, even when scrolled to the bottom.
  for (const lang of ['pt', 'en']) {
    const home = await newPage({ width: 1280, height: 500 });
    await home.goto(`${base}/${lang}/`, { waitUntil: 'networkidle0' });
    await home.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await wait(1000);
    ok(`weight: home ${lang} loads no map code`, home.requests.filter((u) => heavy.test(u) || /home-map|leaflet/i.test(u)).length === 0, home.requests.filter((u) => heavy.test(u)).join(' '));
    await home.close();
  }
  // The map code is fetched as soon as the page has loaded, even when the block is far below the screen (a very short one).
  const page = await newPage({ width: 360, height: 100 });
  await page.goto(MAP.pt, { waitUntil: 'networkidle0' });
  await wait(500);
  ok('weight: on the map page the map code and its styles are fetched at once, not when the block comes into view', page.requests.some((u) => /map-island/.test(u)) && page.requests.some((u) => /(MapBlock|leaflet)[^/]*\.css/.test(u)));
  await page.close();
}

await browser.close();
console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll map checks passed');
process.exit(failed ? 1 : 0);

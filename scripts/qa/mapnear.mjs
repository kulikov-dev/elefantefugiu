// Browser checks for the map page tools: "Near me" (a fake position, a denied one), the list with hooks and distances, "Whole world"
// and the plate for stories overseas, the marker style and legend, the epoch scale under the map.
// Run against dist/ served by serve.mjs (base path "/"):   node mapnear.mjs [tools near list world markers scale]
import { launchBrowser } from './browser.mjs';
import { epochs, fixture, overseasOf, real } from './data.mjs';

// `variant` runs against the fixture build (more cards than its marker limit of 7, so clusters exist); the rest runs on the real site.
const VARIANT = process.argv[2] === 'variant';
const base = VARIANT ? process.env.VARIANT_URL || 'http://localhost:4401' : process.env.BASE_URL || 'http://localhost:4400';
const world = VARIANT ? fixture : real;
const EPOCHS_ALL = epochs.length;
const EPOCHS_READY = world.readyEpochs.length;
const OVERSEAS = overseasOf(world.published).length;
const ONLY = process.argv.slice(2).filter((a) => a !== 'variant');
const want = (name) => ONLY.length === 0 || ONLY.includes(name);
const MAP = { pt: '/pt/mapa/', en: '/en/map/', ru: '/ru/karta/' };
const LISBON = { latitude: 38.7075, longitude: -9.1364 }; // Praça do Comércio
const TOKYO = { latitude: 35.68, longitude: 139.76 };

let failed = 0;
const ok = (name, cond, extra = '') => {
  if (!cond) failed += 1;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
};
const browser = await launchBrowser();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const open = async (path, { width = 1280, height = 900, position = null, denied = false } = {}) => {
  const context = await browser.createBrowserContext();
  if (!denied) await context.overridePermissions(base, ['geolocation']);
  const page = await context.newPage();
  page.close = () => context.close();
  await page.setViewport({ width, height });
  if (position) await page.setGeolocation({ ...position, accuracy: 20 });
  page.errors = [];
  page.dialogs = 0;
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('dialog', (d) => {
    page.dialogs += 1;
    d.dismiss();
  });
  await page.goto(`${base}${path}`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.map[data-state="ready"]', { timeout: 15000 });
  return page;
};

// ---------- 1. Tools under the zoom ----------
if (want('tools')) {
  for (const lang of ['pt', 'en', 'ru']) {
    const page = await open(MAP[lang]);
    const t = await page.evaluate(() => {
      const zoom = document.querySelector('.leaflet-control-zoom').getBoundingClientRect();
      return [...document.querySelectorAll('.map__tools a')].map((a) => ({ title: a.title, label: a.getAttribute('aria-label'), top: a.getBoundingClientRect().top >= zoom.bottom, w: a.getBoundingClientRect().width, h: a.getBoundingClientRect().height }));
    });
    ok(`tools (${lang}): three icon buttons under the zoom, each with a title and the same name for screen readers, at least 44 px`, t.length === 3 && t.every((b) => b.top && b.w >= 44 && b.h >= 44 && b.title && b.title === b.label), JSON.stringify(t.map((b) => b.title)));
    if (lang === 'pt') ok('tools (pt): the titles are Perto de mim / Portugal inteiro / O mundo todo', t.map((b) => b.title).join('|') === 'Perto de mim|Portugal inteiro|O mundo todo', t.map((b) => b.title).join(' | '));
    if (lang === 'en') ok('tools (en): the titles are Near me / All of Portugal / Whole world', t.map((b) => b.title).join('|') === 'Near me|All of Portugal|Whole world', t.map((b) => b.title).join(' | '));
    if (lang === 'ru') ok('tools (ru): the titles are Рядом со мной / Вся Португалия / Весь мир', t.map((b) => b.title).join('|') === 'Рядом со мной|Вся Португалия|Весь мир', t.map((b) => b.title).join(' | '));
    ok(`tools (${lang}): the old text button "All of Portugal" is gone`, (await page.$('[data-map-home]')) === null);
    await page.close();
  }
}

// ---------- 2. Near me ----------
if (want('near')) {
  const page = await open(MAP.pt, { position: LISBON });
  await page.click('.map__tools a:nth-child(1)');
  await page.waitForSelector('.mk--me', { timeout: 8000 });
  await wait(600);
  const n = await page.evaluate(() => {
    const metas = [...document.querySelectorAll('.map__items li')].map((li) => li.querySelector('.map__item-meta').textContent);
    return { me: document.querySelectorAll('.mk--me').length, metas: metas.slice(0, 4), pressed: document.querySelector('.map__tools a:nth-child(1)').getAttribute('aria-pressed'), legend: !document.querySelector('[data-legend-here]').hidden };
  });
  ok('near me: the position is marked and the legend names it', n.me === 1 && n.legend && n.pressed === 'true', JSON.stringify(n));
  ok('near me: every line of the list ends with a distance ("a 350 m", "a 2,1 km", "aqui mesmo")', n.metas.length > 0 && n.metas.every((m) => /a \d+(,\d)? (m|km)$|aqui mesmo$/.test(m)), n.metas.join(' | '));
  const order = await page.evaluate(() => [...document.querySelectorAll('.map__items li .map__item-meta')].map((m) => m.textContent.match(/a (\d+(?:,\d)?) (m|km)$/)).map((x) => (x ? parseFloat(x[1].replace(',', '.')) * (x[2] === 'km' ? 1000 : 1) : 0)));
  ok('near me: the distances only grow down the list', order.every((v, i) => i === 0 || v >= order[i - 1]), order.join(' '));
  ok('near me: no pop-up dialog and no script error', page.dialogs === 0 && page.errors.length === 0, page.errors.join('; '));
  await page.click('.map__tools a:nth-child(1)');
  await wait(300);
  ok('near me: a second press removes the marker and the distances', (await page.$$('.mk--me')).length === 0 && (await page.$$eval('.map__items .map__item-meta', (m) => m.every((x) => !/ a \d/.test(x.textContent)))));
  await page.close();

  const keep = await open(MAP.pt, { position: LISBON });
  await keep.click('.map__tools a:nth-child(1)');
  await keep.waitForSelector('.mk--me', { timeout: 8000 });
  const stored = await keep.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }) + location.href + document.cookie);
  ok('near me: the position is not kept anywhere (storage, address, cookies)', !/38\.7|-9\.13/.test(stored), stored.slice(0, 120));
  await keep.close();

  const denied = await open(MAP.en, { denied: true });
  await denied.click('.map__tools a:nth-child(1)');
  await wait(1200);
  const d = await denied.evaluate(() => ({ text: document.querySelector('[data-map-message]').textContent, hidden: document.querySelector('[data-map-message]').hidden, me: document.querySelectorAll('.mk--me').length }));
  ok('near me: access denied gives a short message in the page, no marker, no dialog', !d.hidden && d.text.length > 10 && d.me === 0 && denied.dialogs === 0, d.text);
  await denied.close();

  const far = await open(MAP.en, { position: TOKYO });
  await far.click('.map__tools a:nth-child(1)');
  await wait(1500);
  const f = await far.evaluate(() => ({ text: document.querySelector('[data-map-message]').textContent, me: document.querySelectorAll('.mk--me').length, metas: [...document.querySelectorAll('.map__items .map__item-meta')].slice(0, 1).map((m) => m.textContent) }));
  ok('near me: far from Portugal the map says so, shows no marker and still sorts the list by distance', /far from Portugal/.test(f.text) && f.me === 0 && /km away/.test(f.metas[0] ?? ''), JSON.stringify(f));
  await far.close();
}

// ---------- 3. The list ----------
if (want('list')) {
  const page = await open(MAP.pt);
  const l = await page.evaluate(() => {
    const li = document.querySelector('.map__items li');
    const hook = li.querySelector('.map__item-hook');
    const meta = li.querySelector('.map__item-meta');
    const h = getComputedStyle(hook);
    return { hasHook: Boolean(hook?.textContent.trim()), oneLine: h.whiteSpace === 'nowrap' && h.textOverflow === 'ellipsis' && hook.getBoundingClientRect().height < 30, metaSmaller: parseFloat(getComputedStyle(meta).fontSize) < parseFloat(getComputedStyle(li.querySelector('.map__item-title')).fontSize), order: [...li.querySelectorAll('a > span')].map((s) => s.className) };
  });
  ok('list: under the title the hook on one line cut with an ellipsis, then "date · place" in smaller type', l.hasHook && l.oneLine && l.metaSmaller && l.order.join() === 'map__item-title,map__item-hook,map__item-meta', JSON.stringify(l));
  await page.close();
}

// ---------- 4. Whole world and the plate ----------
if (want('world')) {
  for (const lang of ['pt', 'en', 'ru']) {
    const page = await open(MAP[lang]);
    const plate = await page.$eval('[data-overseas]', (b) => ({ hidden: b.hidden, text: b.textContent.trim() }));
    ok(`world (${lang}): a plate says how many stories are overseas (${OVERSEAS}) and ends with an arrow`, !plate.hidden && plate.text.includes(String(OVERSEAS)) && /→/.test(plate.text), plate.text);
    ok(`world (${lang}): no marker of a place abroad before the world view`, (await page.$$('.mk--place')).length === 0);
    await page.click('[data-overseas]');
    await wait(1500);
    const w = await page.evaluate(() => ({ places: document.querySelectorAll('.mk--place').length, hiddenPlate: document.querySelector('[data-overseas]').hidden }));
    ok(`world (${lang}): the plate switches to the whole world: the places abroad are marked and the plate goes away`, w.places === OVERSEAS && w.hiddenPlate, JSON.stringify(w));
    await page.click('.map__tools a:nth-child(2)');
    await wait(1200);
    const back = await page.evaluate(() => ({ places: document.querySelectorAll('.mk--place').length, plate: !document.querySelector('[data-overseas]').hidden }));
    ok(`world (${lang}): "All of Portugal" goes back: no places abroad, the plate is back`, back.places === 0 && back.plate, JSON.stringify(back));
    await page.click('.map__tools a:nth-child(3)');
    await wait(1200);
    ok(`world (${lang}): the "Whole world" button does the same as the plate`, (await page.$$('.mk--place')).length === OVERSEAS);
    await page.close();
  }
  // A thread whose stories are all in Portugal (the sea thread has Bojador, abroad since the card was added).
  const page = await open(`${MAP.pt}?fio=comida-e-vinho`);
  ok('world: a filter that leaves no story abroad shows no plate', await page.$eval('[data-overseas]', (b) => b.hidden));
  await page.close();
}

// ---------- 5. Markers and legend ----------
if (want('markers')) {
  const page = await open(MAP.pt);
  const m = await page.evaluate(() => {
    const frame = document.querySelector('.mk--frame .mk__shape');
    const cluster = document.querySelector('.mk--cluster .mk__shape');
    const cs = (el) => getComputedStyle(el);
    return {
      frameBg: cs(frame).backgroundColor,
      clusterBg: cs(cluster).backgroundColor,
      frameRot: cs(frame).rotate,
      clusterRot: cs(cluster).rotate,
      frameW: frame.getBoundingClientRect().width,
      clusterW: cluster.getBoundingClientRect().width,
      num: document.querySelector('.mk--cluster .mk__num')?.textContent,
      legend: [...document.querySelectorAll('.map__legend li')].filter((li) => !li.hidden).map((li) => li.textContent.trim()),
    };
  });
  ok('markers: a cluster is the same diamond as a main event (same colour, turned 45 degrees), larger, with its number inside', m.frameBg === m.clusterBg && m.frameRot === m.clusterRot && m.clusterRot !== 'none' && m.clusterW > m.frameW && /^\d+$/.test(m.num ?? ''), JSON.stringify(m));
  ok('markers: the legend under the map has four entries (the diamond, the circle, the cluster, the place abroad); "you" only after Near me', m.legend.length === 4, m.legend.join(' | '));
  await page.close();
  const epoch = await open('/pt/epoca/avis-e-descobrimentos/');
  ok('markers: the epoch page shows the same legend under its map', (await epoch.$$('.map__legend li')).length >= 3);
  await epoch.close();
}

// ---------- 6. The epoch scale ----------
if (want('scale')) {
  const page = await open(MAP.pt);
  const s = await page.evaluate(() => {
    const items = [...document.querySelectorAll('.epoch-scale__item:not(.epoch-scale__item--all)')];
    const widths = items.map((li) => li.getBoundingClientRect().width);
    const under = document.querySelector('.epoch-scale').getBoundingClientRect().top >= document.querySelector('.map__stage').getBoundingClientRect().bottom;
    return { n: items.length, ready: items.filter((li) => li.querySelector('button')).length, soon: items.filter((li) => !li.querySelector('button')).length, widths: widths.map(Math.round), under, old: document.querySelectorAll('.map-filters button[data-epoca]').length };
  });
  ok(`scale: all ${EPOCHS_ALL} epochs in order under the map, ${EPOCHS_READY} ready (buttons) and ${EPOCHS_ALL - EPOCHS_READY} pale (not buttons)`, s.n === EPOCHS_ALL && s.ready === EPOCHS_READY && s.soon === EPOCHS_ALL - EPOCHS_READY && s.under, JSON.stringify(s));
  ok('scale: every epoch has a cell of the same width', new Set(s.widths).size === 1, s.widths.join(' '));
  const fade = await page.evaluate(() => {
    const strip = document.querySelector('.epoch-scale');
    const before = { start: strip.hasAttribute('data-fade-start'), end: strip.hasAttribute('data-fade-end') };
    strip.scrollLeft = strip.scrollWidth;
    return new Promise((r) => setTimeout(() => r({ before, after: { start: strip.hasAttribute('data-fade-start'), end: strip.hasAttribute('data-fade-end') }, mask: getComputedStyle(strip).maskImage !== 'none' }), 200));
  });
  ok('scale: a fade at the right edge while there is more to scroll, and at the left once scrolled to the end', fade.mask && fade.before.end && !fade.before.start && fade.after.start && !fade.after.end, JSON.stringify(fade));
  const words = await page.evaluate(() => [...document.querySelectorAll('.epoch-scale__name')].filter((n) => { const range = document.createRange(); range.selectNodeContents(n); return n.scrollWidth > n.clientWidth + 1; }).length);
  ok('scale: no name is cut or broken inside a word (the names wrap at spaces)', words === 0 && (await page.evaluate(() => getComputedStyle(document.querySelector('.epoch-scale__name')).hyphens)) === 'manual');
  ok('scale: the old row of epoch buttons above the map is gone', s.old === 0);
  await page.click('.epoch-scale button[data-epoca="avis-e-descobrimentos"]');
  await wait(800);
  const c = await page.evaluate(() => ({ pressed: document.querySelector('.epoch-scale button[data-epoca="avis-e-descobrimentos"]').getAttribute('aria-pressed'), all: document.querySelector('.epoch-scale button[data-epoca=""]').getAttribute('aria-pressed'), count: document.querySelector('[data-list-count]').textContent, url: location.search }));
  ok('scale: pressing an epoch filters the map and the list, the address says so', c.pressed === 'true' && c.all === 'false' && c.count === '7' && /epoca=avis/.test(c.url), JSON.stringify(c));
  await page.close();
}

await browser.close();
console.log(failed === 0 ? '\nAll map tool checks passed' : `\n${failed} check(s) failed`);
process.exit(failed === 0 ? 0 : 1);

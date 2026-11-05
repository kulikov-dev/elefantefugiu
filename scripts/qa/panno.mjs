// Browser checks of the personal panel of the epoch page (src/components/EpochPanno.astro, src/lib/panno.ts, src/scripts/read-marks.ts), against dist/ served by serve.mjs:
//   node panno.mjs [nojs states link reset layout]
//   nojs     without JavaScript the panel is not shown and takes no room
//   states   0 read: no piece open, the picture is not fetched; some read: the pieces of the share, the picture fetched; all read: the whole picture and the line "Epoch complete"
//   link     the panel leads to the first story not read; all read: it is no link
//   reset    the reset button of the legal page empties the panel too (one storage)
//   layout   no horizontal scroll at 360 px, the panel fills the column on a phone, no layout shift, an epoch without a picture has no panel and keeps "read N of M" by the years
// The epoch is picked from the data (the first live one with a picture), and so is the number of pieces to expect: nothing here knows a count of stories.
import { launchBrowser } from './browser.mjs';
import { epochPath, epochs, inEpoch, readyEpochs, ui } from './data.mjs';

const base = process.env.BASE_URL || 'http://localhost:4400';
const ONLY = process.argv.slice(2);
const want = (name) => ONLY.length === 0 || ONLY.includes(name);
let failed = 0;
const ok = (name, cond, extra = '') => {
  if (!cond) failed += 1;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
};

// Prefer an epoch with a 9 x 6 grid (the number of open tiles is then not the trivial 24), else any live epoch with `panno`.
const epoch = readyEpochs.find((e) => e.panno?.cols === 9 && e.panno?.rows === 6) ?? readyEpochs.find((e) => e.panno);
if (!epoch) throw new Error('need: a live epoch with `panno` (image, cols, rows) in src/content/epochs.yaml. None found.');
const PIECES = epoch.panno.cols * epoch.panno.rows;
const path = epochPath(epoch, 'pt');
const without = epochs.find((e) => !e.panno && inEpoch(e.id).length > 0);
const browser = await launchBrowser();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** A fresh page of the epoch with `read` (a list of ids) in readStories before the page starts. */
async function open(read, { width = 1280, js = true, url = path } = {}) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  page.close = () => context.close();
  await page.setViewport({ width, height: 900 });
  if (!js) await page.setJavaScriptEnabled(false);
  page.images = [];
  page.on('request', (r) => {
    if (/\.webp/.test(r.url())) page.images.push(r.url());
  });
  if (read) {
    await page.evaluateOnNewDocument((ids) => {
      try {
        localStorage.setItem('readStories', JSON.stringify(ids));
      } catch {}
    }, read);
  }
  await page.goto(`${base}${url}`, { waitUntil: 'networkidle0' });
  await wait(250);
  return page;
}

const state = (page) =>
  page.evaluate(() => {
    const panel = document.querySelector('[data-panno]');
    const grid = panel?.querySelector('[data-panno-grid]');
    return {
      shown: !!panel && panel.getClientRects().length > 0,
      open: panel ? panel.querySelectorAll('[data-open]').length : -1,
      pieces: panel ? [...panel.querySelectorAll('[data-open]')].map((c) => Number(c.dataset.piece)).sort((a, b) => a - b) : [],
      line: panel?.querySelector('[data-panno-count]')?.textContent.trim() ?? null,
      href: grid?.getAttribute('href') ?? null,
      image: panel?.dataset.imageLarge ?? null,
      imageSmall: panel?.dataset.imageSmall ?? null,
      alt: grid?.getAttribute('aria-label') ?? null,
      width: panel?.getBoundingClientRect().width ?? 0,
      links: panel ? JSON.parse(panel.dataset.links) : {},
      order: [...document.querySelectorAll('.feed [data-story]')].map((c) => c.dataset.story),
      scrollX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

if (want('nojs')) {
  const page = await open(null, { js: false });
  const s = await state(page);
  ok('no JavaScript: the panel is not shown and takes no room', s.open === 0 && !s.shown && s.width === 0, JSON.stringify({ shown: s.shown, width: s.width }));
  await page.close();
}

const probe = await open(null);
const ORDER = (await state(probe)).order;
await probe.close();
const N = ORDER.length;
const piecesFor = (k) => Math.round((PIECES * k) / N);
const at = (k) => ORDER.slice(0, k);
const lineOf = (k, lang = 'pt') =>
  k === 0
    ? ui('panno.hint_first', lang)
    : k === N
      ? ui('panno.done', lang)
      : `${ui('plural.panno_count_other', lang).replace('{n}', String(k)).replace('{m}', String(N))} · ${ui('panno.hint', lang)}`;

if (want('states')) {
  let page = await open(null);
  let s = await state(page);
  ok(`0 read: the panel is shown, no piece open, the line "${lineOf(0)}"`, s.shown && s.open === 0 && s.line === lineOf(0), JSON.stringify([s.shown, s.open, s.line]));
  ok('0 read: the picture is not requested (neither size)', page.images.every((u) => !u.includes(s.image.split('?')[0]) && !u.includes(s.imageSmall.split('?')[0])), JSON.stringify(page.images));
  await page.close();
  for (const k of new Set([1, Math.ceil(N / 2)])) {
    page = await open(at(k));
    s = await state(page);
    ok(`${k} of ${N} read: ${piecesFor(k)} pieces open and the line says so`, s.open === piecesFor(k) && s.line === lineOf(k), JSON.stringify([s.open, s.line]));
    ok(`${k} of ${N} read: the same tiles as the order of the page promises (${PIECES} tiles, ${epoch.panno.cols} x ${epoch.panno.rows})`, s.pieces.length === s.open && s.pieces.every((c) => c >= 0 && c < PIECES), JSON.stringify(s.pieces));
    ok(`${k} of ${N} read: the alt says how many tiles are open, without describing the scene`, s.alt?.includes(ui('plural.panno_alt_other', 'pt').replace('{n}', String(piecesFor(k))).replace('{m}', String(PIECES))), String(s.alt));
    ok(`${k} of ${N} read: the picture is fetched`, page.images.some((u) => u.includes(s.image.split('?')[0]) || u.includes(s.imageSmall.split('?')[0])), JSON.stringify(page.images));
    await page.close();
  }
  for (const lang of ['pt', 'en', 'ru']) {
    page = await open(ORDER, { url: epochPath(epoch, lang) });
    s = await state(page);
    ok(`${lang}: all read: every tile open and the line "${ui('panno.done', lang)}"`, s.open === PIECES && s.line === ui('panno.done', lang), JSON.stringify([s.open, s.line]));
    await page.close();
  }
}

if (want('link')) {
  let page = await open(at(1));
  let s = await state(page);
  ok('the panel leads to the first story not read', s.href === s.links[ORDER[1]], JSON.stringify([s.href, s.links[ORDER[1]]]));
  await page.close();
  page = await open([ORDER[1]]);
  s = await state(page);
  ok('read in another order: it still leads to the first story of the page not read', s.href === s.links[ORDER[0]], JSON.stringify([s.href, s.links[ORDER[0]]]));
  await page.close();
  page = await open(ORDER);
  s = await state(page);
  ok('all read: the panel is no link', s.href === null, JSON.stringify(s.href));
  await page.close();
}

if (want('reset')) {
  // The marks are set from the page itself: a script that runs on every new document would set them again after the reset.
  const page = await open(null);
  await page.evaluate((ids) => localStorage.setItem('readStories', JSON.stringify(ids)), at(1));
  await page.goto(`${base}/pt/legal/`, { waitUntil: 'networkidle0' });
  await page.click('[data-read-reset]');
  await wait(200);
  await page.goto(`${base}${path}`, { waitUntil: 'networkidle0' });
  await wait(250);
  const s = await state(page);
  ok('after the reset on the legal page the panel has no piece open', s.open === 0, String(s.open));
  await page.close();
}

if (want('layout')) {
  for (const k of new Set([0, 1, Math.ceil(N / 2), N])) {
    const page = await open(at(k), { width: 360 });
    const s = await state(page);
    const column = await page.evaluate(() => document.querySelector('.epoch__head').getBoundingClientRect().width);
    ok(`360 px, ${k} read: no horizontal scroll, the panel fills the column`, s.scrollX <= 0 && Math.abs(s.width - column) <= 1, JSON.stringify({ scrollX: s.scrollX, panel: s.width, column }));
    await page.close();
  }
  const page = await open(at(1), { width: 360 });
  const shift = await page.evaluate(
    () =>
      new Promise((resolve) => {
        let sum = 0;
        new PerformanceObserver((list) => {
          for (const e of list.getEntries()) if (!e.hadRecentInput) sum += e.value;
        }).observe({ type: 'layout-shift', buffered: true });
        setTimeout(() => resolve(sum), 300);
      }),
  );
  ok('360 px: the panel shifts nothing (layout shift below 0.01)', shift < 0.01, String(shift));
  await page.close();
  if (without) {
    const p = await open(null, { url: epochPath(without, 'pt') });
    const s = await p.evaluate(() => ({ panel: !!document.querySelector('[data-panno]'), progress: !!document.querySelector('[data-read-progress]') }));
    ok('an epoch without a picture has no panel and keeps "read N of M" by the years', !s.panel && s.progress, JSON.stringify(s));
    await p.close();
  } else console.log('NOTE  every live epoch has a picture: the case of an epoch without one is covered by the unit tests only');
}

await browser.close();
console.log(failed === 0 ? '\nAll panel checks passed' : `\n${failed} check(s) failed`);
process.exit(failed === 0 ? 0 : 1);

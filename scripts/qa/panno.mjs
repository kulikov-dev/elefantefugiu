// Browser checks of the personal panel of the epoch page (src/components/EpochPanno.astro, src/lib/panno.ts, src/scripts/read-marks.ts), against dist/ served by serve.mjs:
//   node panno.mjs [nojs states link reset layout]
//   nojs     without JavaScript the panel is not shown and takes no room
//   states   0 read: no piece open, the picture is not fetched; some read: the pieces of the share, the picture fetched; all read: the whole picture and the line "Epoch complete"
//   link     the panel leads to the first story not read; all read: it is no link
//   reset    the reset button of the legal page empties the panel too (one storage)
//   reward   only with every story read: the panel is a button (enlarged in a <dialog>: Esc, cross, backdrop, focus back, picture only when opened, scrolled sideways on a phone held upright)
//            and "Share" (Web Share or copy + a quiet line, one GoatCounter event); family mode counts the stories it shows
//   pages    the page of the finished panel in three languages: noindex, not in the sitemap, own preview picture 1200 x 630 at an absolute address, hreflang, the way to the epoch
//   layout   no horizontal scroll at 360 px, the panel fills the column on a phone, no layout shift, an epoch without a picture has no panel and keeps "read N of M" by the years
// The epoch is picked from the data (the first live one with a picture), and so is the number of pieces to expect: nothing here knows a count of stories.
import { launchBrowser } from './browser.mjs';
import { epochPath, epochs, inEpoch, pannoPath, readyEpochs, ui } from './data.mjs';

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
async function open(read, { width = 1280, height = 900, js = true, url = path, family = null } = {}) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  page.close = () => context.close();
  await page.setViewport({ width, height });
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
  if (family) await page.evaluateOnNewDocument((m) => { try { localStorage.setItem('family', m); } catch {} }, family);
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
      hint: panel?.querySelector('[data-panno-hint]')?.getClientRects().length > 0 ? panel.querySelector('[data-panno-hint]').textContent.trim() : null,
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
// Two lines under the panel: "N of M read" (none with nothing read, the closing line when all are read) and the hint (not shown when all are read).
const lineOf = (k, lang = 'pt') => (k === 0 ? '' : k === N ? ui('panno.done', lang) : ui('plural.panno_count_other', lang).replace('{n}', String(k)).replace('{m}', String(N)));

if (want('states')) {
  let page = await open(null);
  let s = await state(page);
  ok(`0 read: the panel is shown, no piece open, the line "${lineOf(0)}"`, s.shown && s.open === 0 && s.line === lineOf(0), JSON.stringify([s.shown, s.open, s.line]));
  ok('0 read: only the hint line is shown, with a capital', s.hint === ui('panno.hint', 'pt') && s.line === '', JSON.stringify([s.hint, s.line]));
  ok('0 read: the picture is not requested (neither size)', page.images.every((u) => !u.includes(s.image.split('?')[0]) && !u.includes(s.imageSmall.split('?')[0])), JSON.stringify(page.images));
  await page.close();
  for (const k of new Set([1, Math.ceil(N / 2)])) {
    page = await open(at(k));
    s = await state(page);
    ok(`${k} of ${N} read: ${piecesFor(k)} pieces open and the line says so`, s.open === piecesFor(k) && s.line === lineOf(k), JSON.stringify([s.open, s.line]));
    ok(`${k} of ${N} read: the second line is the hint`, s.hint === ui('panno.hint', 'pt'), JSON.stringify(s.hint));
    ok(`${k} of ${N} read: the same tiles as the order of the page promises (${PIECES} tiles, ${epoch.panno.cols} x ${epoch.panno.rows})`, s.pieces.length === s.open && s.pieces.every((c) => c >= 0 && c < PIECES), JSON.stringify(s.pieces));
    ok(`${k} of ${N} read: the alt says how many tiles are open, without describing the scene`, s.alt?.includes(ui('plural.panno_alt_other', 'pt').replace('{n}', String(piecesFor(k))).replace('{m}', String(PIECES))), String(s.alt));
    ok(`${k} of ${N} read: the picture is fetched`, page.images.some((u) => u.includes(s.image.split('?')[0]) || u.includes(s.imageSmall.split('?')[0])), JSON.stringify(page.images));
    await page.close();
  }
  for (const lang of ['pt', 'en', 'ru']) {
    page = await open(ORDER, { url: epochPath(epoch, lang) });
    s = await state(page);
    ok(`${lang}: all read: every tile open and the line "${ui('panno.done', lang)}"`, s.open === PIECES && s.line === ui('panno.done', lang) && s.hint === null, JSON.stringify([s.open, s.line, s.hint]));
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


if (want('reward')) {
  const rewardState = (page) =>
    page.evaluate(() => {
      const shown = (el) => !!el && el.getClientRects().length > 0;
      const panel = document.querySelector('[data-panno]');
      const zoom = panel.querySelector('[data-panno-zoom]');
      const share = panel.querySelector('[data-panno-share]');
      const dialog = panel.querySelector('[data-panno-dialog]');
      const img = panel.querySelector('[data-panno-full]');
      return { zoom: shown(zoom), share: shown(share), zoomLabel: zoom?.getAttribute('aria-label'), shareText: share?.textContent.trim(), open: dialog.open, src: img.getAttribute('src'), focusOnZoom: document.activeElement === zoom, full: panel.dataset.imageFull };
    });
  // Not all read: neither the button nor "Share".
  for (const k of new Set([0, 1, N - 1])) {
    if (k >= N) continue;
    const page = await open(at(k));
    const s = await rewardState(page);
    ok(`${k} of ${N} read: the panel is no button and there is no "Share"`, !s.zoom && !s.share, JSON.stringify([s.zoom, s.share]));
    await page.close();
  }
  for (const lang of ['pt', 'en', 'ru']) {
    const page = await open(ORDER, { url: epochPath(epoch, lang) });
    const s = await rewardState(page);
    ok(`${lang}: all read: the panel is a button "${ui('panno.zoom', lang)}" and "${ui('panno.share', lang)}" stands beside the closing line`, s.zoom && s.share && s.zoomLabel === ui('panno.zoom', lang) && s.shareText === ui('panno.share', lang), JSON.stringify(s));
    await page.close();
  }

  // The dialog: opens, the picture is asked for only then, Esc / cross / backdrop close it, the focus goes back to the panel.
  let page = await open(ORDER);
  let s = await rewardState(page);
  ok('the enlarged picture is not requested before the dialog is opened', s.src === null && !page.images.some((u) => u.includes(s.full.split('?')[0])), JSON.stringify([s.src, page.images.length]));
  await page.focus('[data-panno-zoom]');
  await page.keyboard.press('Enter');
  await wait(400);
  s = await rewardState(page);
  ok('the button opens the dialog and its picture is requested', s.open && s.src !== null && page.images.some((u) => u.includes(s.full.split('?')[0])), JSON.stringify([s.open, s.src]));
  const dim = await page.evaluate(() => {
    const img = document.querySelector('[data-panno-full]');
    const r = img.getBoundingClientRect();
    return { w: r.width, h: r.height, nw: img.naturalWidth, nh: img.naturalHeight, vw: innerWidth, vh: innerHeight, seams: document.querySelectorAll('[data-panno-dialog] [data-piece]').length };
  });
  ok('1280: the picture is shown whole inside the screen and not larger than its own size', dim.w <= dim.vw + 1 && dim.h <= dim.vh + 1 && dim.w <= dim.nw + 1 && dim.seams === 0, JSON.stringify(dim));
  await page.keyboard.press('Escape');
  await wait(200);
  s = await rewardState(page);
  ok('Esc closes the dialog and the focus is back on the panel', !s.open && s.focusOnZoom, JSON.stringify([s.open, s.focusOnZoom]));
  await page.click('[data-panno-zoom]');
  await wait(200);
  await page.click('[data-panno-close]');
  await wait(200);
  s = await rewardState(page);
  ok('the cross closes the dialog and the focus is back on the panel', !s.open && s.focusOnZoom, JSON.stringify([s.open, s.focusOnZoom]));
  await page.click('[data-panno-zoom]');
  await wait(200);
  await page.mouse.click(3, 3);
  await wait(200);
  s = await rewardState(page);
  ok('a click on the backdrop closes the dialog', !s.open && s.focusOnZoom, JSON.stringify([s.open, s.focusOnZoom]));
  await page.close();

  // A phone held upright: the picture is 70% of the screen tall, wider than the screen, scrolls sideways from its middle, the browser zoom is not blocked.
  page = await open(ORDER, { width: 390, height: 844 });
  await page.click('[data-panno-zoom]');
  await wait(500);
  const phone = await page.evaluate(() => {
    const scroll = document.querySelector('[data-panno-scroll]');
    const img = document.querySelector('[data-panno-full]');
    const cs = getComputedStyle(scroll);
    return { overflowX: cs.overflowX, touch: [cs.touchAction, getComputedStyle(img).touchAction, getComputedStyle(document.querySelector('[data-panno-dialog]')).touchAction], imgH: img.getBoundingClientRect().height, imgW: img.getBoundingClientRect().width, vh: innerHeight, vw: innerWidth, sl: scroll.scrollLeft, sw: scroll.scrollWidth, cw: scroll.clientWidth, meta: document.querySelector('meta[name=viewport]').content };
  });
  ok('390 upright: the picture is about 70% of the screen tall and wider than the screen (scrolls sideways)', Math.abs(phone.imgH - 0.7 * phone.vh) <= 3 && phone.imgW > phone.vw && phone.overflowX === 'auto' && phone.sw > phone.cw, JSON.stringify(phone));
  ok('390 upright: it is opened scrolled to the middle', Math.abs(phone.sl - (phone.sw - phone.cw) / 2) <= 2, JSON.stringify([phone.sl, phone.sw, phone.cw]));
  ok('390 upright: pinch zoom is not blocked (no touch-action: none, no user-scalable=no)', phone.touch.every((v) => v !== 'none') && !/user-scalable\s*=\s*no|maximum-scale\s*=\s*1\b/.test(phone.meta), JSON.stringify([phone.touch, phone.meta]));
  await page.close();

  // "Share": Web Share when there is one (title, text, url), else copy + a quiet line for 2 s; one event.
  const stub = (withShare) => {
    window.__events = [];
    window.__shared = null;
    window.__copied = null;
    window.goatcounter = { count: (v) => window.__events.push(v) };
    if (withShare) navigator.share = (d) => { window.__shared = d; return Promise.resolve(); };
    else Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: (t) => { window.__copied = t; return Promise.resolve(); } }, configurable: true });
  };
  const name = epoch.name.pt;
  for (const withShare of [true, false]) {
    page = await open(ORDER);
    await page.evaluate(stub, withShare);
    await page.click('[data-panno-share]');
    await wait(300);
    const r = await page.evaluate(() => ({ events: window.__events, shared: window.__shared, copied: window.__copied, status: document.querySelector('[data-panno-status]').textContent }));
    const url = new URL(pannoPath(epoch, 'pt'), base).href;
    ok(`share (${withShare ? 'Web Share' : 'copy'}): exactly one event "panno-share-${epoch.id}"`, r.events.length === 1 && r.events[0].path === `panno-share-${epoch.id}` && r.events[0].event === true, JSON.stringify(r.events));
    if (withShare) ok('share: title, text and the address of the panel page are given', r.shared?.url === url && r.shared?.text === ui('panno.share_text', 'pt').replace('{name}', name).replace('{hook}', epoch.panno.share_hook.pt).replace('{stories}', `${N} histórias`) && !!r.shared?.title, JSON.stringify(r.shared));
    else {
      ok('copy: the address of the panel page is copied and a quiet line says so', r.copied === url && r.status === ui('panno.copied', 'pt'), JSON.stringify([r.copied, r.status]));
      await wait(2300);
      const gone = await page.evaluate(() => document.querySelector('[data-panno-status]').textContent);
      ok('copy: the line is gone after 2 seconds', gone === '', JSON.stringify(gone));
    }
    await page.close();
  }

  // Family mode: "all read" is counted by the stories the mode shows, like the counter.
  for (const mode of ['all', '12']) {
    const shownIn = (e) => !e.sensitive && (mode === 'all' ? e.min_age === 'all' : e.min_age === 'all' || e.min_age === '12');
    const target = readyEpochs.find((e) => e.panno && inEpoch(e.id).some((x) => !shownIn(x)) && inEpoch(e.id).some(shownIn));
    if (!target) {
      console.log(`NOTE  no live epoch with a panel hides a story in family mode "${mode}": the case is covered by the unit tests of readProgress only`);
      continue;
    }
    const feed = inEpoch(target.id);
    const visible = feed.filter(shownIn).map((e) => e.id);
    page = await open(visible, { url: epochPath(target, 'pt'), family: mode });
    s = await rewardState(page);
    ok(`family mode ${mode}: only the stories it shows are read (${visible.length} of ${feed.length}): the reward is there`, s.zoom && s.share, JSON.stringify(s));
    await page.close();
    page = await open(visible.slice(0, -1), { url: epochPath(target, 'pt'), family: mode });
    s = await rewardState(page);
    ok(`family mode ${mode}: one visible story short: no reward`, !s.zoom && !s.share, JSON.stringify(s));
    await page.close();
  }
}

if (want('pages')) {
  const sitemap = await (await fetch(`${base}/sitemap.xml`)).text();
  for (const lang of ['pt', 'en', 'ru']) {
    const page = await open(null, { url: pannoPath(epoch, lang) });
    const h = await page.evaluate(() => {
      const meta = (sel) => document.querySelector(sel)?.getAttribute('content') ?? null;
      return {
        robots: meta('meta[name=robots]'),
        ogImage: meta('meta[property="og:image"]'),
        ogTitle: meta('meta[property="og:title"]'),
        ogDescription: meta('meta[property="og:description"]'),
        hreflang: [...document.querySelectorAll('link[rel=alternate][hreflang]')].map((l) => l.hreflang).sort(),
        h1: document.querySelector('h1')?.textContent.trim(),
        img: document.querySelector('.panno-page__image')?.getBoundingClientRect().width ?? 0,
        epochLink: [...document.querySelectorAll('article a.button')].map((a) => a.getAttribute('href')),
        text: document.body.textContent,
      };
    });
    const name = epoch.name[lang];
    ok(`${lang}: the panel page has the heading, the whole picture, the invitation and the way to the epoch`, h.h1 === ui('panno.page_title', lang).replace('{name}', name) && h.img > 0 && h.text.includes(ui('panno.invite', lang)) && h.epochLink.includes(epochPath(epoch, lang)), JSON.stringify([h.h1, h.img, h.epochLink]));
    ok(`${lang}: the panel page is noindex and not in the sitemap`, /noindex/.test(h.robots ?? '') && !sitemap.includes(pannoPath(epoch, lang)) && !/\/(panno|painel|panel)\//.test(sitemap), String(h.robots));
    ok(`${lang}: og:title and og:description are the ones of the panel`, h.ogTitle?.startsWith(ui('panno.og_title', lang).replace('{name}', name)) && h.ogDescription === ui('panno.og_description', lang), JSON.stringify([h.ogTitle, h.ogDescription]));
    ok(`${lang}: hreflang links the three languages`, JSON.stringify(h.hreflang.filter((x) => x !== 'x-default')) === JSON.stringify(['en', 'pt', 'ru']), JSON.stringify(h.hreflang));
    ok(`${lang}: og:image is an absolute address`, /^https?:\/\//.test(h.ogImage ?? ''), String(h.ogImage));
    if (lang === 'pt') {
      // The file behind og:image: it is in the build (served here under the path of the address) and is 1200 x 630.
      const rel = new URL(h.ogImage).pathname;
      const size = await page.evaluate(
        (u) =>
          new Promise((resolve) => {
            const im = new Image();
            im.onload = () => resolve([im.naturalWidth, im.naturalHeight]);
            im.onerror = () => resolve(null);
            im.src = u;
          }),
        rel,
      );
      ok('og:image leads to an existing file of 1200 x 630', JSON.stringify(size) === '[1200,630]', JSON.stringify([rel, size]));
    }
    await page.close();
  }
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

// Browser checks for stage 7b-2: azulejo patterns, the waiting tile of the map, layout shifts, a neutral header.
// Run against dist/ served by serve.mjs (base path "/"):   node azulejo.mjs [variant] [patterns waiting motion shifts header]
// The epochs and cards come from src/content (data.mjs). `variant` runs against the fixture build, where the epoch Estado Novo has
// published cards: it gives the third pattern and the grey interface of that epoch; the real site has two ready epochs.
import { launchBrowser } from './browser.mjs';
import { fixture, need, pt, real } from './data.mjs';

const VARIANT = process.argv[2] === 'variant';
const base = VARIANT ? process.env.VARIANT_URL || 'http://localhost:4401' : process.env.BASE_URL || 'http://localhost:4400';
const world = VARIANT ? fixture : real;
const ONLY = process.argv.slice(2).filter((a) => a !== 'variant');
const want = (name) => ONLY.length === 0 || ONLY.includes(name);

// Every epoch that has published cards: each of them has a pattern of its own (src/lib/azulejo.ts).
const EPOCHS = world.readyEpochs.map((m) => m.id);
const firstEpochId = EPOCHS[0];
const plainCard = need('a card of the first ready epoch', () => world.inEpoch(firstEpochId)[0]);
const frameCard = need('a key (frame) card', () => world.published.find((c) => c.level === 'frame'));
let failed = 0;
const ok = (name, cond, extra = '') => {
  if (!cond) failed += 1;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
};
const browser = await launchBrowser();
/** The name of a pattern from its address: the files are small, so the build inlines them as data: URIs, and each starts with a comment naming it. */
const nameOf = (u) => {
  const [head, body = ''] = u.split(',');
  const svg = head.endsWith('base64') ? Buffer.from(body, 'base64').toString() : decodeURIComponent(body);
  return svg.match(/Azulejo pattern "?'?(\w+)/)?.[1] ?? 'unknown';
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** `intercept(request)` decides what happens to every request (it must call continue, respond or abort). */
const newPage = async ({ width = 1280, scheme = 'light', motion = 'no-preference', intercept = null } = {}) => {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 900 });
  await page.emulateMediaFeatures([
    { name: 'prefers-color-scheme', value: scheme },
    { name: 'prefers-reduced-motion', value: motion },
  ]);
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  if (intercept) {
    await page.setRequestInterception(true);
    page.on('request', (r) => intercept(r));
  }
  return page;
};
const epochUrl = (id) => `${base}/pt/epoca/${id}/`;
/** The map code arrives `ms` late. */
const slowMap = (ms) => (r) => (/map-island/.test(r.url()) ? setTimeout(() => r.continue(), ms) : r.continue());

// ---------- 1. Patterns show in both themes ----------
if (want('patterns')) {
  const masks = {};
  for (const scheme of ['light', 'dark']) {
    for (const id of EPOCHS) {
      const page = await newPage({ scheme });
      await page.goto(epochUrl(id), { waitUntil: 'networkidle0' });
      const s = await page.evaluate(async () => {
        const css = (el, pseudo) => getComputedStyle(el, pseudo);
        const mask = (c) => (c.maskImage && c.maskImage !== 'none' ? c.maskImage : c.webkitMaskImage);
        const urlOf = (m) => (m && m.match(/url\("?([^")]+)"?\)/)?.[1]) || '';
        const loads = (u) => new Promise((res) => { const i = new Image(); i.onload = () => res(i.naturalWidth > 0); i.onerror = () => res(false); i.src = u; });
        const feed = document.querySelector('.feed');
        const strip = css(feed, '::before');
        const layers = [document.querySelector('.azulejo-rule')].map((el) => {
          const c = css(el);
          const r = el.getBoundingClientRect();
          return { url: urlOf(mask(c)), mask: mask(c), bg: c.backgroundColor, opacity: Number(c.opacity), w: r.width, h: r.height, children: el.childNodes.length, hidden: el.getAttribute('aria-hidden') };
        });
        const stripUrl = urlOf(mask(strip));
        const doc = document.documentElement;
        const area = layers.reduce((a, l) => a + l.w * l.h, 0) + parseFloat(strip.width) * feed.getBoundingClientRect().height;
        return { layers, stripUrl, stripOpacity: Number(strip.opacity), loads: await Promise.all([layers[0].url, stripUrl].map(loads)), share: area / (doc.scrollWidth * doc.scrollHeight) };
      });
      ok(`patterns (${id}, ${scheme}): the rule and the timeline strip are masks that load (the epoch page has no corner: it looked like a button)`, s.layers.every((l) => l.mask && l.mask !== 'none' && l.url) && Boolean(s.stripUrl) && s.loads.every(Boolean), JSON.stringify(s.loads));
      ok(`patterns (${id}, ${scheme}): each layer is empty, aria-hidden, visible and at most 50% opaque`, s.layers.every((l) => l.children === 0 && l.hidden === 'true' && l.opacity > 0 && l.opacity <= 0.5 && l.w > 0 && l.h > 0) && s.stripOpacity > 0 && s.stripOpacity <= 0.5, JSON.stringify(s.layers.map((l) => [l.bg, l.opacity])));
      ok(`patterns (${id}, ${scheme}): together less than 10% of the page`, s.share < 0.1, s.share.toFixed(3));
      (masks[id] ??= []).push(s.layers[0].url);
      ok(`patterns (${id}, ${scheme}): no script errors`, page.errors.length === 0, page.errors.join(';'));
      await page.close();
    }
  }
  const distinct = new Set(EPOCHS.map((id) => masks[id][0]));
  ok(`patterns: ${EPOCHS.length} epochs, ${EPOCHS.length} different patterns (${EPOCHS.map((id) => nameOf(masks[id][0])).join(', ')})`, distinct.size === EPOCHS.length);
  // Neither the epoch page nor the 404 page has the corner (it looked like a button that does nothing); the 404 page has the elephant.
  const p404 = await newPage();
  await p404.goto(`${base}/404.html`, { waitUntil: 'networkidle0' });
  ok('404: no corner signature', (await p404.$('.azulejo-corner')) === null);
  await p404.close();
  // The cards of the feed are equal and compact (the epoch page rework): key events and stories alike have no band of the pattern;
  // the pattern is on the rule of the card page, the strip of the timeline and the page of the epoch.
  const feed = await newPage();
  await feed.goto(epochUrl(firstEpochId), { waitUntil: 'networkidle0' });
  const bands = await feed.evaluate(() => ({ withBand: document.querySelectorAll('.ecard .azulejo-rule').length, cards: document.querySelectorAll('.ecard').length, frames: document.querySelectorAll('.ecard--frame').length }));
  ok('feed: the cards are equal compact cards, none carries a band of the pattern (key events included)', bands.cards > 0 && bands.frames > 0 && bands.withBand === 0, JSON.stringify(bands));
  await feed.close();
}

// ---------- 2. The waiting tile of the map ----------
if (want('waiting')) {
  const probe = (page) =>
    page.evaluate(() => {
      const map = document.querySelector('[data-map]');
      const w = map?.querySelector('[data-map-loading]');
      return { state: map?.dataset.state ?? null, busy: map?.getAttribute('aria-busy') ?? null, opacity: w ? Number(getComputedStyle(w).opacity) : null, display: w ? getComputedStyle(w).display : null, role: w?.getAttribute('role') ?? null, text: w?.textContent.trim() ?? null, tile: w ? getComputedStyle(w.querySelector('.map__wait-tile')).animationName : null };
    });
  // Slow: the map code arrives after 1.5 s, so the tile has to appear (after 300 ms) and go away at the end.
  const slow = await newPage({ intercept: slowMap(1500) });
  await slow.goto(`${base}/pt/mapa/`, { waitUntil: 'domcontentloaded' });
  await wait(100);
  const early = await probe(slow);
  ok('waiting: in the first moments the tile is not visible (opacity 0)', early.state === 'loading' && early.opacity === 0, JSON.stringify(early));
  await wait(500);
  const mid = await probe(slow);
  ok('waiting: after the delay the tile is visible, role=status, "A carregar o mapa…", aria-busy on the map', mid.opacity === 1 && mid.role === 'status' && mid.text === 'A carregar o mapa…' && mid.busy === 'true', JSON.stringify(mid));
  ok('waiting: the tile breathes (an animation by name) while waiting', mid.tile === 'map-wait-breathe', String(mid.tile));
  await slow.waitForFunction(() => document.querySelector('[data-map]')?.dataset.state === 'ready', { timeout: 15000 });
  const done = await probe(slow);
  ok('waiting: when the map is ready the tile is gone and aria-busy is removed', done.display === 'none' && done.busy === null, JSON.stringify(done));
  // The animation moves transform and opacity only.
  const props = await slow.evaluate(() => {
    const names = new Set();
    for (const sheet of document.styleSheets) {
      let rules = [];
      try { rules = [...sheet.cssRules]; } catch (e) { continue; }
      for (const r of rules) if (r instanceof CSSKeyframesRule && r.name.startsWith('map-wait')) for (const k of r.cssRules) for (const p of k.style) names.add(p);
    }
    return [...names];
  });
  ok('waiting: the keyframes of the waiting tile change transform and opacity only', props.length > 0 && props.every((p) => p === 'transform' || p === 'opacity'), JSON.stringify(props));
  await slow.close();
  // Fast: whatever the server does, the tile is never visible before the 300 ms have passed.
  const fast = await newPage();
  await fast.evaluateOnNewDocument(() => {
    window.__seen = [];
    const start = performance.now();
    const tick = () => {
      const w = document.querySelector('[data-map-loading]');
      const m = document.querySelector('[data-map]');
      if (w && Number(getComputedStyle(w).opacity) > 0 && getComputedStyle(w).display !== 'none') window.__seen.push(Math.round(performance.now() - start));
      if (m?.dataset.state === 'ready') { window.__ready = Math.round(performance.now() - start); return; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await fast.goto(`${base}/pt/mapa/`, { waitUntil: 'networkidle0' });
  const seen = await fast.evaluate(() => ({ seen: window.__seen, ready: window.__ready ?? null }));
  ok('waiting: the tile appears only if the map is still not ready after 300 ms', seen.seen.length === 0 || (seen.seen[0] >= 300 && seen.ready >= 300), JSON.stringify(seen));
  await fast.close();
}

// ---------- 3. Reduced motion ----------
if (want('motion')) {
  for (const motion of ['no-preference', 'reduce']) {
    const page = await newPage({ motion, intercept: slowMap(2500) });
    await page.goto(`${base}/pt/mapa/`, { waitUntil: 'domcontentloaded' });
    await wait(700);
    const got = await page.evaluate(() => {
      const w = document.querySelector('.map__wait-tile');
      return { name: getComputedStyle(w).animationName, opacity: Number(getComputedStyle(document.querySelector('[data-map-loading]')).opacity), moving: document.getAnimations().filter((a) => a.effect?.target === w).length };
    });
    if (motion === 'reduce') ok('motion: with reduced motion the tile stands still (no animation), the text still shows', got.name === 'none' && got.moving === 0 && got.opacity === 1, JSON.stringify(got));
    else ok('motion: without the preference the tile breathes', got.name !== 'none' && got.moving > 0, JSON.stringify(got));
    await page.close();
  }
}

// ---------- 4. No layout shifts when pictures load ----------
if (want('shifts')) {
  for (const path of [pt(plainCard), `/pt/epoca/${firstEpochId}/`, `/pt/epoca/${firstEpochId}/?vista=grelha`]) {
    for (const width of [360, 1280]) {
      const page = await newPage({ width });
      await page.evaluateOnNewDocument(() => {
        window.__cls = 0;
        new PerformanceObserver((list) => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
      });
      await page.goto(`${base}${path}`, { waitUntil: 'load' });
      // Scroll to the end so every lazy picture loads, then let the page settle.
      await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } });
      await wait(500);
      const s = await page.evaluate(() => ({ cls: window.__cls, imgs: [...document.images].filter((i) => !i.closest('.mascot, .brand, .minimap, .leaflet-container') && !i.classList.contains('mascot')).map((i) => ({ w: i.getAttribute('width'), h: i.getAttribute('height'), ratio: getComputedStyle(i).aspectRatio, bg: getComputedStyle(i).backgroundColor })) }));
      ok(`shifts (${path}, ${width} px): every picture reserves its place by proportion and has a token colour behind it`, s.imgs.every((i) => (i.w && i.h) || i.ratio !== 'auto') && s.imgs.every((i) => i.bg !== 'rgba(0, 0, 0, 0)'), JSON.stringify(s.imgs.slice(0, 2)));
      ok(`shifts (${path}, ${width} px): layout shift score ${s.cls.toFixed(3)} (at most 0.05)`, s.cls <= 0.05);
      await page.close();
    }
  }
}

// ---------- 5. The header is neutral on every epoch ----------
if (want('header')) {
  const pages = ['/pt/', ...EPOCHS.map((id) => `/pt/epoca/${id}/`), pt(plainCard), pt(frameCard), '/pt/mapa/'];
  for (const scheme of ['light', 'dark']) {
    const looks = [];
    for (const path of pages) {
      const page = await newPage({ scheme });
      await page.goto(`${base}${path}`, { waitUntil: 'load' });
      looks.push(
        await page.evaluate(() => {
          const c = (sel, prop) => { const el = document.querySelector(sel); return el ? getComputedStyle(el)[prop] : null; };
          return { path: location.pathname, logo: c('.brand__logo', 'color'), lang: c('.lang-switch a[aria-current="true"]', 'backgroundColor'), langInk: c('.lang-switch a[aria-current="true"]', 'color'), header: c('.site-header', 'backgroundColor'), footer: c('.site-footer', 'backgroundColor'), body: c('body', 'backgroundColor') };
        }),
      );
      await page.close();
    }
    const head = (l) => JSON.stringify([l.logo, l.lang, l.langInk, l.header, l.footer]);
    ok(`header (${scheme}): logo, language switch, header and footer have the same colours on the home page, every epoch, two cards and the map`, new Set(looks.map(head)).size === 1, JSON.stringify(looks.map((l) => [l.path, l.logo, l.lang])));
    ok(`header (${scheme}): the page behind them still follows the epoch (the epochs differ from each other)`, new Set(looks.slice(1, 1 + EPOCHS.length).map((l) => l.body)).size === EPOCHS.length);
  }
  // Estado Novo: the interface is grey, not carnation red (only the fixture build has a page of this epoch).
  if (EPOCHS.includes('estado-novo-e-25-de-abril')) {
  const en = await newPage();
  await en.goto(epochUrl('estado-novo-e-25-de-abril'), { waitUntil: 'load' });
  const grey = await en.evaluate(() => {
    const m = getComputedStyle(document.querySelector('main'));
    return { primary: m.getPropertyValue('--epoch-primary').trim(), accent: m.getPropertyValue('--color-accent').trim(), flash: m.getPropertyValue('--epoch-flash').trim(), flashCards: document.querySelectorAll('[data-flash]').length };
  });
  ok('estado novo: the primary colour of the interface is grey (#4a4a48), the flash red is kept apart, and no test card is marked (none is from 1974)', /#4a4a48/i.test(grey.primary) && /#4a4a48/i.test(grey.accent) && /#c41e3a/i.test(grey.flash) && grey.flashCards === 0, JSON.stringify(grey));
  await en.close();
  }
}

await browser.close();
console.log(failed === 0 ? '\nAll azulejo checks passed' : `\n${failed} check(s) failed`);
process.exit(failed === 0 ? 0 : 1);

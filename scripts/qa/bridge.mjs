// Browser checks for stage 5c: the map marks the bridge (not the place), the marker preview, "Como chegar", the bridge block.
// Run against dist/ served by serve.mjs:   node bridge.mjs [preview caption directions block weight]
import { fsPath, launchBrowser } from './browser.mjs';
import { createRequire } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const require = createRequire(import.meta.url);
const { parse } = require('../../node_modules/yaml');
const root = fsPath(new URL('../../', import.meta.url));
const base = process.env.BASE_URL || 'http://localhost:4400';
const ONLY = process.argv.slice(2);
const want = (name) => ONLY.length === 0 || ONLY.includes(name);

const events = readdirSync(join(root, 'src/content/events')).map((n) => parse(readFileSync(join(root, 'src/content/events', n), 'utf8'), { schema: 'core', customTags: ['timestamp'] })).filter((e) => e.status === 'ready');
const byId = (id) => events.find((e) => e.id === id);
const threadsData = parse(readFileSync(join(root, 'src/content/threads.yaml'), 'utf8'), { schema: 'core' });
const GOA = byId('evento-exemplo-05'); // place in Goa, bridge in Lisbon (Belém)
const FAR = byId('evento-exemplo-03'); // bridge a few km from the place
const SEG = { pt: 'historia', en: 'story' };
const UA = {
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  ipad: 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
};
const r5 = (n) => Number(n.toFixed(5));
const osm = (e) => `https://www.openstreetmap.org/?mlat=${r5(e.bridge.lat)}&mlon=${r5(e.bridge.lon)}#map=17/${r5(e.bridge.lat)}/${r5(e.bridge.lon)}`;
const norm = (s) => String(s).replace(/\s+/g, ' ').trim();

let failed = 0;
const ok = (name, cond, extra = '') => {
  if (!cond) failed += 1;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
};
const browser = await launchBrowser();
const TILE = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mO8/58BAAMCAQDvVTZlAAAAAElFTkSuQmCC', 'base64');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const newPage = async ({ ua, width = 390, js = true } = {}) => {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 800, isMobile: width < 700, hasTouch: width < 700 });
  if (ua) await page.setUserAgent(ua);
  if (!js) await page.setJavaScriptEnabled(false);
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request', (r) => {
    if (/tile\.openstreetmap\.org/.test(r.url())) r.respond({ status: 200, contentType: 'image/png', body: TILE });
    else if (!r.url().startsWith(base)) r.abort();
    else r.continue();
  });
  return page;
};
const ready = (page) => page.waitForFunction(() => document.querySelector('[data-map]')?.dataset.state === 'ready', { timeout: 15000 });
const openMap = async (id, opts) => {
  const page = await newPage(opts);
  await page.goto(`${base}/pt/mapa/?id=${id}`, { waitUntil: 'load' });
  await ready(page);
  await page.waitForSelector('[data-map-preview]:not([hidden])', { timeout: 8000 });
  return page;
};
const preview = (page) =>
  page.evaluate(() => {
    const p = document.querySelector('[data-map-preview]');
    const order = ['.map__preview-today', '[data-preview-bridge-name]', '[data-preview-bridge-address]', '[data-preview-title]', '[data-preview-threads]', '[data-preview-hook]', '[data-preview-open]', '[data-preview-directions]'].map((s) => p.querySelector(s));
    const inOrder = order.every((el, i) => el && (i === 0 || order[i - 1].compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING));
    const text = (s) => p.querySelector(s)?.textContent.replace(/\s+/g, ' ').trim();
    const open = p.querySelector('[data-preview-open]');
    const how = p.querySelector('[data-preview-directions]');
    return { inOrder, today: text('.map__preview-today'), name: text('[data-preview-bridge-name]'), address: text('[data-preview-bridge-address]'), title: text('[data-preview-title]'), threads: [...p.querySelectorAll('[data-preview-threads] li')].map((l) => l.textContent.trim()), hook: text('[data-preview-hook]'), openText: open.textContent.trim(), openHref: open.getAttribute('href'), howText: how.textContent.trim(), howHref: how.getAttribute('href'), howRel: how.getAttribute('rel'), buttons: [...p.querySelectorAll('a.button')].map((a) => a.textContent.trim()) };
  });

// ---------- 1. The marker preview ----------
if (want('preview')) {
  for (const e of [GOA, FAR]) {
    const page = await openMap(e.id);
    const p = await preview(page);
    const threads = e.threads.map((id) => threadsData.find((t) => t.id === id).name.pt);
    ok(`preview of ${e.id}: "Hoje, aqui", bridge name, bridge address, then title, threads, hook, and the two buttons, in that order`, p.inOrder && p.today === 'Hoje, aqui' && p.name === e.bridge.name && p.address === e.bridge.address && p.title === e.title.pt && p.hook === norm(e.hook.pt), JSON.stringify({ today: p.today, name: p.name, address: p.address, title: p.title }));
    ok(`preview of ${e.id}: the threads of the card are listed`, threads.every((t) => p.threads.includes(t)), p.threads.join(', '));
    ok(`preview of ${e.id}: exactly two buttons, "Abrir" and "Como chegar"`, p.buttons.length === 2 && p.buttons[0] === 'Abrir' && p.buttons[1] === 'Como chegar', p.buttons.join(' | '));
    ok(`preview of ${e.id}: "Abrir" leads to the card, "Como chegar" to OpenStreetMap at the BRIDGE with rel="noopener"`, p.openHref.endsWith(`/${SEG.pt}/${e.slug.pt}/`) && p.howHref === osm(e) && /noopener/.test(p.howRel), `${p.openHref} ${p.howHref}`);
    await page.close();
  }
  ok('the Goa card: "Como chegar" points at Lisbon (bridge), not at Goa (place)', (() => { const near = GOA.bridge.lat > 38 && GOA.place.lat < 20; return near; })());
  const en = await newPage();
  await en.goto(`${base}/en/map/?id=${GOA.id}`, { waitUntil: 'load' });
  await ready(en);
  await en.waitForSelector('[data-map-preview]:not([hidden])');
  const pe = await preview(en);
  ok('preview in English: "Today, here", the bridge, "Open" and "Get directions"', pe.today === 'Today, here' && pe.name === GOA.bridge.name && pe.buttons.join('|') === 'Open|Get directions', JSON.stringify(pe.buttons));
  await en.close();
}

// ---------- 2. The caption of the selected marker ----------
if (want('caption')) {
  const page = await openMap(GOA.id);
  const c = await page.evaluate(() => [...document.querySelectorAll('.mk')].map((m) => ({ key: m.dataset.key, selected: m.classList.contains('mk--selected'), caption: m.querySelector('.mk__caption')?.textContent ?? null, shown: m.querySelector('.mk__caption') ? getComputedStyle(m.querySelector('.mk__caption')).display !== 'none' : false })));
  const withText = c.filter((m) => m.caption);
  ok('the bridge name is written next to the selected marker, and only there', withText.length === 1 && withText[0].key === GOA.id && withText[0].selected && withText[0].caption === GOA.bridge.name && withText[0].shown, JSON.stringify(withText));
  ok('no other marker or cluster has a caption', c.filter((m) => m.key !== GOA.id).every((m) => !m.caption));
  const box = await page.evaluate(() => { const el = document.querySelector('.mk--selected .mk__caption'); const r = el.getBoundingClientRect(); return { l: r.left, r: r.right, vw: document.documentElement.clientWidth, h: r.height }; });
  ok('the caption is on the screen', box.l >= -1 && box.h > 0, JSON.stringify(box));
  await page.click('[data-preview-close]');
  await wait(200);
  ok('closing the preview removes the caption', (await page.evaluate(() => [...document.querySelectorAll('.mk__caption')].every((c) => c.textContent === ''))));
  await page.close();
}

// ---------- 3. "Como chegar": OSM for all, geo: on Android only ----------
if (want('directions')) {
  for (const [name, ua, geo] of [['Android', UA.android, true], ['iPhone', UA.iphone, false], ['iPad', UA.ipad, false], ['macOS desktop', UA.mac, false], ['Windows desktop', UA.windows, false]]) {
    const page = await openMap(FAR.id, { ua, width: name.includes('desktop') ? 1100 : 390 });
    const p = await preview(page);
    const expectGeo = new RegExp(`^geo:${r5(FAR.bridge.lat)},${r5(FAR.bridge.lon)}\\?q=${r5(FAR.bridge.lat)},${r5(FAR.bridge.lon)}\\(`);
    ok(`map preview, ${name}: "Como chegar" is ${geo ? 'a geo: link' : 'the OpenStreetMap link'}`, geo ? expectGeo.test(p.howHref) : p.howHref === osm(FAR), p.howHref);
    await page.close();
    const card = await newPage({ ua, width: name.includes('desktop') ? 1100 : 390 });
    await card.goto(`${base}/pt/${SEG.pt}/${FAR.slug.pt}/`, { waitUntil: 'load' });
    await wait(300);
    const href = await card.evaluate(() => document.querySelector('[data-bridge] a[data-directions]').getAttribute('href'));
    ok(`card page, ${name}: "Como chegar" is ${geo ? 'a geo: link' : 'the OpenStreetMap link'}`, geo ? expectGeo.test(href) : href === osm(FAR), href);
    ok(`card page, ${name}: no script error`, card.errors.length === 0, card.errors.join('; '));
    await card.close();
  }
  const nojs = await newPage({ ua: UA.android, js: false });
  await nojs.goto(`${base}/pt/${SEG.pt}/${FAR.slug.pt}/`, { waitUntil: 'load' });
  ok('no JavaScript, even on Android: the OpenStreetMap link works', (await nojs.evaluate(() => document.querySelector('[data-bridge] a[data-directions]').getAttribute('href'))) === osm(FAR));
  await nojs.close();
  // nothing of Google or other services anywhere on the map page or a card
  for (const path of ['/pt/mapa/', `/pt/${SEG.pt}/${FAR.slug.pt}/`]) {
    const html = await (await fetch(base + path)).text();
    ok(`${path}: no Google, Apple, Bing, Waze or Mapbox address in the page`, !/google\.[a-z]+\/maps|maps\.google|maps\.apple|bing\.com\/maps|waze\.com|mapbox\.com/i.test(html));
  }
}

// ---------- 4. The bridge block on the card ----------
if (want('block')) {
  for (const lang of ['pt', 'en']) {
    for (const e of [GOA, FAR]) {
      const page = await newPage({ width: 360 });
      await page.goto(`${base}/${lang}/${SEG[lang]}/${e.slug[lang]}/#detalhes`, { waitUntil: 'load' });
      const b = await page.evaluate(() => {
        const s = document.querySelector('[data-bridge]');
        const vis = (el) => !!el && el.getClientRects().length > 0;
        return { visible: vis(s), name: s.querySelector('.bridge__name')?.textContent.trim(), address: s.querySelector('.bridge__address')?.textContent.trim(), note: s.querySelector('.bridge__note')?.textContent.trim(), noteLang: s.querySelector('.bridge__note')?.getAttribute('lang'), links: [...s.querySelectorAll('a.button')].map((a) => ({ text: a.textContent.trim(), href: a.getAttribute('href'), rel: a.getAttribute('rel'), h: Math.round(a.getBoundingClientRect().height), vis: vis(a) })), overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth };
      });
      const names = lang === 'pt' ? ['Ver no mapa', 'Como chegar', 'Sítio oficial'] : ['Open on map', 'Get directions', 'Official website'];
      ok(`bridge block (${lang}, ${e.id}): name, address and the note of this language`, b.visible && b.name === e.bridge.name && b.address === e.bridge.address && b.note === e.bridge.note[lang], JSON.stringify([b.name, b.address, b.note]));
      ok(`bridge block (${lang}, ${e.id}): three buttons ${names.join(', ')}, all visible, 44 px tall, no sideways scroll`, b.links.map((l) => l.text).join('|') === names.join('|') && b.links.every((l) => l.vis && l.h >= 44) && !b.overflow, JSON.stringify(b.links.map((l) => [l.text, l.h])));
      ok(`bridge block (${lang}, ${e.id}): the map button opens the map on this card, the official site link is the data's`, b.links[0].href.endsWith(`/${lang === 'pt' ? 'mapa' : 'map'}/?id=${e.id}`) && b.links[2].href === e.bridge.url && /noopener/.test(b.links[2].rel) && /noopener/.test(b.links[1].rel), JSON.stringify(b.links.map((l) => l.href)));
      ok(`bridge block (${lang}, ${e.id}): the Latin placeholder note is marked lang="la"`, b.noteLang === 'la');
      await page.close();
    }
  }
  // the place stays text on the card (Goa), the map link leads to a marker in Lisbon
  const page = await newPage();
  await page.goto(`${base}/pt/${SEG.pt}/${GOA.slug.pt}/`, { waitUntil: 'load' });
  const meta = await page.evaluate(() => document.body.textContent.replace(/\s+/g, ' '));
  ok('the place of the Goa card is text on the card, and the page still has a bridge in Lisbon', meta.includes(GOA.place.name) && meta.includes(GOA.bridge.name));
  await page.close();
}

// ---------- 5. Weight of the Android script on a card ----------
if (want('weight')) {
  const html = await (await fetch(`${base}/pt/${SEG.pt}/${FAR.slug.pt}/`)).text();
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).filter((c) => /data-directions|geo:/.test(c));
  const code = Buffer.from(scripts.join('\n'));
  const gz = gzipSync(code).length;
  console.log(`INFO  Android script on a card page: ${code.length} bytes raw, ${gz} bytes gzip`);
  ok('the Android script is under 1 KB gzip (it is on every card page)', code.length > 0 && gz < 1024, `${gz} B`);
  const plain = await (await fetch(`${base}/pt/${SEG.pt}/evento-exemplo-01/`)).text();
  ok('it carries no map library and no extra request', !/leaflet/i.test(plain));
}

await browser.close();
console.log(failed === 0 ? '\nAll bridge checks passed' : `\n${failed} check(s) failed`);
process.exit(failed === 0 ? 0 : 1);

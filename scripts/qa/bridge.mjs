// Browser checks for stage 5c: the map marks the bridge (not the place), the marker preview, "Como chegar", the bridge block.
// Run against dist/ served by serve.mjs:   node bridge.mjs [preview caption directions block weight]
import { launchBrowser } from './browser.mjs';
import { need, published, threads as threadsData } from './data.mjs';

const base = process.env.BASE_URL || 'http://localhost:4400';
const ONLY = process.argv.slice(2);
const want = (name) => ONLY.length === 0 || ONLY.includes(name);

// Two published cards, chosen from the data: one whose place is far from its bridge (a story told elsewhere, the bridge is in Portugal:
// the map must mark the bridge, not the place) and one whose bridge is a few km from the place.
const km = (a, b) => {
  const r = Math.PI / 180;
  return 6371 * Math.acos(Math.min(1, Math.sin(a.lat * r) * Math.sin(b.lat * r) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.cos((a.lon - b.lon) * r)));
};
const GOA = need('a story whose place is more than 1000 km from its bridge', (list) => list.find((e) => km(e.place, e.bridge) > 1000));
const FAR = need('a story whose bridge is 2 to 30 km from the place', (list) => list.find((e) => km(e.place, e.bridge) > 2 && km(e.place, e.bridge) < 30));
// The name of the bridge as the site shows it: the short title in the language when the card has one, else the name.
const bname = (e, lang = 'pt') => (e.bridge.title?.[lang]?.trim() || e.bridge.name);
const events = published;
const SEG = { pt: 'historia', en: 'story' };
const UA = {
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  ipad: 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
};
const r5 = (n) => Number(n.toFixed(5));
const google = (e) => `https://www.google.com/maps/dir/?api=1&destination=${r5(e.bridge.lat)},${r5(e.bridge.lon)}`;
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
    return { inOrder, today: text('.map__preview-today'), name: text('[data-preview-bridge-name]'), address: text('[data-preview-bridge-address]'), title: text('[data-preview-title]'), threads: [...p.querySelectorAll('[data-preview-threads] li')].map((l) => l.textContent.trim()), hook: text('[data-preview-hook]'), openText: open.textContent.trim(), openHref: open.getAttribute('href'), howText: how.textContent.trim(), howHref: how.getAttribute('href'), howRel: how.getAttribute('rel'), howTarget: how.getAttribute('target'), buttons: [...p.querySelectorAll('a.button')].map((a) => a.textContent.trim()) };
  });

// ---------- 1. The marker preview ----------
if (want('preview')) {
  for (const e of [GOA, FAR]) {
    const page = await openMap(e.id);
    const p = await preview(page);
    const threads = e.threads.map((id) => threadsData.find((t) => t.id === id).name.pt);
    ok(`preview of ${e.id}: "Hoje, aqui", bridge name, bridge address, then title, threads, hook, and the two buttons, in that order`, p.inOrder && p.today === 'Hoje, aqui' && p.name === bname(e) && p.address === e.bridge.address && p.title === e.title.pt && p.hook === norm(e.hook.pt), JSON.stringify({ today: p.today, name: p.name, address: p.address, title: p.title }));
    ok(`preview of ${e.id}: the threads of the card are listed`, threads.every((t) => p.threads.includes(t)), p.threads.join(', '));
    ok(`preview of ${e.id}: exactly two buttons, "Abrir" and "Como chegar"`, p.buttons.length === 2 && p.buttons[0] === 'Abrir' && p.buttons[1] === 'Como chegar', p.buttons.join(' | '));
    ok(`preview of ${e.id}: "Abrir" leads to the card, "Como chegar" to Google Maps at the BRIDGE, in a new tab with rel="noopener"`, p.openHref.endsWith(`/${SEG.pt}/${e.slug.pt}/`) && p.howHref === google(e) && p.howTarget === '_blank' && /noopener/.test(p.howRel), `${p.openHref} ${p.howHref}`);
    await page.close();
  }
  ok('the Goa card: "Como chegar" points at Lisbon (bridge), not at Goa (place)', (() => { const near = GOA.bridge.lat > 37 && GOA.bridge.lat < 40 && km(GOA.place, GOA.bridge) > 1000; return near; })());
  const en = await newPage();
  await en.goto(`${base}/en/map/?id=${GOA.id}`, { waitUntil: 'load' });
  await ready(en);
  await en.waitForSelector('[data-map-preview]:not([hidden])');
  const pe = await preview(en);
  ok('preview in English: "Today, here", the bridge, "Open" and "Get directions"', pe.today === 'Today, here' && pe.name === bname(GOA, 'en') && pe.buttons.join('|') === 'Open|Get directions', JSON.stringify(pe.buttons));
  await en.close();
}

// ---------- 2. The caption of the selected marker ----------
if (want('caption')) {
  const page = await openMap(GOA.id);
  const c = await page.evaluate(() => [...document.querySelectorAll('.mk')].map((m) => ({ key: m.dataset.key, selected: m.classList.contains('mk--selected'), caption: m.querySelector('.mk__caption')?.textContent ?? null, shown: m.querySelector('.mk__caption') ? getComputedStyle(m.querySelector('.mk__caption')).display !== 'none' : false })));
  const withText = c.filter((m) => m.caption);
  ok('the bridge name is written next to the selected marker, and only there', withText.length === 1 && withText[0].key === GOA.id && withText[0].selected && withText[0].caption === bname(GOA) && withText[0].shown, JSON.stringify(withText));
  ok('no other marker or cluster has a caption', c.filter((m) => m.key !== GOA.id).every((m) => !m.caption));
  const box = await page.evaluate(() => { const el = document.querySelector('.mk--selected .mk__caption'); const r = el.getBoundingClientRect(); return { l: r.left, r: r.right, vw: document.documentElement.clientWidth, h: r.height }; });
  ok('the caption is on the screen', box.l >= -1 && box.h > 0, JSON.stringify(box));
  await page.click('[data-preview-close]');
  await wait(200);
  ok('closing the preview removes the caption', (await page.evaluate(() => [...document.querySelectorAll('.mk__caption')].every((c) => c.textContent === ''))));
  await page.close();
}

// ---------- 3. "Como chegar": the same plain Google Maps link in the map preview and on the card page, on every device ----------
if (want('directions')) {
  for (const [name, ua] of [['Android', UA.android], ['iPhone', UA.iphone], ['iPad', UA.ipad], ['macOS desktop', UA.mac], ['Windows desktop', UA.windows]]) {
    const page = await openMap(FAR.id, { ua, width: name.includes('desktop') ? 1100 : 390 });
    const p = await preview(page);
    const prev = await page.evaluate(() => { const l = document.querySelector('[data-preview-directions]'); return { href: l.getAttribute('href'), target: l.getAttribute('target'), rel: l.getAttribute('rel') }; });
    ok(`map preview, ${name}: "Como chegar" is the Google Maps link to the bridge, in a new tab, rel noopener`, prev.href === google(FAR) && prev.target === '_blank' && /noopener/.test(prev.rel ?? ''), JSON.stringify(prev));
    await page.close();
    const card = await newPage({ ua, width: name.includes('desktop') ? 1100 : 390 });
    await card.goto(`${base}/pt/${SEG.pt}/${FAR.slug.pt}/`, { waitUntil: 'load' });
    await wait(300);
    const a = await card.evaluate(() => { const l = document.querySelector('[data-bridge] a[data-directions]'); return { href: l.getAttribute('href'), target: l.getAttribute('target'), rel: l.getAttribute('rel') }; });
    ok(`card page, ${name}: "Como chegar" is the Google Maps link to the bridge, in a new tab, rel noopener`, a.href === google(FAR) && a.target === '_blank' && /noopener/.test(a.rel ?? ''), JSON.stringify(a));
    ok(`card page, ${name}: no script error`, card.errors.length === 0, card.errors.join('; '));
    await card.close();
  }
  const nojs = await newPage({ ua: UA.android, js: false });
  await nojs.goto(`${base}/pt/${SEG.pt}/${FAR.slug.pt}/`, { waitUntil: 'load' });
  ok('no JavaScript, even on Android: the Google Maps link works', (await nojs.evaluate(() => document.querySelector('[data-bridge] a[data-directions]').getAttribute('href'))) === google(FAR));
  await nojs.close();
  // no other service anywhere on the map page or a card; the one Google address is the directions link of the card page (a link, nothing is loaded)
  for (const path of ['/pt/mapa/', `/pt/${SEG.pt}/${FAR.slug.pt}/`]) {
    const html = (await (await fetch(base + path)).text()).replace(/&amp;/g, '&').split(google(FAR)).join('');
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
        return { visible: vis(s), name: s.querySelector('.bridge__name')?.textContent.trim(), address: s.querySelector('.bridge__address')?.textContent.trim(), note: s.querySelector('.bridge__note')?.textContent.trim(), noteLang: s.querySelector('.bridge__note')?.getAttribute('lang'), links: [...s.querySelectorAll('.bridge__go a, .bridge__links a')].map((a) => ({ text: a.textContent.trim(), href: a.getAttribute('href'), rel: a.getAttribute('rel'), h: Math.round(a.getBoundingClientRect().height), vis: vis(a) })), overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth };
      });
      // Now: one button "Como chegar" (44 px), under it two plain links, "Ver no mapa" and "Sítio oficial".
      const names = lang === 'pt' ? ['Como chegar', 'Ver no mapa', 'Sítio oficial'] : ['Get directions', 'Open on map', 'Official website'];
      ok(`bridge block (${lang}, ${e.id}): name, address and the note of this language`, b.visible && b.name === bname(e, lang) && b.address === e.bridge.address && b.note === e.bridge.note[lang], JSON.stringify([b.name, b.address, b.note]));
      ok(`bridge block (${lang}, ${e.id}): the button and two links ${names.join(', ')}, all visible, the button 44 px tall, no sideways scroll`, b.links.map((l) => l.text).join('|') === names.join('|') && b.links.every((l) => l.vis) && b.links[0].h >= 44 && !b.overflow, JSON.stringify(b.links));
      ok(`bridge block (${lang}, ${e.id}): the map link opens the map on this card, the official site link is the data's`, b.links[1].href.endsWith(`/${lang === 'pt' ? 'mapa' : 'map'}/?id=${e.id}`) && b.links[2].href === e.bridge.url && /noopener/.test(b.links[2].rel ?? ''), JSON.stringify(b.links.map((l) => l.href)));
      ok(`bridge block (${lang}, ${e.id}): the note carries lang="la" only for a placeholder card`, (b.noteLang ?? null) === (e.placeholder ? 'la' : null), String(b.noteLang));
      await page.close();
    }
  }
  // the place stays text on the card (Goa), the map link leads to a marker in Lisbon
  const page = await newPage();
  await page.goto(`${base}/pt/${SEG.pt}/${GOA.slug.pt}/`, { waitUntil: 'load' });
  const meta = await page.evaluate(() => document.body.textContent.replace(/\s+/g, ' '));
  ok('the place of the Goa card is text on the card, and the page still has a bridge in Lisbon', meta.includes(GOA.place.name.pt) && meta.includes(bname(GOA)));
  await page.close();
}

// ---------- 5. Weight: the card page has no script for directions and no map library ----------
if (want('weight')) {
  const html = await (await fetch(`${base}/pt/${SEG.pt}/${FAR.slug.pt}/`)).text();
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).filter((c) => /data-directions|geo:/.test(c));
  ok('the card page has no inline script for directions (the link is a plain link)', scripts.length === 0, String(scripts.length));
  const plain = await (await fetch(`${base}/pt/${SEG.pt}/${published.find((c) => c.id !== FAR.id).slug.pt}/`)).text();
  ok('it carries no map library and no extra request', !/leaflet/i.test(plain));
}

await browser.close();
console.log(failed === 0 ? '\nAll bridge checks passed' : `\n${failed} check(s) failed`);
process.exit(failed === 0 ? 0 : 1);

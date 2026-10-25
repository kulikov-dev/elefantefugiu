import { launchBrowser } from './browser.mjs';
import { en, need, pt } from './data.mjs';
const browser = await launchBrowser();
const base = process.env.BASE_URL || 'http://localhost:4400';
// A plain published card: all ages, no interactive, not a heavy topic.
const card = need('a story for all ages without an interactive', (list) => list.find((e) => e.min_age === 'all' && !e.interactive && !e.sensitive));
const url = `${base}${pt(card)}`;
let failed = 0;
const ok = (name, cond, extra = '') => {
  if (!cond) failed += 1;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// 1. No JavaScript, images blocked: text readable, details works, share falls back to a link.
{
  const page = await browser.newPage();
  await page.setViewport({ width: 360, height: 800 });
  await page.setJavaScriptEnabled(false);
  await page.setRequestInterception(true);
  page.on('request', (r) => (r.resourceType() === 'image' ? r.abort() : r.continue()));
  await page.goto(url, { waitUntil: 'load' });
  const s = await page.evaluate(() => {
    const vis = (el) => !!el && el.getBoundingClientRect().height > 0 && getComputedStyle(el).visibility !== 'hidden';
    const d = document.getElementById('detalhes');
    return {
      hook: vis(document.querySelector('.hook')),
      story: vis(document.getElementById('historia')),
      miniMap: Boolean(document.querySelector('.minimap')?.checkVisibility()),
      shareLink: vis(document.querySelector('[data-share-link]')),
      shareButton: vis(document.querySelector('[data-share-button]')),
      detailsOpen: d.open,
      overflow: document.scrollingElement.scrollWidth - innerWidth,
    };
  });
  ok('no JS + no images: hook visible', s.hook);
  ok('no JS + no images: story visible', s.story);
  // The map of the bridge block is in the closed "More" layer: nothing of it takes room before the reader opens it.
  ok('no JS + no images: the map of the bridge block is not shown while "More" is closed', !s.miniMap);
  ok('no JS: share is a plain link, button hidden', s.shareLink && !s.shareButton);
  ok('no JS: layer 3 closed by default', !s.detailsOpen);
  await page.click('#detalhes > summary');
  ok('no JS: summary toggles layer 3 (native <details>)', await page.evaluate(() => document.getElementById('detalhes').open));
  const map = await page.evaluate(() => {
    const frame = document.querySelector('.minimap__frame');
    return { height: Math.round(frame.getBoundingClientRect().height), caption: document.querySelector('.minimap__caption').textContent.trim(), inBridge: Boolean(frame.closest('[data-bridge]')), link: frame.getAttribute('href') };
  });
  ok('no JS: opened, the map is in the bridge block, 220 px tall on a phone, with the caption "Bridge to today: name" and a link to the map page', map.inBridge && map.height === 220 && /^[^:]+: .+/.test(map.caption) && /[?&]id=/.test(map.link), JSON.stringify(map));
  ok('no JS: no horizontal overflow at 360px', s.overflow <= 0, `overflow=${s.overflow}`);
  await page.close();
}

// 2. Hash <-> layer state
{
  const page = await browser.newPage();
  await page.setViewport({ width: 360, height: 800 });
  await page.goto(url + '#detalhes', { waitUntil: 'networkidle0' });
  const isOpen = () => page.evaluate(() => document.getElementById('detalhes').open);
  ok('open on load with #detalhes', await isOpen());
  await page.click('#detalhes > summary'); // close
  await wait(150);
  ok('closing removes #detalhes from the address', (await page.evaluate(() => location.hash)) === '' && !(await isOpen()));
  await page.click('#detalhes > summary'); // open
  await wait(150);
  ok('opening sets #detalhes', (await page.evaluate(() => location.hash)) === '#detalhes' && (await isOpen()));
  await page.evaluate(() => (location.hash = '#historia'));
  await wait(150);
  ok('#historia closes layer 3 (state follows hashchange)', !(await isOpen()));
  const hist = await page.evaluate(() => history.length);
  await page.click('#detalhes > summary');
  await wait(100);
  await page.click('#detalhes > summary');
  await wait(100);
  ok('toggling does not add history entries', (await page.evaluate(() => history.length)) === hist);
  await page.goto(url, { waitUntil: 'networkidle0' });
  ok('no hash: default state (story visible, layer 3 closed)', !(await isOpen()));
  await page.close();
}

// 3. Keyboard: tab order, visible focus, Enter/Space on summary
{
  const page = await browser.newPage();
  await page.setViewport({ width: 360, height: 800 });
  await page.goto(url, { waitUntil: 'networkidle0' });
  const seen = [];
  let bad = [];
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName.toLowerCase(),
        name: (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40),
        outline: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2,
        h: Math.round(r.height),
        w: Math.round(r.width),
        visible: r.height > 0 && r.width > 0,
        hidden: el.hidden,
      };
    });
    if (!info) break;
    seen.push(info);
    if (!info.outline) bad.push(`${info.tag} "${info.name}" has no focus outline`);
    if (info.h < 40 && info.tag !== 'a') bad.push(`${info.tag} "${info.name}" height ${info.h}px`);
    if (!info.visible || info.hidden) bad.push(`focus landed on a hidden element: ${info.name}`);
    if (seen.length > 1 && seen.at(-1).name === seen[0].name) break;
  }
  console.log('      tab order:', seen.map((s) => `${s.tag}:${s.name}`).join(' | '));
  ok('every focused element has a visible outline (>= 2px) and is visible', bad.length === 0, bad.join('; '));
  // Keyboard on summary
  await page.focus('#detalhes > summary');
  await page.keyboard.press('Enter');
  const afterEnter = await page.evaluate(() => document.getElementById('detalhes').open);
  await page.keyboard.press('Space');
  const afterSpace = await page.evaluate(() => document.getElementById('detalhes').open);
  ok('Enter opens and Space closes layer 3', afterEnter === true && afterSpace === false);
  await page.close();
}

// 4. Share widget with JS: button replaces link; Web Share path; copy path; cancel
{
  const ctx = browser.defaultBrowserContext();
  await ctx.overridePermissions(base, ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']);
  const page = await browser.newPage();
  await page.setViewport({ width: 360, height: 800 });
  await page.goto(url + '#detalhes', { waitUntil: 'networkidle0' });
  const vis = await page.evaluate(() => ({
    link: !document.querySelector('[data-share-link]').offsetParent,
    button: !!document.querySelector('[data-share-button]').offsetParent,
  }));
  ok('with JS: link hidden, button shown', vis.link && vis.button);
  await page.evaluate(() => { delete Navigator.prototype.share; Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }); });
  await page.click('[data-share-button]');
  await wait(200);
  const status = await page.$eval('[data-share-status]', (e) => e.textContent);
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  ok('no Web Share: link copied with confirmation', status.includes('copiada') && clip === url + '#detalhes', `status="${status}"`);
  const live = await page.$eval('[data-share-status]', (e) => e.getAttribute('role'));
  ok('confirmation is announced (role=status)', live === 'status');
  await page.evaluate(() => { window.__shared = null; Object.defineProperty(navigator, 'share', { value: async (d) => { window.__shared = d; }, configurable: true }); });
  await page.click('[data-share-button]');
  await wait(100);
  const shared = await page.evaluate(() => window.__shared);
  ok('Web Share API used when available (title + current url incl. #detalhes)', shared && shared.url === url + '#detalhes' && shared.title === card.title.pt);
  await page.evaluate(() => { Object.defineProperty(navigator, 'share', { value: async () => { throw new DOMException('x', 'AbortError'); }, configurable: true }); document.querySelector('[data-share-status]').textContent = ''; });
  await page.click('[data-share-button]');
  await wait(150);
  ok('cancelled share dialog shows no message', (await page.$eval('[data-share-status]', (e) => e.textContent)) === '');
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('denied')) }, configurable: true });
  });
  await page.click('[data-share-button]');
  await wait(150);
  const failText = await page.$eval('[data-share-status]', (e) => e.textContent);
  ok('copy refused: the message shows the link to copy by hand', failText.includes('http'), failText);
  await page.close();
}

// 5. Language switch goes to the same card; report link carries the card address
{
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle0' });
  const hrefs = await page.evaluate(() => ({
    en: document.querySelector('.lang-switch a[hreflang="en"]').getAttribute('href'),
    report: [...document.querySelectorAll('a')].find((a) => a.href.includes('/corrigir/?url=')).getAttribute('href'),
  }));
  ok('language switch leads to the same card in EN', hrefs.en === en(card), hrefs.en);
  ok('report link carries the card address', decodeURIComponent(hrefs.report).includes(pt(card)), hrefs.report);
  await page.close();
}
await browser.close();
console.log(failed ? `${failed} check(s) failed` : 'All browser checks passed');
process.exit(failed ? 1 : 0);

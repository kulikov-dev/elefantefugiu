// Browser checks for the elephant mascot (docs/visual-direction.md section 6).
// Run against dist/ served by serve.mjs (base path "/"):   node mascot.mjs [logo notfound pager empty dark motion]
import { fsPath, launchBrowser } from './browser.mjs';

const base = process.env.BASE_URL || 'http://localhost:4400';
const ONLY = process.argv.slice(2);
const want = (name) => ONLY.length === 0 || ONLY.includes(name);
const AVIS = '/pt/epoca/avis-e-descobrimentos/';
// The regime epoch has no published card on the real site: its page exists only in the fixture build (variant-plan.mjs).
const ESTADO = '/pt/epoca/estado-novo-e-25-de-abril/';
const variantBase = process.env.VARIANT_URL || 'http://localhost:4401';

let failed = 0;
const ok = (name, cond, extra = '') => {
  if (!cond) failed += 1;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
};
const browser = await launchBrowser();
const open = async (path, { width = 360, scheme = 'light', reduce = false, js = true, from = base } = {}) => {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 800, isMobile: width < 700, hasTouch: width < 700 });
  await page.emulateMediaFeatures([
    { name: 'prefers-color-scheme', value: scheme },
    { name: 'prefers-reduced-motion', value: reduce ? 'reduce' : 'no-preference' },
  ]);
  if (!js) await page.setJavaScriptEnabled(false);
  await page.goto(`${from}${path}`, { waitUntil: 'networkidle0' });
  return page;
};
/** Mascot pictures that are drawn (size above zero) and inside the screen right now, the logo not counted. */
const visibleFigures = (page) =>
  page.$$eval('img.mascot:not(.mascot--logo)', (imgs) =>
    imgs.filter((i) => {
      const r = i.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && i.checkVisibility();
    }).length,
  );

// ---------- 1. The logo ----------
if (want('logo')) {
  for (const width of [320, 360, 1280]) {
    const page = await open('/pt/', { width });
    const m = await page.evaluate(() => {
      const img = document.querySelector('.brand img.mascot--logo');
      const r = img.getBoundingClientRect();
      return { loaded: img.complete && img.naturalWidth > 0, h: r.height, overflow: document.documentElement.scrollWidth > innerWidth, alt: img.getAttribute('alt'), brandRight: document.querySelector('.brand').getBoundingClientRect().right, switchLeft: document.querySelector('.lang-switch')?.getBoundingClientRect().left };
    });
    ok(`logo ${width}px: the head is drawn, decorative, and the header does not overflow`, m.loaded && m.alt === '' && m.h >= 24 && !m.overflow, JSON.stringify(m));
    ok(`logo ${width}px: the brand does not run into the language switch`, m.switchLeft === undefined || m.brandRight <= m.switchLeft + 1, `${m.brandRight} vs ${m.switchLeft}`);
    await page.close();
  }
}

// ---------- 2. The 404 page ----------
if (want('notfound')) {
  for (const width of [320, 1280]) {
    const page = await open('/404.html', { width });
    const n = await visibleFigures(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    ok(`404 ${width}px: one thinking elephant, no horizontal scroll`, n === 1 && !overflow && (await page.$$eval('img.mascot--hero', (is) => is.filter((i) => i.getClientRects().length > 0).map((i) => i.dataset.mascot)[0])) === 'think', `figures ${n}`);
    await page.close();
  }
}

// ---------- 3. The walking elephant by the "next epoch" link ----------
if (want('pager')) {
  const page = await open(AVIS, { width: 1280 });
  await page.evaluate(() => document.querySelector('.pager').scrollIntoView({ block: 'end' }));
  await new Promise((r) => setTimeout(r, 500));
  const m = await page.evaluate(() => {
    const img = document.querySelector('.pager .mascot');
    const link = document.querySelector('.pager__link--next');
    if (!img || !link) return null;
    const a = img.getBoundingClientRect();
    const b = link.getBoundingClientRect();
    return { standsOnLink: Math.abs(a.bottom - b.top) <= 2, insideLinkRight: a.right <= b.right + 1, pointer: getComputedStyle(img).pointerEvents, opacity: getComputedStyle(img).opacity };
  });
  ok('pager: the elephant stands on the top edge of the "next epoch" link, no clicks, fully visible', m && m.standsOnLink && m.insideLinkRight && m.pointer === 'none' && Number(m.opacity) === 1, JSON.stringify(m));
  ok('pager: one elephant on the screen', (await visibleFigures(page)) === 1);
  await page.close();
  const card = await open('/pt/historia/terramoto-de-lisboa/', { width: 360 });
  ok('a heavy card has no elephant (only the logo)', (await card.$$('img.mascot:not(.mascot--logo)')).length === 0);
  await card.close();
}

// ---------- 3b. The regime epoch (fixture build only) ----------
if (want('regime')) {
  for (const width of [360, 1280]) {
    const regime = await open(ESTADO, { width, from: variantBase });
    ok(`the regime epoch page (${width}px) has no elephant at all, not even in the pager`, (await regime.$$('img.mascot:not(.mascot--logo)')).length === 0);
    await regime.close();
  }
}

// ---------- 4. Empty states ----------
if (want('empty')) {
  const page = await open(`${AVIS}?fio=natureza`, { width: 360 });
  // The family mode "all ages" hides the heavy cards; when nothing is left the "think" elephant shows in its message.
  const shown = await page.evaluate(() => {
    const el = document.querySelector('[data-empty]');
    return { has: Boolean(el?.querySelector('img.mascot')), pose: el?.querySelector('img.mascot')?.dataset.mascot };
  });
  ok('the empty feed message carries the peeking elephant (hidden until it is needed)', shown.has && shown.pose === 'peek', JSON.stringify(shown));
  ok('while the feed has cards, no elephant is on the screen', (await visibleFigures(page)) === 0);
  await page.close();
}

// ---------- 5. Dark theme: the halo ----------
if (want('dark')) {
  const dark = await open('/pt/', { scheme: 'dark' });
  const light = await open('/pt/', { scheme: 'light' });
  const f = async (page) => page.$eval('img.mascot--logo', (i) => getComputedStyle(i).filter);
  const [fd, fl] = [await f(dark), await f(light)];
  ok('dark theme: the mascot has a light halo; light theme: the halo is transparent', /drop-shadow/.test(fd) && fd !== fl, `${fd} | ${fl}`);
  await dark.close();
  await light.close();
}

// ---------- 6. Reduced motion ----------
if (want('motion')) {
  const page = await open(AVIS, { width: 1280, reduce: true });
  const anim = await page.$eval('.pager .mascot', (i) => getComputedStyle(i).animationName);
  ok('reduced motion: the elephant does not move', anim === 'none', anim);
  await page.close();
}

await browser.close();
console.log(failed === 0 ? '\nAll mascot checks passed' : `\n${failed} check(s) failed`);
process.exit(failed === 0 ? 0 : 1);

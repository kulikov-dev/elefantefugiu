// Browser checks for the bottom tab bar of a phone (src/components/TabBar.astro): present up to 767 px and absent from 768 px, one active tab where
// the section matches and none elsewhere, the page and the footer end above the bar, the links lead to pages that exist, the colour and the focus.
// Run against dist/ served by serve.mjs (base path "/"):   node nav.mjs
// Pages come from src/content (data.mjs) and from the links of the footer; nothing here counts stories or epochs.
import { launchBrowser } from './browser.mjs';
import { epochPath, festas, need, published, readyEpochs, threads, threadPath } from './data.mjs';

const base = process.env.BASE_URL || 'http://localhost:4400';
const LANGS = ['pt', 'en', 'ru'];
const STORY = { pt: 'historia', en: 'story', ru: 'istoriya' };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let failed = 0;
const ok = (name, cond, extra = '') => {
  if (!cond) failed += 1;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
};

const epoch = need('a ready epoch', () => readyEpochs[0]);
const story = need('a published story of the first ready epoch', () => published.find((e) => e.epoch === epoch.id && LANGS.every((l) => e.slug?.[l])));
const thread = need('a thread in every language', () => threads.find((t) => LANGS.every((l) => t.slug?.[l])));
const festaList = festas.filter((f) => f.enabled);

const browser = await launchBrowser();
const newPage = async ({ width = 390, scheme = 'light', js = true } = {}) => {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 800, isMobile: width < 768, hasTouch: width < 768 });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
  if (!js) await page.setJavaScriptEnabled(false);
  return page;
};
const open = async (page, path) => {
  const response = await page.goto(`${base}${path}`, { waitUntil: 'load' });
  return response?.status() ?? 0;
};
const tabs = (page) =>
  page.evaluate(() => {
    const bar = document.querySelector('.tabbar');
    return {
      shown: !!bar && getComputedStyle(bar).display !== 'none',
      count: bar ? bar.querySelectorAll('a').length : 0,
      current: bar ? [...bar.querySelectorAll('a[aria-current="page"]')].map((a) => a.getAttribute('href')) : [],
      hrefs: bar ? [...bar.querySelectorAll('a')].map((a) => a.getAttribute('href')) : [],
    };
  });
const footerLinks = (page) => page.evaluate(() => [...document.querySelectorAll('.site-footer__links a')].map((a) => a.getAttribute('href')));

// 1. The pages of every language: the bar is there, and the active tab is the section of the page (none outside the five sections).
const pagesOf = async (lang) => {
  const probe = await newPage();
  await open(probe, `/${lang}/`);
  const footer = await footerLinks(probe);
  const bar = await tabs(probe);
  await probe.close();
  const [home, epochs, map, myths, surprise] = bar.hrefs;
  // The second game: the tab "Games" is the current one there too.
  const orderHref = `/${lang}/${{ pt: 'o-que-veio-primeiro', en: 'which-came-first', ru: 'chto-bylo-ranshe' }[lang]}/`;
  const list = [
    ['home', home, home],
    ['epoch', epochPath(epoch, lang), epochs],
    ['story', `/${lang}/${STORY[lang]}/${story.slug[lang]}/`, epochs],
    ['map', map, map],
    ['myths', myths, myths],
    ['order', orderHref, myths],
    ['surprise', surprise, surprise],
    ['thread', threadPath(thread, lang), null],
    ...footer.filter((h) => h.startsWith(`/${lang}/`) && h.endsWith('/') && !bar.hrefs.includes(h) && h !== orderHref).map((h) => [`static ${h}`, h, null]),
    ...festaList.map((f) => [`festa ${f.slug}`, `/${lang}/festa/${f.slug}/`, null]),
    ['404', `/${lang}/no-such-page/`, null],
  ];
  return { list, bar };
};

let mapPath = null;
for (const lang of LANGS) {
  const { list, bar } = await pagesOf(lang);
  if (lang === 'pt') mapPath = bar.hrefs[2];
  ok(`${lang}: five tabs`, bar.count === 5);
  ok(`${lang}: the tabs stay in their language`, bar.hrefs.every((h) => h.startsWith(`/${lang}/`)));
  for (const href of bar.hrefs) {
    const page = await newPage();
    const status = await open(page, href.split('#')[0]);
    ok(`${lang}: tab link ${href} leads to a page that exists`, status === 200, `status ${status}`);
    await page.close();
  }
  for (const [name, path, expected] of list) {
    // With JavaScript the link to Surprise me goes on to a story at once; the page itself (the fallback) is what has the tab.
    const page = await newPage({ js: name !== 'surprise' });
    await open(page, path);
    const t = await tabs(page);
    ok(`${lang} ${name} (390 px): the bar shows`, t.shown && t.count === 5);
    ok(`${lang} ${name} (390 px): active tab ${expected ?? 'none'}`, JSON.stringify(t.current) === JSON.stringify(expected ? [expected] : []), `got ${JSON.stringify(t.current)}`);
    await page.close();
  }
}

// 2. Width: the bar up to 767 px, none from 768 px; on a phone the header menu is gone (its links are the tabs), from 768 px it stays.
for (const [width, bar] of [[320, true], [767, true], [768, false], [1280, false]]) {
  const page = await newPage({ width });
  await open(page, '/pt/');
  const t = await tabs(page);
  const menu = await page.evaluate(() => getComputedStyle(document.querySelector('.site-nav')).display !== 'none');
  ok(`pt home at ${width} px: bar ${bar ? 'shown' : 'absent'}`, t.shown === bar);
  ok(`pt home at ${width} px: header menu ${bar ? 'hidden' : 'shown'}`, menu === !bar);
  await page.close();
}
{
  const page = await newPage({ js: false });
  await open(page, '/pt/');
  ok('pt home without JavaScript: the bar shows', (await tabs(page)).shown);
  await page.close();
}

// 3. The end of the page is above the bar (360 px): the footer and the last control of the page.
for (const [name, path] of [['story', `/pt/${STORY.pt}/${story.slug.pt}/`], ['map', mapPath], ['home', '/pt/']]) {
  const page = await newPage({ width: 360 });
  await open(page, path);
  await wait(800);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await wait(300);
  const m = await page.evaluate(() => {
    const barTop = document.querySelector('.tabbar').getBoundingClientRect().top;
    const lastLink = [...document.querySelectorAll('.site-footer a')].at(-1).getBoundingClientRect().bottom;
    const footer = document.querySelector('.site-footer').getBoundingClientRect().bottom;
    const controls = [...document.querySelectorAll('main button, main .button')].filter((el) => el.getClientRects().length > 0);
    return { barTop, lastLink, footer, lastControl: controls.length ? controls.at(-1).getBoundingClientRect().bottom : null, overflowX: document.documentElement.scrollWidth - innerWidth };
  });
  ok(`${name} (360 px): the footer ends above the bar`, m.footer <= m.barTop + 1 && m.lastLink <= m.barTop, JSON.stringify(m));
  ok(`${name} (360 px): the last control of the page is above the bar`, m.lastControl === null || m.lastControl <= m.barTop + 1);
  ok(`${name} (360 px): no horizontal scroll`, m.overflowX <= 0);
  await page.close();
}
{
  // The map: the sheet and the attribution stay inside the map (above the bar once the page is scrolled to the map), the strip below it and the footer scroll above the bar.
  const page = await newPage({ width: 390, scheme: 'dark' });
  await open(page, mapPath);
  await wait(1500);
  const m = await page.evaluate(() => {
    const stage = document.querySelector('.map__stage');
    window.scrollTo(0, stage.getBoundingClientRect().bottom + scrollY - (innerHeight - 160));
    const barTop = document.querySelector('.tabbar').getBoundingClientRect().top;
    const sheet = document.querySelector('.map__list').getBoundingClientRect().bottom;
    const attribution = document.querySelector('.leaflet-control-attribution')?.getBoundingClientRect().bottom ?? null;
    window.scrollTo(0, document.documentElement.scrollHeight);
    const strip = document.querySelector('[class*="timeline"]');
    return { barTop, sheet, attribution, strip: strip ? strip.getBoundingClientRect().bottom : null, footer: document.querySelector('.site-footer').getBoundingClientRect().bottom, barTopEnd: document.querySelector('.tabbar').getBoundingClientRect().top };
  });
  ok('map (390 px, dark): the sheet and the attribution are above the bar', m.sheet <= m.barTop + 1 && (m.attribution === null || m.attribution <= m.barTop + 1), JSON.stringify(m));
  ok('map (390 px, dark): scrolled to the end, the strip under the map and the footer are above the bar', (m.strip === null || m.strip <= m.barTopEnd + 1) && m.footer <= m.barTopEnd + 1, JSON.stringify(m));
  await page.close();
}

// 4. The colour of the active tab is the colour of the epoch link (the crumbs of a story), in both themes; outside an epoch the base link colour.
for (const scheme of ['light', 'dark']) {
  const page = await newPage({ scheme });
  await open(page, `/pt/${STORY.pt}/${story.slug.pt}/`);
  const c = await page.evaluate(() => ({
    tab: getComputedStyle(document.querySelector('.tabbar a[aria-current="page"]')).color,
    crumb: getComputedStyle(document.querySelector('.crumbs a')).color,
    idle: getComputedStyle(document.querySelector('.tabbar a:not([aria-current])')).color,
  }));
  ok(`story (${scheme}): the active tab has the colour of the epoch link in the crumbs`, c.tab === c.crumb && c.tab !== c.idle, JSON.stringify(c));
  await open(page, mapPath);
  const m = await page.evaluate(() => {
    const probe = document.createElement('a');
    probe.href = '#';
    document.querySelector('.site-footer').append(probe);
    const base = getComputedStyle(probe).color;
    probe.remove();
    return { tab: getComputedStyle(document.querySelector('.tabbar a[aria-current="page"]')).color, base };
  });
  ok(`map (${scheme}): outside an epoch the tab has the base link colour`, m.tab === m.base, JSON.stringify(m));
  await page.close();
}

// 5. Keyboard: Tab reaches the bar after the page, a tab in focus has a visible ring inside the tab (both themes).
for (const scheme of ['light', 'dark']) {
  const page = await newPage({ scheme });
  await open(page, '/pt/');
  const stops = await page.evaluate(() => document.querySelectorAll('a[href], button, summary, input, select, textarea').length);
  let ring = null;
  for (let i = 0; i < stops + 10 && !ring; i += 1) {
    await page.keyboard.press('Tab');
    ring = await page.evaluate(() => {
      if (!document.activeElement?.closest('.tabbar')) return null;
      const s = getComputedStyle(document.activeElement);
      return { style: s.outlineStyle, width: parseFloat(s.outlineWidth), offset: parseFloat(s.outlineOffset), color: s.outlineColor };
    });
  }
  ok(`keyboard (${scheme}): Tab reaches the bar`, ring !== null);
  ok(`keyboard (${scheme}): a tab in focus has a visible ring inside the tab`, !!ring && ring.style !== 'none' && ring.width >= 2 && ring.offset < 0, JSON.stringify(ring));
  const last = await page.evaluate(() => {
    const els = [...document.querySelectorAll('a[href], button, summary, input, select, textarea')].filter((e) => e.getClientRects().length > 0);
    return !!els.at(-1)?.closest('.tabbar');
  });
  ok(`keyboard (${scheme}): the bar is the last stop, after the content and the footer`, last);
  await page.close();
}

// 6. A form field in focus hides the bar (the on-screen keyboard must not carry it over the field).
{
  const probe = await newPage();
  await open(probe, '/pt/');
  const links = await footerLinks(probe);
  await probe.close();
  const form = need('a footer page with a form', () => links.find((h) => /corrigir/.test(h)));
  const page = await newPage();
  await open(page, form);
  await page.focus('form input:not([type=hidden]):not([tabindex="-1"]), form textarea');
  ok('report form: the bar is hidden while a field has the focus', await page.evaluate(() => getComputedStyle(document.querySelector('.tabbar')).display === 'none'));
  await page.close();
}

await browser.close();
console.log(failed === 0 ? '\nAll nav checks passed' : `\n${failed} check(s) failed`);
process.exit(failed === 0 ? 0 : 1);

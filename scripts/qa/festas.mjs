// Browser checks of the holidays (src/data/festas.yaml, src/lib/festas.mjs, docs/spec.md "Праздники"), run against dist/ served by serve.mjs:
//   node festas.mjs [window page art nojs natal bolo carnaval]
// The day is set with ?hoje=YYYY-MM-DD and a holiday with ?festa=<id>. The holiday, its days and its address come from the data: the first enabled holiday that has a
// text in every language of the site (pt, en, ru) and a drawing; the suite names what is missing when there is none.
import { spawn, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchBrowser } from './browser.mjs';
import { festas, published, readyEpochs } from './data.mjs';
import { addDays, festaDay, fillDate, windowOf } from '../../src/lib/festas.mjs';

const base = process.env.BASE_URL || 'http://localhost:4400';
const ONLY = process.argv.slice(2);
const want = (name) => ONLY.length === 0 || ONLY.includes(name);

const LANGS = ['pt', 'en', 'ru'];
const FESTA = festas.find((f) => f.enabled && f.art && LANGS.every((l) => f.text?.[l]));
if (!FESTA) throw new Error('need: an enabled holiday with a drawing and a text in pt, en and ru in src/data/festas.yaml. None found.');
const TEXT = FESTA.text.ru;
const STORY = published.find((e) => e.id === FESTA.story);
if (!STORY) throw new Error(`need: the story "${FESTA.story}" of the holiday "${FESTA.id}" among the published stories`);
// Days come from the data, never from the clock: the year after the last published story (the days of the holidays are far from it), and, for the builds that
// need a day of their own, the days below.
const LATEST = published.map((e) => e.published).sort().at(-1);
const year = Number(LATEST.slice(0, 4)) + 1;
const DAY = festaDay(FESTA.date, year);
const { from: FIRST } = windowOf(DAY);
const BEFORE = addDays(FIRST, -1);
const AFTER = addDays(DAY, 1);
const MIDDLE = addDays(DAY, -1);
const pageOf = (lang) => `/${lang}/festa/${FESTA.slug}/`;

// The holiday with the cake to cut (art: bolo), in the language that has its game texts: the day, the window and the words come from the data.
const BOLO = festas.find((f) => f.enabled && f.art === 'bolo' && Object.values(f.text ?? {}).some((t) => t.bolo));
const BOLO_LANGS = BOLO ? LANGS.filter((l) => BOLO.text[l]?.bolo) : [];
const BOLO_DAY = BOLO ? festaDay(BOLO.date, year) : '';

// The pages of a holiday are decided when the site is built, by the day of the build (indexing, sitemap, the picture of the home page, the header without JavaScript):
// two builds with a day of their own (prepare-day.mjs), one inside the window of the carnival and one outside every window of every holiday. A check that needs
// the day of the build asks for one of them (`open(url, { site: OUT })`); the day of the real build (BASE_URL) is not looked at.
const windows = (y) => festas.map((f) => { const d = festaDay(f.date, y); return { from: windowOf(d).from, to: d }; });
const free = (day) => [-1, 0, 1].every((k) => windows(Number(day.slice(0, 4)) + k).every((w) => day < w.from || day > w.to));
const OUT_DAY = (() => { let d = LATEST; while (!free(d)) d = addDays(d, 1); return d; })();
const CARN_DAY = (() => { const c = festas.find((f) => f.enabled && f.art === 'queen' && 'easter' in f.date); return c ? festaDay(c.date, year) : DAY; })();
const dayPort = new URL(base).port ? Number(new URL(base).port) : 4400;
const dayChildren = [];
process.on('exit', () => dayChildren.forEach((c) => c.kill()));
async function dayBuild(name, day, port) {
  const r = spawnSync('node', ['prepare-day.mjs', name, day], { cwd: new URL('.', import.meta.url), stdio: 'inherit', env: process.env });
  if (r.status !== 0) throw new Error(`the build of ${name} (${day}) failed`);
  dayChildren.push(spawn('node', ['serve.mjs', String(port)], { cwd: new URL('.', import.meta.url), env: { ...process.env, DIST: join(process.env.QA_VARIANT_DIR || tmpdir(), `elefante-day-${name}`, 'dist') }, stdio: 'ignore' }));
  await new Promise((resolve) => setTimeout(resolve, 1500));
  return `http://localhost:${port}`;
}
const OUT = want('page') || want('natal') || want('carnaval') ? await dayBuild('out', OUT_DAY, dayPort + 2) : '';
const IN = want('carnaval') ? await dayBuild('in', CARN_DAY, dayPort + 3) : '';
console.log(`INFO  builds of the day: outside every window ${OUT_DAY} (${OUT}), inside the window of the carnival ${CARN_DAY} (${IN})`);

let failed = 0;
const baseOk = (name, cond, extra = '') => {
  if (!cond) failed += 1;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
};
const ok = baseOk;
const browser = await launchBrowser();
const open = async (url, { width = 1280, scheme = 'light', reduce = false, js = true, site = base } = {}) => {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 900, isMobile: width < 700, hasTouch: width < 700 });
  await page.emulateMediaFeatures([
    { name: 'prefers-color-scheme', value: scheme },
    { name: 'prefers-reduced-motion', value: reduce ? 'reduce' : 'no-preference' },
  ]);
  if (!js) await page.setJavaScriptEnabled(false);
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  await page.goto(`${site}${url}`, { waitUntil: 'load' });
  return page;
};
/** What of the holiday is drawn on a page right now (checkVisibility: display none and hidden ancestors count). */
const shown = (page) =>
  page.evaluate(() => {
    const seen = (el) => !!el && el.checkVisibility();
    const brand = document.querySelector('.brand')?.getBoundingClientRect();
    const logo = document.querySelector('.brand img')?.getBoundingClientRect();
    return {
      head: seen(document.querySelector('.festa-head')),
      // The tab icon of the holiday: the SVG link points into /festas/.
      icon: (document.querySelector('link[rel=icon][type="image/svg+xml"]')?.getAttribute('href') ?? '').includes('/festas/'),
      off: seen(document.querySelector('[data-festa-off]')),
      date: seen(document.querySelector('[data-festa-on]')),
      festa: document.documentElement.getAttribute('data-festa'),
      logo: logo ? [Math.round(logo.left), Math.round(logo.top), Math.round(logo.width)].join() : '',
      brand: brand ? [Math.round(brand.left), Math.round(brand.top), Math.round(brand.width), Math.round(brand.height)].join() : '',
      overflow: document.documentElement.scrollWidth > innerWidth,
    };
  });

if (want('window')) {
  for (const lang of LANGS) {
    const t = FESTA.text[lang];
    const page = await open(`/${lang}/?hoje=${MIDDLE}`);
    const st = await shown(page);
    ok(`/${lang}/?hoje=${MIDDLE}: the header shows and the tab icon is the holiday's`, st.head && st.icon && st.festa === FESTA.id, JSON.stringify(st));
    const link = await page.$eval('.festa-head__link', (el) => ({ text: el.textContent.trim(), href: el.getAttribute('href') }));
    ok(`/${lang}/: the header leads to the page of the holiday with its text`, link.href === pageOf(lang) && link.text === t.head_link, JSON.stringify(link));
    const head = await page.$eval('.festa-head', (el) => el.textContent);
    ok(`/${lang}/: the header says the date line and the title of the holiday`, head.includes(t.head_date) && head.includes(t.head_title), head.trim().slice(0, 120));
    const out = await shown(await open(`/${lang}/?hoje=${AFTER}`));
    ok(`/${lang}/?hoje=${AFTER}: nothing shows`, !out.head && !out.icon && !out.festa, JSON.stringify(out));
    // The header stands after the hero and before the cards of "Where to start".
    const order = await page.evaluate(() => {
      const head = document.querySelector('.festa-head');
      const start = document.querySelector('.start-card');
      return !!head && !!start && !!(head.compareDocumentPosition(start) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    ok(`/${lang}/: the header is before the cards of "Where to start"`, order);
  }
  const inside = await open(`/ru/?hoje=${MIDDLE}`);
  const a = await shown(inside);
  const outside = await open(`/ru/?hoje=${AFTER}`);
  const b = await shown(outside);
  ok(`/ru/?hoje=${AFTER}: nothing shows`, !b.head && !b.icon && !b.festa, JSON.stringify(b));
  ok('the logo and the brand stay where they were (no shift)', a.logo === b.logo && a.brand === b.brand, `${a.logo} ${a.brand} | ${b.logo} ${b.brand}`);
  const before = await shown(await open(`/ru/?hoje=${BEFORE}`));
  ok(`/ru/?hoje=${BEFORE}: nothing shows, the day before the window`, !before.head && !before.icon, JSON.stringify(before));
  const first = await shown(await open(`/ru/?hoje=${FIRST}`));
  ok(`/ru/?hoje=${FIRST}: the first day of the window shows`, first.head && first.icon, JSON.stringify(first));
  const last = await shown(await open(`/ru/?hoje=${DAY}`));
  ok(`/ru/?hoje=${DAY}: the day of the holiday shows`, last.head && last.icon, JSON.stringify(last));
  const forced = await shown(await open(`/ru/?hoje=${AFTER}&festa=${FESTA.id}`));
  ok('?festa=<id> turns the holiday on whatever the date', forced.head && forced.icon && forced.festa === FESTA.id, JSON.stringify(forced));
  const other = await shown(await open(`/ru/?hoje=${AFTER}&festa=nothing`));
  ok('an unknown ?festa= is ignored', !other.head && !other.icon, JSON.stringify(other));
  // Other pages: the tab icon only, no header.
  const about = await shown(await open(`/ru/o-proekte/?hoje=${MIDDLE}`));
  ok('a page that is not the home page has the tab icon and no header', about.icon && !about.head, JSON.stringify(about));
  // The tab icon on a story page, an epoch page and the map; an explicit ?hoje= stays for the next pages of the tab, ?hoje=off and an empty one clear it.
  const iconOf = (page) => page.evaluate(() => (document.querySelector('link[rel=icon][type="image/svg+xml"]')?.getAttribute('href') ?? '').includes('/festas/'));
  const story = published.find((e) => e.slug?.ru);
  const epoch = readyEpochs.find((e) => e.slug?.ru);
  if (!story || !epoch) throw new Error('need: a published story and an open epoch with a Russian address');
  for (const [what, url] of [['a story page', `/ru/istoriya/${story.slug.ru}/`], ['an epoch page', `/ru/epoha/${epoch.slug.ru}/`], ['the map', '/ru/karta/']]) {
    ok(`${what}?hoje=${MIDDLE}: the tab icon is the holiday's`, await iconOf(await open(`${url}?hoje=${MIDDLE}`)));
    ok(`${what}?hoje=${AFTER}: the usual tab icon`, !(await iconOf(await open(`${url}?hoje=${AFTER}`))));
  }
  const tab = await open(`/ru/?hoje=${MIDDLE}`);
  await tab.goto(`${base}/ru/istoriya/${story.slug.ru}/`, { waitUntil: 'load' });
  ok('?hoje= given once is kept for the next page of the tab (no parameter in its address)', await iconOf(tab));
  await tab.goto(`${base}/ru/istoriya/${story.slug.ru}/?hoje=off`, { waitUntil: 'load' });
  ok('?hoje=off clears it', !(await iconOf(tab)));
  await tab.goto(`${base}/ru/o-proekte/`, { waitUntil: 'load' });
  ok('and the next page has the usual icon', !(await iconOf(tab)));
  await tab.goto(`${base}/ru/?hoje=${MIDDLE}`, { waitUntil: 'load' });
  await tab.goto(`${base}/ru/o-proekte/?hoje=`, { waitUntil: 'load' });
  ok('an empty ?hoje= clears it too', !(await iconOf(tab)));
  // A language with no text of the holiday (none in the data now): nothing, even with ?festa=.
  for (const lang of LANGS) {
    if (FESTA.text[lang]) continue;
    const page = await shown(await open(`/${lang}/?hoje=${MIDDLE}&festa=${FESTA.id}`));
    ok(`/${lang}/: no header and the usual tab icon while there is no text in the language`, !page.head && !page.icon, JSON.stringify(page));
  }
}

if (want('page')) {
  for (const lang of LANGS) {
    const t = FESTA.text[lang];
    const url = pageOf(lang);
    const outside = await open(`${url}?hoje=${AFTER}`, { site: OUT });
    const out = await shown(outside);
    const line = await outside.$eval('[data-festa-off]', (el) => el.textContent.trim());
    ok(`${url}?hoje=${AFTER}: the line "${t.off_window}" shows in the place of the date`, out.off && !out.date && line === t.off_window, JSON.stringify(out));
    const inn = await shown(await open(`${url}?hoje=${MIDDLE}`));
    ok(`${url}?hoje=${MIDDLE}: the date shows instead of the line, the tab icon is the holiday's`, !inn.off && inn.date && inn.icon, JSON.stringify(inn));
    const checks = await outside.evaluate(() => ({
      h1: document.querySelector('h1')?.textContent?.trim(),
      date: document.querySelector('[data-festa-on]')?.textContent?.trim(),
      hreflang: [...document.querySelectorAll('link[rel=alternate][hreflang]')].map((l) => `${l.getAttribute('hreflang')} ${new URL(l.href).pathname}`),
      robots: document.querySelector('meta[name=robots]')?.getAttribute('content') ?? '',
      activeLang: [...document.querySelectorAll('.lang-switch__list a')].map((a) => a.getAttribute('hreflang')),
      disabled: document.querySelectorAll('.lang-switch__off').length,
      links: [...document.querySelectorAll('.festa-trad a')].map((a) => a.getAttribute('href')),
      headings: [...document.querySelectorAll('.festa-page h2')].map((h) => h.textContent.trim()),
      card: [...document.querySelectorAll('.festa-story .start-card')].map((c) => ({ story: c.getAttribute('data-story'), href: c.querySelector('a')?.getAttribute('href'), hasImage: !!c.querySelector('img') })),
    }));
    ok(`${lang}: the title is the name of the holiday and the date line is its date`, checks.h1 === t.name && checks.date === t.date, JSON.stringify([checks.h1, checks.date]));
    const wantHreflang = [...LANGS.map((l) => `${l} ${pageOf(l)}`), `x-default ${pageOf('pt')}`].sort().join('|');
    ok(`${lang}: hreflang to the three pages and x-default`, checks.hreflang.slice().sort().join('|') === wantHreflang, JSON.stringify(checks.hreflang));
    ok(`${lang}: outside the window the page is noindex`, /noindex/.test(checks.robots), checks.robots);
    ok(`${lang}: the language switch leads to all three pages, none is off`, [...checks.activeLang].sort().join() === 'en,pt,ru' && checks.disabled === 0, JSON.stringify([checks.activeLang, checks.disabled]));
    ok(`${lang}: two blocks (the story of the day, traditions and facts)`, checks.headings.length === 2, JSON.stringify(checks.headings));
    const wantLinks = (t.traditions ?? []).filter((x) => x.link).length;
    ok(`${lang}: every tradition with a link has it (a story of the site)`, checks.links.length === wantLinks && checks.links.every((h) => new RegExp(`^/${lang}/[^/]+/[^/]+/$`).test(h)), JSON.stringify(checks.links));
    ok(`${lang}: the story of the day is the usual card with a picture, and its link leads to the story`, checks.card.length === 1 && checks.card[0].story === STORY.id && checks.card[0].hasImage && checks.card[0].href?.endsWith(`/${STORY.slug[lang]}/`), JSON.stringify(checks.card));
    const story = await open(checks.card[0]?.href ?? '/');
    const h1 = await story.$eval('h1', (el) => el.textContent.trim()).catch(() => '');
    ok(`${lang}: the link of the card opens the story "${STORY.title[lang]}"`, h1 === STORY.title[lang], h1);
    const phone = await open(`${url}?hoje=${AFTER}`, { width: 360 });
    ok(`${lang}, 360 px: no horizontal scroll on the page`, !(await shown(phone)).overflow);
  }
}

if (want('art')) {
  const wide = await open(`/ru/?hoje=${MIDDLE}`);
  const motion = await wide.evaluate(() => {
    const rays = document.querySelector('.festa-head .festa-rays');
    const style = rays && getComputedStyle(rays);
    return { has: !!rays, shown: style?.display !== 'none', animation: style?.animationName, title: document.querySelector('.festa-head svg title')?.textContent, role: document.querySelector('.festa-head svg')?.getAttribute('role'), label: document.querySelector('.festa-head svg')?.getAttribute('aria-labelledby') };
  });
  ok('1280 px: the rays move (one animation)', motion.has && motion.shown && motion.animation && motion.animation !== 'none', JSON.stringify(motion));
  ok('the drawing has role="img" and a title', motion.role === 'img' && motion.title === TEXT.art_title && !!motion.label, JSON.stringify(motion));
  const still = await open(`/ru/?hoje=${MIDDLE}`, { reduce: true });
  const stillMotion = await still.evaluate(() => getComputedStyle(document.querySelector('.festa-head .festa-rays')).animationName);
  ok('prefers-reduced-motion: the rays stand still', stillMotion === 'none', stillMotion);
  const phone = await open(`/ru/?hoje=${MIDDLE}`, { width: 360 });
  const small = await phone.evaluate(() => ({
    // checkVisibility() does not see display:none on a piece of an SVG, the computed style does.
    rays: getComputedStyle(document.querySelector('.festa-head .festa-rays')).display !== 'none',
    crown: document.querySelector('.festa-head svg')?.checkVisibility(),
  }));
  ok('360 px: the rays are hidden, the crown stays', small.rays === false && small.crown === true, JSON.stringify(small));
  const colours = await open(`/ru/?hoje=${MIDDLE}`, { scheme: 'dark' });
  const dark = await colours.evaluate(() => getComputedStyle(document.querySelector('.festa-head svg g[stroke]')).stroke);
  const light = await (await open(`/ru/?hoje=${MIDDLE}`)).evaluate(() => getComputedStyle(document.querySelector('.festa-head svg g[stroke]')).stroke);
  ok('the drawing changes colour with the theme (tokens)', dark !== light, `${light} | ${dark}`);
}

if (want('nojs')) {
  // Without JavaScript the markup of the build stands: shown when the build day is in the window (data-festa-built), hidden otherwise.
  const page = await open('/ru/', { js: false });
  const built = await page.evaluate(() => ({ head: document.querySelector('.festa-head')?.checkVisibility(), marked: document.querySelector('[data-festa-show]')?.hasAttribute('data-festa-built') }));
  ok('without JavaScript the header shows only if the build was made in the window', built.head === built.marked, JSON.stringify(built));
}

if (want('natal')) {
  if (!BOLO) throw new Error('need: an enabled holiday with art: bolo in src/data/festas.yaml');
  const pageB = (l) => `/${l}/festa/${BOLO.slug}/`;
  const want3 = [...LANGS.map((l) => `${l} ${pageB(l)}`), `x-default ${pageB('pt')}`].sort().join('|');
  for (const lang of LANGS) {
    const t = BOLO.text[lang];
    if (!t) throw new Error(`need: text.${lang} of the holiday "${BOLO.id}" in src/data/festas.yaml`);
    const inWin = addDays(BOLO_DAY, -1);
    const out = addDays(BOLO_DAY, 1);
    const home = await open(`/${lang}/?hoje=${inWin}`);
    const h = await home.evaluate((id) => {
      const box = document.querySelector(`[data-festa-show="${id}"]`);
      return { shown: !!box?.querySelector('.festa-head')?.checkVisibility(), text: box?.textContent ?? '', href: box?.querySelector('.festa-head__link')?.getAttribute('href'), icon: (document.querySelector('link[rel=icon][type="image/svg+xml"]')?.getAttribute('href') ?? '').includes('/festas/'), og: document.querySelector('meta[property="og:image"]')?.getAttribute('content') ?? '', after: !!document.querySelector('.festa-head')?.compareDocumentPosition(document.querySelector('.start-card') ?? document.body) };
    }, BOLO.id);
    ok(`/${lang}/ in the window: the block of the holiday with its date line, title and link, and the icon of the tab`, h.shown && h.text.includes(t.head_date) && h.text.includes(t.head_title) && h.href === pageB(lang) && h.icon, JSON.stringify({ ...h, text: h.text.length }));
    const outHome = await shown(await open(`/${lang}/?hoje=${out}`));
    ok(`/${lang}/ after the window: no block, the usual icon`, !outHome.festa && !outHome.icon, JSON.stringify(outHome));
    const page = await open(`${pageB(lang)}?hoje=${out}`, { site: OUT });
    const c = await page.evaluate(() => ({
      h1: document.querySelector('h1')?.textContent?.trim(),
      hreflang: [...document.querySelectorAll('link[rel=alternate][hreflang]')].map((l) => `${l.getAttribute('hreflang')} ${new URL(l.href).pathname}`),
      robots: document.querySelector('meta[name=robots]')?.getAttribute('content') ?? '',
      og: document.querySelector('meta[property="og:title"]')?.getAttribute('content') ?? '',
      ogd: document.querySelector('meta[property="og:description"]')?.getAttribute('content') ?? '',
      ogi: document.querySelector('meta[property="og:image"]')?.getAttribute('content') ?? '',
      lang: [...document.querySelectorAll('.lang-switch__list a')].map((a) => a.getAttribute('hreflang')),
      off: document.querySelectorAll('.lang-switch__off').length,
      headings: [...document.querySelectorAll('.festa-page h2')].map((x) => x.textContent.trim()),
      trad: document.querySelectorAll('.festa-trad li').length,
    }));
    ok(`${lang}: the page says the name of the holiday`, c.h1 === t.name, c.h1);
    ok(`${lang}: hreflang to the three pages and x-default`, c.hreflang.slice().sort().join('|') === want3, JSON.stringify(c.hreflang));
    ok(`${lang}: noindex outside the window`, /noindex/.test(c.robots), c.robots);
    ok(`${lang}: the language switch leads to all three pages, none is off`, [...c.lang].sort().join() === 'en,pt,ru' && c.off === 0, JSON.stringify([c.lang, c.off]));
    ok(`${lang}: the preview (title, description, picture) is the holiday's`, c.og === `${t.name} · ${t.date}` && c.ogd === t.og_description && c.ogi.includes('og-festas/'), JSON.stringify([c.og, c.ogd, c.ogi]));
    ok(`${lang}: two blocks and all the traditions`, c.headings.length === 2 && c.trad === t.traditions.length, JSON.stringify([c.headings, c.trad]));
  }
  // Sitemap: the build of the day outside every window has none of the pages of the holiday in it (the build in the window is checked by check-sitemap).
  const map = await (await fetch(`${OUT}/sitemap.xml`)).text();
  const inMap = LANGS.filter((l) => map.includes(pageB(l)));
  ok('the sitemap has all three pages of the holiday or none of them', inMap.length === 0 || inMap.length === 3, inMap.join());
}

for (const BOLO_LANG of want('bolo') ? BOLO_LANGS : []) {
  const ok = (name, cond, extra) => baseOk(`[${BOLO_LANG}] ${name}`, cond, extra);
  if (!BOLO) throw new Error('need: an enabled holiday with art: bolo and the texts of the game (text.<lang>.bolo) in src/data/festas.yaml');
  const T = BOLO.text[BOLO_LANG];
  const G = T.bolo;
  const NEAR = addDays(BOLO_DAY, -1); // inside the window
  const OUT = addDays(BOLO_DAY, 1); // just after it
  const url = `/${BOLO_LANG}/festa/${BOLO.slug}/?hoje=${NEAR}`;
  const N = 8;
  const KEY = 'festa-natal-bolo';
  const story = published.find((e) => e.id === BOLO.story);
  // A page whose GoatCounter is a recorder: the events the cake sends.
  const openCake = async (opts = {}, path = url) => {
    const page = await browser.newPage();
    await page.setViewport({ width: opts.width ?? 1280, height: 900 });
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: opts.reduce ? 'reduce' : 'no-preference' }]);
    page.errors = [];
    page.on('pageerror', (e) => page.errors.push(e.message));
    // A build for a real address (as in CI) has the counter: its config script sets window.goatcounter and count.js sets .count. Both are taken over here, so the recorder stays whoever comes second.
    await page.setRequestInterception(true);
    page.on('request', (r) => (r.url().includes('goatcounter.com/count') ? r.abort() : r.continue()));
    await page.evaluateOnNewDocument(() => {
      window.__events = [];
      const recorder = { allow_local: true };
      Object.defineProperty(recorder, 'count', { configurable: true, get: () => (v) => { if (v?.event) window.__events.push(v.path); }, set: () => {} });
      Object.defineProperty(window, 'goatcounter', { configurable: true, get: () => recorder, set: () => {} });
    });
    await page.goto(`${base}${path}`, { waitUntil: 'load' });
    return page;
  };
  const fresh = async (opts, path) => {
    const page = await openCake(opts, path);
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'load' });
    return page;
  };
  const stored = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), KEY);
  const state = (page) =>
    page.evaluate(() => ({
      slices: document.querySelectorAll('.bolo svg .slice').length,
      hint: document.querySelector('.bolo__hint').checkVisibility(),
      bubble: document.querySelector('.bolo__bubble').checkVisibility(),
      done: document.querySelector('.bolo__done-text').textContent.trim(),
      again: document.querySelector('.bolo__again').checkVisibility(),
      disabled: document.querySelector('.bolo__cake').getAttribute('aria-disabled'),
    }));
  const which = (text) => (text.includes(G.fava.head) ? 'fava' : text.includes(G.brinde.head) ? 'brinde' : text.includes(G.fruit.head) ? 'fruit' : '?');

  // The page of the holiday after the window and the home page inside it and after it.
  const lead = await openCake({}, `/${BOLO_LANG}/festa/${BOLO.slug}/?hoje=${OUT}`);
  const href = await lead.$eval('.festa-story a', (el) => el.getAttribute('href')).catch(() => '');
  ok('the card of the story of the day leads to the story', !!story && href.includes(story.slug[BOLO_LANG] ?? story.slug.en), href);
  const home = await open(`/${BOLO_LANG}/?hoje=${NEAR}`);
  const homeNow = await shown(home);
  ok('home page in the window: the header of the holiday and its tab icon', homeNow.festa === BOLO.id && homeNow.icon, JSON.stringify(homeNow));
  const homeOut = await shown(await open(`/${BOLO_LANG}/?hoje=${OUT}`));
  ok('home page after the window: no header and the usual icon', !homeOut.festa && !homeOut.icon, JSON.stringify(homeOut));
  const homeCake = await home.evaluate((id) => {
    const art = document.querySelector(`[data-festa-show="${id}"] .festa-art`);
    return { slices: art?.querySelectorAll('.slice').length, role: art?.getAttribute('role'), head: art?.closest('.festa-head')?.checkVisibility() };
  }, BOLO.id);
  ok('the cake on the home page is whole and has role="img"', homeCake.slices === N && homeCake.role === 'img' && homeCake.head === true, JSON.stringify(homeCake));

  // Without JavaScript: a whole cake, the button is off.
  const plain = await open(url, { js: false });
  const noJs = await plain.evaluate(() => ({ slices: document.querySelectorAll('.bolo svg .slice').length, off: document.querySelector('.bolo__cake').disabled, hint: document.querySelector('.bolo__hint').checkVisibility() }));
  ok('no JavaScript: the whole cake, the button is off, no hint', noJs.slices === N && noJs.off && !noJs.hint, JSON.stringify(noJs));

  // Eight presses.
  const page = await fresh();
  const before = await state(page);
  ok('a fresh cake: whole, the hint stands, no bubble, no line, no button "again"', before.slices === N && before.hint && !before.bubble && before.done === '' && !before.again, JSON.stringify(before));
  const seen = [];
  for (let i = 0; i < N; i++) {
    await page.click('.bolo__cake');
    seen.push(await page.$eval('.bolo__bubble', (el) => el.textContent.trim()));
    if (i === 0) {
      const after = await state(page);
      ok('after the first slice the hint is gone and the bubble shows', !after.hint && after.bubble, JSON.stringify(after));
    }
  }
  const kinds = seen.map(which);
  const keep = await stored(page);
  ok('eight slices: the bean once, the gift once, the rest candied fruit', kinds.filter((k) => k === 'fava').length === 1 && kinds.filter((k) => k === 'brinde').length === 1 && kinds.filter((k) => k === 'fruit').length === N - 2, kinds.join());
  ok('the bean and the gift lie in two different slices (those the state names)', keep && keep.fava !== keep.brinde && kinds[keep.fava] === 'fava' && kinds[keep.brinde] === 'brinde', JSON.stringify(keep));
  ok('no counter of slices anywhere', !(await page.evaluate(() => /\d\s*(из|of|de)\s*\d/.test(document.querySelector('.bolo').textContent))));
  await new Promise((r) => setTimeout(r, 3200));
  const last = await state(page);
  ok('after the eighth slice: the line and the button "again", the cake is aria-disabled, no bubble, no slices', last.done === G.done && last.again && (await page.$eval('.bolo__again', (el) => el.textContent.trim())) === G.again && last.disabled === 'true' && !last.bubble && last.slices === 0, JSON.stringify(last));
  await page.click('.bolo__cake');
  ok('a press after the last slice changes nothing', (await stored(page)).cut === N);
  const events = await page.evaluate(() => window.__events);
  ok('GoatCounter: festa-natal-bolo-cut once (the first slice) and festa-natal-bolo-eaten once, nothing else', JSON.stringify(events) === JSON.stringify(['festa-natal-bolo-cut', 'festa-natal-bolo-eaten']), JSON.stringify(events));
  await page.reload({ waitUntil: 'load' });
  const again = await state(page);
  ok('after a reload the cake is still eaten (line, aria-disabled, no hint)', again.done === G.done && again.disabled === 'true' && again.slices === 0 && !again.hint, JSON.stringify(again));
  // "Bake another one": a new whole cake, new random slices, cut 0 in the storage, the hint does not come back.
  ok('after a reload the button "again" is still there', again.again, JSON.stringify(again));
  const oldCake = await stored(page);
  await page.click('.bolo__again');
  const next = await state(page);
  const newCake = await stored(page);
  ok('"again": a whole cake, no line, no button, no hint, not aria-disabled', next.slices === N && next.done === '' && !next.again && !next.hint && next.disabled === null && !next.bubble, JSON.stringify(next));
  ok('"again": the state is cut 0 of this year with the bean and the gift in two different slices', newCake && newCake.cut === 0 && newCake.year === oldCake.year && newCake.fava !== newCake.brinde && newCake.fava >= 0 && newCake.fava < N && newCake.brinde >= 0 && newCake.brinde < N, JSON.stringify([oldCake, newCake]));
  ok('"again": the event festa-natal-bolo-again is sent, nothing else', JSON.stringify(await page.evaluate(() => window.__events)) === JSON.stringify(['festa-natal-bolo-again']), JSON.stringify(await page.evaluate(() => window.__events)));
  await page.click('.bolo__cake');
  ok('the new cake can be cut again (and the hint stays away)', (await stored(page)).cut === 1 && !(await state(page)).hint);
  ok('the page has no script errors', page.errors.length === 0, page.errors.join('; '));

  // A cake started before: reload after two slices.
  const part = await fresh();
  await part.click('.bolo__cake');
  await part.click('.bolo__cake');
  await part.reload({ waitUntil: 'load' });
  const partly = await state(part);
  ok('reload after two slices: six slices, no hint, no bubble, no counter line', partly.slices === N - 2 && !partly.hint && !partly.bubble && partly.done === '', JSON.stringify(partly));

  // The keyboard: Enter and Space cut.
  const keys = await fresh();
  await keys.focus('.bolo__cake');
  await keys.keyboard.press('Enter');
  const one = (await stored(keys))?.cut;
  await keys.keyboard.press('Space');
  const two = (await stored(keys))?.cut;
  ok('Enter and Space on the focused cake cut a slice each', one === 1 && two === 2, `${one},${two}`);

  // Reduced motion: the slice stands cut at once, the bubble has no animation.
  const still = await fresh({ reduce: true });
  await still.click('.bolo__cake');
  const calm = await still.evaluate(() => ({
    moved: document.querySelector('.bolo .slice.cut')?.style.transform ?? '',
    transition: getComputedStyle(document.querySelector('.bolo .slice.cut')).transitionDuration,
    animation: getComputedStyle(document.querySelector('.bolo__bubble')).animationName,
  }));
  ok('prefers-reduced-motion: the slice is out at once, no transition, no bubble animation', calm.moved !== '' && !calm.moved.includes('translate(0px,0px)') && parseFloat(calm.transition) < 0.001 && calm.animation === 'none', JSON.stringify(calm));

  // The year: a cake of an earlier year is a new whole cake.
  const old = await fresh();
  await old.evaluate((k, y) => localStorage.setItem(k, JSON.stringify({ year: y, cut: 8, fava: 0, brinde: 1 })), KEY, Number(NEAR.slice(0, 4)) - 1);
  await old.reload({ waitUntil: 'load' });
  const renewed = await state(old);
  ok('the state of an earlier year: a whole new cake again', renewed.slices === N && renewed.hint && renewed.done === '', JSON.stringify(renewed));
  await old.click('.bolo__cake');
  ok('the new cake is stored under the year of the Lisbon day (?hoje=)', (await stored(old))?.year === Number(NEAR.slice(0, 4)), JSON.stringify(await stored(old)));

  // A phone: the bubble stands under the cake (it does not cover it) and stays inside the page; on a wide screen it is over the slice.
  const phone = await fresh({ width: 360 });
  await phone.click('.bolo__cake');
  const box = await phone.evaluate(() => {
    const b = document.querySelector('.bolo__bubble').getBoundingClientRect();
    const c = document.querySelector('.bolo__cake').getBoundingClientRect();
    return { left: Math.round(b.left), right: Math.round(b.right), top: Math.round(b.top), cakeBottom: Math.round(c.bottom), width: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth };
  });
  ok('360 px: the bubble is under the cake, inside the screen', box.left >= 0 && box.right <= box.width && box.top >= box.cakeBottom && !box.overflow, JSON.stringify(box));
  const wide = await fresh({ width: 1280 });
  await wide.click('.bolo__cake');
  const over = await wide.evaluate(() => {
    const b = document.querySelector('.bolo__bubble').getBoundingClientRect();
    const c = document.querySelector('.bolo__cake').getBoundingClientRect();
    const top = document.querySelector('.festa-page h1').getBoundingClientRect();
    return { bubbleBottom: Math.round(b.bottom), cakeBottom: Math.round(c.bottom), cakeTop: Math.round(c.top), h1Bottom: Math.round(top.bottom), cakeWidth: Math.round(c.width) };
  });
  ok('1280 px: the cake stands under the heading, 640 px at most, and the bubble is over the cake', over.cakeTop >= over.h1Bottom && over.cakeWidth <= 640 && over.bubbleBottom < over.cakeBottom, JSON.stringify(over));
}

// The holiday that moves with Easter and has the queen with a fan (art: queen), in the languages that have its text: the days come from the data (festaDay), the
// words from the text with `{date}` filled by fillDate.
const CARN = festas.find((f) => f.enabled && f.art === 'queen' && 'easter' in f.date);
if (want('carnaval')) {
  if (!CARN) throw new Error('need: an enabled holiday with art "queen" and a date from Easter in src/data/festas.yaml. None found.');
  const CARN_LANGS = LANGS.filter((l) => CARN.text[l]);
  const CARN_STORY = published.find((e) => e.id === CARN.story);
  if (!CARN_STORY) throw new Error(`need: the story "${CARN.story}" of the holiday "${CARN.id}" among the published stories`);
  const day = festaDay(CARN.date, year);
  const { from } = windowOf(day);
  const say = (lang, key) => fillDate(CARN.text[lang], day, lang)[key];
  ok('the carnival has a text in all three languages (pt, en, ru)', CARN_LANGS.join() === LANGS.join(), CARN_LANGS.join());
  const carnPage = (l) => `/${l}/festa/${CARN.slug}/`;
  const carnHreflang = [...LANGS.map((l) => `${l} ${carnPage(l)}`), `x-default ${carnPage('pt')}`].sort().join('|');
  for (const lang of CARN_LANGS) {
    const inWindow = await open(`${carnPage(lang)}?hoje=${day}`);
    const meta = await inWindow.evaluate(() => ({
      hreflang: [...document.querySelectorAll('link[rel=alternate][hreflang]')].map((l) => `${l.getAttribute('hreflang')} ${new URL(l.href).pathname}`),
      switch: [...document.querySelectorAll('.lang-switch__list a')].map((a) => a.getAttribute('hreflang')),
      off: document.querySelectorAll('.lang-switch__off').length,
      robots: document.querySelector('meta[name=robots]')?.getAttribute('content') ?? '',
      og: document.querySelector('meta[property="og:title"]')?.getAttribute('content'),
      ogd: document.querySelector('meta[property="og:description"]')?.getAttribute('content'),
      ogi: document.querySelector('meta[property="og:image"]')?.getAttribute('content') ?? '',
    }));
    ok(`${carnPage(lang)}: hreflang to the three pages and x-default, the language switch leads to all three`, meta.hreflang.slice().sort().join('|') === carnHreflang && [...meta.switch].sort().join() === 'en,pt,ru' && meta.off === 0, JSON.stringify(meta));
    ok(`${carnPage(lang)}: the preview (title, description, picture) is the holiday's`, meta.og === `${say(lang, 'name')} · ${say(lang, 'date')}` && meta.ogd === CARN.text[lang].og_description && meta.ogi.includes('og-festas/'), JSON.stringify([meta.og, meta.ogd, meta.ogi]));
    const home = await open(`/${lang}/`, { site: IN });
    const og = await home.evaluate(() => document.querySelector('meta[property="og:image"]')?.getAttribute('content') ?? '');
    ok(`/${lang}/ built in the window: the block comes after the hero and the picture to share is the holiday's`, og.includes('og-festas/') && (await home.evaluate((id) => { const b = document.querySelector(`[data-festa-show="${id}"]`); const h = document.querySelector('.hero, main h1'); return !!b && !!h && !!(h.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING); }, CARN.id)), og);
  }
  /** The block of the carnival on the home page and the icon of the tab. */
  const homeState = (page) =>
    page.evaluate((id) => {
      const block = document.querySelector(`[data-festa-show="${id}"] .festa-head`);
      return {
        shown: !!block?.checkVisibility(),
        text: block?.textContent ?? '',
        href: block?.querySelector('a')?.getAttribute('href') ?? '',
        icon: (document.querySelector('link[rel=icon][type="image/svg+xml"]')?.getAttribute('href') ?? '').includes('/festas/favicon-'),
        festa: document.documentElement.getAttribute('data-festa'),
      };
    }, CARN.id);
  for (const lang of CARN_LANGS) {
    for (const [name, date, inside] of [['first day of the window', from, true], ['the day itself', day, true], ['the day before the window', addDays(from, -1), false], ['the day after', addDays(day, 1), false]]) {
      const st = await homeState(await open(`/${lang}/?hoje=${date}`));
      const header = st.text.includes(say(lang, 'head_date')) && st.text.includes(say(lang, 'head_title')) && st.text.includes(say(lang, 'head_line'));
      ok(`/${lang}/?hoje=${date} (${name}): ${inside ? 'the block of the holiday and the tab icon' : 'the usual home page'}`, inside ? st.shown && header && st.icon && st.festa === CARN.id : !st.shown && !st.icon && st.festa !== CARN.id, JSON.stringify(st));
    }
    const url = `/${lang}/festa/${CARN.slug}/`;
    const off = await open(`${url}?hoje=${addDays(day, 1)}`, { site: OUT });
    const out = await off.evaluate(() => ({
      line: document.querySelector('[data-festa-off]')?.checkVisibility() ? document.querySelector('[data-festa-off]').textContent.trim() : '',
      date: !!document.querySelector('[data-festa-on]')?.checkVisibility(),
      robots: document.querySelector('meta[name=robots]')?.getAttribute('content') ?? '',
    }));
    ok(`${url}: outside the window the line "${CARN.text[lang].off_window}" and noindex`, out.line === CARN.text[lang].off_window && !out.date && /noindex/.test(out.robots), JSON.stringify(out));
    const on = await open(`${url}?hoje=${day}`);
    const inn = await on.evaluate(() => ({
      h1: document.querySelector('h1')?.textContent.trim(),
      date: document.querySelector('[data-festa-on]')?.textContent.trim(),
      off: !!document.querySelector('[data-festa-off]')?.checkVisibility(),
      og: document.querySelector('meta[property="og:title"]')?.getAttribute('content'),
      href: document.querySelector('.festa-story a')?.getAttribute('href') ?? '',
      traditions: document.querySelectorAll('.festa-trad li').length,
    }));
    ok(`${url}: in the window the date, the name, the traditions and the story card`, inn.h1 === CARN.text[lang].name && inn.date === say(lang, 'date') && !inn.off && inn.traditions === CARN.text[lang].traditions.length && inn.href.length > 0, JSON.stringify(inn));
    const story = await open(inn.href || '/');
    ok(`${url}: the card leads to the story "${CARN_STORY.title[lang]}"`, (await story.$eval('h1', (el) => el.textContent.trim()).catch(() => '')) === CARN_STORY.title[lang]);
  }
  // The drawing: the same on the home page and on the page, a phone too; the fan sways, with "reduce motion" it stands still; role and title.
  for (const [where, path] of [['home', `/ru/?hoje=${day}`], ['page', `/ru/festa/${CARN.slug}/?hoje=${day}`]]) {
    for (const width of [1280, 360]) {
      const page = await open(path, { width });
      const art = await page.evaluate((id) => {
        const svg = document.querySelector(`${document.querySelector('.festa-head') ? `[data-festa-show="${id}"] ` : ''}svg.festa-art`);
        const fan = svg?.querySelector('.fan');
        return { shown: !!svg?.checkVisibility(), role: svg?.getAttribute('role'), title: svg?.querySelector('title')?.textContent, moves: fan ? getComputedStyle(fan).animationName : '', parts: svg ? svg.querySelectorAll('.fan, .crown').length : 0 };
      }, CARN.id);
      ok(`${where}, ${width} px: the queen is drawn (role img, title, the fan sways, the crown stays)`, art.shown && art.role === 'img' && art.title === CARN.text.ru.art_title && art.moves !== 'none' && art.moves !== '' && art.parts === 2, JSON.stringify(art));
    }
    const still = await open(path, { reduce: true });
    ok(`${where}: prefers-reduced-motion, the fan stands still`, (await still.evaluate(() => getComputedStyle(document.querySelector('.fan')).animationName)) === 'none');
  }
}

await browser.close();
console.log(failed === 0 ? '\nAll holiday checks passed.' : `\n${failed} holiday check(s) FAILED.`);
process.exit(failed === 0 ? 0 : 1);

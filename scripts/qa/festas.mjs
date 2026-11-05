// Browser checks of the holidays (src/data/festas.yaml, src/lib/festas.mjs, docs/spec.md "Праздники"), run against dist/ served by serve.mjs:
//   node festas.mjs [window page art nojs]
// The day is set with ?hoje=YYYY-MM-DD and a holiday with ?festa=<id>. The holiday, its days and its address come from the data: the first enabled holiday that has a
// text in every language of the site (pt, en, ru) and a drawing; the suite names what is missing when there is none.
import { launchBrowser } from './browser.mjs';
import { festas, published, readyEpochs } from './data.mjs';
import { addDays, festaDay, windowOf } from '../../src/lib/festas.mjs';

const base = process.env.BASE_URL || 'http://localhost:4400';
const ONLY = process.argv.slice(2);
const want = (name) => ONLY.length === 0 || ONLY.includes(name);

const LANGS = ['pt', 'en', 'ru'];
const FESTA = festas.find((f) => f.enabled && f.art && LANGS.every((l) => f.text?.[l]));
if (!FESTA) throw new Error('need: an enabled holiday with a drawing and a text in pt, en and ru in src/data/festas.yaml. None found.');
const TEXT = FESTA.text.ru;
const STORY = published.find((e) => e.id === FESTA.story);
if (!STORY) throw new Error(`need: the story "${FESTA.story}" of the holiday "${FESTA.id}" among the published stories`);
const year = new Date().getFullYear() + 1;
const DAY = festaDay(FESTA.date, year);
const { from: FIRST } = windowOf(DAY);
const BEFORE = addDays(FIRST, -1);
const AFTER = addDays(DAY, 1);
const MIDDLE = addDays(DAY, -1);
const pageOf = (lang) => `/${lang}/festa/${FESTA.slug}/`;

let failed = 0;
const ok = (name, cond, extra = '') => {
  if (!cond) failed += 1;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
};
const browser = await launchBrowser();
const open = async (url, { width = 1280, scheme = 'light', reduce = false, js = true } = {}) => {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 900, isMobile: width < 700, hasTouch: width < 700 });
  await page.emulateMediaFeatures([
    { name: 'prefers-color-scheme', value: scheme },
    { name: 'prefers-reduced-motion', value: reduce ? 'reduce' : 'no-preference' },
  ]);
  if (!js) await page.setJavaScriptEnabled(false);
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  await page.goto(`${base}${url}`, { waitUntil: 'load' });
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
    const outside = await open(`${url}?hoje=${AFTER}`);
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

await browser.close();
console.log(failed === 0 ? '\nAll holiday checks passed.' : `\n${failed} holiday check(s) FAILED.`);
process.exit(failed === 0 ? 0 : 1);

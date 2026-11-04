// Browser checks of the holidays (src/data/festas.yaml, src/lib/festas.mjs, docs/spec.md "Праздники"), run against dist/ served by serve.mjs:
//   node festas.mjs [window page art nojs]
// The day is set with ?hoje=YYYY-MM-DD and a holiday with ?festa=<id>. The holiday, its days and its address come from the data: the first enabled holiday that has a
// text in Russian (the only language with texts for now); the suite names what is missing when there is none.
import { launchBrowser } from './browser.mjs';
import { festas } from './data.mjs';
import { addDays, festaDay, windowOf } from '../../src/lib/festas.mjs';

const base = process.env.BASE_URL || 'http://localhost:4400';
const ONLY = process.argv.slice(2);
const want = (name) => ONLY.length === 0 || ONLY.includes(name);

const FESTA = festas.find((f) => f.enabled && f.text?.ru && f.art);
if (!FESTA) throw new Error('The suite needs an enabled holiday with a Russian text and a drawing in src/data/festas.yaml. None found.');
const TEXT = FESTA.text.ru;
const year = new Date().getFullYear() + 1;
const DAY = festaDay(FESTA.date, year);
const { from: FIRST } = windowOf(DAY);
const BEFORE = addDays(FIRST, -1);
const AFTER = addDays(DAY, 1);
const MIDDLE = addDays(DAY, -1);
const PAGE = `/ru/festa/${FESTA.slug}/`;

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
      badge: seen(document.querySelector('.festa-badge')),
      off: seen(document.querySelector('[data-festa-off]')),
      date: seen(document.querySelector('[data-festa-on]')),
      festa: document.documentElement.getAttribute('data-festa'),
      logo: logo ? [Math.round(logo.left), Math.round(logo.top), Math.round(logo.width)].join() : '',
      brand: brand ? [Math.round(brand.left), Math.round(brand.top), Math.round(brand.width), Math.round(brand.height)].join() : '',
      overflow: document.documentElement.scrollWidth > innerWidth,
    };
  });

if (want('window')) {
  const inside = await open(`/ru/?hoje=${MIDDLE}`);
  const a = await shown(inside);
  ok(`/ru/?hoje=${MIDDLE}: the header and the badge show`, a.head && a.badge && a.festa === FESTA.id, JSON.stringify(a));
  const link = await inside.$eval('.festa-head__link', (el) => ({ text: el.textContent.trim(), href: el.getAttribute('href') }));
  ok('the header leads to the page of the holiday with its text', link.href === PAGE && link.text === TEXT.head_link, JSON.stringify(link));
  const outside = await open(`/ru/?hoje=${AFTER}`);
  const b = await shown(outside);
  ok(`/ru/?hoje=${AFTER}: nothing shows`, !b.head && !b.badge && !b.festa, JSON.stringify(b));
  ok('the logo and the brand stay where they were (no shift)', a.logo === b.logo && a.brand === b.brand, `${a.logo} ${a.brand} | ${b.logo} ${b.brand}`);
  const before = await shown(await open(`/ru/?hoje=${BEFORE}`));
  ok(`/ru/?hoje=${BEFORE}: nothing shows, the day before the window`, !before.head && !before.badge, JSON.stringify(before));
  const first = await shown(await open(`/ru/?hoje=${FIRST}`));
  ok(`/ru/?hoje=${FIRST}: the first day of the window shows`, first.head && first.badge, JSON.stringify(first));
  const last = await shown(await open(`/ru/?hoje=${DAY}`));
  ok(`/ru/?hoje=${DAY}: the day of the holiday shows`, last.head && last.badge, JSON.stringify(last));
  const forced = await shown(await open(`/ru/?hoje=${AFTER}&festa=${FESTA.id}`));
  ok('?festa=<id> turns the holiday on whatever the date', forced.head && forced.badge && forced.festa === FESTA.id, JSON.stringify(forced));
  const other = await shown(await open(`/ru/?hoje=${AFTER}&festa=nothing`));
  ok('an unknown ?festa= is ignored', !other.head && !other.badge, JSON.stringify(other));
  // Other pages: the badge only, no header.
  const about = await shown(await open(`/ru/o-proekte/?hoje=${MIDDLE}`));
  ok('a page that is not the home page has the badge and no header', about.badge && !about.head, JSON.stringify(about));
  // Languages without a text: nothing, even with ?festa=.
  for (const lang of ['pt', 'en']) {
    if (FESTA.text[lang]) continue;
    const page = await shown(await open(`/${lang}/?hoje=${MIDDLE}&festa=${FESTA.id}`));
    ok(`/${lang}/: no header and no badge while there is no text in the language`, !page.head && !page.badge, JSON.stringify(page));
  }
}

if (want('page')) {
  const outside = await open(`${PAGE}?hoje=${AFTER}`);
  const out = await shown(outside);
  const line = await outside.$eval('[data-festa-off]', (el) => el.textContent.trim());
  ok(`${PAGE}?hoje=${AFTER}: the line "${TEXT.off_window}" shows in the place of the date`, out.off && !out.date && line === TEXT.off_window, JSON.stringify(out));
  const inside = await open(`${PAGE}?hoje=${MIDDLE}`);
  const inn = await shown(inside);
  ok(`${PAGE}?hoje=${MIDDLE}: the date shows instead of the line, the badge shows`, !inn.off && inn.date && inn.badge, JSON.stringify(inn));
  const checks = await outside.evaluate(() => ({
    h1: document.querySelector('h1')?.textContent?.trim(),
    hreflang: document.querySelectorAll('link[rel=alternate][hreflang]').length,
    activeLang: [...document.querySelectorAll('.lang-switch__list a')].map((a) => a.getAttribute('hreflang')),
    disabled: [...document.querySelectorAll('.lang-switch__off')].map((a) => a.getAttribute('lang')),
    links: [...document.querySelectorAll('.festa-trad a')].map((a) => a.getAttribute('href')),
    sources: [...document.querySelectorAll('.festa-card__sources a')].map((a) => a.getAttribute('href')),
    overflow: document.documentElement.scrollWidth > innerWidth,
  }));
  ok('the title is the name of the holiday', checks.h1 === TEXT.name, checks.h1);
  ok('no hreflang on the page', checks.hreflang === 0, String(checks.hreflang));
  ok('the language switch leads to the Russian page only, the other languages are not links', checks.activeLang.join() === 'ru' && checks.disabled.join() === 'pt,en', JSON.stringify(checks));
  const wantLinks = (TEXT.traditions ?? []).filter((t) => t.link).length;
  ok('every tradition with a link has it (a story of the site)', checks.links.length === wantLinks && checks.links.every((h) => /^\/ru\/istoriya\/[^/]+\/$/.test(h)), JSON.stringify(checks.links));
  ok('the sources are links', checks.sources.length === TEXT.card.sources.length && checks.sources.every((h) => /^https:\/\//.test(h)));
  const phone = await open(`${PAGE}?hoje=${AFTER}`, { width: 360 });
  ok('360 px: no horizontal scroll on the page', !(await shown(phone)).overflow);
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

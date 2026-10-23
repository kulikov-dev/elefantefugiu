// Browser checks for the Russian stage: the language menu on 320 and 360 px, the root choice, the banner on a card that is
// not translated, noindex and hreflang, Cyrillic fonts only on the Russian pages, plural forms.
// Run against dist/ served by serve.mjs (base path "/"):   node ru.mjs [menu root banner fonts plural]
import { fsPath, launchBrowser } from './browser.mjs';

const base = process.env.BASE_URL || 'http://localhost:4400';
const ONLY = process.argv.slice(2);
const want = (name) => ONLY.length === 0 || ONLY.includes(name);
const HEADER_MAX = 145; // the height of the header on a phone before the Russian stage (stage 7b-1)

let failed = 0;
const ok = (name, cond, extra = '') => {
  if (!cond) failed += 1;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
};
const browser = await launchBrowser();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** `language`: what navigator.language says; `saved`: localStorage "lang" before the page starts. */
const newPage = async ({ width = 360, language = null, saved = null } = {}) => {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 900, isMobile: width < 700, hasTouch: width < 700 });
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.fontRequests = [];
  page.on('request', (r) => {
    if (/\.woff2?(\?|$)/.test(r.url())) page.fontRequests.push(r.url());
  });
  await page.evaluateOnNewDocument(
    (lang, stored) => {
      if (lang !== null) Object.defineProperty(navigator, 'language', { get: () => lang });
      try {
        if (stored !== null && !sessionStorage.getItem('__seeded')) {
          localStorage.setItem('lang', stored);
          sessionStorage.setItem('__seeded', '1');
        }
      } catch (e) {}
    },
    language,
    saved,
  );
  return page;
};

// ---------- 1. The language menu on narrow phones ----------
if (want('menu')) {
  for (const width of [320, 360]) {
    for (const lang of ['pt', 'en', 'ru']) {
      const page = await newPage({ width });
      await page.goto(`${base}/${lang}/?fio=mar&vista=grelha`, { waitUntil: 'load' });
      const closed = await page.evaluate(() => {
        const box = (sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; };
        const s = document.querySelector('.lang-switch__current');
        return { header: Math.round(document.querySelector('.site-header').getBoundingClientRect().height), btn: box('.lang-switch__current'), brand: box('.brand'), vw: innerWidth, sw: document.documentElement.scrollWidth, label: s.getAttribute('aria-label'), text: s.textContent.trim(), h: Math.round(s.getBoundingClientRect().height), w: Math.round(s.getBoundingClientRect().width), open: document.querySelector('[data-lang-switch]').open };
      });
      ok(`menu (${lang}, ${width} px): the header is at most ${HEADER_MAX} px (${closed.header} px), no sideways scroll`, closed.header <= HEADER_MAX && closed.sw <= closed.vw, JSON.stringify({ header: closed.header, sw: closed.sw, vw: closed.vw }));
      ok(`menu (${lang}, ${width} px): the button shows the current language, is 44 px tall and inside the screen, and does not overlap the name`, closed.text === lang.toUpperCase() && closed.h >= 44 && closed.btn.r <= closed.vw && closed.btn.l >= closed.brand.r - 1, JSON.stringify(closed));
      ok(`menu (${lang}, ${width} px): the button is named "Language: ..." for screen readers and the menu starts closed`, /^(Idioma|Language|Язык): /.test(closed.label) && closed.open === false, closed.label);
      await page.click('.lang-switch__current');
      const opened = await page.evaluate(() => {
        const links = [...document.querySelectorAll('.lang-switch a')].map((a) => { const r = a.getBoundingClientRect(); return { text: a.textContent.trim(), lang: a.getAttribute('hreflang'), href: a.getAttribute('href'), current: a.getAttribute('aria-current'), h: Math.round(r.height), l: r.left, r: r.right, vis: r.width > 0 }; });
        return { links, vw: innerWidth, sw: document.documentElement.scrollWidth };
      });
      ok(`menu (${lang}, ${width} px): the list names Português, English, Русский, each 44 px tall and inside the screen`, opened.links.map((l) => l.text).join('|') === 'Português|English|Русский' && opened.links.every((l) => l.vis && l.h >= 44 && l.l >= 0 && l.r <= opened.vw) && opened.sw <= opened.vw, JSON.stringify(opened.links.map((l) => [l.text, l.l, l.r])));
      ok(`menu (${lang}, ${width} px): only the current language is marked, the links keep ?fio and ?vista`, opened.links.filter((l) => l.current === 'true').map((l) => l.lang).join() === lang && opened.links.every((l) => /fio=mar/.test(l.href) && /vista=grelha/.test(l.href)), JSON.stringify(opened.links.map((l) => l.href)));
      await page.keyboard.press('Escape');
      const afterEsc = await page.evaluate(() => ({ open: document.querySelector('[data-lang-switch]').open, focus: document.activeElement?.classList.contains('lang-switch__current') }));
      ok(`menu (${lang}, ${width} px): Escape closes the list and returns focus to the button`, afterEsc.open === false && afterEsc.focus === true, JSON.stringify(afterEsc));
      await page.click('.lang-switch__current');
      await page.mouse.click(10, 600);
      ok(`menu (${lang}, ${width} px): a click elsewhere closes the list`, (await page.evaluate(() => document.querySelector('[data-lang-switch]').open)) === false);
      ok(`menu (${lang}, ${width} px): no script errors`, page.errors.length === 0, page.errors.join(';'));
      await page.close();
    }
  }
  // Switching keeps the page: a card in Russian leads to the card in the other languages, and the choice is remembered.
  const page = await newPage({ width: 360 });
  await page.goto(`${base}/ru/istoriya/testovoe-sobytie-01/`, { waitUntil: 'load' });
  const hrefs = await page.$$eval('.lang-switch a', (as) => as.map((a) => a.getAttribute('href')));
  ok('menu: on a Russian card the links lead to the same card in pt and en and to itself', hrefs.join() === '/pt/historia/evento-exemplo-01/,/en/story/example-event-01/,/ru/istoriya/testovoe-sobytie-01/', hrefs.join());
  await page.click('.lang-switch__current');
  await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), page.click('.lang-switch a[hreflang="en"]')]);
  ok('menu: choosing English opens the English card and stores "en"', page.url().endsWith('/en/story/example-event-01/') && (await page.evaluate(() => localStorage.getItem('lang'))) === 'en');
  await page.close();
}

// ---------- 2. The root chooses the language ----------
if (want('root')) {
  const go = async (language, saved) => {
    const page = await newPage({ language, saved });
    await page.goto(`${base}/`, { waitUntil: 'load' });
    await page.waitForFunction(() => location.pathname !== '/', { timeout: 5000 }).catch(() => {});
    const path = new URL(page.url()).pathname;
    await page.close();
    return path;
  };
  ok('root: a Russian browser leads to /ru/', (await go('ru-RU', null)) === '/ru/');
  ok('root: an English browser leads to /en/', (await go('en-GB', null)) === '/en/');
  ok('root: any other browser leads to /pt/', (await go('de-DE', null)) === '/pt/');
  ok('root: the saved choice wins over the browser (en over ru, ru over en)', (await go('ru-RU', 'en')) === '/en/' && (await go('en-US', 'ru')) === '/ru/');
  const nojs = await newPage();
  await nojs.setJavaScriptEnabled(false);
  await nojs.goto(`${base}/`, { waitUntil: 'load' });
  const links = await nojs.$$eval('.lang-chooser__links a', (as) => as.map((a) => [a.textContent.trim(), a.getAttribute('href')]));
  ok('root without JavaScript: three links, Português, English, Русский', JSON.stringify(links) === JSON.stringify([['Português', '/pt/'], ['English', '/en/'], ['Русский', '/ru/']]), JSON.stringify(links));
  await nojs.close();
}

// ---------- 3. A card that is not translated ----------
if (want('banner')) {
  const page = await newPage({ width: 360 });
  await page.goto(`${base}/ru/istoriya/example-event-09/`, { waitUntil: 'load' });
  const stand = await page.evaluate(() => {
    const banner = document.querySelector('[data-not-translated]');
    const r = banner?.getBoundingClientRect();
    return {
      lang: document.documentElement.lang,
      banner: banner?.textContent.trim() ?? null,
      visible: Boolean(r && r.width > 0 && r.height > 0),
      noindex: document.querySelector('meta[name=robots]')?.content ?? null,
      alternates: [...document.querySelectorAll('link[rel=alternate]')].map((l) => l.getAttribute('hreflang')),
      h1: document.querySelector('h1').textContent.trim(),
      storyLang: document.querySelector('#historia .prose')?.getAttribute('lang') ?? null,
    };
  });
  ok('banner: the Russian page of a card that is not translated says so, above the text', stand.visible && stand.banner === 'Эта страница пока не переведена. Показан текст на английском.', stand.banner ?? 'no banner');
  ok('banner: the page is noindex and has no hreflang', stand.noindex === 'noindex' && stand.alternates.length === 0, JSON.stringify([stand.noindex, stand.alternates]));
  ok('banner: the text is the English one and is marked as such (lang)', stand.lang === 'ru' && stand.h1 === 'Example event 09' && ['en', 'la'].includes(stand.storyLang), JSON.stringify([stand.lang, stand.h1, stand.storyLang]));
  await page.close();

  const ready = await newPage({ width: 360 });
  await ready.goto(`${base}/ru/istoriya/testovoe-sobytie-01/`, { waitUntil: 'load' });
  const r = await ready.evaluate(() => ({ banner: Boolean(document.querySelector('[data-not-translated]')), h1: document.querySelector('h1').textContent.trim(), alternates: [...document.querySelectorAll('link[rel=alternate]')].map((l) => l.getAttribute('hreflang')).sort(), robots: document.querySelector('meta[name=robots]')?.content ?? null, hook: document.querySelector('.hook')?.textContent.trim() ?? '' }));
  ok('banner: a card ready in Russian has no banner, its own title and text, hreflang pt, en, ru and x-default', !r.banner && r.h1 === 'Тестовое событие 01' && /[а-я]/.test(r.hook) && r.alternates.join() === 'en,pt,ru,x-default', JSON.stringify(r));
  await ready.close();

  // The Portuguese and English pages of a card that is not translated do not name a Russian version.
  for (const path of ['/pt/historia/evento-exemplo-09/', '/en/story/example-event-09/']) {
    const p = await newPage();
    await p.goto(`${base}${path}`, { waitUntil: 'load' });
    const alt = await p.$$eval('link[rel=alternate]', (ls) => ls.map((l) => l.getAttribute('hreflang')).sort());
    ok(`banner: ${path} names pt, en and x-default only`, alt.join() === 'en,pt,x-default', alt.join());
    await p.close();
  }
  // A feed of a Russian epoch page shows the English stand-in text of the cards that are not translated.
  const feed = await newPage({ width: 1280 });
  await feed.goto(`${base}/ru/epoha/pombal-zemletryasenie-begstvo-dvora/`, { waitUntil: 'load' });
  const f = await feed.evaluate(() => ({ cards: document.querySelectorAll('.ecard').length, marked: [...document.querySelectorAll('.ecard .ecard__hook')].filter((h) => ['en', 'la'].includes(h.getAttribute('lang'))).length }));
  ok('banner: in the feed of a Russian epoch page every card that is not translated marks its text language', f.cards > 0 && f.marked === f.cards, JSON.stringify(f));
  await feed.close();
}

// ---------- 4. Cyrillic fonts only on the Russian pages ----------
if (want('fonts')) {
  const paths = ['/pt/', '/en/', '/pt/historia/evento-exemplo-01/', '/en/story/example-event-02/', '/pt/epoca/avis-e-descobrimentos/', '/en/era/avis-and-the-discoveries/', '/pt/mapa/'];
  for (const path of paths) {
    const page = await newPage({ width: 1280 });
    await page.goto(`${base}${path}`, { waitUntil: 'networkidle0' });
    const cyr = page.fontRequests.filter((u) => /cyrillic/i.test(u));
    ok(`fonts: ${path} does not fetch a Cyrillic font file`, cyr.length === 0, cyr.join(' '));
    await page.close();
  }
  // The 404 page holds the text in all three languages, so it is the one page outside /ru/ that draws Cyrillic.
  const nf = await newPage({ width: 1280 });
  await nf.goto(`${base}/404.html`, { waitUntil: 'networkidle0' });
  ok('fonts: the 404 page (pt, en and ru text together) fetches the Cyrillic files', nf.fontRequests.some((u) => /cyrillic/i.test(u)));
  await nf.close();
  let ruBytes = 0;
  for (const path of ['/ru/', '/ru/istoriya/testovoe-sobytie-01/', '/ru/epoha/avis-i-velikie-otkrytiya/']) {
    const page = await newPage({ width: 1280 });
    const sizes = [];
    page.on('response', async (res) => {
      if (/cyrillic.*\.woff2/.test(res.url())) sizes.push([res.url().split('/').pop(), (await res.buffer().catch(() => Buffer.alloc(0))).length]);
    });
    await page.goto(`${base}${path}`, { waitUntil: 'networkidle0' });
    await page.evaluate(() => document.fonts.ready);
    const cyr = page.fontRequests.filter((u) => /cyrillic/i.test(u));
    ok(`fonts: ${path} fetches Cyrillic files (and no Latin-extended or other subsets)`, cyr.length > 0 && page.fontRequests.every((u) => /latin-|cyrillic-/.test(u) && !/-ext-/.test(u)), cyr.map((u) => u.split('/').pop()).join(' '));
    const preloads = await page.$$eval('link[rel=preload][as=font]', (ls) => ls.length);
    ok(`fonts: ${path} has no font preload`, preloads === 0);
    ok(`fonts: ${path} draws its Russian text with the web fonts (not the fallback)`, await page.evaluate(() => ['400 17px "Source Serif 4"', '600 17px "Source Serif 4"', 'italic 400 17px "Source Serif 4"', '700 32px "Playfair Display"', '600 14px "Oswald"'].every((f) => document.fonts.check(f, 'Привет'))));
    ruBytes = Math.max(ruBytes, sizes.reduce((a, [, n]) => a + n, 0));
    console.log(`INFO  ${path}: Cyrillic font files ${sizes.map(([n, s]) => `${n} ${(s / 1024).toFixed(1)} KB`).join(', ')}`);
    await page.close();
  }
  console.log(`INFO  most Cyrillic font bytes on one Russian page: ${(ruBytes / 1024).toFixed(1)} KB`);
}

// ---------- 5. Plural forms in the browser ----------
if (want('plural')) {
  const page = await newPage({ width: 1280 });
  await page.goto(`${base}/ru/epoha/avis-i-velikie-otkrytiya/`, { waitUntil: 'networkidle0' });
  const counts = await page.$$eval('[data-fio]', (bs) => bs.map((b) => b.getAttribute('data-fio')).filter(Boolean));
  const seen = new Set();
  for (const fio of counts.slice(0, 5)) {
    await page.click(`[data-fio="${fio}"]`);
    await wait(100);
    seen.add(await page.$eval('[data-status]', (s) => s.textContent.trim()));
  }
  ok('plural: the filter announces the count of a Russian page with the right form of "история"', [...seen].length > 0 && [...seen].every((t) => /^\d+ (история|истории|историй)$/.test(t)), [...seen].join(' | '));
  const forms = await page.$eval('[data-status]', (s) => ({ one: s.dataset.one, few: s.dataset.few, many: s.dataset.many, other: s.dataset.other, locale: s.dataset.locale }));
  ok('plural: the page carries all four Russian forms and the locale for the script', Boolean(forms.one && forms.few && forms.many && forms.other) && forms.locale === 'ru-RU', JSON.stringify(forms));
  await page.close();
}

await browser.close();
console.log(failed === 0 ? '\nAll Russian-language checks passed' : `\n${failed} check(s) failed`);
process.exit(failed === 0 ? 0 : 1);

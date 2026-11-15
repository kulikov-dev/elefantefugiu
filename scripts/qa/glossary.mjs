// Browser checks of the glossary (src/lib/glossary.ts, src/scripts/glossary.ts, src/views/GlossaryView.astro, docs/spec.md "Словарик"), against dist/ served by serve.mjs:
//   node glossary.mjs [story page]
//   story   the marked word of a story (a page found in dist/, none is hardcoded): closed at first, a press opens it (a phone) with the tooltip inside the screen at 320 and 390 px, a second press and
//           a press elsewhere close it, Esc closes it and keeps the focus on the word, the keyboard focus opens it, a mouse (1280 px) opens it on hover and closes it on leaving, the first
//           mention only, the link "All words" leads to the word on the page of the glossary, no horizontal scroll, both themes
//   page    the page of the glossary in ru and en: every word of the file with its text, a link to a story, the footer link beside "Method and sources"; no Portuguese page and no
//           link to one, no marks and no footer link in Portuguese
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fsPath, launchBrowser } from './browser.mjs';

const base = process.env.BASE_URL || 'http://localhost:4400';
const ONLY = process.argv.slice(2);
const want = (name) => ONLY.length === 0 || ONLY.includes(name);
let failed = 0;
const ok = (name, cond, extra = '') => {
  if (!cond) failed += 1;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await launchBrowser();

const { parse } = createRequire(import.meta.url)('../../node_modules/yaml');
const TERMS = parse(readFileSync(fsPath(new URL('../../src/data/glossary.yaml', import.meta.url)), 'utf8'));
const dist = fsPath(new URL('../../dist/', import.meta.url));
const SEG = { en: 'story', ru: 'istoriya', pt: 'historia' };
const GLOSSARY = { en: 'glossary', ru: 'slovarik' };

// The pages of stories in dist/ that carry a mark, by language: found in the build, so the suite needs no word or story of its own.
const storyPages = (lang) => {
  const dir = join(dist, lang, SEG[lang]);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((slug) => statSync(join(dir, slug)).isDirectory() && existsSync(join(dir, slug, 'index.html')))
    .filter((slug) => readFileSync(join(dir, slug, 'index.html'), 'utf8').includes('class="gl__term"'))
    .map((slug) => `/${lang}/${SEG[lang]}/${slug}/`);
};
const MARKED = { ru: storyPages('ru')[0], en: storyPages('en')[0] };

const open = async (path, { width = 390, scheme = 'light', js = true } = {}) => {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 800, isMobile: width < 700, hasTouch: width < 700 });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
  if (!js) await page.setJavaScriptEnabled(false);
  page.errors = [];
  page.on('pageerror', (e) => !/ViewTransition opt-in disabled/.test(e.message) && page.errors.push(e.message));
  await page.goto(`${base}${path}`, { waitUntil: 'networkidle0' });
  await wait(300);
  return page;
};
// The word that stands in the open part of the page (the first of the story), scrolled to the upper third (no smooth scroll: a press lands where the word is).
const reveal = async (page, index = 0) => {
  await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; });
  const el = (await page.$$('.gl__term'))[index];
  await el.evaluate((e) => { e.closest('details')?.setAttribute('open', ''); window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 260); });
  await wait(400);
  return el;
};
const state = (page, index = 0) =>
  page.evaluate((i) => {
    const word = document.querySelectorAll('.gl')[i];
    const tip = word.querySelector('.gl__tip').getBoundingClientRect();
    const shown = getComputedStyle(word.querySelector('.gl__tip')).visibility === 'visible';
    return { open: word.hasAttribute('data-open'), shown, expanded: word.querySelector('.gl__term').getAttribute('aria-expanded'), left: tip.left, right: tip.right, wide: document.documentElement.clientWidth, overflow: document.scrollingElement.scrollWidth - innerWidth };
  }, index);
const tap = async (page, el) => {
  const b = await el.boundingBox();
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  await wait(250);
};

if (want('story')) {
  for (const lang of ['ru', 'en']) {
    const path = MARKED[lang];
    if (!path) {
      ok(`story (${lang}): a page with a marked word exists in the build`, false, 'no page in dist/ has class="gl__term"');
      continue;
    }
    for (const width of [320, 390]) {
      const page = await open(path, { width });
      const el = await reveal(page);
      let s = await state(page);
      ok(`story (${lang}, ${width} px): the tooltip is closed and hidden at first`, !s.open && !s.shown && s.expanded === 'false');
      await tap(page, el);
      s = await state(page);
      ok(`story (${lang}, ${width} px): a press opens it, aria-expanded is true`, s.open && s.shown && s.expanded === 'true');
      ok(`story (${lang}, ${width} px): the tooltip is inside the screen, no horizontal scroll`, s.left >= 0 && s.right <= s.wide && s.overflow <= 0, JSON.stringify(s));
      const link = await page.$eval('.gl[data-open] .gl__all', (a) => a.getAttribute('href'));
      const id = await page.$eval('.gl[data-open] .gl__tip', (t) => t.id.replace(/^gl-/, ''));
      ok(`story (${lang}, ${width} px): "All words" leads to the word on the page of the glossary`, link.endsWith(`/${lang}/${GLOSSARY[lang]}/#${id}`), link);
      await tap(page, el);
      s = await state(page);
      ok(`story (${lang}, ${width} px): a second press closes it`, !s.open && !s.shown);
      await tap(page, el);
      await page.touchscreen.tap(width - 4, 400);
      await wait(250);
      s = await state(page);
      ok(`story (${lang}, ${width} px): a press elsewhere closes it`, !s.open);
      ok(`story (${lang}, ${width} px): no error`, page.errors.length === 0, page.errors.join('; '));
      await page.close();
    }
    {
      const page = await open(path, { width: 1280 });
      const el = await reveal(page);
      await page.keyboard.press('Shift');
      await el.focus();
      await wait(250);
      let s = await state(page);
      ok(`story (${lang}): the keyboard focus opens the tooltip`, s.open && s.shown);
      await page.keyboard.press('Escape');
      await wait(200);
      s = await state(page);
      const onWord = await page.evaluate(() => document.activeElement?.classList.contains('gl__term'));
      ok(`story (${lang}): Esc closes it and keeps the focus on the word`, !s.open && !s.shown && onWord);
      await page.evaluate(() => document.activeElement.blur());
      await el.hover();
      await wait(250);
      s = await state(page);
      ok(`story (${lang}, 1280 px): a mouse over the word opens the tooltip`, s.open && s.shown);
      await page.mouse.move(2, 2);
      await wait(250);
      s = await state(page);
      ok(`story (${lang}, 1280 px): leaving closes it`, !s.open && !s.shown);
      const dups = await page.evaluate(() => {
        const ids = [...document.querySelectorAll('.gl__tip')].map((t) => t.id);
        return ids.length - new Set(ids).size;
      });
      ok(`story (${lang}): a word is marked once on a page`, dups === 0);
      const inSearch = await page.evaluate(() => [...document.querySelectorAll('.gl__tip')].every((t) => t.hasAttribute('data-pagefind-ignore')));
      ok(`story (${lang}): the tooltips are out of the search index`, inSearch);
      await page.close();
    }
    for (const scheme of ['light', 'dark']) {
      const page = await open(path, { width: 390, scheme });
      const el = await reveal(page);
      await tap(page, el);
      const colours = await page.evaluate(() => {
        const box = getComputedStyle(document.querySelector('.gl[data-open] .gl__box'));
        const term = getComputedStyle(document.querySelector('.gl__term'));
        return { bg: box.backgroundColor, ink: box.color, line: term.textDecorationLine, style: term.textDecorationStyle };
      });
      ok(`story (${lang}, ${scheme}): the word has a dotted underline, the tooltip a background that differs from its text`, colours.line.includes('underline') && colours.style === 'dotted' && colours.bg !== colours.ink, JSON.stringify(colours));
      await page.close();
    }
    {
      const page = await open(path, { width: 390 });
      const el = await reveal(page);
      await tap(page, el);
      const id = await page.$eval('.gl[data-open] .gl__tip', (t) => t.id.replace(/^gl-/, ''));
      const box = await (await page.$('.gl[data-open] .gl__all')).boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForFunction((l) => location.pathname.includes(l), { timeout: 8000 }, `/${GLOSSARY[lang]}/`);
      await wait(300);
      const here = await page.evaluate(() => ({ hash: location.hash, target: document.querySelector(':target')?.id }));
      ok(`story (${lang}): the link opens the page of the glossary at the word`, here.hash === `#${id}` && here.target === id, JSON.stringify(here));
      await page.close();
    }
  }
  {
    const page = await open(MARKED.ru, { width: 390, js: false });
    const hidden = await page.evaluate(() => getComputedStyle(document.querySelector('.gl__tip')).visibility === 'hidden');
    ok('story (no JS): the tooltip is hidden until hover or focus; the word and its text are still in the page', hidden && (await page.$$('.gl__term')).length > 0);
    await page.close();
  }
}

if (want('page')) {
  for (const lang of ['ru', 'en']) {
    const page = await open(`/${lang}/${GLOSSARY[lang]}/`, { width: 390 });
    const found = await page.evaluate(() => [...document.querySelectorAll('.gloss__item')].map((li) => ({ id: li.id, text: li.querySelector('.gloss__text')?.textContent.trim(), links: li.querySelectorAll('.gloss__links a').length })));
    ok(`page (${lang}): every word of the file is on the page, with its text`, TERMS.every((t) => found.some((f) => f.id === t.id && f.text === t.text[lang])), `${found.length} of ${TERMS.length}`);
    ok(`page (${lang}): a word of a published story has a link to a story`, found.some((f) => f.links > 0));
    ok(`page (${lang}): one h1, no horizontal scroll, no error`, (await page.$$('h1')).length === 1 && (await page.evaluate(() => document.scrollingElement.scrollWidth - innerWidth)) <= 0 && page.errors.length === 0);
    const hreflang = await page.evaluate(() => [...document.querySelectorAll('link[rel="alternate"][hreflang]')].map((l) => l.hreflang).sort().join(','));
    ok(`page (${lang}): hreflang en, ru and x-default, no pt`, hreflang === 'en,ru,x-default', hreflang);
    const footer = await page.evaluate(() => [...document.querySelectorAll('.site-footer__links a')].map((a) => a.getAttribute('href')));
    const at = footer.findIndex((h) => h.endsWith(`/${lang}/${GLOSSARY[lang]}/`));
    ok(`page (${lang}): the footer links to it right after "Method and sources"; it is not in the header or the bottom bar`, at > 0 && footer[at - 1].includes(lang === 'ru' ? 'metod' : 'method') && (await page.evaluate((g) => !document.querySelector(`header a[href$="/${g}/"]:not([data-set-lang]), .tabbar a[href$="/${g}/"]`), GLOSSARY[lang])));
    const pt = await page.evaluate(() => [...document.querySelectorAll('.lang-switch__list li')].map((li) => ({ lang: li.querySelector('[lang]')?.getAttribute('lang'), link: li.querySelector('a') !== null })));
    ok(`page (${lang}): the Portuguese entry of the language switch is not a link`, pt.find((x) => x.lang === 'pt')?.link === false, JSON.stringify(pt));
    await page.close();
  }
  ok('page: no Portuguese page of the glossary is built', !existsSync(join(dist, 'pt', 'glossario')));
  const pt = await open('/pt/', { width: 390 });
  const ptLinks = await pt.evaluate(() => [...document.querySelectorAll('a')].filter((a) => /glossar|slovarik/.test(a.getAttribute('href') || '')).length);
  ok('page: the Portuguese pages have no link to the glossary', ptLinks === 0);
  await pt.close();
  const ptStory = readdirSync(join(dist, 'pt', 'historia')).find((s) => existsSync(join(dist, 'pt', 'historia', s, 'index.html')));
  ok('page: the Portuguese story pages have no marks', !readFileSync(join(dist, 'pt', 'historia', ptStory, 'index.html'), 'utf8').includes('class="gl"'));
}

await browser.close();
console.log(failed === 0 ? '\nAll glossary checks passed' : `\n${failed} check(s) failed`);
process.exit(failed === 0 ? 0 : 1);

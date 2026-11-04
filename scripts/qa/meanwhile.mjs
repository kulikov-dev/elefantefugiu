// Browser checks of the block "Meanwhile" (pt "Entretanto", ru "А в это время") on a story page, against dist/ served by serve.mjs:   node meanwhile.mjs [markup layout]
// (src/components/Meanwhile.astro, src/lib/meanwhile.ts; the lines are in the YAML of the story, field `meanwhile`)
//   markup   every published story in every language, read from the HTML as served (so without JavaScript): the block exists exactly when the data has a line for the
//            language (its own scope or `world`), the lines are its own language first and then the world, a line of another language is never there, and each time caption is
//            the one the distance in years gives
//   layout   at 360 px (and 1280) in every language: the block stands after the text and before "More", outside it, with no horizontal scroll; a story without lines has no
//            block; the block is in view in every family mode
import { launchBrowser } from './browser.mjs';
import { need, published, ui } from './data.mjs';

const base = process.env.BASE_URL || 'http://localhost:4400';
const ONLY = process.argv.slice(2);
const want = (name) => ONLY.length === 0 || ONLY.includes(name);
let failed = 0;
const ok = (name, cond, extra = '') => {
  if (!cond) failed += 1;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
};

const LANGS = ['pt', 'en', 'ru'];
const SEG = { pt: 'historia', en: 'story', ru: 'istoriya' };
const pathOf = (e, lang) => `/${lang}/${SEG[lang]}/${e.slug[lang]}/`;

/** The first year of a story, and the distance from it to a year of the event (there is no year 0). */
const startOf = (e) => (typeof e.year === 'number' ? e.year : e.year.from);
/** What the data promises for a story on the page of a language: [{scope, text, caption}], its own line first. A Russian page of a story not ready in Russian shows English with no Russian line. */
function expected(e, lang) {
  const items = e.sensitive ? [] : (e.meanwhile ?? []);
  const own = lang === 'ru' && !e.ru_ready ? undefined : items.find((i) => i.scope === lang);
  const world = items.find((i) => i.scope === 'world');
  const caption = (i) => (i.year < 0 ? ui('card.year_bc', lang).replace('{n}', String(-i.year)) : i.year < 1000 ? ui('card.year_ad', lang).replace('{n}', String(i.year)) : String(i.year));
  return [own, world].filter(Boolean).map((i) => ({ scope: i.scope, caption: caption(i), text: i.text[lang] ?? i.text.en }));
}

const decode = (s) => s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const strip = (s) => decode(s.replace(/<[^>]+>/g, '')).trim();
/** The block of a served page: [{scope, caption, text}] or null when there is none. */
function blockOf(html) {
  const m = html.match(/<section[^>]*data-meanwhile[^>]*>([\s\S]*?)<\/section>/);
  if (!m) return null;
  return [...m[1].matchAll(/<li[^>]*data-scope="([^"]+)"[^>]*>([\s\S]*?)<\/li>/g)].map((li) => ({
    scope: li[1],
    caption: strip(li[2].match(/class="[^"]*meanwhile__year[^"]*"[^>]*>([\s\S]*?)<\/span>/)?.[1] ?? ''),
    text: strip(li[2].match(/class="[^"]*meanwhile__text[^"]*"[^>]*>([\s\S]*?)<\/span>/)?.[1] ?? ''),
  }));
}

if (want('markup')) {
  let withLines = 0;
  let without = 0;
  const bad = [];
  for (const e of published) {
    for (const lang of LANGS) {
      const html = await (await fetch(`${base}${pathOf(e, lang)}`)).text();
      const got = blockOf(html);
      const want_ = expected(e, lang);
      if (want_.length === 0) {
        without += 1;
        if (got) bad.push(`${lang}/${e.id}: a block where the data has no line`);
        continue;
      }
      withLines += 1;
      if (!got) bad.push(`${lang}/${e.id}: no block, the data has ${want_.length} line(s)`);
      else if (JSON.stringify(got) !== JSON.stringify(want_)) bad.push(`${lang}/${e.id}: ${JSON.stringify(got)} instead of ${JSON.stringify(want_)}`);
      else if (got.some((l) => l.scope !== 'world' && l.scope !== lang)) bad.push(`${lang}/${e.id}: a line of another language`);
    }
  }
  ok(`markup: the block is on exactly the pages that have lines (${withLines} with, ${without} without), own language first then the world, the right captions`, bad.length === 0, bad.slice(0, 3).join(' | '));
}

if (want('layout')) {
  const browser = await launchBrowser();
  for (const lang of LANGS) {
    const two = need(`a story with two "Meanwhile" lines in ${lang}`, (list) => list.find((e) => expected(e, lang).length === 2));
    const none = need(`a story with no "Meanwhile" line in ${lang}`, (list) => list.find((e) => expected(e, lang).length === 0));
    for (const width of [360, 1280]) {
      const page = await browser.newPage();
      await page.setViewport({ width, height: 900, isMobile: width < 700, hasTouch: width < 700 });
      page.errors = [];
      page.on('pageerror', (err) => !/ViewTransition opt-in disabled/.test(err.message) && page.errors.push(err.message));
      await page.goto(`${base}${pathOf(two, lang)}`, { waitUntil: 'networkidle0' });
      const geo = await page.evaluate(() => {
        const block = document.querySelector('[data-meanwhile]');
        const story = document.getElementById('historia');
        const more = document.getElementById('detalhes');
        const heading = block?.querySelector('h2');
        const box = block?.getBoundingClientRect();
        return {
          has: !!block,
          items: block ? block.querySelectorAll('li').length : 0,
          after: !!block && !!story && !!(story.compareDocumentPosition(block) & Node.DOCUMENT_POSITION_FOLLOWING),
          before: !!block && !!more && !!(block.compareDocumentPosition(more) & Node.DOCUMENT_POSITION_FOLLOWING),
          outside: !!block && !more.contains(block),
          title: heading?.textContent?.trim(),
          fits: !!box && box.right <= document.documentElement.clientWidth + 1 && box.left >= -1,
          scrollX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          visible: !!block && block.getClientRects().length > 0,
        };
      });
      ok(`${lang} ${width}px: two lines, after the text, before "More" and outside it, heading "${ui('card.meanwhile_title', lang)}"`, geo.has && geo.items === 2 && geo.after && geo.before && geo.outside && geo.title === ui('card.meanwhile_title', lang), JSON.stringify(geo));
      ok(`${lang} ${width}px: no horizontal scroll, the block is inside the screen`, geo.scrollX <= 0 && geo.fits && geo.visible, `scrollX ${geo.scrollX}`);
      if (width === 360) {
        // Family mode hides cards by age, never this block: it is in view in every mode (the mode is the attribute data-family of <html>, set by the script in <head>).
        for (const mode of ['all', '12', '16']) {
          await page.evaluate((m) => { document.documentElement.dataset.family = m; }, mode);
          const shown = await page.evaluate(() => { const b = document.querySelector('[data-meanwhile]'); return !!b && b.getClientRects().length > 0 && getComputedStyle(b).visibility === 'visible'; });
          ok(`${lang}: the block is in view in family mode ${mode}`, shown);
        }
      }
      ok(`${lang} ${width}px: no script error`, page.errors.length === 0, page.errors.join(' | '));
      await page.close();
    }
    const page = await browser.newPage();
    await page.setViewport({ width: 360, height: 900, isMobile: true, hasTouch: true });
    await page.goto(`${base}${pathOf(none, lang)}`, { waitUntil: 'networkidle0' });
    const count = await page.evaluate(() => ({ block: document.querySelectorAll('[data-meanwhile]').length, title: [...document.querySelectorAll('h2')].some((h) => h.id === 'meanwhile-title'), scrollX: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
    ok(`${lang} 360px: a story without lines has no block and no empty heading`, count.block === 0 && !count.title && count.scrollX <= 0, JSON.stringify(count));
    await page.close();
  }
  await browser.close();
}

console.log(failed === 0 ? '\nAll "Meanwhile" checks passed' : `\n${failed} check(s) failed`);
process.exit(failed === 0 ? 0 : 1);

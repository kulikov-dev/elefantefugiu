// Browser checks of the button "I liked it" under the text of a story, before "More" (src/components/LikeButton.astro, src/scripts/like.ts, src/lib/like.ts), against dist/ served by
// serve.mjs:   node like.mjs [layout counter]
//   layout   the button exists only with JavaScript; it stands under the text, before "More", on the right edge of the text column, not among the actions at the foot
//            ("Share" is alone there); pressing changes the words and the heart and nothing else, at 320 and 390 px in every language; both themes: the colour of the links, a focus ring
//   counter  (only on a build for a public address, where the counter is on) one request with event=true and the path like/<id> (no language) per reader and story,
//            "Thanks!" after a reload, nothing sent twice, nothing sent with the counter switched off, one per page load without localStorage
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
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await launchBrowser();

const SEG = { pt: 'historia', en: 'story', ru: 'istoriya' };
const STORY = need('a published story with a slug in every language', (list) => list.find((e) => e.slug?.pt && e.slug?.en && e.slug?.ru));
const path = (lang) => `/${lang}/${SEG[lang]}/${STORY.slug[lang]}/`;
const LANGS = ['pt', 'en', 'ru'];

const open = async ({ lang = 'pt', width = 390, js = true, blocked = false, skipgc = false, counting = false } = {}) => {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 900, isMobile: width < 700, hasTouch: width < 700 });
  if (!js) await page.setJavaScriptEnabled(false);
  page.errors = [];
  page.on('pageerror', (e) => !/ViewTransition opt-in disabled/.test(e.message) && page.errors.push(e.message));
  page.hits = [];
  if (counting) {
    await page.setRequestInterception(true);
    page.on('request', (r) => {
      if (r.url().includes('goatcounter.com/count')) {
        page.hits.push(new URL(r.url()));
        r.abort();
      } else r.continue();
    });
    // The counter does not count a local address; this lets the test see what it would send.
    await page.evaluateOnNewDocument(() => {
      let v;
      Object.defineProperty(window, 'goatcounter', { configurable: true, get: () => v, set: (x) => { x.allow_local = true; v = x; } });
    });
  }
  if (blocked) {
    await page.evaluateOnNewDocument(() => Object.defineProperty(window, 'localStorage', { get: () => { throw new DOMException('blocked', 'SecurityError'); } }));
  } else {
    await page.evaluateOnNewDocument((skip) => {
      // Every page of the browser shares one localStorage: each test starts with nothing liked (and, on a reload, with what the test left).
      if (!sessionStorage.getItem('__seeded')) {
        sessionStorage.setItem('__seeded', '1');
        localStorage.clear();
        if (skip) localStorage.setItem('skipgc', 't');
      }
    }, skipgc);
  }
  await page.goto(`${base}${path(lang)}`, { waitUntil: 'networkidle0' });
  await wait(300);
  return page;
};
/** The visible pair "heart + words": the gap between them and how far it is from the right edge of the button (inside its padding). */
const pairGeo = (page) =>
  page.evaluate(() => {
    const btn = document.querySelector('[data-like]');
    const pair = [...btn.querySelectorAll('.like__pair')].find((p) => getComputedStyle(p).visibility === 'visible');
    const svg = pair.querySelector('svg').getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(pair.querySelector('span'));
    const word = range.getBoundingClientRect();
    const pad = parseFloat(getComputedStyle(btn).paddingRight);
    return { gap: Math.round((word.left - svg.right) * 10) / 10, right: Math.round((btn.getBoundingClientRect().right - pad - pair.getBoundingClientRect().right) * 10) / 10 };
  });
const rect = (page, sel) =>
  page.evaluate((s) => {
    const e = document.querySelector(s);
    const r = e.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y + scrollY), w: Math.round(r.width), h: Math.round(r.height), over: e.scrollWidth > e.clientWidth };
  }, sel);
const events = (page) => page.hits.filter((u) => u.searchParams.get('e') === 'true');

if (want('layout')) {
  // Without JavaScript there is no button at all.
  {
    const page = await open({ js: false });
    ok('no JavaScript: the button is not shown', await page.evaluate(() => getComputedStyle(document.querySelector('[data-like]')).display === 'none'));
    await page.close();
  }
  for (const width of [320, 390]) {
    for (const lang of LANGS) {
      const page = await open({ lang, width });
      const word = await page.evaluate(() => document.querySelector('[data-like]').innerText.trim());
      ok(`${lang} ${width} px: the button says "${ui('ui.like', lang)}", not pressed`, word === ui('ui.like', lang) && (await page.evaluate(() => document.querySelector('[data-like]').getAttribute('aria-pressed'))) === 'false', word);
      // The place: after the end of the text, before "More", not among the actions at the foot of the page; on the right edge of the column of the text.
      const place = await page.evaluate(() => {
        const like = document.querySelector('[data-like]');
        const end = document.querySelector('[data-story-end]');
        const more = document.querySelector('details#detalhes');
        const prose = document.querySelector('.story .prose').getBoundingClientRect();
        const r = like.getBoundingClientRect();
        return {
          afterText: Boolean(end.compareDocumentPosition(like) & Node.DOCUMENT_POSITION_FOLLOWING),
          beforeMore: Boolean(like.compareDocumentPosition(more) & Node.DOCUMENT_POSITION_FOLLOWING),
          inActions: Boolean(like.closest('.actions')),
          rightGap: Math.round(prose.right - r.right),
          h: Math.round(r.height),
          w: Math.round(r.width),
          over: document.documentElement.scrollWidth > innerWidth,
        };
      });
      ok(`${lang} ${width} px: the button stands under the text, before "More", and not in the actions at the foot`, place.afterText && place.beforeMore && !place.inActions, JSON.stringify(place));
      ok(`${lang} ${width} px: it is on the right edge of the text column and is at least 44 px high`, Math.abs(place.rightGap) <= 12 && place.h >= 44, `gap ${place.rightGap}, height ${place.h}`);
      ok(`${lang} ${width} px: the page does not scroll sideways`, !place.over);
      const share = await rect(page, '[data-share-button]');
      ok(`${lang} ${width} px: "Share" is alone at the foot, of its own width (not stretched)`, share.w < 240 && share.x <= 20, JSON.stringify(share));
      const before = {
        like: await rect(page, '[data-like]'),
        more: await rect(page, 'details#detalhes'),
        actions: await rect(page, '.actions'),
        link: await rect(page, '.report-link a'),
      };
      const geoBefore = await pairGeo(page);
      await page.click('[data-like]');
      await page.mouse.move(1, 1);
      await wait(150);
      const geoAfter = await pairGeo(page);
      ok(`${lang} ${width} px: the heart is right against its words (about 6 px) and the pair is on the right edge of the button, before and after pressing`, [geoBefore, geoAfter].every((g) => g.gap >= 5 && g.gap <= 7 && Math.abs(g.right) <= 1), JSON.stringify([geoBefore, geoAfter]));
      const after = {
        like: await rect(page, '[data-like]'),
        more: await rect(page, 'details#detalhes'),
        actions: await rect(page, '.actions'),
        link: await rect(page, '.report-link a'),
      };
      const pressed = await page.evaluate(() => ({
        p: document.querySelector('[data-like]').getAttribute('aria-pressed'),
        t: document.querySelector('[data-like]').innerText.trim(),
        fill: getComputedStyle([...document.querySelectorAll('[data-like] .like__pair')].find((p) => getComputedStyle(p).visibility === 'visible').querySelector('svg path')).fill,
      }));
      ok(`${lang} ${width} px: pressed it says "${ui('ui.like_thanks', lang)}" (aria-pressed) and the heart is filled`, pressed.p === 'true' && pressed.t === ui('ui.like_thanks', lang) && pressed.fill !== 'none', JSON.stringify(pressed));
      ok(`${lang} ${width} px: pressing moves nothing: the button, "More", the actions and the link below keep their place and size`, JSON.stringify(before) === JSON.stringify(after) && !after.like.over, `${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
      await page.close();
    }
  }
  // Both themes: the colour of the links of the epoch, a heart of 20 px, a focus ring that can be seen.
  for (const scheme of ['light', 'dark']) {
    for (const lang of LANGS) {
      const page = await browser.newPage();
      await page.setViewport({ width: 390, height: 900, isMobile: true, hasTouch: true });
      await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
      await page.goto(`${base}${path(lang)}`, { waitUntil: 'networkidle0' });
      await page.evaluate(() => localStorage.clear());
      const look = await page.evaluate(() => {
        const like = document.querySelector('[data-like]');
        const link = document.querySelector('.report-link a');
        const s = getComputedStyle(like);
        const svg = like.querySelector('svg').getBoundingClientRect();
        return { colour: s.color, link: getComputedStyle(link).color, border: s.borderTopWidth, bg: s.backgroundColor, svg: Math.round(svg.width), weight: s.fontWeight, caps: s.textTransform };
      });
      ok(`${scheme} theme (${lang}): no frame, no background, the colour of the links, a heart of 20 px, the words not in capitals`, look.colour === look.link && look.border === '0px' && look.bg === 'rgba(0, 0, 0, 0)' && look.svg === 20 && look.caps === 'none', JSON.stringify(look));
      // Tab to the button: the ring is drawn.
      let focused = false;
      for (let i = 0; i < 400 && !focused; i += 1) {
        await page.keyboard.press('Tab');
        focused = await page.evaluate(() => document.activeElement?.hasAttribute('data-like'));
      }
      const ring = await page.evaluate(() => {
        const s = getComputedStyle(document.activeElement);
        return { visible: document.activeElement.matches(':focus-visible'), style: s.outlineStyle, width: s.outlineWidth };
      });
      ok(`${scheme} theme (${lang}): Tab reaches the button and its focus ring is visible`, focused && ring.visible && ring.style !== 'none' && parseFloat(ring.width) >= 2, JSON.stringify(ring));
      await page.close();
    }
  }
}

if (want('counter')) {
  const html = await (await fetch(`${base}/pt/`)).text();
  if (!html.includes('goatcounter/count.js')) console.log('SKIP  counter: this build has no counter (SITE_URL is a local address)');
  else {
    const expectPath = `like/${STORY.id}`;
    {
      const page = await open({ lang: 'ru', counting: true });
      const before = events(page).length;
      await page.click('[data-like]');
      await wait(400);
      const hits = events(page);
      ok('counter: one press, one event request with the path like/<id> (no language) and the title', hits.length - before === 1 && hits.at(-1).searchParams.get('p') === expectPath && Boolean(hits.at(-1).searchParams.get('t')), hits.map((u) => u.search).join(' | '));
      await page.click('[data-like]');
      await wait(300);
      ok('counter: a second press sends nothing', events(page).length === hits.length);
      const stored = await page.evaluate((id) => localStorage.getItem(`like:${id}`), STORY.id);
      ok('counter: the like is kept in localStorage (like:<id>)', stored === '1', String(stored));
      const sent = hits.length;
      await page.reload({ waitUntil: 'networkidle0' });
      await wait(300);
      const label = await page.evaluate(() => ({ t: document.querySelector('[data-like]').innerText.trim(), p: document.querySelector('[data-like]').getAttribute('aria-pressed') }));
      ok('counter: after a reload the button says "Thanks!" and nothing is sent', label.p === 'true' && label.t === ui('ui.like_thanks', 'ru') && events(page).length === sent, JSON.stringify(label));
      await page.close();
    }
    {
      // The same story in another language is the same like: the key and the path have no language.
      const pt = await open({ lang: 'pt', counting: true });
      await pt.click('[data-like]');
      await wait(300);
      ok('counter: the Portuguese page sends the same path', events(pt).at(-1)?.searchParams.get('p') === expectPath);
      await pt.close();
    }
    {
      const page = await open({ lang: 'en', counting: true, skipgc: true });
      await page.click('[data-like]');
      await wait(300);
      ok('counter: switched off with #toggle-goatcounter nothing is sent, the reader still gets "Thanks!"', events(page).length === 0 && (await page.evaluate(() => document.querySelector('[data-like]').getAttribute('aria-pressed'))) === 'true');
      await page.close();
    }
    {
      const page = await open({ lang: 'en', counting: true, blocked: true });
      await page.click('[data-like]');
      await wait(300);
      await page.click('[data-like]');
      await wait(300);
      // count.js itself reads localStorage and throws when it is blocked (its own page view and its filter): then nothing can be counted at all, which is not an
      // error of the button. The button must still thank the reader, never send more than one event, and raise no error of its own.
      const own = page.errors.filter((e) => !/blocked/.test(e));
      const thanks = await page.evaluate(() => document.querySelector('[data-like]').getAttribute('aria-pressed'));
      ok('counter: without localStorage the reader is thanked, at most one event per page load, no error of the button', thanks === 'true' && events(page).length <= 1 && own.length === 0, `${events(page).length} ${page.errors}`);
      await page.close();
    }
  }
}

await browser.close();
console.log(failed === 0 ? '\nAll like-button checks passed' : `\n${failed} check(s) failed`);
process.exit(failed === 0 ? 0 : 1);

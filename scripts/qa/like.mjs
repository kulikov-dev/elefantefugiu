// Browser checks of the button "I liked it" at the end of a story (src/components/LikeButton.astro, src/scripts/like.ts, src/lib/like.ts), against dist/ served by
// serve.mjs:   node like.mjs [layout counter]
//   layout   the button exists only with JavaScript; "Share" and "I liked it" in one line at 320 and 390 px in every language; the labels fit; pressing changes the words
//            and nothing else: the link "Spotted a mistake?" under them does not move
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
      const label = await page.evaluate(() => document.querySelector('[data-like]').textContent.trim());
      ok(`${lang} ${width} px: the button says "${ui('ui.like', lang)}", not pressed`, label === ui('ui.like', lang) && (await page.evaluate(() => document.querySelector('[data-like]').getAttribute('aria-pressed'))) === 'false', label);
      const share = await rect(page, '[data-share-button]');
      const like = await rect(page, '[data-like]');
      const link = await rect(page, '.report-link a');
      ok(`${lang} ${width} px: "Share" and "I liked it" are in one line`, share.y === like.y && share.h === like.h && like.x > share.x, `${JSON.stringify(share)} ${JSON.stringify(like)}`);
      ok(`${lang} ${width} px: both labels fit in their buttons`, !share.over && !like.over, `${share.over} ${like.over}`);
      ok(`${lang} ${width} px: the page does not scroll sideways`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.click('[data-like]');
      await wait(150);
      const after = await rect(page, '[data-like]');
      const linkAfter = await rect(page, '.report-link a');
      const pressed = await page.evaluate(() => ({ p: document.querySelector('[data-like]').getAttribute('aria-pressed'), t: document.querySelector('[data-like]').textContent.trim() }));
      ok(`${lang} ${width} px: pressed it says "${ui('ui.like_thanks', lang)}" (aria-pressed)`, pressed.p === 'true' && pressed.t === ui('ui.like_thanks', lang), JSON.stringify(pressed));
      ok(`${lang} ${width} px: the button keeps its size and the label still fits`, after.w === like.w && after.h === like.h && after.y === like.y && !after.over, `${JSON.stringify(like)} -> ${JSON.stringify(after)}`);
      ok(`${lang} ${width} px: the link "Spotted a mistake?" does not move`, linkAfter.y === link.y && linkAfter.x === link.x && linkAfter.h === link.h, `${JSON.stringify(link)} -> ${JSON.stringify(linkAfter)}`);
      await page.close();
    }
  }
  // The pressed button is clearly paler or lighter than the page (a colour of its own in each theme), in both themes.
  for (const scheme of ['light', 'dark']) {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 900 });
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
    await page.goto(`${base}${path('pt')}`, { waitUntil: 'networkidle0' });
    await page.evaluate(() => localStorage.clear());
    await page.click('[data-like]');
    const colours = await page.evaluate(() => ({ pressed: getComputedStyle(document.querySelector('[data-like]')).backgroundColor, share: getComputedStyle(document.querySelector('[data-share-button]')).backgroundColor }));
    ok(`${scheme} theme: the pressed button has a background of its own (not the one of "Share")`, colours.pressed !== colours.share, JSON.stringify(colours));
    await page.close();
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
      const label = await page.evaluate(() => ({ t: document.querySelector('[data-like]').textContent.trim(), p: document.querySelector('[data-like]').getAttribute('aria-pressed') }));
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

// Browser checks of "Myth or fact" (src/views/MythsView.astro, src/scripts/myths.ts, src/content/myths.yaml) against dist/ served by serve.mjs:   node myths.mjs [page answer nojs anchor card links layout]
//   page     the page in every language: a card for every claim of the data (those whose story is published), the two buttons, the footer link, the line at the end of About
//   answer   the answer is hidden until a press; a press opens that card only, marks the pressed button, turns both off, shows the verdict, the text, the story with its title and Share;
//            no words "right" / "wrong"; nothing is saved; one counter event `myth-<id>` and no other
//   nojs     without JavaScript: no buttons, every card is a <details> opened by "Answer"
//   anchor   the address with #id leads to the card, the answer stays closed
//   card     the address of one card: that card first and marked, noindex, canonical to the page of all of them, its own og:title and picture, hreflang between the languages
//   links    the link of every answer leads to the story in the language of the page
//   layout   no horizontal scroll at 360 px (closed and with every answer open)
import { launchBrowser } from './browser.mjs';
import { myths, published } from './data.mjs';

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

const LANGS = ['pt', 'en', 'ru'];
const SEG = { pt: 'mito-ou-verdade', en: 'myth-or-fact', ru: 'mif-ili-pravda' };
const STORY_SEG = { pt: 'historia', en: 'story', ru: 'istoriya' };
const ABOUT = { pt: 'sobre', en: 'about', ru: 'o-proekte' };
const SHARE = { pt: 'conheco-uma-historia', en: 'share-a-story', ru: 'znayu-istoriyu' };
const WRONG = /верно|ошибк|неверно|правильно|correct|wrong|incorrect|right!|certo!|errado|incorreto/i;
if (myths.length < 2) throw new Error('The suite needs at least two claims in src/content/myths.yaml whose story is published (need: two claims).');
const LIST = myths;
const storyOf = (m) => published.find((e) => e.id === m.story);
const pageUrl = (lang, id = '') => `${base}/${lang}/${SEG[lang]}/${id ? `${id}/` : ''}`;

const open = async ({ lang = 'pt', width = 390, js = true, id = '', hash = '' } = {}) => {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 900, isMobile: width < 700, hasTouch: width < 700 });
  if (!js) await page.setJavaScriptEnabled(false);
  page.errors = [];
  page.on('pageerror', (e) => !/ViewTransition opt-in disabled/.test(e.message) && page.errors.push(e.message));
  // The counter of the site is not loaded on a local address: a stand-in records what the page would send.
  await page.evaluateOnNewDocument(() => {
    window.__counted = [];
    Object.defineProperty(window, 'goatcounter', { configurable: true, value: { count: (v) => window.__counted.push(v) } });
  });
  await page.goto(`${pageUrl(lang, id)}${hash}`, { waitUntil: 'networkidle0' });
  await wait(200);
  return page;
};
const visible = (page, selector) => page.evaluate((s) => { const el = document.querySelector(s); return el ? el.checkVisibility() && el.getBoundingClientRect().height > 0 : false; }, selector);
// What the browser holds for the page (the site keeps its own marks, e.g. the last visit): a press must add nothing to it.
const stored = (page) => page.evaluate(() => JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)]));

if (want('page')) {
  for (const lang of LANGS) {
    const page = await open({ lang });
    const cards = await page.$$eval('[data-myth]', (list) => list.map((c) => ({ id: c.dataset.myth, buttons: c.querySelectorAll('[data-pick]').length, statement: c.querySelector('.myth__statement')?.textContent.trim() })));
    ok(`${lang}: a card for every claim of the data, in the order of the file`, cards.map((c) => c.id).join() === LIST.map((m) => m.id).join(), `${cards.length} of ${LIST.length}`);
    ok(`${lang}: every card has its claim and two buttons`, cards.every((c) => c.statement && c.statement.length > 5 && c.buttons === 2));
    ok(`${lang}: one h1`, (await page.$$eval('h1', (l) => l.length)) === 1);
    ok(`${lang}: the claims are those of the data`, cards.every((c, i) => c.statement === LIST[i].statement[lang]));
    const links = await page.evaluate(() => ({ foot: [...document.querySelectorAll('.site-footer a')].map((a) => a.getAttribute('href')), end: document.querySelector('.myths__end a')?.getAttribute('href') }));
    ok(`${lang}: the footer links to the page`, links.foot.includes(`/${lang}/${SEG[lang]}/`), links.foot.join(' '));
    ok(`${lang}: the line at the end leads to the form "Know a story?"`, links.end === `/${lang}/${SHARE[lang]}/`, links.end);
    await page.close();
    const about = await browser.newPage();
    await about.goto(`${base}/${lang}/${ABOUT[lang]}/`, { waitUntil: 'networkidle0' });
    const last = await about.evaluate(() => [...document.querySelectorAll('.static a')].map((a) => a.getAttribute('href')));
    ok(`${lang}: About has the line with a link to the page, at its end`, last.at(-1) === `/${lang}/${SEG[lang]}/`, last.at(-1));
    await about.close();
  }
  // Not on the home page nor in the stories.
  const home = await browser.newPage();
  await home.goto(`${base}/pt/`, { waitUntil: 'networkidle0' });
  ok('the home page has no link to the page (only the footer has)', (await home.$$eval(`main a[href="/pt/${SEG.pt}/"]`, (l) => l.length)) === 0);
  await home.close();
}

if (want('answer')) {
  for (const lang of LANGS) {
    const page = await open({ lang });
    const first = LIST[0];
    const second = LIST[1];
    const card = `[data-myth="${first.id}"]`;
    ok(`${lang}: JavaScript hides the summary and shows the buttons`, !(await visible(page, `${card} .myth__summary`)) && (await visible(page, `${card} [data-pick]`)));
    const closed = await page.$$eval('[data-answer]', (l) => l.every((d) => !d.open));
    ok(`${lang}: every answer is closed and hidden`, closed && !(await visible(page, `${card} [data-body]`)) && !(await visible(page, `${card} .myth__story`)) && !(await visible(page, `${card} .verdict`)));
    // The title of the story and its picture are not in the page's text before the answer is shown.
    ok(`${lang}: the title of the story is not visible before the answer`, !(await page.evaluate((c) => { const el = document.querySelector(`${c} .myth__story-title`); return el ? el.checkVisibility() : false; }, card)));
    const before = await stored(page);
    await page.click(`${card} [data-pick="myth"]`);
    await wait(200);
    const after = await page.evaluate((c, other) => {
      const el = document.querySelector(c);
      const buttons = [...el.querySelectorAll('[data-pick]')];
      return {
        open: el.querySelector('[data-answer]').open,
        pressed: buttons.map((b) => b.getAttribute('aria-pressed')),
        disabled: buttons.map((b) => b.disabled),
        verdict: el.querySelector('.verdict')?.textContent.trim(),
        text: el.querySelector('.myth__text')?.textContent.trim(),
        title: el.querySelector('.myth__story-title')?.textContent.trim(),
        thumb: el.querySelector('.myth__thumb')?.complete,
        share: Boolean(el.querySelector('[data-share-button], [data-share-link]')),
        otherOpen: document.querySelector(`[data-myth="${other}"] [data-answer]`).open,
        focus: document.activeElement === el.querySelector('[data-body]'),
        wrong: el.innerText,
      };
    }, card, second.id);
    ok(`${lang}: the press opens the answer of that card only`, after.open && !after.otherOpen);
    ok(`${lang}: the pressed button is marked, the other is not, both are off`, after.pressed.join() === 'true,false' && after.disabled.every(Boolean), after.pressed.join());
    ok(`${lang}: the answer shows the verdict, the text, the title of the story and Share`, after.verdict && after.text === first.answer[lang] && after.title === storyOf(first).title[lang] && after.share, JSON.stringify({ v: after.verdict, t: after.title }));
    ok(`${lang}: the focus moves to the answer`, after.focus);
    ok(`${lang}: nothing tells whether the guess was right`, !WRONG.test(after.wrong));
    ok(`${lang}: the other card has its own buttons still on`, await page.$eval(`[data-myth="${second.id}"] [data-pick]`, (b) => !b.disabled));
    // A second press does nothing more.
    await page.click(`${card} [data-pick="fact"]`).catch(() => {});
    const counted = await page.evaluate(() => window.__counted);
    ok(`${lang}: one counter event, myth-<id>, and no other`, counted.length === 1 && counted[0].path === `myth-${first.id}` && counted[0].event === true, JSON.stringify(counted));
    ok(`${lang}: nothing is saved in the browser`, (await stored(page)) === before);
    // The other button of another card: the verdict label is the data's, whichever button was pressed.
    await page.click(`[data-myth="${second.id}"] [data-pick="fact"]`);
    const verdict = await page.$eval(`[data-myth="${second.id}"] .verdict`, (v) => v.textContent.trim());
    ok(`${lang}: the verdict of a card does not depend on the button pressed`, verdict.length > 2);
    ok(`${lang}: no script error`, page.errors.length === 0, page.errors.join('; '));
    await page.close();
  }
}

if (want('nojs')) {
  for (const lang of LANGS) {
    const page = await open({ lang, js: false });
    const card = `[data-myth="${LIST[0].id}"]`;
    ok(`${lang}, no JavaScript: no buttons, the summary "Answer" is there`, !(await visible(page, `${card} [data-pick]`)) && (await visible(page, `${card} .myth__summary`)));
    ok(`${lang}, no JavaScript: the answer is closed`, !(await visible(page, `${card} [data-body]`)));
    await page.click(`${card} .myth__summary`);
    ok(`${lang}, no JavaScript: "Answer" opens it (verdict, text, story)`, (await visible(page, `${card} [data-body]`)) && (await visible(page, `${card} .verdict`)) && (await visible(page, `${card} .myth__story`)));
    ok(`${lang}, no JavaScript: Share is a plain link to the address of the card`, (await page.$eval(`${card} [data-share-link]`, (a) => a.getAttribute('href'))).endsWith(`/${lang}/${SEG[lang]}/${LIST[0].id}/`));
    await page.close();
  }
}

if (want('anchor')) {
  for (const lang of LANGS) {
    const target = LIST.at(-1);
    const page = await open({ lang, hash: `#${target.id}` });
    const state = await page.evaluate((id) => {
      const el = document.getElementById(id);
      const r = el.getBoundingClientRect();
      return { inView: r.top >= -2 && r.top < innerHeight, target: location.hash === `#${id}`, closed: !el.querySelector('[data-answer]').open, anchorLink: el.querySelector('.myth__anchor')?.getAttribute('href') };
    }, target.id);
    ok(`${lang}: the address with #id brings the card into view`, state.inView && state.target, JSON.stringify(state));
    ok(`${lang}: the answer of that card is closed`, state.closed);
    ok(`${lang}: every card has its link #id`, state.anchorLink === `#${target.id}`);
    await page.close();
  }
}

if (want('card')) {
  const m = LIST[2] ?? LIST[1];
  for (const lang of LANGS) {
    const page = await open({ lang, id: m.id });
    const info = await page.evaluate(() => {
      const meta = (a, n) => document.querySelector(`meta[${a}="${n}"]`)?.getAttribute('content');
      return {
        order: [...document.querySelectorAll('[data-myth]')].map((c) => c.dataset.myth),
        first: document.querySelector('[data-myth]')?.classList.contains('myth--first'),
        robots: meta('name', 'robots'),
        canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href'),
        ogUrl: meta('property', 'og:url'),
        ogTitle: meta('property', 'og:title'),
        ogDescription: meta('property', 'og:description'),
        ogImage: meta('property', 'og:image'),
        ogAlt: meta('property', 'og:image:alt'),
        hreflang: [...document.querySelectorAll('link[rel="alternate"][hreflang]')].map((l) => `${l.hreflang} ${l.getAttribute('href')}`),
        closed: [...document.querySelectorAll('[data-answer]')].every((d) => !d.open),
        jsonld: document.querySelectorAll('script[type="application/ld+json"]').length,
      };
    });
    ok(`${lang}: the card of the address is first, the others follow in order`, info.order[0] === m.id && info.order.slice(1).join() === LIST.filter((x) => x.id !== m.id).map((x) => x.id).join(), info.order.join());
    ok(`${lang}: it is marked`, info.first);
    ok(`${lang}: noindex, canonical to the page of all of them, og:url is its own address`, /noindex/.test(info.robots) && new URL(info.canonical).pathname === `/${lang}/${SEG[lang]}/` && new URL(info.ogUrl).pathname === `/${lang}/${SEG[lang]}/${m.id}/`, `${info.robots} ${info.canonical} ${info.ogUrl}`);
    const stmt = m.statement[lang].replace(/[.!?]+$/u, '');
    ok(`${lang}: og:title has the claim, og:description invites to the link`, info.ogTitle.endsWith(`: ${stmt}?`) && info.ogTitle.length > stmt.length && info.ogDescription.length > 10, `${info.ogTitle} | ${info.ogDescription}`);
    ok(`${lang}: its own picture (og-myths), the claim is its alt, no answer in the head`, /\/og-myths\/[a-z0-9-]+-[0-9a-f]{10}\.jpg$/.test(info.ogImage) && info.ogAlt === m.statement[lang] && !info.ogDescription.includes(m.answer[lang].slice(0, 20)), `${info.ogImage}`);
    ok(`${lang}: the answer is closed`, info.closed);
    ok(`${lang}: no structured data on the page of one card (it is noindex)`, info.jsonld === 0);
    ok(`${lang}: hreflang points to the same card in the other languages`, LANGS.every((l) => info.hreflang.some((h) => h.startsWith(`${l} `) && h.endsWith(`/${l}/${SEG[l]}/${m.id}/`))), info.hreflang.join(' '));
    await page.close();
  }
  // The page of all of them: indexable, its own canonical.
  const page = await open({ lang: 'ru' });
  const main = await page.evaluate(() => ({ robots: document.querySelector('meta[name="robots"]')?.getAttribute('content'), canonical: document.querySelector('link[rel="canonical"]').getAttribute('href'), jsonld: document.querySelectorAll('script[type="application/ld+json"]').length }));
  ok('the page of all of them is indexable, its canonical is itself, it has structured data', !main.robots && new URL(main.canonical).pathname === `/ru/${SEG.ru}/` && main.jsonld === 1, JSON.stringify(main));
  await page.close();
}

if (want('links')) {
  for (const lang of LANGS) {
    const page = await open({ lang });
    const hrefs = await page.$$eval('[data-myth]', (list) => list.map((c) => ({ id: c.dataset.myth, href: c.querySelector('.myth__story')?.getAttribute('href') })));
    ok(`${lang}: the link of every answer leads to the story in this language`, hrefs.every((h) => h.href === `/${lang}/${STORY_SEG[lang]}/${storyOf(LIST.find((m) => m.id === h.id)).slug[lang]}/`), hrefs.filter((h) => !h.href).map((h) => h.id).join());
    // And the page of that story exists.
    const status = await page.evaluate(async (url) => (await fetch(url)).status, hrefs[0].href);
    ok(`${lang}: the first of them opens`, status === 200, String(status));
    await page.close();
  }
}

if (want('layout')) {
  for (const lang of LANGS) {
    const page = await open({ lang, width: 360 });
    ok(`${lang} 360 px: no horizontal scroll`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.evaluate(() => document.querySelectorAll('[data-pick="myth"]').forEach((b) => b.click()));
    await wait(200);
    ok(`${lang} 360 px: no horizontal scroll with every answer open`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), String(await page.evaluate(() => document.documentElement.scrollWidth)));
    const small = await page.$$eval('.myth__button', (l) => l.filter((b) => b.getBoundingClientRect().height < 44).length);
    ok(`${lang} 360 px: the buttons are at least 44 px high`, small === 0);
    await page.close();
  }
}

await browser.close();
console.log(failed === 0 ? '\nAll "Myth or fact" checks passed' : `\n${failed} check(s) failed`);
process.exit(failed === 0 ? 0 : 1);

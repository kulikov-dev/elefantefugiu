// Browser checks for the epoch page: years on the scale, equal cards, compact feed, the view switch (shown from 9 stories),
// the labels "Timeline / Cards", the active card, the "more eras" dropdown (keyboard, without JavaScript, no dead links).
// Run against dist/ served by serve.mjs (base path "/"):   node epochpage.mjs [years cards switch active more]
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

const base = process.env.BASE_URL || 'http://localhost:4400';
const ONLY = process.argv.slice(2);
const want = (name) => ONLY.length === 0 || ONLY.includes(name);
const POMBAL = { pt: '/pt/epoca/pombal-e-terramoto/', en: '/en/era/pombal-and-the-earthquake/', ru: '/ru/epoha/pombal-zemletryasenie-begstvo-dvora/' };

let failed = 0;
const ok = (name, cond, extra = '') => {
  if (!cond) failed += 1;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
};
const browser = await puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: 'shell' });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const open = async (path, { width = 1280, height = 800, js = true } = {}) => {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  page.close = () => context.close();
  await page.setViewport({ width, height });
  if (!js) await page.setJavaScriptEnabled(false);
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  await page.goto(`${base}${path}`, { waitUntil: 'networkidle0' });
  return page;
};

// ---------- 1. Years on the scale ----------
if (want('years')) {
  for (const lang of ['pt', 'en', 'ru']) {
    const page = await open(POMBAL[lang]);
    const m = await page.evaluate(() => {
      const items = [...document.querySelectorAll('ol.feed > li')];
      const rows = items.map((li) => {
        const y = li.querySelector('.feed__year');
        const card = li.querySelector('.ecard');
        const ry = y.getBoundingClientRect();
        const rc = card.getBoundingClientRect();
        const cs = getComputedStyle(y);
        return { year: y.textContent.trim(), visible: y.checkVisibility(), left: ry.right <= rc.left, size: parseFloat(cs.fontSize), weight: Number(cs.fontWeight), meta: card.querySelector('.ecard__meta').innerText.replace(/\s+/g, ' ').trim() };
      });
      return { rows, vw: innerWidth, sw: document.documentElement.scrollWidth };
    });
    ok(`years (${lang}): every story has its year on the scale, left of the card, large (18 px or more) and bold`, m.rows.length > 0 && m.rows.every((r) => /^\d{4}$/.test(r.year) && r.visible && r.left && r.size >= 18 && r.weight >= 600), JSON.stringify(m.rows[0]));
    ok(`years (${lang}): the line of the card carries a full date only when the data has one, never a bare year beside the scale`, m.rows.every((r) => !new RegExp(`^${r.year}\\s*·`).test(r.meta)), m.rows.map((r) => r.meta).join(' | '));
    ok(`years (${lang}): no sideways scroll`, m.sw <= m.vw);
    await page.close();
  }
  const phone = await open(POMBAL.pt, { width: 320 });
  const p = await phone.evaluate(() => {
    const li = document.querySelector('ol.feed > li');
    const y = li.querySelector('.feed__year').getBoundingClientRect();
    const c = li.querySelector('.ecard').getBoundingClientRect();
    return { above: y.bottom <= c.top + 1, sw: document.documentElement.scrollWidth <= innerWidth };
  });
  ok('years (320 px): the year stands above the card, no sideways scroll', p.above && p.sw, JSON.stringify(p));
  await phone.close();
}

// ---------- 2. Cards of one size, compact ----------
if (want('cards')) {
  const page = await open(POMBAL.pt, { width: 1280, height: 800 });
  const c = await page.evaluate(() => {
    const titles = [...document.querySelectorAll('ol.feed .ecard__title')].map((t) => getComputedStyle(t).fontSize);
    const cards = [...document.querySelectorAll('ol.feed .ecard')].map((e) => e.getBoundingClientRect());
    const paddings = [...document.querySelectorAll('ol.feed .ecard')].map((e) => getComputedStyle(e).paddingTop + getComputedStyle(e).paddingLeft);
    const withoutHeavy = [...document.querySelectorAll('ol.feed > li')].filter((li) => !li.querySelector('.ecard__heavy')).map((li) => li.querySelector('.ecard').getBoundingClientRect().height);
    return { titles: [...new Set(titles)], paddings: [...new Set(paddings)], maxPlain: Math.max(...withoutHeavy) };
  });
  ok('cards: every title has the same size', c.titles.length === 1, c.titles.join(' '));
  ok('cards: the same padding on every card', c.paddings.length === 1, c.paddings.join(' '));
  ok('cards: a plain card (one line of hook, no heavy-topic pill) is at most 165 px tall, so 4-5 fit a 800 px screen', c.maxPlain <= 165, String(c.maxPlain));
  await page.close();
}

// ---------- 3. The view switch ----------
if (want('switch')) {
  for (const lang of ['pt', 'en', 'ru']) {
    const page = await open(`${POMBAL[lang]}?vista=grelha`);
    const s = await page.evaluate(() => ({
      switchHidden: document.querySelector('[data-view-switch]').hidden || !document.querySelector('[data-view-switch]').checkVisibility(),
      vista: document.documentElement.dataset.vista ?? null,
      cols: getComputedStyle(document.querySelector('ol.feed')).display,
    }));
    ok(`switch (${lang}): 8 stories are fewer than 9, so the switch is hidden and the timeline is shown even with ?vista=grelha`, s.switchHidden && s.vista === null && s.cols !== 'grid', JSON.stringify(s));
    const labels = await page.$$eval('[data-view-switch] button', (b) => b.map((x) => x.textContent.trim()));
    const want_ = { pt: ['Cronologia', 'Cartões'], en: ['Timeline', 'Cards'], ru: ['Хронология', 'Карточки'] }[lang];
    ok(`switch (${lang}): the labels are ${want_.join(' / ')}`, JSON.stringify(labels) === JSON.stringify(want_), labels.join(' / '));
    await page.close();
  }
}

// ---------- 4. The active card ----------
if (want('active')) {
  const page = await open(POMBAL.pt);
  await page.evaluate(() => document.querySelector('ol.feed > li:nth-child(2)').setAttribute('data-active', ''));
  const a = await page.evaluate(() => {
    const own = (li) => getComputedStyle(li.querySelector('.ecard'));
    const [first, second] = [...document.querySelectorAll('ol.feed > li')];
    return { active: own(second).boxShadow, other: own(first).boxShadow, titleA: getComputedStyle(second.querySelector('.ecard__title')).fontSize, titleO: getComputedStyle(first.querySelector('.ecard__title')).fontSize };
  });
  ok('active: the chosen card gets a coloured bar on its left edge and nothing else changes (the title keeps its size)', a.active !== 'none' && a.other === 'none' && a.titleA === a.titleO, JSON.stringify(a));
  await page.close();
}

// ---------- 5. "More eras" ----------
if (want('more')) {
  for (const js of [true, false]) {
    const page = await open(POMBAL.pt, { js });
    let focused = false;
    for (let i = 0; i < 40 && !focused; i += 1) {
      await page.keyboard.press('Tab');
      focused = await page.evaluate(() => document.activeElement?.matches('.epoch-switch__summary'));
    }
    await page.keyboard.press('Enter');
    const items = await page.$$eval('.epoch-switch__rest li', (lis) => lis.map((l) => ({ link: Boolean(l.querySelector('a')), visible: l.checkVisibility() })));
    ok(`more (${js ? 'with' : 'without'} JavaScript): the chip is reached with Tab and Enter opens the list`, focused && (await page.$eval('.epoch-switch__more', (d) => d.open)) && items.every((i) => i.visible));
    ok(`more (${js ? 'with' : 'without'} JavaScript): no item of the list is a link (all these epochs are not ready)`, items.length > 0 && items.every((i) => !i.link));
    await page.keyboard.press('Space');
    ok(`more (${js ? 'with' : 'without'} JavaScript): Space closes it again`, !(await page.$eval('.epoch-switch__more', (d) => d.open)));
    await page.close();
  }
}

await browser.close();
console.log(failed === 0 ? '\nAll epoch page checks passed' : `\n${failed} check(s) failed`);
process.exit(failed === 0 ? 0 : 1);

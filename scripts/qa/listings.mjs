// Browser checks for epoch and thread pages (stage 4a): feed, in-place expansion, Back button,
// thread links and counters, neighbouring epochs, keyboard, no-JS. Run against `dist/` served by serve.mjs.
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

const base = process.env.BASE_URL || 'http://localhost:4400';
const EPOCH = `${base}/pt/epoca/avis-e-descobrimentos/`;
const NEXT_EPOCH = `${base}/pt/epoca/pombal-e-terramoto/`;
const THREAD = `${base}/pt/fio/mar/`;
const FEED_IDS = ['01', '02', '03', '04', '05', '06', '07', '08'].map((n) => `evento-exemplo-${n}`);

let failed = 0;
const ok = (name, cond, extra = '') => {
  if (!cond) failed += 1;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: 'shell' });
const newPage = async () => {
  const page = await browser.newPage();
  await page.setViewport({ width: 360, height: 800 });
  return page;
};

// 1. Epoch page without JavaScript and without images
{
  const page = await newPage();
  await page.setJavaScriptEnabled(false);
  await page.setRequestInterception(true);
  page.on('request', (r) => (r.resourceType() === 'image' ? r.abort() : r.continue()));
  await page.goto(EPOCH, { waitUntil: 'load' });
  const s = await page.evaluate(() => {
    const vis = (el) => !!el && el.getBoundingClientRect().height > 0;
    return {
      cards: document.querySelectorAll('.feed > li').length,
      hooksVisible: [...document.querySelectorAll('.ecard__hook')].every(vis),
      titlesVisible: [...document.querySelectorAll('.ecard__title a')].every(vis),
      chips: document.querySelectorAll('.chips a.thread--link').length,
      h1: document.querySelector('h1')?.textContent.trim(),
      overflow: document.scrollingElement.scrollWidth - innerWidth,
      story: document.querySelector('details[data-ecard] .ecard__story').checkVisibility({ contentVisibilityAuto: true, visibilityProperty: true }),
      open: document.querySelector('details[data-ecard]').open,
    };
  });
  ok('no JS, no images: all 8 feed cards with hook and title visible', s.cards === 8 && s.hooksVisible && s.titlesVisible, `cards=${s.cards}`);
  ok('no JS: thread chips are links', s.chips === 5, `chips=${s.chips}`);
  ok('no JS: no horizontal overflow at 360px', s.overflow <= 0, `overflow=${s.overflow}`);
  ok('no JS: story layer closed by default (not rendered)', !s.story && !s.open);
  await page.click('details[data-ecard="evento-exemplo-02"] > summary');
  const openNoJs = await page.evaluate(() => document.querySelector('details[data-ecard="evento-exemplo-02"] .ecard__story').checkVisibility({ contentVisibilityAuto: true, visibilityProperty: true }));
  ok('no JS: native <details> opens the story in place', openNoJs);
  await page.close();
}

// 2. In-place expansion and the address hash
{
  const page = await newPage();
  await page.goto(EPOCH, { waitUntil: 'networkidle0' });
  const isOpen = (id) => page.evaluate((i) => document.querySelector(`details[data-ecard="${i}"]`).open, id);
  const path0 = await page.evaluate(() => location.pathname);
  await page.click('details[data-ecard="evento-exemplo-02"] > summary');
  await wait(100);
  ok('click opens the story in place (same page)', (await isOpen('evento-exemplo-02')) && (await page.evaluate(() => location.pathname)) === path0);
  ok('open card puts #c-<id> in the address', (await page.evaluate(() => location.hash)) === '#c-evento-exemplo-02');
  const hist = await page.evaluate(() => history.length);
  await page.click('details[data-ecard="evento-exemplo-03"] > summary');
  await wait(100);
  ok('opening another card does not add history entries', (await page.evaluate(() => history.length)) === hist);
  await page.click('details[data-ecard="evento-exemplo-03"] > summary');
  await wait(100);
  ok('closing the card removes its hash', (await page.evaluate(() => location.hash)) === '');
  await page.goto(`${EPOCH}#c-evento-exemplo-05`, { waitUntil: 'networkidle0' });
  ok('a link with #c-<id> opens that card on load', (await isOpen('evento-exemplo-05')) && !(await isOpen('evento-exemplo-04')));
  await page.close();
}

// 3. Back button returns to the same place in the feed
{
  const page = await newPage();
  await page.goto(`${EPOCH}#c-evento-exemplo-05`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => window.scrollBy(0, 150));
  await wait(200);
  const before = await page.evaluate(() => Math.round(scrollY));
  await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), page.$eval('#c-evento-exemplo-05 .ecard__title a', (a) => a.click())]);
  ok('card title link opens the card page', (await page.evaluate(() => location.pathname)).includes('/historia/'));
  await page.goBack({ waitUntil: 'load' });
  await wait(500);
  const after = await page.evaluate(() => Math.round(scrollY));
  const stillOpen = await page.evaluate(() => document.querySelector('details[data-ecard="evento-exemplo-05"]').open);
  ok('Back returns to the same scroll position', Math.abs(after - before) <= 8 && before > 300, `before=${before} after=${after}`);
  ok('Back keeps the opened card open', stillOpen);
  await page.close();
}

// 4. Counters and links: epoch page -> thread page
{
  const page = await newPage();
  await page.goto(EPOCH, { waitUntil: 'networkidle0' });
  const chips = await page.$$eval('.chips a.thread--link', (as) =>
    as.map((a) => ({ href: a.getAttribute('href'), count: Number(a.querySelector('.thread__count')?.textContent), label: a.textContent.replace(/\s+/g, ' ').trim() })),
  );
  const target = chips.find((c) => c.href.includes('/fio/mar/'));
  await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), page.click(`.chips a.thread--link[href="${target.href}"]`)]);
  await wait(300);
  const landed = await page.evaluate(() => {
    const section = document.getElementById(location.hash.slice(1));
    const top = section?.getBoundingClientRect().top;
    return { path: location.pathname, hash: location.hash, tiles: section?.querySelectorAll('.ecard').length, top, vh: innerHeight };
  });
  ok('chip leads to the thread page at this epoch\'s section', landed.path === '/pt/fio/mar/' && landed.hash === '#e-avis-e-descobrimentos');
  ok('chip counter equals the number of tiles in that section', landed.tiles === target.count, `counter=${target.count} tiles=${landed.tiles}`);
  ok('the section is in view after the jump', landed.top >= -2 && landed.top < landed.vh / 2, `top=${Math.round(landed.top)}`);
  await page.close();
}

// 5. Thread page: grid, epoch chips, links
{
  const page = await newPage();
  await page.goto(THREAD, { waitUntil: 'networkidle0' });
  const s = await page.evaluate(() => ({
    h1: document.querySelector('h1').textContent.trim(),
    details: document.querySelectorAll('details').length,
    sections: document.querySelectorAll('section.section').length,
    chips: [...document.querySelectorAll('a.chip')].map((a) => ({ n: Number(a.querySelector('.chip__count').textContent), id: a.getAttribute('href').slice(1) })),
    overflow: document.scrollingElement.scrollWidth - innerWidth,
    columnsAt360: getComputedStyle(document.querySelector('.grid')).gridTemplateColumns.split(' ').length,
  }));
  ok('thread page: name, no expandable feed cards, no horizontal overflow', s.h1 === 'Mar' && s.details === 0 && s.overflow <= 0);
  ok('thread page: one section per epoch with cards', s.sections === s.chips.length && s.sections === 3, `sections=${s.sections}`);
  ok('thread page: one column of tiles at 360px', s.columnsAt360 === 1);
  const second = s.chips[1];
  await page.click(`a.chip[href="#${second.id}"]`);
  await wait(300);
  const inView = await page.evaluate((id) => {
    const t = document.getElementById(id).getBoundingClientRect().top;
    return { hash: location.hash, top: t, tiles: document.getElementById(id).querySelectorAll('.ecard').length };
  }, second.id);
  ok('epoch chip jumps to its section; counter equals tiles', inView.hash === `#${second.id}` && inView.top < 400 && inView.tiles === second.n, JSON.stringify(inView));
  await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), page.click(`#${second.id} .ecard__title a`)]);
  ok('a tile leads to the card page', (await page.evaluate(() => location.pathname)).includes('/historia/'));
  await page.close();
}

// 6. Neighbouring epochs, card page links
{
  const page = await newPage();
  await page.goto(EPOCH, { waitUntil: 'networkidle0' });
  const hasPrev = await page.$('nav.pager a[rel="prev"]');
  ok('first epoch has no "back" link', hasPrev === null);
  await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), page.click('nav.pager a[rel="next"]')]);
  ok('"next" leads to the next epoch page', page.url() === NEXT_EPOCH);
  const prevHref = await page.$eval('nav.pager a[rel="prev"]', (a) => a.getAttribute('href'));
  ok('the next epoch links back', prevHref === '/pt/epoca/avis-e-descobrimentos/');
  await page.goto(`${base}/pt/historia/evento-exemplo-02/`, { waitUntil: 'networkidle0' });
  const links = await page.evaluate(() => ({
    crumb: document.querySelector('.crumbs a')?.getAttribute('href'),
    threads: [...document.querySelectorAll('a.thread--link')].map((a) => a.getAttribute('href')),
  }));
  ok('card page: epoch crumb leads to the epoch page', links.crumb === '/pt/epoca/avis-e-descobrimentos/', links.crumb);
  ok('card page: thread chips lead to thread pages', links.threads.length >= 1 && links.threads.every((h) => /^\/pt\/fio\/[^/]+\/$/.test(h)), links.threads.join(' '));
  await page.close();
}

// 7. Language switch keeps epoch and thread pages
{
  const page = await newPage();
  for (const [url, expected] of [[EPOCH, '/en/era/avis-and-the-discoveries/'], [THREAD, '/en/thread/sea/']]) {
    await page.goto(url, { waitUntil: 'networkidle0' });
    const href = await page.$eval('.lang-switch a[hreflang="en"]', (a) => a.getAttribute('href'));
    ok(`language switch on ${new URL(url).pathname} leads to ${expected}`, href === expected, href);
  }
  await page.close();
}

// 8. Keyboard on the epoch page
{
  const page = await newPage();
  await page.goto(EPOCH, { waitUntil: 'networkidle0' });
  const seen = [];
  const bad = [];
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName.toLowerCase(),
        name: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30),
        outline: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2,
        w: r.width,
        h: r.height,
      };
    });
    if (!info) break;
    seen.push(info);
    if (!info.outline) bad.push(`${info.tag} "${info.name}": no focus outline`);
    if (info.h === 0 || info.w === 0) bad.push(`${info.tag} "${info.name}": hidden element has focus`);
    if (seen.length > 1 && seen.at(-1).name === seen[0].name && seen.at(-1).tag === seen[0].tag) break;
  }
  const firstThreadChip = seen.findIndex((s) => s.tag === 'a' && /\d/.test(s.name));
  const firstSummary = seen.findIndex((s) => s.tag === 'summary');
  ok('keyboard: thread chips come before the feed in tab order', firstThreadChip >= 0 && firstSummary > firstThreadChip);
  ok('keyboard: every stop has a visible outline and is visible', bad.length === 0, bad.join('; '));
  await page.focus('details[data-ecard="evento-exemplo-01"] > summary');
  await page.keyboard.press('Enter');
  const afterEnter = await page.evaluate(() => document.querySelector('details[data-ecard="evento-exemplo-01"]').open);
  await page.keyboard.press('Space');
  const afterSpace = await page.evaluate(() => document.querySelector('details[data-ecard="evento-exemplo-01"]').open);
  ok('keyboard: Enter opens and Space closes a card in the feed', afterEnter === true && afterSpace === false);
  await page.close();
}

await browser.close();
console.log(failed ? `${failed} check(s) failed` : 'All listing checks passed');
process.exit(failed ? 1 : 0);

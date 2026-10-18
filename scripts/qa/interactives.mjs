// Browser checks for stage 7a: the interactives "1 against 5" (ArmyDots) and "Size of the nau" (ShipScale).
// Run against dist/ served by serve.mjs; the section "family" also needs the variant build (prepare-variant.mjs):
//   node interactives.mjs                          every section except "family"
//   VARIANT_URL=http://localhost:4401 node interactives.mjs family
// Expected values come from src/content/events/*.yaml.
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { createRequire } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { parse } = require('../../node_modules/yaml');
const root = new URL('../../', import.meta.url).pathname;
const base = process.env.BASE_URL || 'http://localhost:4400';
const variantBase = process.env.VARIANT_URL || 'http://localhost:4401';
const ONLY = process.argv.slice(2);
const want = (name) => ONLY.length === 0 ? name !== 'family' : ONLY.includes(name);

const events = readdirSync(join(root, 'src/content/events')).map((n) => parse(readFileSync(join(root, 'src/content/events', n), 'utf8'), { schema: 'core', customTags: ['timestamp'] }));
const dotsCard = events.find((e) => e.interactive?.type === 'army_dots');
const shipCard = events.find((e) => e.interactive?.type === 'ship_scale');
const plainCard = events.find((e) => !e.interactive && e.status === 'ready');
const SEG = { pt: 'historia', en: 'story' };
const url = (b, lang, e, hash = '#detalhes') => `${b}/${lang}/${SEG[lang]}/${e.slug[lang]}/${hash}`;
// Same call as formatNumber in src/lib/viz.ts (useGrouping: true gives "1 000" in Portuguese too).
const nf = (n, lang) => new Intl.NumberFormat(lang === 'pt' ? 'pt-PT' : 'en', { maximumFractionDigits: 1, useGrouping: true }).format(n);
const norm = (s) => String(s).replace(/[\s\u00a0\u202f]+/g, ' ').trim();

let failed = 0;
const ok = (name, cond, extra = '') => {
  if (!cond) failed += 1;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
};
const browser = await puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: 'shell' });
const newPage = async ({ js = true, reduce = false, width = 360, mode = null } = {}) => {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 900, isMobile: width < 700, hasTouch: width < 700 });
  if (!js) await page.setJavaScriptEnabled(false);
  if (reduce) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  if (mode) await page.evaluateOnNewDocument((m) => localStorage.setItem('family', m), mode);
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  return page;
};
const vis = `(el) => !!el && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden' && el.getClientRects().length > 0`;
const isVisible = (page, sel) => page.evaluate((s, v) => eval(v)(document.querySelector(s)), sel, vis);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
/** Scrolls the element into view at once (the address hash may still be scrolling smoothly) and clicks it. */
const tap = async (page, selector) => {
  await page.waitForSelector(selector);
  await page.$eval(selector, (el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await wait(350);
  await page.click(selector);
};

/** Tab until the focused element matches; returns false when it is not reached. */
async function tabTo(page, selector, max = 120) {
  for (let i = 0; i < max; i += 1) {
    await page.keyboard.press('Tab');
    if (await page.evaluate((s) => document.activeElement?.matches(s), selector)) return true;
  }
  return false;
}
const outline = (page) => page.evaluate(() => {
  const el = document.activeElement;
  const target = el.matches('input') ? el.nextElementSibling : el;
  const c = getComputedStyle(target);
  return { style: c.outlineStyle, width: parseFloat(c.outlineWidth) };
});

// ---------- 1. Keyboard ----------
if (want('keyboard')) {
  for (const lang of ['pt', 'en']) {
    const page = await newPage();
    await page.goto(url(base, lang, dotsCard), { waitUntil: 'load' });
    const reached = await tabTo(page, '[data-viz-play]');
    ok(`dots (${lang}): the "Show one by one" button is reached with Tab`, reached);
    if (reached) {
      const o = await outline(page);
      ok(`dots (${lang}): the focused button has a visible outline`, o.style !== 'none' && o.width >= 2, JSON.stringify(o));
      await page.keyboard.press('Enter');
      await wait(150);
      const during = await page.evaluate(() => ({ waiting: document.querySelectorAll('.dot--waiting').length, disabled: document.querySelector('[data-viz-play]').disabled }));
      ok(`dots (${lang}): Enter starts the animation (dots wait, button is busy)`, during.waiting > 0 && during.disabled, JSON.stringify(during));
      await page.waitForFunction(() => document.querySelectorAll('.dot--waiting').length === 0 && !document.querySelector('[data-viz-play]').disabled, { timeout: 8000 });
      const label = await page.evaluate(() => document.querySelector('[data-viz-play]').textContent);
      ok(`dots (${lang}): all dots are shown again, the button is back and keeps focus`, (await page.evaluate(() => document.activeElement?.matches('[data-viz-play]'))) && label.length > 0, label);
      // Space works too
      await page.keyboard.press('Space');
      await wait(150);
      ok(`dots (${lang}): Space starts it too`, (await page.evaluate(() => document.querySelectorAll('.dot--waiting').length)) > 0);
      await page.waitForFunction(() => document.querySelectorAll('.dot--waiting').length === 0, { timeout: 8000 });
    }
    ok(`dots (${lang}): no script errors`, page.errors.length === 0, page.errors.join('; '));
    await page.close();

    const ships = await newPage();
    await ships.goto(url(base, lang, shipCard), { waitUntil: 'load' });
    const got = await tabTo(ships, '[data-viz-switch] input');
    ok(`ships (${lang}): the switch is reached with Tab (one tab stop)`, got);
    if (got) {
      const o = await outline(ships);
      ok(`ships (${lang}): the focused option has a visible outline`, o.style !== 'none' && o.width >= 2, JSON.stringify(o));
      const start = await ships.evaluate((v) => ({ mode: document.querySelector('[data-viz-ships]').dataset.mode, stack: eval(v)(document.querySelector('.viz__svg--stack')), overlay: eval(v)(document.querySelector('.viz__svg--overlay')) }), vis);
      ok(`ships (${lang}): starts side by side`, start.mode === 'stack' && start.stack && !start.overlay);
      await ships.keyboard.press('ArrowRight');
      const next = await ships.evaluate((v) => ({ mode: document.querySelector('[data-viz-ships]').dataset.mode, stack: eval(v)(document.querySelector('.viz__svg--stack')), overlay: eval(v)(document.querySelector('.viz__svg--overlay')) }), vis);
      ok(`ships (${lang}): the right arrow switches to overlaid`, next.mode === 'overlay' && !next.stack && next.overlay);
      await ships.keyboard.press('ArrowLeft');
      ok(`ships (${lang}): the left arrow goes back`, (await ships.evaluate(() => document.querySelector('[data-viz-ships]').dataset.mode)) === 'stack');
      await ships.keyboard.press('Tab');
      ok(`ships (${lang}): Tab leaves the group in one step (a radio group is one tab stop)`, !(await ships.evaluate(() => document.activeElement?.matches('[data-viz-switch] input'))));
    }
    ok(`ships (${lang}): no script errors`, ships.errors.length === 0, ships.errors.join('; '));
    // Touch target of the switch (a thumb on a phone)
    const h = await ships.evaluate(() => Math.round(document.querySelector('.viz__option span').getBoundingClientRect().height));
    ok(`ships (${lang}): the switch options are at least 48 px tall`, h >= 48, String(h));
    await ships.close();
  }
}

// ---------- 2. The text alternative matches the data ----------
if (want('text')) {
  for (const lang of ['pt', 'en']) {
    const page = await newPage();
    await page.goto(url(base, lang, dotsCard), { waitUntil: 'load' });
    const d = dotsCard.interactive.data;
    const got = await page.evaluate(() => ({
      title: document.querySelector('#viz-svg-title').textContent,
      desc: document.querySelector('#viz-svg-desc').textContent,
      role: document.querySelector('.viz__svg').getAttribute('role'),
      labelledby: document.querySelector('.viz__svg').getAttribute('aria-labelledby'),
      rows: [...document.querySelectorAll('.viz__table tbody tr')].map((tr) => ({ id: tr.dataset.group, min: Number(tr.dataset.min), max: Number(tr.dataset.max), cells: [...tr.children].map((c) => c.textContent.replace(/\s+/g, ' ').trim()) })),
      dots: [...document.querySelectorAll('.viz__svg g[data-group]')].map((g) => ({ id: g.dataset.group, solid: g.querySelectorAll('.dot--solid').length, range: g.querySelectorAll('.dot--range').length })),
      estimate: document.querySelector('.viz__estimate').textContent,
      caption: document.querySelector('.viz figcaption').textContent,
      ratio: document.querySelector('.viz__ratio').textContent,
      scale: document.querySelector('.viz__scale').textContent,
    }));
    ok(`dots (${lang}): the drawing is an image with a title and a description`, got.role === 'img' && got.labelledby === 'viz-svg-title viz-svg-desc' && got.desc.length > 40);
    ok(`dots (${lang}): the caption and the "by historians' estimates" line come from the data`, norm(got.caption) === norm(d.caption[lang]) && norm(got.estimate) === norm(d.estimate_note[lang]) && norm(got.desc).includes(norm(d.estimate_note[lang])));
    const rowsOk = d.groups.every((g, i) => got.rows[i]?.id === g.id && got.rows[i].min === g.min && got.rows[i].max === g.max && norm(got.rows[i].cells[0]) === norm(g.label[lang]) && norm(got.rows[i].cells[1]).includes(norm(nf(g.min, lang))) && norm(got.rows[i].cells[1]).includes(norm(nf(g.max, lang))) && norm(got.rows[i].cells[2]) === norm(g.note[lang]));
    ok(`dots (${lang}): the table holds every group with its label, the range and the note`, rowsOk && got.rows.length === d.groups.length, JSON.stringify(got.rows.map((r) => r.cells[1])));
    const descOk = d.groups.every((g) => norm(got.desc).includes(norm(g.label[lang])) && norm(got.desc).includes(norm(nf(g.min, lang))) && norm(got.desc).includes(norm(nf(g.max, lang))));
    ok(`dots (${lang}): the description names every group and its range`, descOk);
    const dotsOk = d.groups.every((g, i) => {
      const total = Math.max(1, Math.round(g.max / g.unit_per_dot));
      const solid = Math.min(total, Math.round(g.min / g.unit_per_dot));
      return got.dots[i]?.solid === solid && got.dots[i]?.range === total - solid;
    });
    ok(`dots (${lang}): dot counts follow the data (one dot = ${d.groups[0].unit_per_dot}; filled to min, empty to max)`, dotsOk, JSON.stringify(got.dots));
    ok(`dots (${lang}): the scale sentence names the people per dot and the ratio is in words`, norm(got.scale).includes(norm(nf(d.groups[0].unit_per_dot, lang))) && /\d/.test(got.ratio) && d.groups.every((g) => got.ratio.includes(g.label[lang])), got.ratio);
    ok(`dots (${lang}): the card says the numbers are test numbers`, await page.evaluate(() => /teste|test/i.test(document.querySelector('.viz__test')?.textContent ?? '')));
    // all dots are in one scale: the same radius
    ok(`dots (${lang}): one scale, one dot size`, await page.evaluate(() => new Set([...document.querySelectorAll('.dot')].map((c) => c.getAttribute('r'))).size === 1));
    await page.close();

    const sp = await newPage();
    await sp.goto(url(base, lang, shipCard), { waitUntil: 'load' });
    const s = shipCard.interactive.data;
    const sg = await sp.evaluate(() => ({
      desc: document.querySelector('#viz-stack-desc').textContent,
      labels: [...document.querySelectorAll('.viz__svg--stack .ship__label')].map((t) => t.textContent),
      rows: [...document.querySelectorAll('.viz__table tbody tr')].map((tr) => ({ id: tr.dataset.item, length: Number(tr.dataset.length), height: tr.dataset.height, cells: [...tr.children].map((c) => c.textContent.replace(/\s+/g, ' ').trim()) })),
      widths: [...document.querySelectorAll('.viz__svg--stack .ship__hull')].map((p) => p.getBBox().width),
      ratio: document.querySelector('.viz__ratio').textContent,
      titles: ['viz-stack-title', 'viz-overlay-title'].map((i) => document.getElementById(i)?.textContent),
    }));
    const tableOk = s.items.every((it, i) => sg.rows[i]?.id === it.id && sg.rows[i].length === it.length_m && norm(sg.rows[i].cells[0]) === norm(it.label[lang]) && norm(sg.rows[i].cells[1]) === norm(nf(it.length_m, lang)) && norm(sg.rows[i].cells[2]) === (it.height_m === undefined ? '' : norm(nf(it.height_m, lang))));
    ok(`ships (${lang}): the table holds every ship with its length and height in metres`, tableOk && sg.rows.length === s.items.length, JSON.stringify(sg.rows.map((r) => r.cells.slice(1))));
    ok(`ships (${lang}): labels on the drawing give the length in metres`, s.items.every((it, i) => sg.labels[i] === `${it.label[lang]}, ${nf(it.length_m, lang)} m`), sg.labels.join(' | '));
    ok(`ships (${lang}): the description names every ship with its size and compares them in words`, s.items.every((it) => norm(sg.desc).includes(norm(it.label[lang])) && norm(sg.desc).includes(norm(nf(it.length_m, lang)))) && /\d/.test(sg.ratio), sg.ratio);
    await sp.waitForSelector('[data-viz-switch]:not([hidden])');
    await tap(sp, '.viz__option:nth-child(2)');
    sg.overlayWidths = await sp.evaluate(() => [...document.querySelectorAll('.viz__svg--overlay .ship__hull')].map((p) => p.getBBox().width));
    const k = sg.widths[sg.widths.length - 1] / sg.widths[0];
    const want = s.items[s.items.length - 1].length_m / s.items[0].length_m;
    ok(`ships (${lang}): silhouettes are in one scale (width ratio ${k.toFixed(2)} = length ratio ${want.toFixed(2)}), in both views`, Math.abs(k - want) < 0.05 && Math.abs(sg.overlayWidths[1] / sg.overlayWidths[0] - want) < 0.05, JSON.stringify(sg.overlayWidths));
    ok(`ships (${lang}): both drawings have a title`, sg.titles.every((x) => x && x.length > 5));
    await sp.close();
  }
}

// ---------- 2b. Not told apart by colour alone ----------
if (want('color')) {
  for (const lang of ['pt', 'en']) {
    const d = dotsCard.interactive.data;
    const page = await newPage();
    await page.goto(url(base, lang, dotsCard), { waitUntil: 'load' });
    const g = await page.evaluate(() => ({
      groups: [...document.querySelectorAll('.viz__svg g[data-group]')].map((el) => {
        const ys = [...el.querySelectorAll('.dot')].map((c) => Number(c.getAttribute('cy')));
        return { id: el.dataset.group, label: el.querySelector('.dots__label')?.textContent ?? '', labelY: Number(el.querySelector('.dots__label')?.getAttribute('y')), from: Math.min(...ys), to: Math.max(...ys) };
      }),
      solid: (() => { const c = getComputedStyle(document.querySelector('.dot--solid')); return { fill: c.fill, stroke: c.stroke }; })(),
      range: (() => { const c = getComputedStyle(document.querySelector('.dot--range')); return { fill: c.fill, stroke: c.stroke, width: c.strokeWidth }; })(),
    }));
    const nfx = (n) => new Intl.NumberFormat(lang === 'pt' ? 'pt-PT' : 'en', { maximumFractionDigits: 1, useGrouping: true }).format(n);
    ok(`dots (${lang}): every group is named inside the drawing, with its range`, d.groups.every((grp, i) => norm(g.groups[i].label).includes(norm(grp.label[lang])) && norm(g.groups[i].label).includes(norm(nfx(grp.min))) && norm(g.groups[i].label).includes(norm(nfx(grp.max)))), g.groups.map((x) => x.label).join(' | '));
    ok(`dots (${lang}): the groups sit in separate bands, each under its own name (position, not colour, tells them apart)`, g.groups.every((x, i) => x.labelY < x.from && (i === 0 || g.groups[i - 1].to < x.labelY)), JSON.stringify(g.groups.map((x) => [x.labelY, x.from, x.to])));
    ok(`dots (${lang}): filled and empty dots differ in form (fill versus outline only)`, g.solid.fill !== 'none' && g.solid.stroke === 'none' && g.range.fill === 'none' && g.range.stroke !== 'none' && parseFloat(g.range.width) >= 1, JSON.stringify([g.solid, g.range]));
    // greyscale: take colour away and the text and position still carry the meaning
    await page.addStyleTag({ content: 'html { filter: grayscale(1); }' });
    ok(`dots (${lang}): in greyscale the labels are still there`, await page.evaluate(() => document.querySelectorAll('.dots__label').length === 2));
    await page.close();

    const s = shipCard.interactive.data;
    const ship = await newPage();
    await ship.goto(url(base, lang, shipCard), { waitUntil: 'load' });
    await tap(ship, '.viz__option:nth-child(2)');
    const o = await ship.evaluate(() => ({
      keys: [...document.querySelectorAll('.viz__svg--overlay .ship__key')].map((k) => ({ text: k.querySelector('text').textContent, dash: k.querySelector('line').getAttribute('stroke-dasharray') ?? 'solid' })),
      hulls: [...document.querySelectorAll('.viz__svg--overlay .ship__hull')].map((h) => h.getAttribute('stroke-dasharray') ?? 'solid'),
    }));
    ok(`ships (${lang}): the overlaid view has a legend with every ship and its length in metres`, s.items.every((it, i) => o.keys[i]?.text === `${it.label[lang]}, ${nf(it.length_m, lang)} m`), JSON.stringify(o.keys));
    ok(`ships (${lang}): overlaid outlines differ by line pattern, and the legend repeats each pattern`, new Set(o.hulls).size === o.hulls.length && o.hulls.every((h, i) => h === o.keys[i].dash), JSON.stringify(o.hulls));
    await ship.close();
  }
}

// ---------- 3. Reduced motion ----------
if (want('motion')) {
  const calm = await newPage({ reduce: true });
  await calm.goto(url(base, 'pt', dotsCard), { waitUntil: 'load' });
  const c = await calm.evaluate((v) => ({ button: eval(v)(document.querySelector('[data-viz-play]')), hidden: document.querySelector('[data-viz-play]').hidden, waiting: document.querySelectorAll('.dot--waiting').length, dots: document.querySelectorAll('.dot').length, visibleDots: [...document.querySelectorAll('.dot')].filter((d) => getComputedStyle(d).opacity === '1').length, transition: getComputedStyle(document.querySelector('.dot')).transitionDuration }), vis);
  ok('prefers-reduced-motion: no "Show one by one" button, every dot shown at once, no transition', !c.button && c.hidden && c.waiting === 0 && c.visibleDots === c.dots && parseFloat(c.transition) <= 0.001, JSON.stringify(c));
  // a click on a hidden button is impossible; calling it by script does nothing either
  await calm.evaluate(() => document.querySelector('[data-viz-play]').click());
  await wait(200);
  ok('prefers-reduced-motion: a script click does not start anything', (await calm.evaluate(() => document.querySelectorAll('.dot--waiting').length)) === 0);
  // switching to reduced motion while the animation runs shows everything
  const live = await newPage();
  await live.goto(url(base, 'pt', dotsCard), { waitUntil: 'load' });
  ok('normal motion: the button is shown and nothing is animated at load', (await isVisible(live, '[data-viz-play]')) && (await live.evaluate(() => document.querySelectorAll('.dot--waiting').length)) === 0);
  await live.waitForSelector('[data-viz-play]:not([hidden])');
  await tap(live, '[data-viz-play]');
  await wait(100);
  await live.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await wait(300);
  const sw = await live.evaluate((v) => ({ waiting: document.querySelectorAll('.dot--waiting').length, button: eval(v)(document.querySelector('[data-viz-play]')) }), vis);
  ok('the setting changes while the animation runs: the dots are all shown and the button goes away', sw.waiting === 0 && !sw.button, JSON.stringify(sw));
  const ship = await newPage({ reduce: true });
  await ship.goto(url(base, 'pt', shipCard), { waitUntil: 'load' });
  ok('prefers-reduced-motion: the ship switch still works (it has no animation)', await (async () => {
    await ship.waitForSelector('[data-viz-switch]:not([hidden])');
    await tap(ship, '.viz__option:nth-child(2)');
    return (await ship.evaluate(() => document.querySelector('[data-viz-ships]').dataset.mode)) === 'overlay';
  })());
  await calm.close(); await live.close(); await ship.close();
}

// ---------- 4. No JavaScript ----------
if (want('nojs')) {
  for (const [name, card] of [['dots', dotsCard], ['ships', shipCard]]) {
    const page = await newPage({ js: false });
    await page.goto(url(base, 'pt', card), { waitUntil: 'load' });
    const n = await page.evaluate((v) => {
      const isVisible = eval(v);
      return {
        svg: [...document.querySelectorAll('.viz__svg')].filter(isVisible).length,
        table: isVisible(document.querySelector('.viz__table')),
        button: isVisible(document.querySelector('[data-viz-play]')),
        switcher: isVisible(document.querySelector('[data-viz-switch]')),
        waiting: document.querySelectorAll('.dot--waiting').length,
        dots: [...document.querySelectorAll('.dot')].filter(isVisible).length,
        total: document.querySelectorAll('.dot').length,
        details: document.querySelector('#detalhes') !== null,
        caption: document.querySelector('.viz figcaption')?.textContent.length > 0,
      };
    }, vis);
    // <details> is closed without JS unless the address opens it: open it as a reader would
    await page.evaluate(() => { document.querySelector('#detalhes').open = true; });
    const after = await page.evaluate((v) => ({ svg: [...document.querySelectorAll('.viz__svg')].filter(eval(v)).length, table: eval(v)(document.querySelector('.viz__table')) }), vis);
    ok(`no JavaScript (${name}): the static drawing and the table are shown, no button or switch`, after.svg === 1 && after.table && !n.button && !n.switcher && n.waiting === 0 && n.dots === n.total && n.caption, JSON.stringify({ ...n, ...after }));
    await page.close();
  }
}

// ---------- 5. Pages without an interactive do not get its code ----------
if (want('code')) {
  const stages = ['pt', 'en'];
  let bad = [];
  let withCount = 0;
  for (const e of events.filter((x) => x.status === 'ready')) {
    for (const lang of stages) {
      const html = await (await fetch(url(base, lang, e, ''))).text();
      const carries = /data-viz-|\.viz__svg|class="viz"/.test(html);
      if (carries !== Boolean(e.interactive)) bad.push(`${lang}/${e.id}`);
      if (carries) withCount += 1;
    }
  }
  ok(`only the ${withCount} pages of cards with an interactive carry its markup, script or styles (all card pages, both languages)`, bad.length === 0 && withCount === 2 * events.filter((x) => x.interactive && x.status === 'ready').length, bad.join(', '));
  // Other pages: home, epoch, thread, map
  const others = ['/pt/', '/en/', '/pt/mapa/', '/pt/epoca/avis-e-descobrimentos/', '/pt/fio/mar/'];
  const leaks = [];
  for (const o of others) {
    const html = await (await fetch(base + o)).text();
    if (/data-viz-|\.viz__svg|class="viz"/.test(html)) leaks.push(o);
  }
  ok('home, epoch, thread and map pages carry nothing of the interactives', leaks.length === 0, leaks.join(', '));
  // In the browser: no shared stylesheet holds the rules, the card without an interactive loads no such script or CSS
  const page = await newPage();
  const requests = [];
  page.on('request', (r) => requests.push(r.url()));
  await page.goto(url(base, 'pt', plainCard, ''), { waitUntil: 'load' });
  const css = await page.evaluate(() => [...document.styleSheets].flatMap((s) => { try { return [...s.cssRules].map((r) => r.cssText); } catch { return []; } }).filter((t) => /\.viz__|\.dot--/.test(t)).length);
  ok('a card without an interactive: no stylesheet rule of the interactives is loaded, no extra request', css === 0 && requests.filter((u) => /viz|army|ship/i.test(u)).length === 0);
  await page.close();
  const withIt = await newPage();
  await withIt.goto(url(base, 'pt', dotsCard, ''), { waitUntil: 'load' });
  ok('a card with an interactive: its rules are there', (await withIt.evaluate(() => [...document.styleSheets].flatMap((s) => [...s.cssRules].map((r) => r.cssText)).filter((t) => /\.viz__svg/.test(t)).length)) > 0);
  await withIt.close();
}

// ---------- 6. Family modes do not break cards with an interactive ----------
if (want('modes')) {
  for (const mode of ['off', 'all', '12']) {
    for (const [name, card] of [['dots', dotsCard], ['ships', shipCard]]) {
      const page = await newPage({ mode });
      await page.goto(url(base, 'pt', card), { waitUntil: 'load' });
      const shown = await page.evaluate((v) => ({ viz: eval(v)(document.querySelector('.viz')), gate: eval(v)(document.querySelector('.gate')), mode: document.documentElement.dataset.family }), vis);
      ok(`mode ${mode}: the card with ${name} shows its interactive (all-ages card), no screen`, shown.viz && !shown.gate && shown.mode === mode);
      if (name === 'ships') {
        await page.waitForSelector('[data-viz-switch]:not([hidden])');
        await tap(page, '.viz__option:nth-child(2)');
        ok(`mode ${mode}: the ship switch works`, (await page.evaluate(() => document.querySelector('[data-viz-ships]').dataset.mode)) === 'overlay');
      } else {
        await page.waitForSelector('[data-viz-play]:not([hidden])');
        await tap(page, '[data-viz-play]');
        await page.waitForFunction(() => document.querySelectorAll('.dot--waiting').length === 0 && !document.querySelector('[data-viz-play]').disabled, { timeout: 8000 });
        ok(`mode ${mode}: the dots animation runs and ends`, true);
      }
      ok(`mode ${mode}: no script errors`, page.errors.length === 0, page.errors.join('; '));
      await page.close();
    }
  }
}

// ---------- 7. The variant build: the same cards are 12+, mode "all" hides them behind the screen ----------
if (want('family')) {
  for (const [name, card, play] of [['dots', dotsCard, '[data-viz-play]'], ['ships', shipCard, '.viz__option:nth-child(2)']]) {
    const page = await newPage({ mode: 'all' });
    await page.goto(url(variantBase, 'pt', card), { waitUntil: 'load' });
    const before = await page.evaluate((v) => ({ gate: eval(v)(document.querySelector('.gate')), viz: eval(v)(document.querySelector('.viz')) }), vis);
    ok(`variant, mode all: a 12+ card with ${name} shows the screen and hides the interactive (it stays in the HTML)`, before.gate && !before.viz && (await page.evaluate(() => document.querySelector('.viz') !== null)));
    await tap(page, '[data-gate-open]');
    await wait(150);
    const opened = await page.evaluate((v) => ({ viz: eval(v)(document.querySelector('.viz')), mode: document.documentElement.dataset.family }), vis);
    ok(`variant, mode all: after "Open" the ${name} interactive is shown and the mode is unchanged`, opened.viz && opened.mode === 'all');
    await page.waitForSelector(play + ':not([hidden])');
    await tap(page, play);
    if (name === 'dots') await page.waitForFunction(() => document.querySelectorAll('.dot--waiting').length === 0 && !document.querySelector('[data-viz-play]').disabled, { timeout: 8000 });
    ok(`variant, mode all: after "Open" the ${name} interactive works`, name === 'dots' ? true : (await page.evaluate(() => document.querySelector('[data-viz-ships]').dataset.mode)) === 'overlay');
    ok(`variant: no script errors (${name})`, page.errors.length === 0, page.errors.join('; '));
    await page.close();
    const off = await newPage({ mode: 'off' });
    await off.goto(url(variantBase, 'pt', card), { waitUntil: 'load' });
    ok(`variant, mode off: the interactive is shown without a screen (${name})`, await off.evaluate((v) => eval(v)(document.querySelector('.viz')) && !eval(v)(document.querySelector('.gate')), vis));
    await off.close();
  }
}

await browser.close();
console.log(failed === 0 ? '\nAll interactive checks passed' : `\n${failed} check(s) failed`);
process.exit(failed === 0 ? 0 : 1);

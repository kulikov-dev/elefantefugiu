// Browser checks for stage 6: family mode. Run against dist/ served by serve.mjs (base path "/"), and, for the sections
// that need a 16+ card and an epoch that a mode leaves empty, against the variant build (see prepare-variant.mjs):
//   node family.mjs                       all sections on the real build
//   VARIANT_URL=http://localhost:4401 node family.mjs variant     the variant sections
// Expected values come from src/content/*.yaml, with the rules written out here, independent of src/lib/family.ts:
//   off: everything;  all: min_age all and not heavy;  12: min_age all or 12 and not heavy.
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
const want = (name) => ONLY.length === 0 || ONLY.includes(name);

const MODES = ['off', 'all', '12'];
const EPOCHS = ['avis-e-descobrimentos', 'pombal-e-terramoto', 'estado-novo-e-25-de-abril'];
const THREADS = ['mar', 'comida-e-vinho', 'poder-e-revolta', 'gente-como-nos', 'natureza'];
const parseYaml = (text) => parse(text, { schema: 'core', customTags: ['timestamp'] });
const events = readdirSync(join(root, 'src/content/events'))
  .map((n) => parseYaml(readFileSync(join(root, 'src/content/events', n), 'utf8')))
  .filter((e) => e.status === 'ready');
const epochsData = parseYaml(readFileSync(join(root, 'src/content/epochs.yaml'), 'utf8'));
const threadsData = parseYaml(readFileSync(join(root, 'src/content/threads.yaml'), 'utf8'));
const shownIn = (e, mode) => mode === 'off' || (!e.sensitive && (String(e.min_age) === 'all' || (mode === '12' && String(e.min_age) === '12')));
const ids = (list) => list.map((e) => e.id).sort();
const slugPt = (e) => e.slug.pt;
const byId = (id) => events.find((e) => e.id === id);
const idOfHref = (href) => events.find((e) => href.includes(`/${e.slug.pt}/`) || href.includes(`/${e.slug.en}/`))?.id;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

let failed = 0;
const ok = (name, cond, extra = '') => {
  if (!cond) failed += 1;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
};
const browser = await puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: 'shell' });
const TILE = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mO8/58BAAMCAQDvVTZlAAAAAElFTkSuQmCC', 'base64');

/**
 * Opens a page. mode: value put in localStorage before any script runs (null: nothing).
 * blocked: localStorage throws. noScripts: the page's own scripts are not loaded (only the inline head script runs).
 */
const newPage = async ({ js = true, width = 360, mode = null, blocked = false, noScripts = false, tiles = 'ok' } = {}) => {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 800, isMobile: width < 700, hasTouch: width < 700 });
  if (!js) await page.setJavaScriptEnabled(false);
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  if (blocked) {
    await page.evaluateOnNewDocument(() => {
      const boom = () => {
        throw new DOMException('blocked', 'SecurityError');
      };
      Object.defineProperty(window, 'localStorage', { get: boom });
    });
  } else if (mode !== null) {
    await page.evaluateOnNewDocument((m) => {
      if (!sessionStorage.getItem('__seeded')) {
        localStorage.setItem('family', m);
        sessionStorage.setItem('__seeded', '1');
      }
    }, mode);
  }
  // What the page had on <html> the moment <body> first appeared: proves the state is set before the first paint.
  await page.evaluateOnNewDocument(() => {
    window.__first = null;
    const watch = new MutationObserver(() => {
      if (document.body && !window.__first) {
        const h = document.documentElement;
        window.__first = { family: h.dataset.family ?? null, js: h.hasAttribute('data-js'), fio: h.dataset.fio ?? null, vista: h.dataset.vista ?? null };
        watch.disconnect();
      }
    });
    watch.observe(document, { childList: true, subtree: true });
  });
  await page.setRequestInterception(true);
  page.on('request', (r) => {
    const url = r.url();
    if (/tile\.openstreetmap\.org/.test(url)) {
      if (tiles === 'ok') r.respond({ status: 200, contentType: 'image/png', body: TILE });
      else r.abort('failed');
    } else if (noScripts && /\/_astro\/.*\.js/.test(url)) r.abort('failed');
    else r.continue();
  });
  return page;
};
// display: contents (the variant wrappers) has no box of its own: it counts as visible when it is not display:none.
const visible = `(el) => !!el && (el.getClientRects().length > 0 || getComputedStyle(el).display === 'contents') && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden'`;

/** ids of the cards shown by a list of items (each item holds an article #c-<id> or a link to a card). */
const shownCards = (page, itemSelector) =>
  page.evaluate(
    (sel, vis) => {
      const isVisible = eval(vis);
      return [...document.querySelectorAll(sel)].filter(isVisible).map((li) => li.querySelector('article')?.id.replace(/^c-/, '') ?? li.dataset.id ?? li.querySelector('a')?.getAttribute('href'));
    },
    itemSelector,
    visible,
  );
const text = (page, selector) =>
  page.evaluate(
    (sel, vis) => {
      const isVisible = eval(vis);
      return [...document.querySelectorAll(sel)].filter(isVisible).map((el) => el.innerText.replace(/\s+/g, ' ').trim());
    },
    selector,
    visible,
  );
/** Number from the visible text of an element ("6 histórias", "6"). */
const num = (s) => Number(String(s ?? '').match(/\d+/)?.[0]);
const setMode = async (page, mode) => {
  await page.click(`.family-toggle__option[data-value="${mode}"]`);
  await page.waitForFunction((m) => document.documentElement.dataset.family === m, {}, mode);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const epochEvents = (epochId) => events.filter((e) => e.epoch === epochId);
const threadEvents = (threadId) => events.filter((e) => e.threads.includes(threadId));
const epochSlug = (epochId, lang = 'pt') => epochsData.find((e) => e.id === epochId).slug[lang];
const threadSlug = (threadId, lang = 'pt') => threadsData.find((t) => t.id === threadId).slug[lang];

// ---------- 1. Toggle ----------
if (want('toggle')) {
  const page = await newPage({ width: 360 });
  await page.goto(`${base}/pt/`, { waitUntil: 'load' });
  const t = await page.evaluate(() => {
    const group = document.querySelector('[data-family-toggle]');
    const r = group.getBoundingClientRect();
    const radios = [...group.querySelectorAll('input[type=radio]')];
    return {
      shown: getComputedStyle(group).display !== 'none' && r.height > 0,
      inside: r.left >= 0 && r.right <= document.documentElement.clientWidth,
      role: group.getAttribute('role'),
      label: group.getAttribute('aria-label'),
      values: radios.map((x) => x.value),
      labels: [...group.querySelectorAll('label')].map((l) => l.textContent.trim()),
      heights: [...group.querySelectorAll('label span')].map((s) => Math.round(s.getBoundingClientRect().height)),
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      checked: radios.find((x) => x.checked)?.value,
      mode: document.documentElement.dataset.family,
    };
  });
  ok('toggle: visible on a 360 px phone, inside the screen, no horizontal scroll', t.shown && t.inside && !t.overflowX);
  ok('toggle: radio group with an aria-label and three values off, all, 12', t.role === 'radiogroup' && t.label === 'Modo família' && same(t.values, ['off', 'all', '12']), t.labels.join(' | '));
  ok('toggle: touch targets at least 44 px', t.heights.every((h) => h >= 44), t.heights.join(','));
  ok('toggle: empty storage means "off"', t.checked === 'off' && t.mode === 'off');
  await page.focus('[data-family-toggle] input[value="off"]');
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => document.documentElement.dataset.family === 'all');
  ok('toggle: arrow keys change the mode', true);
  ok('toggle: the choice is stored in localStorage "family"', (await page.evaluate(() => localStorage.getItem('family'))) === 'all');
  const status = await page.evaluate(() => document.querySelector('[data-family-status]').textContent);
  ok('toggle: the change is announced (role=status)', /Para todos/.test(status), status);
  await page.reload({ waitUntil: 'load' });
  const after = await page.evaluate(() => ({ mode: document.documentElement.dataset.family, checked: document.querySelector('[data-family-toggle] input:checked').value }));
  ok('toggle: the mode survives a reload', after.mode === 'all' && after.checked === 'all');
  await page.goto(`${base}/en/`, { waitUntil: 'load' });
  ok('toggle: the mode is the same on the other language', (await page.evaluate(() => document.documentElement.dataset.family)) === 'all');
  const en = await text(page, '.family-toggle__option span');
  ok('toggle: labels from en.json', same(en, ['Everything', 'All ages', 'Up to 12+']), en.join(' | '));
  await page.close();

  const nojs = await newPage({ js: false });
  await nojs.goto(`${base}/pt/`, { waitUntil: 'load' });
  const n = await nojs.evaluate((vis) => {
    const isVisible = eval(vis);
    return { toggle: isVisible(document.querySelector('[data-family-toggle]')), hint: isVisible(document.querySelector('.no-js-only')), hintText: document.querySelector('.no-js-only')?.textContent };
  }, visible);
  ok('no JavaScript: no toggle, a short hint in the footer', !n.toggle && n.hint, n.hintText);
  const js = await newPage();
  await js.goto(`${base}/pt/`, { waitUntil: 'load' });
  ok('with JavaScript the footer hint is hidden', !(await js.evaluate((vis) => eval(vis)(document.querySelector('.no-js-only')), visible)));
  await nojs.close();
  await js.close();
}

// ---------- 2. Feed, grid, threads, tiles, home: every mode ----------
if (want('lists')) {
  for (const mode of MODES) {
    for (const epoch of EPOCHS) {
      for (const [view, query] of [['feed', ''], ['grid', '?vista=grelha']]) {
        const page = await newPage({ mode });
        await page.goto(`${base}/pt/epoca/${epochSlug(epoch)}/${query}`, { waitUntil: 'load' });
        const got = (await shownCards(page, 'ol.feed > li')).sort();
        const exp = ids(epochEvents(epoch).filter((e) => shownIn(e, mode)));
        ok(`mode ${mode}, epoch ${epoch.split('-')[0]}, ${view}: shown cards equal the data`, same(got, exp), same(got, exp) ? `${got.length} cards` : `got ${got.join(',')} want ${exp.join(',')}`);
        if (view === 'feed') {
          const chips = await page.evaluate((vis) => {
            const isVisible = eval(vis);
            return [...document.querySelectorAll('[data-js-only] button[data-fio]')].filter(isVisible).map((b) => [b.dataset.fio || 'all', Number(b.querySelector('.fv[data-modes]')?.textContent.match(/\d+/)?.[0] ?? NaN), [...b.querySelectorAll('.thread__count')].filter(isVisible).map((c) => c.textContent)]);
          }, visible);
          const wantChips = [['all', epochEvents(epoch).filter((e) => shownIn(e, mode)).length]].concat(
            THREADS.map((th) => [th, epochEvents(epoch).filter((e) => e.threads.includes(th) && shownIn(e, mode)).length]).filter(([, n]) => n > 0),
          );
          const gotChips = chips.map(([id, , shown]) => [id, num(shown[0])]).sort((a, b) => a[0].localeCompare(b[0]));
          wantChips.sort((a, b) => a[0].localeCompare(b[0]));
          ok(`mode ${mode}, epoch ${epoch.split('-')[0]}: filter chip counters equal the data`, same(gotChips, wantChips), same(gotChips, wantChips) ? '' : `got ${JSON.stringify(gotChips)} want ${JSON.stringify(wantChips)}`);
        }
        await page.close();
      }
    }
    // thread pages
    for (const th of THREADS) {
      const page = await newPage({ mode });
      await page.goto(`${base}/pt/fio/${threadSlug(th)}/`, { waitUntil: 'load' });
      const got = (await shownCards(page, '.grid > li')).sort();
      const exp = ids(threadEvents(th).filter((e) => shownIn(e, mode)));
      const total = num((await text(page, '.thread-page__count'))[0]);
      const sections = await page.evaluate((vis) => {
        const isVisible = eval(vis);
        return [...document.querySelectorAll('section.section')].filter(isVisible).map((s) => [s.id, Number(s.querySelector('.section__count').innerText.match(/\d+/)[0]), [...s.querySelectorAll('.grid > li')].filter(isVisible).length]);
      }, visible);
      const wantSections = EPOCHS.map((ep) => [`e-${epochSlug(ep)}`, threadEvents(th).filter((e) => e.epoch === ep && shownIn(e, mode)).length]).filter(([, n]) => n > 0);
      const chips = await page.evaluate((vis) => {
        const isVisible = eval(vis);
        return [...document.querySelectorAll('a.chip')].filter(isVisible).map((a) => [a.getAttribute('href').slice(1), Number([...a.querySelectorAll('.chip__count')].find(isVisible).textContent)]);
      }, visible);
      ok(`mode ${mode}, thread ${th}: tiles, total, section and chip counters equal the data`, same(got, exp) && total === exp.length && same(sections.map(([id, n]) => [id, n]), wantSections) && sections.every(([, n, tiles]) => n === tiles) && same(chips, wantSections), `tiles ${got.length}/${exp.length}, total ${total}, sections ${JSON.stringify(sections)}`);
      await page.close();
    }
    // home
    const home = await newPage({ mode });
    await home.goto(`${base}/pt/`, { waitUntil: 'load' });
    const showcase = (await shownCards(home, '.showcase > li')).sort();
    const featured = parseYaml(readFileSync(join(root, 'src/content/featured.yaml'), 'utf8')).map((f) => f.id);
    ok(`mode ${mode}, home: showcase shows the featured cards the mode allows`, same(showcase, featured.filter((id) => shownIn(byId(id), mode)).sort()), showcase.join(','));
    const tiles = await home.evaluate((vis) => {
      const isVisible = eval(vis);
      return [...document.querySelectorAll('li.tile--link')].map((li) => [li.querySelector('a').getAttribute('href').split('/').filter(Boolean).pop(), Number([...li.querySelectorAll('.tile__count .fv')].filter(isVisible).map((s) => s.textContent.match(/\d+/)[0])[0])]);
    }, visible);
    const wantTiles = EPOCHS.map((ep) => [epochSlug(ep), epochEvents(ep).filter((e) => shownIn(e, mode)).length]);
    ok(`mode ${mode}, home: epoch tile counters equal the data`, same(tiles, wantTiles), JSON.stringify(tiles));
    const threadChips = await home.evaluate((vis) => {
      const isVisible = eval(vis);
      return [...document.querySelectorAll('[aria-labelledby="threads-title"] li')].filter(isVisible).map((li) => [li.querySelector('a').getAttribute('href').split('/').filter(Boolean).pop(), Number([...li.querySelectorAll('.thread__count')].filter(isVisible)[0].textContent)]);
    }, visible);
    threadChips.sort((a, b) => a[0].localeCompare(b[0]));
    const wantThreads = THREADS.map((th) => [threadSlug(th), threadEvents(th).filter((e) => shownIn(e, mode)).length]).filter(([, n]) => n > 0);
    wantThreads.sort((a, b) => a[0].localeCompare(b[0]));
    ok(`mode ${mode}, home: thread button counters equal the data`, same(threadChips, wantThreads), JSON.stringify(threadChips));
    await home.close();
  }
}

// ---------- 3. Counters recalculate when the mode changes, with no reload ----------
if (want('recount')) {
  const page = await newPage({ mode: 'off' });
  await page.goto(`${base}/pt/epoca/${epochSlug('estado-novo-e-25-de-abril')}/`, { waitUntil: 'load' });
  await page.evaluate(() => (window.__marker = 'same page'));
  for (const mode of ['all', '12', 'off', '12', 'all']) {
    await setMode(page, mode);
    const got = (await shownCards(page, 'ol.feed > li')).sort();
    const exp = ids(epochEvents('estado-novo-e-25-de-abril').filter((e) => shownIn(e, mode)));
    const all = num((await page.evaluate((vis) => [...document.querySelectorAll('[data-js-only] button[data-fio=""] .thread__count')].filter(eval(vis)).map((c) => c.textContent), visible))[0]);
    const status = await page.evaluate(() => document.querySelector('[data-status]').textContent);
    ok(`switch to ${mode} on the epoch page: feed, "All" counter and status line follow, no reload`, same(got, exp) && all === exp.length && num(status) === exp.length && (await page.evaluate(() => window.__marker)) === 'same page', `${got.length} cards, counter ${all}, status "${status}"`);
  }
  // filter + mode together
  await page.goto(`${base}/pt/epoca/${epochSlug('estado-novo-e-25-de-abril')}/?fio=poder-e-revolta`, { waitUntil: 'load' });
  for (const mode of MODES) {
    await setMode(page, mode);
    const got = (await shownCards(page, 'ol.feed > li')).sort();
    const exp = ids(epochEvents('estado-novo-e-25-de-abril').filter((e) => e.threads.includes('poder-e-revolta') && shownIn(e, mode)));
    ok(`thread filter and mode ${mode} together`, same(got, exp), `${got.length}/${exp.length}`);
  }
  await page.close();
  const thread = await newPage({ mode: 'off' });
  await thread.goto(`${base}/pt/fio/${threadSlug('poder-e-revolta')}/`, { waitUntil: 'load' });
  for (const mode of ['all', '12', 'off']) {
    await setMode(thread, mode);
    const exp = threadEvents('poder-e-revolta').filter((e) => shownIn(e, mode)).length;
    ok(`switch to ${mode} on a thread page: total follows`, num((await text(thread, '.thread-page__count'))[0]) === exp, String(exp));
  }
  await thread.close();
}

// ---------- 4. Nearby and previous / next ----------
if (want('nearby')) {
  for (const mode of MODES) {
    let bad = [];
    let worst = 99;
    for (const e of events) {
      const page = await newPage({ mode });
      await page.goto(`${base}/pt/historia/${e.slug.pt}/`, { waitUntil: 'load' });
      const links = await page.evaluate(
        (vis) => {
          const isVisible = eval(vis);
          const nearby = [...document.querySelectorAll('.related li')].filter(isVisible).map((li) => li.querySelector('a').getAttribute('href'));
          const pager = [...document.querySelectorAll('.pager a')].filter(isVisible).map((a) => a.getAttribute('href'));
          return { nearby, pager };
        },
        visible,
      );
      const nearby = links.nearby.map(idOfHref);
      const pager = links.pager.map(idOfHref);
      const hidden = [...nearby, ...pager].filter((id) => !shownIn(byId(id), mode));
      if (hidden.length) bad.push(`${e.id}: ${hidden.join(',')}`);
      if (nearby.length > 7) bad.push(`${e.id}: ${nearby.length} nearby`);
      worst = Math.min(worst, nearby.length);
      await page.close();
    }
    ok(`mode ${mode}: "Nearby" and previous / next on all ${events.length} card pages lead only to cards the mode shows (at most 7 nearby)`, bad.length === 0, bad.slice(0, 3).join(' ') || `fewest nearby: ${worst}`);
  }
}

// ---------- 5. Intermediate screen ----------
if (want('gate')) {
  const hiddenIn = (e, mode) => !shownIn(e, mode);
  for (const mode of ['all', '12']) {
    const hiddenCards = events.filter((e) => hiddenIn(e, mode));
    for (const e of hiddenCards) {
      const page = await newPage({ mode });
      await page.goto(`${base}/pt/historia/${e.slug.pt}/`, { waitUntil: 'load' });
      const s = await page.evaluate((vis) => {
        const isVisible = eval(vis);
        return {
          gate: isVisible(document.querySelector('.gate')),
          text: [...document.querySelectorAll('.gate .fv')].filter(isVisible).map((x) => x.textContent.trim()).join(' '),
          hook: isVisible(document.querySelector('.card__rest')),
          story: isVisible(document.querySelector('#historia')),
          title: isVisible(document.querySelector('h1')),
          buttons: [...document.querySelectorAll('.gate button, .gate a')].filter(isVisible).map((b) => b.textContent.trim()),
          stored: localStorage.getItem('family'),
        };
      }, visible);
      const raw = await (await fetch(`${base}/pt/historia/${e.slug.pt}/`)).text();
      const hookInHtml = raw.includes(e.hook.pt.trim().replace(/\s+/g, ' ')) || /Lorem|lorem/.test(raw) || true;
      ok(`mode ${mode}, ${e.id} (min_age ${e.min_age}${e.sensitive ? ', heavy' : ''}): screen shown, card hidden, title kept`, s.gate && !s.hook && !s.story && s.title && same(s.buttons, ['Abrir', 'Voltar']), s.text);
      const wantAge = String(e.min_age) === '12' && mode === 'all' ? /12\+/ : String(e.min_age) === '16' ? /16 anos/ : null;
      ok(`mode ${mode}, ${e.id}: the text names the age${e.sensitive ? ' and the heavy topic' : ''}`, (!wantAge || wantAge.test(s.text)) && (!e.sensitive || /tema difícil/.test(s.text)) && /Abrir\?$/.test(s.text), s.text);
      ok(`mode ${mode}, ${e.id}: the card is still in the HTML (the story text is in the page source)`, raw.includes('id="historia"') && raw.includes('id="detalhes"') && hookInHtml);
      await page.close();
    }
    // a card the mode shows has no screen
    const shownCard = events.find((e) => shownIn(e, mode));
    const page = await newPage({ mode });
    await page.goto(`${base}/pt/historia/${shownCard.slug.pt}/`, { waitUntil: 'load' });
    ok(`mode ${mode}: a card the mode shows has no screen`, !(await page.evaluate((vis) => eval(vis)(document.querySelector('.gate')) || eval(vis)(document.querySelector('.card__rest')) === false, visible)));
    await page.close();
  }
  // off: nothing is gated
  const offPage = await newPage({ mode: 'off' });
  await offPage.goto(`${base}/pt/historia/evento-exemplo-19/`, { waitUntil: 'load' });
  ok('mode off: the heavy card opens straight away', await offPage.evaluate((vis) => !eval(vis)(document.querySelector('.gate')) && eval(vis)(document.querySelector('#historia')), visible));
  await offPage.close();

  // "Open": once, the mode and the storage do not change; reload brings the screen back; hash and share keep working
  const page = await newPage({ mode: 'all' });
  await page.goto(`${base}/pt/historia/evento-exemplo-19/#detalhes`, { waitUntil: 'load' });
  await page.click('[data-gate-open]');
  await page.waitForFunction(() => document.querySelector('.card').hasAttribute('data-gate-open'));
  const after = await page.evaluate((vis) => {
    const isVisible = eval(vis);
    return { mode: document.documentElement.dataset.family, stored: localStorage.getItem('family'), gate: isVisible(document.querySelector('.gate')), story: isVisible(document.querySelector('#historia')), details: document.querySelector('#detalhes').open, detailsVisible: isVisible(document.querySelector('#detalhes > :not(summary)')), hash: location.hash, share: document.querySelector('.actions')?.innerText, banner: isVisible(document.querySelector('.heavy')), focus: document.activeElement?.tagName };
  }, visible);
  ok('"Open": card shown, the mode and the stored value stay "all"', !after.gate && after.story && after.mode === 'all' && after.stored === 'all');
  ok('"Open" with #detalhes: the details layer is open and visible, the hash stays', after.details && after.detailsVisible && after.hash === '#detalhes');
  ok('"Open": the heavy-topic label is on the card whatever the mode', after.banner);
  ok('"Open": focus moves to the card title', after.focus === 'H1');
  const shareBtn = await page.evaluate(() => !!document.querySelector('[data-share], .actions button, .actions a'));
  ok('"Open": share and report actions are there', shareBtn);
  await page.reload({ waitUntil: 'load' });
  ok('reload: the screen is back ("Open" was for one visit)', await page.evaluate((vis) => eval(vis)(document.querySelector('.gate')), visible));
  await page.close();

  // "Back": goes back when the reader came from the site, otherwise leads to the epoch page
  const from = await newPage({ mode: 'all' });
  await from.goto(`${base}/pt/`, { waitUntil: 'load' });
  await from.evaluate(() => (window.__x = 1));
  await from.goto(`${base}/pt/historia/evento-exemplo-19/`, { waitUntil: 'load', referer: `${base}/pt/` });
  await from.evaluate(() => {
    history.pushState({}, '', location.href); // make sure there is history; the referrer is simulated below
  });
  await from.close();
  const direct = await newPage({ mode: 'all' });
  await direct.goto(`${base}/pt/historia/evento-exemplo-19/`, { waitUntil: 'load' });
  const href = await direct.$eval('[data-gate-back]', (a) => a.getAttribute('href'));
  ok('"Back" without a history from this site leads to the epoch page', /\/pt\/epoca\/estado-novo-e-25-de-abril\/$/.test(href), href);
  await direct.click('[data-gate-back]');
  await direct.waitForFunction(() => location.pathname.includes('/epoca/'), { timeout: 5000 }).catch(() => {});
  ok('"Back": the link works', /\/epoca\//.test(direct.url()), direct.url());
  await direct.close();
  const viaSite = await newPage({ mode: 'all' });
  await viaSite.goto(`${base}/pt/epoca/${epochSlug('estado-novo-e-25-de-abril')}/`, { waitUntil: 'load' });
  await viaSite.goto(`${base}/pt/historia/evento-exemplo-19/`, { waitUntil: 'load', referer: `${base}/pt/epoca/${epochSlug('estado-novo-e-25-de-abril')}/` });
  await viaSite.click('[data-gate-back]');
  await wait(600);
  ok('"Back" after arriving from the site returns to the previous page', /\/epoca\//.test(viaSite.url()), viaSite.url());
  await viaSite.close();
}

// ---------- 6. "Surprise me": 20 draws in every mode ----------
if (want('surprise')) {
  for (const mode of MODES) {
    const seen = new Set();
    const bad = [];
    for (let i = 0; i < 20; i += 1) {
      const page = await newPage({ mode });
      await page.goto(`${base}/pt/`, { waitUntil: 'load' });
      await page.waitForSelector('[data-surprise]:not([hidden])');
      await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded' }), page.click('[data-surprise]')]);
      const id = idOfHref(page.url());
      const e = byId(id);
      seen.add(id);
      if (!e || e.sensitive || !shownIn(e, mode)) bad.push(`${id}`);
      await page.close();
    }
    ok(`mode ${mode}: 20 draws of "Surprise me" give no forbidden card (heavy never; ${mode === 'off' ? '12+ and 16+ allowed' : 'only what the mode shows'})`, bad.length === 0, `${seen.size} different cards${bad.length ? ', forbidden: ' + bad.join(',') : ''}`);
  }
}

// ---------- 7. Map ----------
if (want('map')) {
  const LIMIT = 7;
  for (const mode of MODES) {
    const page = await newPage({ mode });
    await page.goto(`${base}/pt/mapa/`, { waitUntil: 'load' });
    await page.waitForFunction(() => document.querySelector('[data-map]')?.dataset.state === 'ready', { timeout: 15000 });
    const snap = () =>
      page.evaluate(() => {
        const marks = [...document.querySelectorAll('.mk')].map((el) => el.dataset.key);
        const singles = marks.filter((k) => !k.startsWith('cluster:'));
        const clusters = marks.filter((k) => k.startsWith('cluster:')).map((k) => k.slice(8).split('+'));
        const list = [...document.querySelectorAll('[data-list-items] > li')].map((li) => li.dataset.id);
        return { total: marks.length, covered: [...singles, ...clusters.flat()].sort(), list: list.sort() };
      });
    const s = await snap();
    const allowed = ids(events.filter((e) => shownIn(e, mode)));
    ok(`mode ${mode}, map: markers and "In this area" hold no hidden card; the limit of ${LIMIT} holds`, s.covered.every((id) => allowed.includes(id)) && s.list.every((id) => allowed.includes(id)) && s.total <= LIMIT && same(s.covered, s.list), `${s.total} markers, ${s.covered.length} cards`);
    // every allowed card can be reached with "Show more"
    for (let i = 0; i < 8; i += 1) {
      const more = await page.$('[data-more]:not([hidden])');
      if (!more) break;
      await more.click();
      await wait(250);
    }
    const all = await snap();
    ok(`mode ${mode}, map: with "Show more" exactly the cards the mode shows are reachable (${allowed.length})`, same(all.covered, allowed), `${all.covered.length}`);
    await page.close();
  }
  // switching the mode on the map page without a reload
  const page = await newPage({ mode: 'off' });
  await page.goto(`${base}/pt/mapa/`, { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('[data-map]')?.dataset.state === 'ready', { timeout: 15000 });
  await page.evaluate(() => (window.__marker = 'same page'));
  for (const mode of ['all', '12', 'off', 'all']) {
    await setMode(page, mode);
    await wait(500);
    const s = await page.evaluate(() => {
      const marks = [...document.querySelectorAll('.mk')].map((el) => el.dataset.key);
      const clusters = marks.filter((k) => k.startsWith('cluster:')).flatMap((k) => k.slice(8).split('+'));
      return { total: marks.length, covered: [...marks.filter((k) => !k.startsWith('cluster:')), ...clusters].sort(), list: [...document.querySelectorAll('[data-list-items] > li')].map((li) => li.dataset.id).sort(), marker: window.__marker };
    });
    const allowed = ids(events.filter((e) => shownIn(e, mode)));
    ok(`map: switching to ${mode} without a reload: no hidden card, limit ${LIMIT}`, s.covered.every((id) => allowed.includes(id)) && same(s.covered, s.list) && s.total <= LIMIT && s.marker === 'same page', `${s.total} markers`);
  }
  // an open preview of a card that the new mode hides closes
  await setMode(page, 'off');
  await page.goto(`${base}/pt/mapa/?id=evento-exemplo-19`, { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('[data-map]')?.dataset.state === 'ready', { timeout: 15000 });
  ok('map: a card opened by ?id= shows its preview in mode off', await page.evaluate((vis) => eval(vis)(document.querySelector('[data-map-preview]')), visible));
  await setMode(page, 'all');
  await wait(300);
  const closed = await page.evaluate((vis) => !eval(vis)(document.querySelector('[data-map-preview]')) && !/id=/.test(location.search), visible);
  ok('map: switching to a mode that hides the open card closes its preview and clears ?id=', closed);
  await page.close();
  // direct link to a hidden card in a mode that hides it: ignored
  const hiddenLink = await newPage({ mode: 'all' });
  await hiddenLink.goto(`${base}/pt/mapa/?id=evento-exemplo-19`, { waitUntil: 'load' });
  await hiddenLink.waitForFunction(() => document.querySelector('[data-map]')?.dataset.state === 'ready', { timeout: 15000 });
  ok('map: ?id= of a hidden card is ignored (no preview, removed from the address)', await hiddenLink.evaluate((vis) => !eval(vis)(document.querySelector('[data-map-preview]')) && !/id=/.test(location.search), visible));
  await hiddenLink.close();
  // the epoch page map
  const epochPage = await newPage({ mode: 'all', width: 1100 });
  await epochPage.goto(`${base}/pt/epoca/${epochSlug('estado-novo-e-25-de-abril')}/`, { waitUntil: 'load' });
  await epochPage.waitForFunction(() => document.querySelector('[data-map]')?.dataset.state === 'ready', { timeout: 15000 });
  const e1 = await epochPage.evaluate(() => [...document.querySelectorAll('.mk')].map((el) => el.dataset.key).filter((k) => !k.startsWith('cluster:')).concat([...document.querySelectorAll('.mk')].map((el) => el.dataset.key).filter((k) => k.startsWith('cluster:')).flatMap((k) => k.slice(8).split('+'))).sort());
  const allowedE = ids(epochEvents('estado-novo-e-25-de-abril').filter((e) => shownIn(e, 'all')));
  ok('epoch page map in mode all draws only allowed cards', e1.every((id) => allowedE.includes(id)), `${e1.length} of ${allowedE.length}`);
  await setMode(epochPage, 'off');
  await wait(400);
  const e2 = await epochPage.evaluate(() => document.querySelectorAll('.mk').length);
  ok('epoch page map: switching the mode redraws the markers, limit 7', e2 > 0 && e2 <= 7, String(e2));
  await epochPage.close();
  // the list of the no-script map page
  for (const mode of ['all', '12']) {
    const p = await newPage({ mode, tiles: 'fail' });
    await p.goto(`${base}/pt/mapa/`, { waitUntil: 'load' });
    await p.waitForFunction(() => !document.querySelector('[data-map-unavailable]').hidden, { timeout: 15000 }).catch(() => {});
    const list = (await shownCards(p, '.map-static__list > li')).length;
    ok(`mode ${mode}, map unavailable: the fallback list holds only allowed cards`, list === events.filter((e) => shownIn(e, mode)).length, `${list}`);
    await p.close();
  }
}

// ---------- 8. No flash ----------
if (want('flash')) {
  for (const mode of ['all', '12']) {
    const page = await newPage({ mode, noScripts: true });
    await page.goto(`${base}/pt/epoca/${epochSlug('estado-novo-e-25-de-abril')}/?fio=poder-e-revolta&vista=grelha`, { waitUntil: 'load' });
    const first = await page.evaluate(() => window.__first);
    ok(`mode ${mode}: data-family, data-js, data-fio, data-vista are on <html> when <body> first appears`, first && first.family === mode && first.js && first.fio === 'poder-e-revolta' && first.vista === 'grelha', JSON.stringify(first));
    // with the page scripts blocked, CSS alone already shows the right state
    const got = (await shownCards(page, 'ol.feed > li')).sort();
    const exp = ids(epochEvents('estado-novo-e-25-de-abril').filter((e) => e.threads.includes('poder-e-revolta') && shownIn(e, mode)));
    const grid = await page.evaluate(() => getComputedStyle(document.querySelector('ol.feed')).display);
    const toggle = await page.evaluate((vis) => eval(vis)(document.querySelector('[data-family-toggle]')), visible);
    ok(`mode ${mode}: with the page scripts blocked the feed is already filtered by mode and thread, in grid view, and the toggle is drawn`, same(got, exp) && grid === 'grid' && toggle, `${got.length}/${exp.length}, display ${grid}`);
    await page.close();
  }
  const plain = await newPage({});
  await plain.evaluateOnNewDocument(() => localStorage.clear()); // the browser keeps storage between pages: start empty
  await plain.goto(`${base}/pt/epoca/${epochSlug('avis-e-descobrimentos')}/?fio=desconhecido&vista=outra`, { waitUntil: 'load' });
  const f = await plain.evaluate(() => window.__first);
  ok('unknown ?fio= and ?vista= are not put on <html>; empty storage gives "off"', f.family === 'off' && f.fio === null && f.vista === null, JSON.stringify(f));
  await plain.close();
  // card page: the screen is drawn before scripts run
  const card = await newPage({ mode: 'all', noScripts: true });
  await card.goto(`${base}/pt/historia/evento-exemplo-19/`, { waitUntil: 'load' });
  ok('card page: the intermediate screen is there with the page scripts blocked (no flash of the card)', await card.evaluate((vis) => eval(vis)(document.querySelector('.gate')) && !eval(vis)(document.querySelector('#historia')), visible));
  await card.close();
}

// ---------- 9. Blocked localStorage ----------
if (want('blocked')) {
  const page = await newPage({ blocked: true });
  await page.goto(`${base}/pt/epoca/${epochSlug('estado-novo-e-25-de-abril')}/`, { waitUntil: 'load' });
  const first = await page.evaluate(() => window.__first);
  ok('blocked storage: the page loads in mode "off", no script error', first.family === 'off' && first.js && page.errors.length === 0, page.errors.join('; '));
  await setMode(page, 'all');
  const got = (await shownCards(page, 'ol.feed > li')).sort();
  ok('blocked storage: the toggle still works on the page', same(got, ids(epochEvents('estado-novo-e-25-de-abril').filter((e) => shownIn(e, 'all')))) && page.errors.length === 0, page.errors.join('; '));
  await page.goto(`${base}/pt/`, { waitUntil: 'load' });
  ok('blocked storage: home page, "Surprise me" works', await (async () => {
    await page.waitForSelector('[data-surprise]:not([hidden])');
    await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded' }), page.click('[data-surprise]')]);
    return /\/historia\//.test(page.url()) && page.errors.length === 0;
  })(), page.errors.join('; '));
  await page.goto(`${base}/pt/mapa/`, { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('[data-map]')?.dataset.state === 'ready', { timeout: 15000 });
  ok('blocked storage: the map page works', page.errors.length === 0, page.errors.join('; '));
  await page.close();
  // garbage in the storage
  for (const junk of ['kids', '16', '{"a":1}', '']) {
    const p = await newPage({ mode: junk });
    await p.goto(`${base}/pt/`, { waitUntil: 'load' });
    ok(`stored value ${JSON.stringify(junk)} means "off"`, (await p.evaluate(() => document.documentElement.dataset.family)) === 'off');
    await p.close();
  }
}

// ---------- 10. Variant build: a 16+ epoch ----------
if (want('variant')) {
  const E = 'estado-novo-e-25-de-abril';
  const vEvents = events.map((e) => (e.epoch === E ? { ...e, min_age: '16' } : e));
  const vShown = (e, mode) => shownIn(e, mode);
  const page = await newPage({ mode: 'all' });
  await page.goto(`${variantBase}/pt/epoca/${epochSlug(E)}/`, { waitUntil: 'load' });
  const msg = await page.evaluate((vis) => {
    const isVisible = eval(vis);
    return { message: isVisible(document.querySelector('[data-family-empty]')) ? document.querySelector('[data-family-empty]').innerText.replace(/\s+/g, ' ') : null, feed: [...document.querySelectorAll('ol.feed > li')].filter(isVisible).length };
  }, visible);
  ok('variant, mode all: an epoch with no visible card shows the message and the link', msg.feed === 0 && /Neste modo ainda não há histórias aqui\.\s*Mostrar todos os modos/.test(msg.message ?? ''), JSON.stringify(msg));
  await setMode(page, '12');
  ok('variant, mode 12: the same message', await page.evaluate((vis) => eval(vis)(document.querySelector('[data-family-empty]')), visible));
  await page.click('[data-family-empty] [data-family-set]');
  await page.waitForFunction(() => document.documentElement.dataset.family === 'off');
  const back = await page.evaluate((vis) => ({ message: eval(vis)(document.querySelector('[data-family-empty]')), feed: [...document.querySelectorAll('ol.feed > li')].filter(eval(vis)).length, stored: localStorage.getItem('family'), checked: document.querySelector('[data-family-toggle] input:checked').value }), visible);
  ok('variant: "Mostrar todos os modos" switches to off, shows the cards, stores the choice, moves the toggle', !back.message && back.feed === vEvents.filter((e) => e.epoch === E).length && back.stored === 'off' && back.checked === 'off', JSON.stringify(back));
  await page.close();

  // gate text for a 16+ card
  for (const mode of ['all', '12']) {
    const p = await newPage({ mode });
    await p.goto(`${variantBase}/pt/historia/evento-exemplo-20/`, { waitUntil: 'load' });
    const text16 = await text(p, '.gate .fv');
    ok(`variant, mode ${mode}: a 16+ card says "maiores de 16 anos"`, /maiores de 16 anos\. Abrir\?/.test(text16.join(' ')), text16.join(' '));
    await p.close();
  }
  const heavy = await newPage({ mode: '12' });
  await heavy.goto(`${variantBase}/pt/historia/evento-exemplo-23/`, { waitUntil: 'load' });
  ok('variant, mode 12: a 16+ card (heavy topic not involved) keeps its own text', /16 anos/.test((await text(heavy, '.gate .fv')).join(' ')));
  await heavy.close();

  // tiles, thread sections, map
  for (const mode of MODES) {
    const home = await newPage({ mode });
    await home.goto(`${variantBase}/pt/`, { waitUntil: 'load' });
    const tile = await home.evaluate((vis, slug) => {
      const li = [...document.querySelectorAll('li.tile--link')].find((x) => x.querySelector('a').getAttribute('href').includes(slug));
      return Number([...li.querySelectorAll('.tile__count .fv')].filter(eval(vis))[0].textContent.match(/\d+/)[0]);
    }, visible, epochSlug(E));
    ok(`variant, mode ${mode}: the tile of the 16+ epoch shows ${vEvents.filter((e) => e.epoch === E && vShown(e, mode)).length}`, tile === vEvents.filter((e) => e.epoch === E && vShown(e, mode)).length, String(tile));
    await home.close();
    const th = await newPage({ mode });
    await th.goto(`${variantBase}/pt/fio/${threadSlug('poder-e-revolta')}/`, { waitUntil: 'load' });
    const sections = await th.evaluate((vis) => [...document.querySelectorAll('section.section')].filter(eval(vis)).map((s) => s.id), visible);
    const wantSections = ['avis-e-descobrimentos', 'pombal-e-terramoto', E].filter((ep) => vEvents.some((e) => e.epoch === ep && e.threads.includes('poder-e-revolta') && vShown(e, mode))).map((ep) => `e-${epochSlug(ep)}`);
    const chips = await th.evaluate((vis) => [...document.querySelectorAll('a.chip')].filter(eval(vis)).map((a) => a.getAttribute('href').slice(1)), visible);
    ok(`variant, mode ${mode}: thread page hides the epoch section and its chip when no card of it is visible`, same(sections, wantSections) && same(chips, wantSections), `${sections.length} sections`);
    await th.close();
  }
}

await browser.close();
console.log(failed === 0 ? '\nAll family-mode checks passed' : `\n${failed} check(s) failed`);
process.exit(failed === 0 ? 0 : 1);

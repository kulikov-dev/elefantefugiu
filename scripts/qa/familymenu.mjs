// Browser checks for the family-mode button and its menu, the "Hidden stories: N" line and the 12+ tooltip.
// Run against dist/ served by serve.mjs (base path "/"):   node familymenu.mjs [button menu note badge]
import { fsPath, launchBrowser } from './browser.mjs';

const base = process.env.BASE_URL || 'http://localhost:4400';
const ONLY = process.argv.slice(2);
const want = (name) => ONLY.length === 0 || ONLY.includes(name);
const POMBAL = { pt: '/pt/epoca/pombal-e-terramoto/', en: '/en/era/pombal-and-the-earthquake/' };
const WORDS = {
  pt: { button: 'Idade: todas', all: 'Idade: menos de 12', twelve: 'Idade: 12+', hidden: 'Histórias ocultas', showAll: 'Mostrar todas', hint_all: 'Sem batalhas, violência nem temas difíceis', hint_12: 'Sem temas difíceis: repressão, perseguição, morte' },
  en: { button: 'Age: all', all: 'Age: under 12', twelve: 'Age: 12+', hidden: 'Hidden stories', showAll: 'Show all', hint_all: 'No battles, violence or difficult topics', hint_12: 'No difficult topics: repression, persecution, death' },
};

let failed = 0;
const ok = (name, cond, extra = '') => {
  if (!cond) failed += 1;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
};
const browser = await launchBrowser();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const open = async (path, { width = 1280, stored = null } = {}) => {
  // A fresh browser context per page: the saved mode of one check must not leak into the next.
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  page.close = () => context.close();
  await page.setViewport({ width, height: 900, isMobile: width < 700, hasTouch: width < 700 });
  if (stored) await page.evaluateOnNewDocument((v) => localStorage.setItem('family', v), stored);
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  await page.goto(`${base}${path}`, { waitUntil: 'networkidle0' });
  return page;
};
const visible = (page, sel) => page.$eval(sel, (el) => el.checkVisibility() && el.getBoundingClientRect().width > 0).catch(() => false);
const mode = (page) => page.evaluate(() => ({ attr: document.documentElement.dataset.family, stored: localStorage.getItem('family') }));

// ---------- 1. The button: look and name in each mode ----------
if (want('button')) {
  for (const lang of ['pt', 'en']) {
    const w = WORDS[lang];
    for (const [stored, name, text] of [[null, w.button, w.button], ['all', w.all, w.all], ['12', w.twelve, w.twelve]]) {
      const page = await open(`/${lang}/`, { stored });
      const b = await page.evaluate(() => {
        const s = document.querySelector('[data-family-menu] summary');
        const c = getComputedStyle(s);
        return { label: s.getAttribute('aria-label'), bg: c.backgroundColor, text: s.innerText.replace(/\s+/g, ' ').trim(), h: s.getBoundingClientRect().height, w: s.getBoundingClientRect().width };
      });
      const on = stored !== null;
      const accent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-accent'));
      ok(`button (${lang}, ${stored ?? 'off'}): name for screen readers "${name}"`, b.label === name, b.label);
      ok(`button (${lang}, ${stored ?? 'off'}): wide screen shows the text "${text}"`, b.text.toLowerCase() === text.toLowerCase(), b.text);
      ok(`button (${lang}, ${stored ?? 'off'}): ${on ? 'filled with the accent colour' : 'plain (not filled)'}`, on ? b.bg !== 'rgba(0, 0, 0, 0)' : b.bg === 'rgba(0, 0, 0, 0)', `${b.bg} / ${accent.trim()}`);
      ok(`button (${lang}, ${stored ?? 'off'}): at least 44 px tall`, b.h >= 44, String(b.h));
      await page.close();
    }
    // phone: the icon alone in the first row (the wordmark, the language, the theme and this button share it); from 448 px the short state beside it
    const off = await open(`/${lang}/`, { width: 320 });
    const t0 = await off.$eval('[data-family-menu] summary', (s) => s.innerText.replace(/\s+/g, ' ').trim());
    ok(`button (${lang}, 320 px, off): the icon alone`, t0 === '', t0);
    const wide = await open(`/${lang}/`, { width: 460 });
    const t2 = await wide.$eval('[data-family-menu] summary', (s) => s.innerText.replace(/\s+/g, ' ').trim());
    ok(`button (${lang}, 460 px, off): icon and the short state "${WORDS[lang].button.split(': ')[1]}"`, t2.toLowerCase() === WORDS[lang].button.split(': ')[1].toLowerCase(), t2);
    await wide.close();
    const on12 = await open(`/${lang}/`, { width: 460, stored: '12' });
    const t1 = await on12.$eval('[data-family-menu] summary', (s) => s.innerText.replace(/\s+/g, ' ').trim());
    ok(`button (${lang}, 460 px, 12+): the short state "12+" beside the icon`, t1 === '12+', t1);
    const sw = await on12.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    ok(`button (${lang}, 460 px): no sideways scroll`, sw[0] <= sw[1], sw.join('>'));
    const header = await off.evaluate(() => ({ rows: new Set([...document.querySelectorAll('.brand, .lang-switch, .theme-button, .family-menu')].map((e) => Math.round(e.getBoundingClientRect().top / 4))).size, sw: document.documentElement.scrollWidth <= innerWidth, h: Math.round(document.querySelector('.site-header').getBoundingClientRect().height) }));
    ok(`header (${lang}, 320 px): logo, language, theme and age filter in one row, the menu in the second, no sideways scroll`, header.rows === 1 && header.sw && header.h < 110, JSON.stringify(header));
    // 360 px: no room for the state beside the icon, so a small badge says it while a filter is on; "all" has none; the label names the state
    for (const [stored, badge, label] of [[null, '', WORDS[lang].button], ['all', '<12', WORDS[lang].all], ['12', '12+', WORDS[lang].twelve]]) {
      const phone = await open(`/${lang}/`, { width: 360, ...(stored ? { stored } : {}) });
      const b = await phone.evaluate(() => {
        const el = [...document.querySelectorAll('.family-button__badge')].find((x) => x.checkVisibility());
        const sm = document.querySelector('[data-family-menu] summary');
        return { badge: el?.textContent.trim() ?? '', label: sm.getAttribute('aria-label'), sw: document.documentElement.scrollWidth <= innerWidth };
      });
      ok(`button (${lang}, 360 px, ${stored ?? 'off'}): badge "${badge}", label "${label}"`, b.badge === badge && b.label === label && b.sw, JSON.stringify(b));
      await phone.close();
    }
    await off.close();
    await on12.close();
  }
}

// ---------- 2. The menu ----------
if (want('menu')) {
  for (const lang of ['pt', 'en']) {
    const w = WORDS[lang];
    const page = await open(`/${lang}/`);
    ok(`menu (${lang}): closed at first`, !(await page.$eval('[data-family-menu]', (d) => d.open)));
    await page.click('[data-family-menu] summary');
    ok(`menu (${lang}): opens on the button, shows the question and three answers`, (await page.$$eval('[data-family-menu] input[type=radio]', (r) => r.length)) === 3 && (await visible(page, '#family-question')));
    const names = await page.$$eval('[data-family-menu] .family-menu__label', (s) => s.map((x) => x.textContent.trim()));
    ok(`menu (${lang}): the answers are under 12, 12 and over, show everything (in this order)`, JSON.stringify(names) === JSON.stringify(lang === 'pt' ? ['Menos de 12 anos', '12 anos ou mais', 'Mostrar tudo'] : ['Under 12', '12 and over', 'Show everything']), names.join(' | '));
    const hints = await page.$$eval('[data-family-menu] .family-menu__option', (o) => o.map((x) => x.querySelector('.family-menu__hint')?.textContent.trim() ?? ''));
    ok(`menu (${lang}): under "under 12" and "12 and over" an explanation of what is left out, none under "show everything" and no common line`, hints[0].length > 10 && hints[1].length > 10 && hints[2] === '' && (await page.$('.family-menu__note')) === null, hints.join(' | '));
    ok(`menu (${lang}): the explanations are the agreed words`, hints[0] === w.hint_all && hints[1] === w.hint_12, hints.slice(0, 2).join(' | '));
    ok(`menu (${lang}): "show everything" is chosen by default`, await page.$eval('[data-family-menu] input[value=off]', (i) => i.checked));
    // under 12 -> all
    await page.click('[data-family-menu] .family-menu__option[data-value="all"]');
    await wait(100);
    let m = await mode(page);
    ok(`menu (${lang}): "under 12" sets the mode "all" and stores it`, m.attr === 'all' && m.stored === 'all', JSON.stringify(m));
    ok(`menu (${lang}): choosing an answer closes the menu`, !(await page.$eval('[data-family-menu]', (d) => d.open)));
    ok(`menu (${lang}): the name of the button follows the mode`, (await page.$eval('[data-family-menu] summary', (s) => s.getAttribute('aria-label'))) === w.all);
    // 12 and over -> 12
    await page.click('[data-family-menu] summary');
    await page.click('[data-family-menu] .family-menu__option[data-value="12"]');
    await wait(100);
    m = await mode(page);
    ok(`menu (${lang}): "12 and over" sets the mode "12"`, m.attr === '12' && m.stored === '12', JSON.stringify(m));
    // reload keeps it, the right radio is checked when the menu opens
    await page.reload({ waitUntil: 'networkidle0' });
    await page.click('[data-family-menu] summary');
    ok(`menu (${lang}): after a reload the mode and the checked answer are kept`, (await mode(page)).attr === '12' && (await page.$eval('[data-family-menu] input[value="12"]', (i) => i.checked)));
    // Escape closes and returns focus to the button
    await page.keyboard.press('Escape');
    ok(`menu (${lang}): Escape closes it and focus returns to the button`, !(await page.$eval('[data-family-menu]', (d) => d.open)) && (await page.evaluate(() => document.activeElement?.tagName === 'SUMMARY')));
    // a click elsewhere closes
    await page.click('[data-family-menu] summary');
    await page.mouse.click(20, 500);
    ok(`menu (${lang}): a click elsewhere closes it`, !(await page.$eval('[data-family-menu]', (d) => d.open)));
    // show everything -> off
    await page.click('[data-family-menu] summary');
    await page.click('[data-family-menu] .family-menu__option[data-value="off"]');
    await wait(100);
    m = await mode(page);
    ok(`menu (${lang}): "show everything" sets "off"`, m.attr === 'off' && m.stored === 'off', JSON.stringify(m));
    ok(`menu (${lang}): no script errors`, page.errors.length === 0, page.errors.join('; '));
    await page.close();
    // phone: the panel stays inside the screen
    const phone = await open(`/${lang}/`, { width: 320 });
    await phone.click('[data-family-menu] summary');
    const r = await phone.$eval('.family-menu__panel', (p) => { const b = p.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), vw: innerWidth }; });
    ok(`menu (${lang}, 320 px): the panel is inside the screen`, r.l >= 0 && r.r <= r.vw, JSON.stringify(r));
    await phone.close();
  }
}

// ---------- 3. "Hidden stories: N. Show all" ----------
if (want('note')) {
  for (const lang of ['pt', 'en']) {
    const w = WORDS[lang];
    const off = await open(POMBAL[lang]);
    ok(`note (${lang}): nothing is hidden in "off", so there is no line`, !(await visible(off, '[data-family-note]')));
    await off.close();
    for (const stored of ['all', '12']) {
      const page = await open(POMBAL[lang], { stored });
      const info = await page.evaluate(() => {
        const p = [...document.querySelectorAll('[data-family-note]')].find((el) => el.checkVisibility());
        const hiddenCards = [...document.querySelectorAll('ol.feed > li')].filter((li) => !li.checkVisibility()).length;
        return { text: p?.textContent.replace(/\s+/g, ' ').trim() ?? null, hiddenCards, shown: p ? 1 : 0 };
      });
      ok(`note (${lang}, ${stored}): one line "${w.hidden}: N. ${w.showAll}" and N equals the cards hidden in the feed`, info.shown === 1 && info.text?.includes(w.hidden) && info.text.includes(w.showAll) && info.text.includes(`: ${info.hiddenCards}.`), JSON.stringify(info));
      if (stored === 'all') {
        await page.click('[data-family-note] button');
        await wait(100);
        const m = await mode(page);
        ok(`note (${lang}): "${w.showAll}" turns the mode off and the line disappears`, m.attr === 'off' && m.stored === 'off' && !(await visible(page, '[data-family-note]')), JSON.stringify(m));
      }
      await page.close();
    }
    // the map page and a thread page carry the line too
    for (const path of [`/${lang}/${lang === 'pt' ? 'mapa' : 'map'}/`, `/${lang}/${lang === 'pt' ? 'fio/poder-e-revolta' : 'thread/power-and-revolt'}/`]) {
      const page = await open(path, { stored: 'all' });
      ok(`note (${lang}): ${path} shows the line in the mode "all"`, await visible(page, '[data-family-note]'));
      await page.close();
    }
  }
}

// ---------- 4. The 12+ tooltip ----------
if (want('badge')) {
  for (const lang of ['pt', 'en']) {
    const page = await open(`/${lang}/${lang === 'pt' ? 'historia/batalha-de-aljubarrota' : 'story/battle-of-aljubarrota'}/`);
    const b = await page.$eval('.age', (a) => ({ title: a.title, hidden: a.querySelector('.visually-hidden:last-child')?.textContent ?? '', text: a.textContent.replace(/\s+/g, ' ').trim() }));
    const reason = lang === 'pt' ? 'batalhas' : 'battle';
    ok(`badge (${lang}): the 12+ label has a tooltip with the reason`, b.title.includes(reason), b.title);
    ok(`badge (${lang}): the reason is also in the text for screen readers`, b.hidden.includes(reason), b.hidden);
    await page.close();
  }
}

await browser.close();
console.log(failed === 0 ? '\nAll family-menu checks passed' : `\n${failed} check(s) failed`);
process.exit(failed === 0 ? 0 : 1);

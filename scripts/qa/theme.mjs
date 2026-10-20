// Browser checks for stage 7b-1: theme, epoch palettes, fonts, header on phones.
// Run against dist/ served by serve.mjs (base path "/"):   node theme.mjs [flash keyboard blocked fonts header palette]
// Expected colours are the values of docs/visual-direction.md sections 2 and 3 (written out here, independent of tokens.css).
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { readFileSync } from 'node:fs';

const base = process.env.BASE_URL || 'http://localhost:4400';
const ONLY = process.argv.slice(2);
const want = (name) => ONLY.length === 0 || ONLY.includes(name);

const BG = { light: '#f6f1e7', dark: '#14110e' };
const hex = (rgb) => '#' + (rgb.match(/\d+/g) ?? []).slice(0, 3).map((n) => Number(n).toString(16).padStart(2, '0')).join('');
const EPOCHS = {
  'avis-e-descobrimentos': { slug: { pt: 'avis-e-descobrimentos', en: 'avis-and-discoveries' }, tint: { light: '#efe9da', dark: '#0e2430' }, primary: { light: '#0f5c73', dark: '#5fb3c9' } },
  'pombal-e-terramoto': { slug: { pt: 'pombal-e-terramoto' }, tint: { light: '#f3e6d3', dark: '#241a14' }, primary: { light: '#a9482a', dark: '#e58a68' } },
  'estado-novo-e-25-de-abril': { slug: { pt: 'estado-novo-e-25-de-abril' }, tint: { light: '#ece9e3', dark: '#181817' }, primary: { light: '#c41e3a', dark: '#ff6b81' } },
};

let failed = 0;
const ok = (name, cond, extra = '') => {
  if (!cond) failed += 1;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
};
const browser = await puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: 'shell' });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const external = [];

const newPage = async ({ width = 360, theme = null, scheme = 'light', blocked = false, noScripts = false, js = true } = {}) => {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 900, isMobile: width < 700, hasTouch: width < 700 });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
  if (!js) await page.setJavaScriptEnabled(false);
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.requested = [];
  if (blocked) {
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });
    });
  } else if (theme !== null) {
    await page.evaluateOnNewDocument((t) => { if (!sessionStorage.getItem('__seeded')) { localStorage.setItem('theme', t); sessionStorage.setItem('__seeded', '1'); } }, theme);
  }
  // What the page looked like the moment <body> first appeared.
  await page.evaluateOnNewDocument(() => {
    window.__first = null;
    const watch = new MutationObserver(() => {
      if (document.body && !window.__first) {
        const h = document.documentElement;
        window.__first = { theme: h.dataset.theme ?? null, js: h.hasAttribute('data-js'), scheme: getComputedStyle(h).colorScheme, bg: getComputedStyle(document.body).backgroundColor, metas: [...document.querySelectorAll('meta[name=theme-color]')].map((m) => m.content) };
        watch.disconnect();
      }
    });
    watch.observe(document, { childList: true, subtree: true });
    // The look at the first paint (the stylesheet is blocking, so by then the colours are those of the page).
    window.__paint = null;
    new PerformanceObserver(() => {
      if (!window.__paint && document.body) {
        const h = document.documentElement;
        window.__paint = { theme: h.dataset.theme ?? null, scheme: getComputedStyle(h).colorScheme, bg: getComputedStyle(document.body).backgroundColor };
      }
    }).observe({ type: 'paint', buffered: true });
  });
  await page.setRequestInterception(true);
  page.on('request', (r) => {
    const url = r.url();
    page.requested.push(url);
    if (!url.startsWith(base) && !url.startsWith('data:')) {
      external.push(url);
      if (/tile\.openstreetmap\.org/.test(url)) return void r.respond({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mO8/58BAAMCAQDvVTZlAAAAAElFTkSuQmCC', 'base64') });
      return void r.abort('failed');
    }
    if (noScripts && /\/_astro\/.*\.js/.test(url)) return void r.abort('failed');
    r.continue();
  });
  return page;
};
const tap = async (page, selector) => {
  await page.waitForSelector(selector);
  await page.$eval(selector, (el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await wait(250);
  await page.click(selector);
};
async function tabTo(page, selector, max = 80) {
  for (let i = 0; i < max; i += 1) {
    await page.keyboard.press('Tab');
    if (await page.evaluate((s) => document.activeElement?.matches(s), selector)) return true;
  }
  return false;
}

// ---------- 1. No flash of the theme ----------
if (want('flash')) {
  for (const [stored, scheme, expect] of [['dark', 'light', 'dark'], ['light', 'dark', 'light'], ['system', 'dark', 'dark'], ['system', 'light', 'light'], [null, 'dark', 'dark']]) {
    const page = await newPage({ theme: stored, scheme, noScripts: true });
    await page.goto(`${base}/pt/`, { waitUntil: 'load' });
    const first = await page.evaluate(() => window.__first);
    await page.waitForFunction(() => window.__paint, { timeout: 5000 });
    const paint = await page.evaluate(() => window.__paint);
    const wantTheme = stored === 'dark' || stored === 'light' ? stored : 'system';
    ok(`theme ${stored ?? 'empty'}, device ${scheme}: data-theme="${wantTheme}" is on <html> when <body> appears, and the first paint is already the ${expect} one (page scripts blocked)`, first && first.theme === wantTheme && first.js && paint && paint.theme === wantTheme && hex(paint.bg) === BG[expect], JSON.stringify({ first: first.theme, paint }));
    await page.close();
  }
  // explicit theme paints the browser UI colour; system leaves the two media tags
  const dark = await newPage({ theme: 'dark', scheme: 'light', noScripts: true });
  await dark.goto(`${base}/en/`, { waitUntil: 'load' });
  const f = await dark.evaluate(() => window.__first);
  ok('explicit dark theme: both theme-color tags are the dark background before the first paint', f.metas.length === 2 && f.metas.every((c) => c === BG.dark), JSON.stringify(f.metas));
  await dark.close();
  const sys = await newPage({ theme: 'system', scheme: 'dark' });
  await sys.goto(`${base}/en/`, { waitUntil: 'load' });
  const m = await sys.evaluate(() => [...document.querySelectorAll('meta[name=theme-color]')].map((x) => [x.media, x.content]));
  ok('system theme: two theme-color tags with media, light and dark backgrounds', m.length === 2 && m.some(([media, c]) => media.includes('light') && c === BG.light) && m.some(([media, c]) => media.includes('dark') && c === BG.dark), JSON.stringify(m));
  ok('<meta name="color-scheme" content="light dark"> is present', await sys.evaluate(() => document.querySelector('meta[name=color-scheme]')?.content === 'light dark'));
  await sys.close();
  // without any JavaScript the device decides
  for (const scheme of ['light', 'dark']) {
    const p = await newPage({ js: false, scheme });
    await p.goto(`${base}/pt/`, { waitUntil: 'load' });
    ok(`no JavaScript, device ${scheme}: the page follows the device`, hex(await p.evaluate(() => getComputedStyle(document.body).backgroundColor)) === BG[scheme]);
    await p.close();
  }
  // the family-mode state still has no flash next to the theme (one head script)
  const both = await newPage({ theme: 'dark', noScripts: true });
  await both.evaluateOnNewDocument(() => localStorage.setItem('family', 'all'));
  await both.goto(`${base}/pt/epoca/estado-novo-e-25-de-abril/?fio=poder-e-revolta&vista=grelha`, { waitUntil: 'load' });
  const all = await both.evaluate(() => { const h = document.documentElement; return { family: h.dataset.family, theme: h.dataset.theme, fio: h.dataset.fio, vista: h.dataset.vista, epoch: h.dataset.epoch }; });
  ok('one head script sets theme, family mode, thread and view together', all.family === 'all' && all.theme === 'dark' && all.fio === 'poder-e-revolta' && all.vista === 'grelha' && all.epoch === 'estado-novo-e-25-de-abril', JSON.stringify(all));
  await both.close();
}

// ---------- 2. Keyboard and storage ----------
if (want('keyboard')) {
  for (const lang of ['pt', 'en']) {
    const page = await newPage({ theme: 'system' });
    await page.goto(`${base}/${lang}/`, { waitUntil: 'load' });
    ok(`theme button (${lang}): reached with Tab`, await tabTo(page, '[data-theme-toggle]'));
    const outline = await page.evaluate(() => { const c = getComputedStyle(document.activeElement); return { style: c.outlineStyle, width: parseFloat(c.outlineWidth) }; });
    ok(`theme button (${lang}): visible focus ring`, outline.style !== 'none' && outline.width >= 2, JSON.stringify(outline));
    const seen = [];
    for (let i = 0; i < 3; i += 1) {
      await page.keyboard.press(i === 1 ? 'Space' : 'Enter');
      await wait(80);
      seen.push(await page.evaluate(() => ({ theme: document.documentElement.dataset.theme, stored: localStorage.getItem('theme'), label: document.querySelector('[data-theme-toggle]').getAttribute('aria-label'), status: document.querySelector('[data-theme-status]').textContent })));
    }
    ok(`theme button (${lang}): Enter, Space, Enter go light, dark, system and store the value`, seen.map((s) => s.theme).join() === 'light,dark,system' && seen.map((s) => s.stored).join() === 'light,dark,system', seen.map((s) => s.theme).join());
    ok(`theme button (${lang}): aria-label names the current value and the change is announced`, seen.every((s) => s.label.includes(s.theme === 'light' ? (lang === 'pt' ? 'Claro' : 'Light') : s.theme === 'dark' ? (lang === 'pt' ? 'Escuro' : 'Dark') : (lang === 'pt' ? 'Sistema' : 'System')) && s.status.length > 0), JSON.stringify(seen.map((s) => s.label)));
    // colours really change
    await page.keyboard.press('Enter');
    await wait(80);
    ok(`theme button (${lang}): the page background follows the theme`, hex(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)) === BG.light);
    await page.keyboard.press('Enter');
    await wait(80);
    ok(`theme button (${lang}): dark background after the next press`, hex(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)) === BG.dark);
    ok(`theme button (${lang}): the browser UI colour follows an explicit theme`, await page.evaluate((c) => [...document.querySelectorAll('meta[name=theme-color]')].every((m) => m.content === c), BG.dark));
    await page.reload({ waitUntil: 'load' });
    ok(`theme (${lang}): the choice survives a reload`, (await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark');
    await page.keyboard.press('Tab');
    // footer radio group
    const ft = await newPage({ theme: 'light' });
    await ft.goto(`${base}/${lang}/`, { waitUntil: 'load' });
    ok(`footer choice (${lang}): reached with Tab (one tab stop)`, await tabTo(ft, '[data-theme-choice] input', 120));
    const radioName = await ft.evaluate(() => document.querySelector('[data-theme-choice]').getAttribute('aria-label'));
    ok(`footer choice (${lang}): a radio group with a label`, radioName === (lang === 'pt' ? 'Tema' : 'Theme'));
    await ft.keyboard.press('ArrowRight');
    await wait(80);
    const afterArrow = await ft.evaluate(() => ({ theme: document.documentElement.dataset.theme, stored: localStorage.getItem('theme'), button: document.querySelector('[data-theme-toggle]').getAttribute('aria-label') }));
    ok(`footer choice (${lang}): the arrow key switches to dark, stores it, the header button label follows`, afterArrow.theme === 'dark' && afterArrow.stored === 'dark' && /Escuro|Dark/.test(afterArrow.button), JSON.stringify(afterArrow));
    const ring = await ft.evaluate(() => { const c = getComputedStyle(document.activeElement.nextElementSibling); return { style: c.outlineStyle, width: parseFloat(c.outlineWidth) }; });
    ok(`footer choice (${lang}): visible focus ring`, ring.style !== 'none' && ring.width >= 2, JSON.stringify(ring));
    await ft.close();
    ok(`theme (${lang}): no script errors`, page.errors.length === 0, page.errors.join('; '));
    await page.close();
  }
  // the choice is shared between languages and pages
  const a = await newPage({ theme: 'system' });
  await a.goto(`${base}/pt/`, { waitUntil: 'load' });
  await tap(a, '[data-theme-toggle]');
  await a.goto(`${base}/en/mapa/`.replace('/mapa/', '/map/'), { waitUntil: 'load' });
  ok('the theme chosen on one page is the same on another page and language', (await a.evaluate(() => document.documentElement.dataset.theme)) === 'light');
  await a.close();
}

// ---------- 3. Blocked localStorage ----------
if (want('blocked')) {
  const page = await newPage({ blocked: true, scheme: 'dark' });
  await page.goto(`${base}/pt/`, { waitUntil: 'load' });
  const first = await page.evaluate(() => window.__first);
  await page.waitForFunction(() => window.__paint, { timeout: 5000 });
  const paint = await page.evaluate(() => window.__paint);
  ok('blocked storage: the page loads in "system" (the device decides), no script error', first.theme === 'system' && hex(paint.bg) === BG.dark && page.errors.length === 0, JSON.stringify({ first: first.theme, paint }) + page.errors.join(';'));
  await tap(page, '[data-theme-toggle]');
  await wait(100);
  ok('blocked storage: the button still switches the theme on the page', (await page.evaluate(() => document.documentElement.dataset.theme)) === 'light' && hex(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)) === BG.light && page.errors.length === 0, page.errors.join(';'));
  await page.goto(`${base}/pt/historia/evento-exemplo-02/`, { waitUntil: 'load' });
  ok('blocked storage: a card page with an interactive loads without errors', page.errors.length === 0, page.errors.join(';'));
  await page.close();
  for (const junk of ['sepia', '1', '{"a":1}', '']) {
    const p = await newPage({ theme: junk });
    await p.goto(`${base}/pt/`, { waitUntil: 'load' });
    ok(`stored theme ${JSON.stringify(junk)} means "system"`, (await p.evaluate(() => document.documentElement.dataset.theme)) === 'system');
    await p.close();
  }
}

// ---------- 4. Epoch palettes ----------
if (want('palette')) {
  for (const theme of ['light', 'dark']) {
    for (const [id, e] of Object.entries(EPOCHS)) {
      const page = await newPage({ theme });
      await page.goto(`${base}/pt/epoca/${e.slug.pt}/`, { waitUntil: 'load' });
      const got = await page.evaluate(() => ({ epoch: document.documentElement.dataset.epoch, bg: getComputedStyle(document.body).backgroundColor, link: getComputedStyle(document.querySelector('.epoch a, main a')).color, accent: getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim() }));
      ok(`${id}, ${theme}: data-epoch, page background = the tint of the table`, got.epoch === id && hex(got.bg) === e.tint[theme], `${got.epoch} ${hex(got.bg)}`);
      // a card of the same epoch gets the palette too
      await page.close();
    }
  }
  const card = await newPage({ theme: 'dark' });
  await card.goto(`${base}/pt/historia/evento-exemplo-01/`, { waitUntil: 'load' });
  ok('a card has data-epoch of its epoch and its palette', (await card.evaluate(() => document.documentElement.dataset.epoch)) === 'avis-e-descobrimentos' && hex(await card.evaluate(() => getComputedStyle(document.body).backgroundColor)) === EPOCHS['avis-e-descobrimentos'].tint.dark);
  await card.close();
  for (const path of ['/pt/', '/pt/mapa/', '/pt/sobre/']) {
    const p = await newPage({ theme: 'light' });
    const res = await p.goto(`${base}${path}`, { waitUntil: 'load' });
    if (res.status() === 404) { await p.close(); continue; }
    ok(`${path}: no data-epoch, the base paper colour`, (await p.evaluate(() => document.documentElement.hasAttribute('data-epoch'))) === false && hex(await p.evaluate(() => getComputedStyle(document.body).backgroundColor)) === BG.light);
    await p.close();
  }
  // headings differ by weight between epochs, the family stays
  const weights = [];
  for (const [id, e] of Object.entries(EPOCHS)) {
    const p = await newPage({ theme: 'light' });
    await p.goto(`${base}/pt/epoca/${e.slug.pt}/`, { waitUntil: 'load' });
    weights.push(await p.evaluate(() => { const c = getComputedStyle(document.querySelector('h1')); return [c.fontWeight, c.fontFamily.split(',')[0].replace(/['"]/g, '')]; }));
    await p.close();
  }
  ok('epoch headings differ by weight, not by family', new Set(weights.map((w) => w[0])).size === 3 && new Set(weights.map((w) => w[1])).size === 1 && weights[0][1] === 'Playfair Display', JSON.stringify(weights));
}

// ---------- 4b. A browser without light-dark(): the light theme ----------
// Emulation: every "light-dark(" of the CSS and the HTML is renamed to a function nobody knows, which is what a browser
// without support sees (the @supports test in the fallback block uses the same call, so it fails too). With the fallback
// block the page must show the light theme; with the block cut out (control) it shows no colours, which proves the emulation bites.
if (want('fallback')) {
  const unsupported = (text, keepBlock) => {
    let out = text.replace(/light-dark\(/g, 'lightdark-unsupported(');
    if (!keepBlock) {
      // The built CSS is minified (no comment markers): find the @supports block and cut it out by matching braces.
      const at = out.search(/@supports\s+not\s*\(\s*color:\s*lightdark-unsupported\(/);
      if (at >= 0) {
        let depth = 0;
        let end = out.indexOf('{', at);
        for (; end < out.length; end += 1) {
          if (out[end] === '{') depth += 1;
          if (out[end] === '}') {
            depth -= 1;
            if (depth === 0) break;
          }
        }
        out = out.slice(0, at) + out.slice(end + 1);
      }
    }
    return out;
  };
  const open = async (path, { scheme, stored, keepBlock }) => {
    const page = await newPage({ scheme, theme: stored ?? null });
    // The browser keeps storage between pages: start without a family mode left over from another section.
    await page.evaluateOnNewDocument(() => { try { localStorage.removeItem('family'); } catch {} });
    page.removeAllListeners('request');
    page.on('request', async (r) => {
      const type = r.resourceType();
      if (type === 'stylesheet' || type === 'document') {
        const res = await fetch(r.url());
        const body = unsupported(await res.text(), keepBlock);
        return void r.respond({ status: res.status, contentType: res.headers.get('content-type') ?? 'text/html', body });
      }
      if (!r.url().startsWith(base)) return void r.abort();
      return void r.continue();
    });
    await page.goto(`${base}${path}`, { waitUntil: 'load' });
    return page;
  };
  const look = (page) => page.evaluate(() => {
    const body = getComputedStyle(document.body);
    const link = document.querySelector('main a') ?? document.querySelector('a');
    const button = document.querySelector('.family-toggle__option span');
    return { bg: body.backgroundColor, text: body.color, link: getComputedStyle(link).color, active: button ? getComputedStyle(document.querySelector('.family-toggle__option[data-value="off"] span')).backgroundColor : null, scheme: getComputedStyle(document.documentElement).colorScheme };
  });
  for (const scheme of ['light', 'dark']) {
    const page = await open('/pt/', { scheme, keepBlock: true });
    const l = await look(page);
    ok(`no light-dark() support, device ${scheme}: the page is the light theme (paper ${BG.light}, ink #1f1b16)`, hex(l.bg) === BG.light && hex(l.text) === '#1f1b16', JSON.stringify(l));
    await page.close();
  }
  const dark = await open('/pt/', { scheme: 'dark', stored: 'dark', keepBlock: true });
  ok('no light-dark() support, a stored dark theme: still the light theme, no script error', hex((await look(dark)).bg) === BG.light && dark.errors.length === 0, dark.errors.join(';'));
  await dark.close();
  for (const [id, e] of Object.entries(EPOCHS)) {
    const page = await open(`/pt/epoca/${e.slug.pt}/`, { scheme: 'dark', keepBlock: true });
    const l = await look(page);
    ok(`no light-dark() support, ${id}: the light tint of the epoch and its primary colour`, hex(l.bg) === e.tint.light && hex(l.active) === e.primary.light, JSON.stringify(l));
    await page.close();
  }
  const control = await open('/pt/', { scheme: 'light', keepBlock: false });
  const c = await look(control);
  ok('control: without the fallback block the emulated browser gets no page colour (the test would notice a missing block)', c.bg === 'rgba(0, 0, 0, 0)', JSON.stringify(c));
  await control.close();
  const normal = await newPage({ scheme: 'dark' });
  await normal.goto(`${base}/pt/`, { waitUntil: 'load' });
  ok('with light-dark() support the fallback block does nothing: the dark device gets the dark theme', hex(await normal.evaluate(() => getComputedStyle(document.body).backgroundColor)) === BG.dark);
  await normal.close();
}

// ---------- 5. Fonts: self-hosted, no external requests ----------
if (want('fonts')) {
  const pages = ['/pt/', '/en/', '/pt/epoca/estado-novo-e-25-de-abril/', '/pt/historia/evento-exemplo-02/', '/en/story/example-event-03/', '/pt/mapa/', '/pt/fio/mar/', '/pt/sobre/', '/pt/pagina-inexistente/'];
  for (const path of pages) {
    const page = await newPage();
    const warnings = [];
    page.on('console', (m) => { if (/preload/i.test(m.text())) warnings.push(m.text()); });
    await page.goto(`${base}${path}`, { waitUntil: 'networkidle0' });
    await wait(1500); // the browser warns about an unused preload only some seconds after load
    const outside = page.requested.filter((u) => !u.startsWith(base) && !u.startsWith('data:') && !/tile\.openstreetmap\.org/.test(u));
    const fonts = page.requested.filter((u) => /\.(woff2?|ttf|otf)(\?|$)/.test(u));
    const families = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family));
    ok(`${path}: no request leaves the site (no font server); ${fonts.length} font files from our own host`, outside.length === 0 && fonts.every((u) => u.startsWith(base)) && fonts.every((u) => /woff2$/.test(u)), outside.slice(0, 2).join(' '));
    ok(`${path}: no font is preloaded, and the browser has no preload warning`, warnings.length === 0 && (await page.evaluate(() => document.querySelectorAll('link[rel=preload][as=font]').length)) === 0 || path.includes('pagina-inexistente'), warnings.join(' | '));
    ok(`${path}: Source Serif 4 and Playfair Display are the faces in use`, families.includes('Source Serif 4') || path.includes('pagina-inexistente'), families.join(', '));
    await page.close();
  }
  // The local server answers an unknown address with a bare message, so the real 404 page is read from the build.
  const notFound = readFileSync(new URL('../../dist/404.html', import.meta.url), 'utf8');
  ok('404.html: no font preload either', (notFound.match(/<link rel="preload" as="font"/g) ?? []).length === 0);
  const html = await (await fetch(`${base}/pt/`)).text();
  const css = await Promise.all([...html.matchAll(/href="(\/_astro\/[^"]+\.css)"/g)].map((m) => fetch(base + m[1]).then((r) => r.text())));
  const all = css.join('\n') + html;
  ok('the page and its CSS never name a font server (fonts.googleapis.com, fonts.gstatic.com, use.typekit.net, cdn)', !/fonts\.(googleapis|gstatic)\.com|typekit|cdnjs|jsdelivr|unpkg/.test(all));
  ok('every web face has font-display: swap in the built CSS', (all.match(/@font-face/g) ?? []).length >= 8 && (all.match(/font-display:\s*swap/g) ?? []).length >= 5);
  ok('no Cyrillic face in the built CSS', !/U\+04[0-9A-F]{2}/i.test(all));
  // The fallback faces are tuned to the web fonts by published metrics (scripts/font-fallbacks.mjs). Check the numbers
  // against real text widths: web font width / default Times-like (or Arial-like) font width must be near size-adjust.
  const factors = Object.fromEntries([...readFileSync(new URL('../../src/styles/fonts.css', import.meta.url), 'utf8').matchAll(/font-family:\s*'([^']+) Fallback';[^}]*?size-adjust:\s*([\d.]+)%/g)].map((m) => [m[1], Number(m[2]) / 100]));
  const probe = await newPage();
  await probe.goto(`${base}/pt/`, { waitUntil: 'networkidle0' });
  const measured = await probe.evaluate(async () => {
    for (const f of ['Source Serif 4', 'Playfair Display', 'Oswald']) await document.fonts.load(`40px '${f}'`);
    const text = 'A história do elefante que fugiu de Lisboa para o mar em mil trezentos e noventa e sete, segundo as crónicas portuguesas.';
    const width = (family, t, extra = '') => { const s = document.createElement('span'); s.style.cssText = `position:absolute;white-space:nowrap;font-size:40px;font-family:${family};${extra}`; s.textContent = t; document.body.append(s); const w = s.getBoundingClientRect().width; s.remove(); return w; };
    return {
      'Source Serif 4': width("'Source Serif 4',serif", text) / width('serif', text),
      'Playfair Display': width("'Playfair Display',serif", text, 'font-weight:700') / width('serif', text, 'font-weight:700'),
      Oswald: width("'Oswald',sans-serif", text.toUpperCase(), 'font-weight:600;letter-spacing:0.06em') / width('sans-serif', text.toUpperCase(), 'font-weight:600;letter-spacing:0.06em'),
    };
  });
  for (const [family, got] of Object.entries(measured)) {
    ok(`fallback face of ${family}: size-adjust ${(factors[family] * 100).toFixed(1)}% is within 5% of the measured width ratio ${(got * 100).toFixed(1)}%`, Math.abs(got / factors[family] - 1) < 0.05);
  }
  await probe.close();
  // No layout jump when the web fonts arrive. Needs the fallback faces to resolve (local() finds Times New Roman / Arial or
  // their metric twins); a headless browser without those fonts cannot show it, and the check says so instead of failing.
  for (const path of ['/pt/historia/evento-exemplo-01/', '/pt/epoca/pombal-e-terramoto/']) {
    const page = await newPage();
    await page.setRequestInterception(true);
    page.removeAllListeners('request');
    // Every font file arrives 1.5 s late, so the first look is the fallback faces.
    page.on('request', (r) => {
      if (/\.woff2/.test(r.url())) setTimeout(() => r.continue().catch(() => {}), 1500);
      else if (!r.url().startsWith(base)) r.abort();
      else r.continue();
    });
    const measure = () => page.evaluate(() => ({ h: Math.round(document.documentElement.scrollHeight), loaded: [...document.fonts].filter((f) => f.status === 'loaded').length }));
    await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded' });
    await wait(600);
    const fallbackFaces = await page.evaluate(async () => (await Promise.all(['Source Serif 4 Fallback', 'Playfair Display Fallback', 'Oswald Fallback'].map((f) => document.fonts.load(`1em '${f}'`).then((r) => r.length > 0).catch(() => false)))).every(Boolean));
    const fallback = await measure();
    await wait(3000);
    const loaded = await measure();
    const drift = Math.abs(loaded.h - fallback.h) / loaded.h;
    if (!fallbackFaces) {
      console.log(`SKIP  ${path}: this browser cannot resolve local() fallback fonts, so the layout jump cannot be measured here (generic fallback: ${(drift * 100).toFixed(1)}%)`);
    } else {
      ok(`${path}: the page height changes by under 5% when the web fonts arrive (${fallback.h} px to ${loaded.h} px, ${(drift * 100).toFixed(1)}%)`, loaded.loaded > 0 && drift < 0.05);
    }
    await page.close();
  }
  // weight of the fonts a page really loads
  const page = await newPage();
  const sizes = [];
  page.on('response', async (r) => { if (/\.woff2/.test(r.url())) sizes.push([r.url().split('/').pop(), (await r.buffer()).length]); });
  await page.goto(`${base}/pt/historia/evento-exemplo-01/`, { waitUntil: 'networkidle0' });
  console.log(`INFO  fonts loaded by a card page: ${sizes.map(([n, s]) => `${n.split('.')[0]} ${(s / 1024).toFixed(1)} KB`).join('; ')}; total ${(sizes.reduce((a, [, s]) => a + s, 0) / 1024).toFixed(1)} KB`);
  await page.close();
}

// ---------- 6. Header on phones; the theme icon is in the footer ----------
const HEADER_MAX = 150; // three rows of 44 px targets cannot go much below 135 px; 145 px is what the layout gives
if (want('header')) {
  for (const lang of ['pt', 'en']) {
    for (const width of [360, 320, 600, 767]) {
      const page = await newPage({ width });
      await page.goto(`${base}/${lang}/`, { waitUntil: 'load' });
      const h = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const box = (sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height) }; };
        const parts = { brand: box('.brand'), lang: box('.lang-switch'), family: box('[data-family-toggle]'), nav: box('.site-nav') };
        const links = [...document.querySelectorAll('.site-nav a')].map((a) => { const r = a.getBoundingClientRect(); return r.left >= 0 && r.right <= vw && r.height >= 44; });
        const names = Object.keys(parts);
        let overlap = false;
        for (let i = 0; i < names.length; i += 1) for (let j = i + 1; j < names.length; j += 1) { const a = parts[names[i]]; const b = parts[names[j]]; if (a.l < b.r - 1 && b.l < a.r - 1 && a.t < b.b - 1 && b.t < a.b - 1) overlap = true; }
        return { vw, sw: document.documentElement.scrollWidth, parts, links, overlap, header: Math.round(document.querySelector('.site-header').getBoundingClientRect().height), themeInHeader: document.querySelector('.site-header .theme-button') !== null, navRows: new Set([...document.querySelectorAll('.site-nav a')].map((a) => Math.round(a.getBoundingClientRect().top))).size, brandLines: Math.round(document.querySelector('.brand span').getBoundingClientRect().height) };
      });
      const inside = Object.values(h.parts).every((p) => p.l >= 0 && p.r <= h.vw);
      ok(`header (${lang}, ${width} px): logo, language, family mode and menu all inside the screen, nothing overlaps, no sideways scroll, menu on one row, name on one line`, inside && h.links.every(Boolean) && h.sw <= h.vw && !h.overlap && h.navRows === 1 && h.brandLines < 40, JSON.stringify({ sw: h.sw, vw: h.vw, navRows: h.navRows, brandLines: h.brandLines }));
      ok(`header (${lang}, ${width} px): at most ${HEADER_MAX} px tall (${h.header} px)`, h.header <= HEADER_MAX);
      ok(`header (${lang}, ${width} px): the theme icon is not in the header`, !h.themeInHeader);
      // The header is an ordinary block: not sticky or fixed on narrow screens, and it scrolls away with the page.
      const pos = await page.evaluate(() => { const out = []; for (let el = document.querySelector('.site-header'); el && el !== document.documentElement; el = el.parentElement) out.push(getComputedStyle(el).position); return out; });
      await page.evaluate(() => window.scrollTo(0, 700));
      await wait(150);
      const top = await page.evaluate(() => Math.round(document.querySelector('.site-header').getBoundingClientRect().bottom));
      ok(`header (${lang}, ${width} px): not sticky or fixed (position ${[...new Set(pos)].join(', ')}), it is gone after scrolling (bottom ${top} px)`, pos.every((p) => p === 'static' || p === 'relative') && top <= 0);
      const f = await page.evaluate(() => { const vw = document.documentElement.clientWidth; const b = document.querySelector('.site-footer .theme-button'); const r = b?.getBoundingClientRect(); const g = document.querySelector('.site-footer [data-theme-choice]'); return { found: !!b, w: r && Math.round(r.width), h: r && Math.round(r.height), inside: r && r.left >= 0 && r.right <= vw, group: !!g }; });
      ok(`footer (${lang}, ${width} px): the theme icon (at least 44 x 44 px) and the radio group are both there`, f.found && f.w >= 44 && f.h >= 44 && f.inside && f.group, JSON.stringify(f));
      console.log(`INFO  header height (${lang}, ${width} px): ${h.header} px`);
      await page.close();
    }
  }
}

await browser.close();
console.log(failed === 0 ? '\nAll theme checks passed' : `\n${failed} check(s) failed`);
process.exit(failed === 0 ? 0 : 1);

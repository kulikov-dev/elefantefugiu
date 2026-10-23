// Browser checks for the static pages, the mistake report form, "Continue" on the home page and the QR address.
// Run against dist/ served by serve.mjs (base path "/"):   node pages.mjs [static form continue qr]
// No request ever leaves for formsubmit.co: the form is answered by the test itself.
import { launchBrowser } from './browser.mjs';
import { epochPath, epochs, en, pt, published, readyEpochs, HOME_START_ID } from './data.mjs';

const base = process.env.BASE_URL || 'http://localhost:4400';
const ONLY = process.argv.slice(2);
const want = (name) => ONLY.length === 0 || ONLY.includes(name);
const EMAIL = 'elefantefugiu@gmail.com';
const PAGES = {
  about: { pt: 'sobre', en: 'about', ru: 'o-proekte' },
  method: { pt: 'metodo', en: 'method', ru: 'metod' },
  legal: { pt: 'legal', en: 'legal', ru: 'pravovaya-informaciya' },
  report: { pt: 'corrigir', en: 'report', ru: 'oshibka' },
};

let failed = 0;
const ok = (name, cond, extra = '') => {
  if (!cond) failed += 1;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
};
const browser = await launchBrowser();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** `answer(request)`: what happens to a request to formsubmit.co (default: success). */
const newPage = async ({ width = 360, js = true, answer = null, saved = null } = {}) => {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 900, isMobile: width < 700, hasTouch: width < 700 });
  if (!js) await page.setJavaScriptEnabled(false);
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.posts = [];
  await page.setRequestInterception(true);
  page.on('request', (r) => {
    if (/formsubmit\.co/.test(r.url())) {
      page.posts.push({ url: r.url(), method: r.method(), body: r.postData() ?? '' });
      if (answer) answer(r);
      else r.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"success":"true","message":"ok"}' });
    } else r.continue();
  });
  if (saved) await page.evaluateOnNewDocument((s) => { try { if (!sessionStorage.getItem('__s')) { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); sessionStorage.setItem('__s', '1'); } } catch (e) {} }, saved);
  return page;
};

// ---------- 1. Static pages ----------
if (want('static')) {
  for (const key of ['about', 'method', 'legal']) {
    for (const lang of ['pt', 'en', 'ru']) {
      for (const width of [320, 1280]) {
        const page = await newPage({ width });
        await page.goto(`${base}/${lang}/${PAGES[key][lang]}/`, { waitUntil: 'load' });
        const s = await page.evaluate(() => {
          const links = [...document.querySelectorAll('.static a')].map((a) => ({ href: a.getAttribute('href'), text: a.textContent.trim() }));
          return {
            h1: document.querySelectorAll('h1').length,
            h2: [...document.querySelectorAll('.static h2')].map((h) => h.id),
            lead: document.querySelector('.static__lead')?.textContent.trim().length ?? 0,
            overflow: document.documentElement.scrollWidth - innerWidth,
            robots: document.querySelector('meta[name=robots]')?.content ?? null,
            alternates: [...document.querySelectorAll('link[rel=alternate]')].map((l) => l.getAttribute('hreflang')).sort().join(),
            email: links.filter((l) => l.href === 'mailto:elefantefugiu@gmail.com').length,
            raw: document.querySelector('.static').innerHTML.includes('{{'),
            links,
          };
        });
        // The legal page opens with its summary section, not with a lead paragraph (docs/texts-*.md).
        ok(`static (${key}, ${lang}, ${width} px): one h1, sections with ids${key === 'legal' ? '' : ', a lead'}, no sideways scroll, no leftover {{token}}`, s.h1 === 1 && s.h2.length >= 4 && (key === 'legal' || s.lead > 40) && s.overflow <= 0 && !s.raw, JSON.stringify({ h2: s.h2.length, lead: s.lead, overflow: s.overflow }));
        // The contact address ("Write to us: ...") is on About and Legal; the Method page has no contact line of its own.
        ok(`static (${key}, ${lang}, ${width} px): indexable, hreflang pt, en, ru and x-default${key === 'method' ? '' : ', the contact address is a link'}`, s.robots === null && s.alternates === 'en,pt,ru,x-default' && (key === 'method' || s.email >= 1), JSON.stringify([s.robots, s.alternates, s.email]));
        if (width === 1280) {
          const bad = [];
          for (const l of s.links.filter((x) => x.href.startsWith('/'))) {
            const res = await page.evaluate(async (h) => (await fetch(h.split('#')[0])).status, l.href);
            if (res !== 200) bad.push(l.href);
          }
          ok(`static (${key}, ${lang}): every internal link of the text leads to an existing page`, bad.length === 0, bad.join(' '));
        }
        await page.close();
      }
    }
  }
}

// ---------- 2. The mistake report form ----------
if (want('form')) {
  for (const lang of ['pt', 'en', 'ru']) {
    const page = await newPage({ width: 360 });
    const card = `https://example.org/${lang}/x/`;
    await page.goto(`${base}/${lang}/${PAGES.report[lang]}/?url=${encodeURIComponent(card)}`, { waitUntil: 'load' });
    const f = await page.evaluate(() => ({
      action: document.querySelector('[data-report-form]').getAttribute('action'),
      method: document.querySelector('[data-report-form]').method,
      url: document.querySelector('#f-url').value,
      labels: [...document.querySelectorAll('.field label')].every((l) => document.getElementById(l.htmlFor)),
      honey: (() => { const h = document.querySelector('[name=_honey]'); return { tab: h.tabIndex, hidden: h.getAttribute('aria-hidden'), w: h.getBoundingClientRect().width }; })(),
      hidden: Object.fromEntries([...document.querySelectorAll('input[type=hidden]')].map((i) => [i.name, i.value])),
      overflow: document.documentElement.scrollWidth - innerWidth,
      robots: document.querySelector('meta[name=robots]')?.content ?? null,
    }));
    ok(`form (${lang}): posts to FormSubmit for ${EMAIL}, with a subject, no captcha page, and a way back to this page`, f.action === `https://formsubmit.co/${EMAIL}` && f.method === 'post' && new RegExp(`\\(${lang}\\)`).test(f.hidden._subject) && f.hidden._captcha === 'false' && new RegExp(`/${PAGES.report[lang]}/(\\?[^#]*)?#sent$`).test(f.hidden._next), JSON.stringify(f.hidden));
    ok(`form (${lang}): the address of the card from ?url= fills the first field; every field has a label; the honeypot is out of reach`, f.url === card && f.labels && f.honey.tab === -1 && f.honey.hidden === 'true' && f.honey.w <= 4, JSON.stringify([f.url, f.honey]));
    ok(`form (${lang}): no sideways scroll at 360 px, the page is not indexed`, f.overflow <= 0 && f.robots === 'noindex');
    // a javascript: address in ?url= is not put into the field
    await page.goto(`${base}/${lang}/${PAGES.report[lang]}/?url=${encodeURIComponent('javascript:alert(1)')}`, { waitUntil: 'load' });
    ok(`form (${lang}): ?url= with anything but http(s) is ignored`, (await page.$eval('#f-url', (i) => i.value)) === '');
    // too short: no request, an error under the field
    await page.click('[data-report-submit]');
    const short = await page.evaluate(() => ({ err: document.querySelector('#f-what-error').textContent.trim(), shown: !document.querySelector('#f-what-error').hidden, invalid: document.querySelector('#f-what').getAttribute('aria-invalid'), focus: document.activeElement.id }));
    ok(`form (${lang}): an empty description sends nothing, shows the error and focuses the field`, short.shown && short.err.length > 5 && short.invalid === 'true' && short.focus === 'f-what' && page.posts.length === 0, JSON.stringify(short));
    // good: one request with the fields, confirmation, no leaving the page
    await page.type('#f-what', 'A data está errada.');
    await page.type('#f-email', 'leitor@example.org');
    await page.click('[data-report-submit]');
    await page.waitForFunction(() => !document.getElementById('sent').hidden, { timeout: 5000 });
    const sent = await page.evaluate(() => ({ form: document.querySelector('[data-report-form]').hidden, focus: document.activeElement.id, title: document.querySelector('#sent h2').textContent.trim() }));
    const post = page.posts[0];
    ok(`form (${lang}): one request to the AJAX address with the description, the e-mail and the page; then the confirmation takes the place of the form`, page.posts.length === 1 && post.url === `https://formsubmit.co/ajax/${EMAIL}` && post.method === 'POST' && /A data est/.test(post.body) && /leitor@example\.org/.test(post.body) && sent.form === true && sent.focus === 'sent', JSON.stringify({ n: page.posts.length, url: post?.url, sent }));
    ok(`form (${lang}): no script errors`, page.errors.length === 0, page.errors.join(';'));
    await page.close();
  }
  // a refused send: the message about writing directly, the button works again, nothing is lost
  const bad = await newPage({ answer: (r) => r.respond({ status: 500, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"success":"false"}' }) });
  await bad.goto(`${base}/pt/corrigir/`, { waitUntil: 'load' });
  await bad.type('#f-what', 'Texto do erro encontrado.');
  await bad.click('[data-report-submit]');
  await bad.waitForFunction(() => !document.querySelector('[data-report-failed]').hidden, { timeout: 5000 });
  const r = await bad.evaluate(() => ({ failed: document.querySelector('[data-report-failed]').textContent, link: document.querySelector('[data-report-failed] a').getAttribute('href'), disabled: document.querySelector('[data-report-submit]').disabled, text: document.querySelector('#f-what').value }));
  ok('form: when the service refuses, the reader sees the address to write to, can try again and keeps the text', r.link === `mailto:${EMAIL}` && r.disabled === false && r.text === 'Texto do erro encontrado.', JSON.stringify(r));
  await bad.close();
  // without JavaScript the form still has everything it needs
  const nojs = await newPage({ js: false });
  await nojs.goto(`${base}/en/report/`, { waitUntil: 'load' });
  const n = await nojs.evaluate(() => ({ action: document.querySelector('[data-report-form]').action, required: document.querySelector('#f-what').required, mail: [...document.querySelectorAll('a[href^="mailto:"]')].length, sentHidden: document.getElementById('sent').hidden }));
  ok('form without JavaScript: a real form post, a required description, the address to write to; the confirmation waits for #sent', n.action === `https://formsubmit.co/${EMAIL}` && n.required && n.mail >= 2 && n.sentHidden, JSON.stringify(n));
  await nojs.close();
  const back = await newPage({ width: 360 });
  await back.goto(`${base}/pt/corrigir/#sent`, { waitUntil: 'load' });
  ok('form: opened at #sent (the service sends the reader here) the confirmation shows and the form is gone', await back.evaluate(() => !document.getElementById('sent').hidden && document.querySelector('[data-report-form]').hidden));
  await back.close();
  // the link from a card leads here with the address of the card
  const cardPage = await newPage();
  const reported = published.find((c) => c.id === HOME_START_ID) ?? published[0];
  await cardPage.goto(`${base}${pt(reported)}`, { waitUntil: 'load' });
  const href = await cardPage.$eval('.actions a[href*="/corrigir/"]', (a) => a.getAttribute('href'));
  ok('form: the small link "Reparou numa imprecisão..." under Share carries the address and the title of the story', /\/pt\/corrigir\/\?url=http/.test(href) && decodeURIComponent(href).includes(`/pt/historia/${reported.slug.pt}/`) && href.includes('&title='), href);
  const plain = await cardPage.$$eval('footer a[href$="/corrigir/"]', (as) => as.length);
  ok('form: the "Encontrou um erro?" link of the footer is the plain address of the form', plain === 1, String(plain));
  await cardPage.close();
}

// ---------- 3. "Continue" on the home page ----------
if (want('continue')) {
  const fresh = await newPage();
  // The browser profile is shared by the suite: forget what the earlier sections visited, as a new reader would have nothing.
  await fresh.goto(`${base}/pt/`, { waitUntil: 'load' });
  await fresh.evaluate(() => localStorage.clear());
  await fresh.reload({ waitUntil: 'load' });
  ok('continue: a new reader sees no "Continue" button', await fresh.$eval('[data-continue]', (a) => a.hidden));
  await fresh.close();

  const visit = await newPage();
  const [first, second] = readyEpochs;
  const cardOfFirst = published.find((c) => c.epoch === first.id);
  await visit.goto(`${base}${epochPath(second)}`, { waitUntil: 'load' });
  ok('continue: visiting an epoch page remembers the epoch id', (await visit.evaluate(() => localStorage.getItem('lastEpoch'))) === second.id);
  await visit.goto(`${base}${pt(cardOfFirst)}`, { waitUntil: 'load' });
  ok('continue: a card remembers the epoch of the card', (await visit.evaluate(() => localStorage.getItem('lastEpoch'))) === first.id);
  for (const [lang, word] of [['pt', 'Continuar onde parou'], ['en', 'Continue where you left off'], ['ru', 'Вы остановились']]) {
    const slug = first.slug[lang];
    await visit.goto(`${base}/${lang}/`, { waitUntil: 'load' });
    const b = await visit.$eval('[data-continue]', (a) => ({ hidden: a.hidden, text: a.textContent.trim(), href: a.getAttribute('href') }));
    ok(`continue (${lang}): the band shows with the name of the epoch and leads to it`, !b.hidden && b.text.startsWith(word) && b.href.endsWith(`/${slug}/`), JSON.stringify(b));
  }
  await visit.close();

  const stale = await newPage({ saved: { lastEpoch: epochs.find((m) => !readyEpochs.includes(m)).id } });
  await stale.goto(`${base}/pt/`, { waitUntil: 'load' });
  ok('continue: an epoch without a page, or a foreign value, shows nothing', await stale.$eval('[data-continue]', (a) => a.hidden));
  await stale.close();

  const blocked = await browser.newPage();
  await blocked.evaluateOnNewDocument(() => { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } }); });
  const errors = [];
  blocked.on('pageerror', (e) => errors.push(e.message));
  await blocked.goto(`${base}/pt/epoca/pombal-e-terramoto/`, { waitUntil: 'load' });
  await blocked.goto(`${base}/pt/`, { waitUntil: 'load' });
  ok('continue: blocked storage - no error, no button', errors.length === 0 && (await blocked.$eval('[data-continue]', (a) => a.hidden)));
  await blocked.close();
}

// ---------- 4. The QR address ----------
if (want('qr')) {
  const qrCard = published.find((c) => c.id === HOME_START_ID) ?? published[0];
  const QR = `/p/${qrCard.id}/`;
  for (const [language, saved, expect] of [['pt-PT', null, pt(qrCard)], ['en-GB', null, en(qrCard)], ['ru-RU', null, `/ru/istoriya/${qrCard.slug.ru ?? qrCard.slug.en}/`], ['ru-RU', 'en', en(qrCard)]]) {
    const page = await browser.newPage();
    await page.evaluateOnNewDocument((l, s) => { Object.defineProperty(navigator, 'language', { get: () => l }); if (s) localStorage.setItem('lang', s); }, language, saved);
    await page.goto(`${base}${QR}`, { waitUntil: 'load' });
    await page.waitForFunction(() => !location.pathname.startsWith('/p/'), { timeout: 5000 }).catch(() => {});
    const url = new URL(page.url());
    ok(`qr: ${QR} with browser ${language}${saved ? ` and saved ${saved}` : ''} leads to the card with ?src=qr`, url.pathname === expect && url.searchParams.get('src') === 'qr', page.url());
    await page.close();
  }
  const nojs = await newPage({ js: false });
  await nojs.goto(`${base}${QR}`, { waitUntil: 'load' });
  const links = await nojs.$$eval('.lang-chooser__links a', (as) => as.map((a) => a.getAttribute('href')));
  ok('qr without JavaScript: three links to the card, each with ?src=qr; the page is noindex', links.length === 3 && links.every((h) => h.endsWith('?src=qr')) && (await nojs.$eval('meta[name=robots]', (m) => m.content)) === 'noindex', links.join(' '));
  await nojs.close();
}

await browser.close();
console.log(failed === 0 ? '\nAll page checks passed' : `\n${failed} check(s) failed`);
process.exit(failed === 0 ? 0 : 1);

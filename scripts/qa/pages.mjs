// Browser checks for the static pages, the mistake report form, "Continue" on the home page, the QR address, the "read" marks and "Then and now".
// Run against dist/ served by serve.mjs (base path "/"):   node pages.mjs [static form continue qr read thennow tone]
// No request ever leaves for formsubmit.co: the form is answered by the test itself.
import { launchBrowser } from './browser.mjs';
import { epochPath, epochs, en, pt, published, readyEpochs, threadPath, threads, HOME_START_ID } from './data.mjs';

const base = process.env.BASE_URL || 'http://localhost:4400';
const ONLY = process.argv.slice(2);
const want = (name) => ONLY.length === 0 || ONLY.includes(name);
const EMAIL = 'elefantefugiu@gmail.com';
const FORM = '72b2e1f6b2547e714da237559c8e643f'; // the id of the form on FormSubmit (src/data/static-pages.ts)
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
    ok(`form (${lang}): posts to FormSubmit by the id of the form, with a subject, no captcha page, and a way back to this page`, f.action === `https://formsubmit.co/${FORM}` && f.method === 'post' && new RegExp(`\\(${lang}\\)`).test(f.hidden._subject) && f.hidden._captcha === 'false' && new RegExp(`/${PAGES.report[lang]}/(\\?[^#]*)?#sent$`).test(f.hidden._next), JSON.stringify(f.hidden));
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
    ok(`form (${lang}): one request to the AJAX address with the description, the e-mail and the page; then the confirmation takes the place of the form`, page.posts.length === 1 && post.url === `https://formsubmit.co/ajax/${FORM}` && post.method === 'POST' && /A data est/.test(post.body) && /leitor@example\.org/.test(post.body) && sent.form === true && sent.focus === 'sent', JSON.stringify({ n: page.posts.length, url: post?.url, sent }));
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
  // without JavaScript the form still posts (the id of the form is in the page), and the e-mail is written as "name [at] host" only
  const nojs = await newPage({ js: false });
  await nojs.goto(`${base}/en/report/`, { waitUntil: 'load' });
  const n = await nojs.evaluate(() => ({ action: document.querySelector('[data-report-form]').action, required: document.querySelector('#f-what').required, mail: [...document.querySelectorAll('a[href^="mailto:"]')].length, shown: [...document.querySelectorAll('.email')].map((e) => e.textContent), raw: document.documentElement.outerHTML.includes('elefantefugiu@'), sentHidden: document.getElementById('sent').hidden }));
  ok('form without JavaScript: a real form post to the id of the form, a required description, no e-mail in the page ("[at]" only); the confirmation waits for #sent', n.action === `https://formsubmit.co/${FORM}` && n.required && n.mail === 0 && n.shown.length >= 1 && n.shown.every((x) => x === 'elefantefugiu [at] gmail.com') && !n.raw && n.sentHidden, JSON.stringify(n));
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

  // The query string of the reader survives the redirects (src/lib/lang-choice.ts): the sources of the visits (?src=, ?utm_source=) are not lost.
  for (const [from, to, what] of [
    ['/?src=x', '/pt/?src=x', 'the root keeps ?src'],
    ['/?utm_source=news#a', '/pt/?utm_source=news#a', 'the root keeps ?utm_source and the hash'],
    [`${QR}?src=ig`, `${pt(qrCard)}?src=ig`, 'a QR address with its own ?src (ig) is not turned into ?src=qr'],
  ]) {
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(() => localStorage.setItem('lang', 'pt'));
    await page.goto(`${base}${from}`, { waitUntil: 'load' });
    await page.waitForFunction(() => location.pathname.split('/').length > 3 || location.pathname === '/pt/', { timeout: 5000 }).catch(() => {});
    const url = new URL(page.url());
    ok(`redirect: ${from} -> ${to} (${what})`, url.pathname + url.search + url.hash === to, page.url());
    await page.close();
  }

  // The counter gets the source as the referrer (count.js sends it as r); only on a build for a public address, where the counter is on.
  const homeHtml = await (await fetch(`${base}/pt/`)).text();
  if (!homeHtml.includes('goatcounter/count.js')) console.log('SKIP  counter: this build has no counter (SITE_URL is a local address)');
  else {
    // [query, the page the visit came from, what `r` must be (null: none)]
    for (const [query, from, want] of [
      ['?src=test', 'https://example.org/', 'test'],
      ['?utm_source=news', '', 'news'],
      ['', '', null],
      ['', `${base}/pt/mapa/`, null],
      ['', 'https://kulikov-dev.github.io/elefantefugiu/pt/', 'old-domain'],
      ['', 'https://example.org/page', 'https://example.org/page'],
    ]) {
      const page = await browser.newPage();
      await page.setRequestInterception(true);
      const seen = [];
      page.on('request', (r) => {
        if (r.url().includes('goatcounter.com/count')) {
          seen.push(new URL(r.url()));
          r.abort();
        } else r.continue();
      });
      // The counter does not count a local address; this lets the test see what it would send.
      // The page the visit came from is set as document.referrer: the browser does not give a cross-origin address to a page opened by a test.
      await page.evaluateOnNewDocument((ref) => {
        let v;
        Object.defineProperty(window, 'goatcounter', { configurable: true, get: () => v, set: (x) => { x.allow_local = true; v = x; } });
        if (ref) Object.defineProperty(document, 'referrer', { configurable: true, get: () => ref });
      }, from);
      await page.goto(`${base}/pt/${query}`, { waitUntil: 'networkidle0' });
      await wait(500);
      const hit = seen[0];
      const sent = hit?.searchParams.get('r') ?? null;
      ok(`counter: /pt/${query} from ${from || 'nowhere'} sends ${want ? `the referrer "${want}"` : 'no referrer'} to GoatCounter`, Boolean(hit) && sent === want && hit.searchParams.get('p') === '/pt/', hit ? hit.search : 'no request');
      await page.close();
    }
  }
}

// ---- "read" marks: the end of the story seen + time on the page -> the tick in the list of the epoch -> reset on the legal page ----
if (want('read')) {
  const story = published.find((e) => e.min_age === 'all' && !e.sensitive) ?? published[0];
  const epoch = epochs.find((e) => e.id === story.epoch);
  const inThisEpoch = published.filter((e) => e.epoch === epoch.id);
  const shownIn = (e, mode) => mode === 'off' || (!e.sensitive && (mode === 'all' ? e.min_age === 'all' : e.min_age === 'all' || e.min_age === '12'));
  const saved = (page) => page.evaluate(() => { try { return JSON.parse(localStorage.getItem('readStories') ?? '[]'); } catch { return null; } });
  /** The story page opened with the wait shortened (delay, ms) and, when asked, with the tab hidden; ends after `stay` ms. */
  const openStory = async ({ delay = null, hidden = false, stay = 1800, width = 1280 } = {}) => {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 900 });
    await page.evaluateOnNewDocument((d, h) => {
      // Every page of the browser shares one localStorage: each test starts from nothing read.
      try { localStorage.removeItem('readStories'); } catch {}
      if (d !== null) window.__readDelayMs = d;
      if (h) Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    }, delay, hidden);
    await page.goto(base + pt(story), { waitUntil: 'networkidle0' });
    await wait(stay);
    return page;
  };
  const tag = story.id;

  // 1. Shortened wait: the end is in view, the time has passed -> the id is kept.
  let page = await openStory({ delay: 600 });
  const afterWait = await saved(page);
  ok(`read: ${tag}: the end of the story seen and the (shortened) wait passed -> the id is in readStories`, Array.isArray(afterWait) && afterWait.includes(story.id), JSON.stringify(afterWait));
  await page.close();

  // 2. The real wait (20 s): a short visit marks nothing; a hidden tab does not count time.
  page = await openStory({ delay: null, stay: 1500 });
  ok('read: a visit shorter than the wait marks nothing (no id after 1.5 s with the real delay)', (await saved(page)).length === 0);
  await page.close();
  page = await openStory({ delay: 300, hidden: true, stay: 1500 });
  ok('read: time with the tab hidden does not count', (await saved(page)).length === 0);
  await page.close();

  // 3. The epoch page: the tick, "read N of M" (M = the stories of the mode), the mode changes the numbers.
  const epochPage = async (mode, read) => {
    const p = await browser.newPage();
    await p.setViewport({ width: 360, height: 900 });
    await p.evaluateOnNewDocument((m, r) => {
      try {
        localStorage.setItem('family', m);
        if (r) localStorage.setItem('readStories', JSON.stringify(r));
        else localStorage.removeItem('readStories');
      } catch {}
    }, mode, read);
    await p.goto(base + epochPath(epoch), { waitUntil: 'networkidle0' });
    await wait(300);
    return p;
  };
  page = await epochPage('off', [story.id]);
  const marks = await page.evaluate((id) => {
    const card = document.querySelector('[data-story="' + id + '"]');
    const mark = card?.querySelector('.read-mark');
    const rect = mark?.getBoundingClientRect();
    const progress = document.querySelector('[data-read-progress]');
    return { read: card?.hasAttribute('data-read'), visibility: mark && getComputedStyle(mark).visibility, word: mark?.textContent.trim(), onScreenWidth: rect?.width > 0, progress: progress?.textContent.trim(), shown: progress?.hasAttribute('data-shown') && getComputedStyle(progress).visibility === 'visible' };
  }, story.id);
  ok('read: the list of the epoch shows the tick and the word "lida" for the read story', marks.read && marks.visibility === 'visible' && marks.word === 'lida' && marks.onScreenWidth, JSON.stringify(marks));
  ok(`read: "lida 1 de M" (the word agrees with 1) where M is the stories of the epoch (${inThisEpoch.length})`, marks.shown && marks.progress === `lida 1 de ${inThisEpoch.length}`, marks.progress);
  const heightsRead = await page.evaluate(() => [...document.querySelectorAll('.ecard')].map((c) => Math.round(c.getBoundingClientRect().height)));
  await page.close();
  page = await epochPage('off', null);
  const heightsUnread = await page.evaluate(() => [...document.querySelectorAll('.ecard')].map((c) => Math.round(c.getBoundingClientRect().height)));
  ok('read: a card has the same height read or not (the tick stands in the corner, out of the flow)', JSON.stringify(heightsRead) === JSON.stringify(heightsUnread) && heightsRead.length > 0, JSON.stringify([heightsRead, heightsUnread]));
  const none = await page.evaluate(() => ({ marks: document.querySelectorAll('[data-read]').length, progress: getComputedStyle(document.querySelector('[data-read-progress]')).visibility }));
  ok('read: with nothing read there is no tick and no "read N of M"', none.marks === 0 && none.progress === 'hidden', JSON.stringify(none));
  await page.close();
  for (const mode of ['all', '12']) {
    const shown = inThisEpoch.filter((e) => shownIn(e, mode));
    const readAll = inThisEpoch.map((e) => e.id);
    page = await epochPage(mode, readAll);
    const text = await page.evaluate(() => document.querySelector('[data-read-progress]').textContent.trim());
    ok(`read: family mode ${mode}: "${text}" counts only the stories the mode shows (${shown.length})`, text === `${shown.length === 1 ? 'lida' : 'lidas'} ${shown.length} de ${shown.length}`);
    await page.close();
  }

  // 4. The reset on the legal page: the button works, the key is gone, the tick is gone.
  page = await browser.newPage();
  await page.setViewport({ width: 360, height: 900 });
  await page.evaluateOnNewDocument((id) => { try { localStorage.setItem('readStories', JSON.stringify([id])); } catch {} }, story.id);
  await page.goto(base + '/pt/legal/', { waitUntil: 'networkidle0' });
  await page.click('[data-read-reset]');
  await wait(200);
  const reset = await page.evaluate(() => ({ key: localStorage.getItem('readStories'), status: document.querySelector('[data-read-reset-status]').textContent }));
  ok('read: the reset button on the legal page clears the key and says so', reset.key === null && reset.status === 'Marcas repostas.', JSON.stringify(reset));
  await page.close();
  page = await browser.newPage(); // a new page: the first one sets the key again on every document it opens
  await page.setViewport({ width: 360, height: 900 });
  await page.goto(base + epochPath(epoch), { waitUntil: 'networkidle0' });
  ok('read: after the reset the list shows no tick', (await page.evaluate(() => document.querySelectorAll('[data-read]').length)) === 0);
  await page.close();

  // 5. No JavaScript: the pages work, the mark is only a hidden place and the button is not offered.
  page = await newPage({ js: false });
  await page.goto(base + epochPath(epoch), { waitUntil: 'networkidle0' });
  ok('read: without JavaScript the list has no tick', (await page.evaluate(() => [...document.querySelectorAll('.read-mark')].every((m) => getComputedStyle(m).visibility === 'hidden'))));
  await page.goto(base + '/pt/legal/', { waitUntil: 'networkidle0' });
  ok('read: without JavaScript the reset button is not shown', (await page.evaluate(() => getComputedStyle(document.querySelector('[data-read-reset]').parentElement).display)) === 'none');
  await page.close();
  // Leave the storage clean for whatever runs next in this browser.
  page = await browser.newPage();
  await page.goto(base + '/pt/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { try { localStorage.removeItem('readStories'); localStorage.removeItem('family'); } catch {} });
  await page.close();
}

// ---- "Then and now" on the epoch pages: one list; on a phone with JavaScript one card and a button, otherwise all three; marks, sources, {n} ----
if (want('thennow')) {
  const ratio = (a, b) => { const n = a / b; return Math.max(1, n >= 100 ? Math.round(n / 10) * 10 : Math.round(n)); };
  const publishedIds = new Set(published.map((e) => e.id));
  const withBlock = readyEpochs.filter((e) => Array.isArray(e.then_now) && e.then_now.length > 0);
  ok('then and now: at least one live epoch has the block (the data are in epochs.yaml)', withBlock.length > 0);
  /** What the reader sees now: the cards that are shown, in order, the button, the focus. */
  const state = (page) => page.evaluate(() => {
    const root = document.querySelector('[data-then-now]');
    if (!root) return null;
    const shown = (el) => el.checkVisibility({ visibilityProperty: true });
    const button = root.querySelector('[data-then-now-more]');
    const sizeOf = (el) => parseFloat(getComputedStyle(el).fontSize);
    return {
      heading: root.querySelector('h2')?.textContent.trim(),
      lists: root.querySelectorAll('.then-now__list').length,
      cardsInPage: root.querySelectorAll('.then-now__card').length,
      cards: [...root.querySelectorAll('.then-now__card')].filter(shown).map((c) => ({
        id: c.id,
        kind: c.dataset.kind,
        big: c.querySelector('.then-now__big')?.textContent.replace(/\s+/g, ' ').trim(),
        text: c.querySelector('.then-now__text')?.textContent.replace(/\s+/g, ' ').trim(),
        mark: c.querySelector('.then-now__kind')?.textContent.trim() ?? null,
        link: c.querySelector('.then-now__link')?.getAttribute('href') ?? null,
        font: getComputedStyle(c.querySelector('.then-now__big')).fontFamily,
        broken: [...c.querySelectorAll('.then-now__part')].some((p) => p.getClientRects().length > 1 && !p.classList.contains('then-now__part--wrap')),
        right: c.getBoundingClientRect().right,
        ratio: sizeOf(c.querySelector('.then-now__then')) / sizeOf(c.querySelector('.then-now__now')),
        quieter: getComputedStyle(c.querySelector('.then-now__then')).color !== getComputedStyle(c.querySelector('.then-now__now')).color,
      })),
      button: button ? { shown: shown(button), expanded: button.getAttribute('aria-expanded'), controls: button.getAttribute('aria-controls'), controlsExists: Boolean(document.getElementById(button.getAttribute('aria-controls') ?? '')), text: button.textContent.trim(), tag: button.tagName } : null,
      focusId: document.activeElement?.id ?? '',
      sources: [...root.querySelectorAll('.then-now__sources > ul > li')].map((li) => li.querySelectorAll('a[href^="http"]').length),
      note: root.querySelector('.then-now__note')?.textContent.trim() ?? '',
      leftover: root.textContent.includes('{n}'),
      overflow: document.scrollingElement.scrollWidth - innerWidth,
    };
  });
  for (const epoch of withBlock) {
    const data = epoch.then_now;
    // A phone with JavaScript: the first card and the button; a click shows the others, hides the button, moves the focus to the second card.
    {
      const where = `then and now (${epoch.id}, 360 px)`;
      const page = await newPage({ width: 360 });
      await page.evaluateOnNewDocument(() => {
        window.__tnShift = 0;
        new PerformanceObserver((q) => {
          for (const e of q.getEntries()) if (!e.hadRecentInput && (e.sources ?? []).some((s) => s.node?.parentElement?.closest?.('[data-then-now]') || s.node?.closest?.('[data-then-now]'))) window.__tnShift += e.value;
        }).observe({ type: 'layout-shift', buffered: true });
      });
      await page.goto(base + epochPath(epoch), { waitUntil: 'networkidle0' });
      const before = await state(page);
      ok(`${where}: the block, its heading and ONE list of three cards are on the page`, before && before.heading === 'Então e agora' && before.lists === 1 && before.cardsInPage === 3, JSON.stringify([before?.heading, before?.lists, before?.cardsInPage]));
      if (!before) { await page.close(); continue; }
      ok(`${where}: one card is seen, and the button "Mais 2 comparações" (a <button>, aria-expanded=false, aria-controls the list)`, before.cards.length === 1 && before.button?.tag === 'BUTTON' && before.button.shown && before.button.text === 'Mais 2 comparações' && before.button.expanded === 'false' && before.button.controls === 'then-now-list' && before.button.controlsExists, JSON.stringify([before.cards.length, before.button]));
      ok(`${where}: the block does not move while the page loads`, (await page.evaluate(() => window.__tnShift)) === 0);
      await page.click('[data-then-now-more]');
      await wait(200);
      const after = await state(page);
      ok(`${where}: after the click three cards are seen, the button is gone`, after.cards.length === 3 && after.button?.shown === false, JSON.stringify([after.cards.length, after.button?.shown]));
      ok(`${where}: aria-expanded is true and the focus is on the second card (tabindex -1)`, after.button?.expanded === 'true' && after.focusId === 'then-now-2', JSON.stringify([after.button?.expanded, after.focusId]));
      ok(`${where}: no sideways scroll, no leftover {n}, every card inside the screen`, after.overflow <= 0 && !after.leftover && after.cards.every((c) => c.right <= 360));
      ok(`${where}: the figures are in the label face (Oswald), the old one is about 0.7 of the new one and quieter, a figure is not broken in two`, after.cards.every((c) => /Oswald/.test(c.font) && !c.broken && c.ratio > 0.6 && c.ratio < 0.8 && c.quieter), JSON.stringify(after.cards.map((c) => [c.ratio.toFixed(2), c.quieter, c.broken])));
      await page.close();
    }
    // Without JavaScript all three cards are shown and there is no button.
    {
      const where = `then and now (${epoch.id}, 360 px, no JavaScript)`;
      const page = await newPage({ width: 360, js: false });
      await page.goto(base + epochPath(epoch), { waitUntil: 'load' });
      const got = await state(page);
      ok(`${where}: all three cards are seen and the button is not`, got && got.cards.length === 3 && got.button?.shown === false, JSON.stringify([got?.cards.length, got?.button?.shown]));
      await page.close();
    }
    // A wide screen: three cards at once, no button.
    for (const width of [768, 1280]) {
      const where = `then and now (${epoch.id}, ${width} px)`;
      const page = await newPage({ width });
      await page.goto(base + epochPath(epoch), { waitUntil: 'networkidle0' });
      const got = await state(page);
      ok(`${where}: three cards at once and no button`, got && got.cards.length === 3 && got.button?.shown === false, JSON.stringify([got?.cards.length, got?.button?.shown]));
      if (!got) { await page.close(); continue; }
      ok(`${where}: no sideways scroll, no leftover {n}`, got.overflow <= 0 && !got.leftover);
      ok(`${where}: every card has its figures with the arrow beside the second, and a sentence`, got.cards.every((c, i) => c.big && c.text && c.kind === data[i].kind), JSON.stringify(got.cards.map((c) => c.kind)));
      ok(`${where}: the mark "estimativa" or "cálculo" only on estimates and calculations, none on a plain fact`, got.cards.every((c) => (c.kind === 'known' ? c.mark === null : c.mark === { estimate: 'estimativa', calc: 'cálculo' }[c.kind])), JSON.stringify(got.cards.map((c) => c.mark)));
      ok(`${where}: every card has its sources under "Fontes" (the number of links is the data's)`, got.sources.length === 3 && got.sources.every((n, i) => n === data[i].sources.length), JSON.stringify(got.sources));
      ok(`${where}: the sentence under the block explains the marks that are used`, (data.some((c) => c.kind !== 'known') ? got.note.length > 0 : got.note === '') && (!data.some((c) => c.kind === 'calc') || /Cálculo/.test(got.note)) && (!data.some((c) => c.kind === 'estimate') || /Estimativa/.test(got.note)), got.note);
      ok(`${where}: the link to a story shows only when that story is published`, got.cards.every((c, i) => { const id = data[i].story; return id && publishedIds.has(id) ? Boolean(c.link) : c.link === null; }), JSON.stringify(got.cards.map((c) => c.link)));
      ok(`${where}: the calculated number of {n} is the ratio of the hours`, got.cards.every((c, i) => { const d = data[i]; return d.then_hours === undefined || c.text.includes(String(ratio(d.then_hours, d.now_hours))); }));
      await page.close();
    }
  }
}

// ---- The colour of the epochs on the threads: a stripe on every card of a thread (the section with the name of its epoch), the dots of a thread on the home page ----
if (want('tone')) {
  const byPtSlug = new Map(published.map((e) => [e.slug.pt, e]));
  const epochName = (id) => epochs.find((e) => e.id === id).name.pt;
  /** The colour of a token as the browser computes it (a probe element, so light-dark() is resolved in the theme of the page). */
  const toneOf = (page, id) => page.evaluate((i) => {
    const probe = document.createElement('span');
    probe.style.color = `var(--tone-${i})`;
    document.body.append(probe);
    const c = getComputedStyle(probe).color;
    probe.remove();
    return c;
  }, id);
  const cards = (page) => page.evaluate(() => [...document.querySelectorAll('.grid .ecard')].map((c) => ({
    slug: c.querySelector('.ecard__title a').getAttribute('href').split('/').filter(Boolean).pop(),
    section: c.closest('section')?.querySelector('h2 a')?.textContent.trim() ?? null,
    stripe: getComputedStyle(c).borderInlineStartWidth,
    color: getComputedStyle(c).borderInlineStartColor,
    overflow: c.scrollWidth - c.clientWidth,
  })));
  for (const thread of threads) {
    const status = (await fetch(base + threadPath(thread))).status;
    if (status !== 200) continue; // a thread with too few stories has no page
    for (const [width, js] of [[360, true], [1280, true], [360, false]]) {
      const where = `thread ${thread.id}, ${width} px${js ? '' : ', no JavaScript'}`;
      const page = await newPage({ width, js });
      await page.goto(base + threadPath(thread), { waitUntil: 'load' });
      const got = await cards(page);
      const want_ = published.filter((e) => (e.threads ?? []).includes(thread.id));
      ok(`${where}: every story of the thread is a card`, got.length === want_.length, `${got.length} of ${want_.length}`);
      ok(`${where}: every card lies in the section with the heading of its epoch`, got.every((c) => c.section === epochName(byPtSlug.get(c.slug)?.epoch)), JSON.stringify(got.filter((c) => c.section !== epochName(byPtSlug.get(c.slug)?.epoch)).map((c) => c.slug)));
      let colours = true;
      for (const c of got) {
        const expected = await toneOf(page, byPtSlug.get(c.slug).epoch);
        if (c.stripe !== '4px' || c.color !== expected) colours = false;
      }
      ok(`${where}: the stripe is 4 px and has the colour of the epoch of the story`, colours);
      ok(`${where}: nothing runs out of a card`, got.every((c) => c.overflow <= 0));
      await page.close();
    }
  }
  // The home page: under every thread a row of dots, one for a story, in the colours of the epochs; the label names the epochs; the dots are not read.
  const home = await newPage({ width: 360 });
  await home.goto(`${base}/pt/`, { waitUntil: 'load' });
  const rows = await home.evaluate(() => [...document.querySelectorAll('.thread-row')].map((r) => ({
    href: r.getAttribute('href'),
    label: [...r.querySelectorAll('.thread-row__eras')].find((e) => e.checkVisibility())?.getAttribute('aria-label') ?? null,
    role: [...r.querySelectorAll('.thread-row__eras')].find((e) => e.checkVisibility())?.getAttribute('role') ?? null,
    dots: [...r.querySelectorAll('.thread-row__era')].filter((d) => d.checkVisibility()).length,
    size: getComputedStyle(r.querySelector('.thread-row__era')).width,
  })));
  ok('home: a row of dots under every thread, 8 px, a role "img" with the label "Épocas: ..."', rows.length > 0 && rows.every((r) => r.role === 'img' && r.label?.startsWith('Épocas: ') && r.size === '8px'), JSON.stringify(rows.map((r) => r.label)));
  ok('home: a dot for every story of the thread, the label names every epoch of the thread once, in the order of time', rows.every((r) => {
    const thread = threads.find((t) => r.href.endsWith(`/${t.slug.pt}/`));
    const stories = published.filter((e) => (e.threads ?? []).includes(thread.id));
    const names = epochs.filter((ep) => stories.some((e) => e.epoch === ep.id)).map((ep) => ep.name.pt);
    return r.dots === stories.length && r.label === `Épocas: ${names.join(', ')}`;
  }), JSON.stringify(rows.map((r) => [r.dots, r.label])));
  await home.close();
}

await browser.close();
console.log(failed === 0 ? '\nAll page checks passed' : `\n${failed} check(s) failed`);
process.exit(failed === 0 ? 0 : 1);

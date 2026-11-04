// Browser checks for the service pages: the texts of About, Method and Legal, the form "Found a mistake?" (from a story, the
// title and "change", the thank-you screen with the way back), the form "Know a story?", the 404 page in every language, and the mascot on them.
// Run against dist/ served by serve.mjs (base path "/"; the server answers a missing address with 404.html like GitHub Pages):
//   node service.mjs [texts form thanks share notfound]
import { fsPath, launchBrowser } from './browser.mjs';
import { TOTAL } from './data.mjs';

const base = process.env.BASE_URL || 'http://localhost:4400';
const ONLY = process.argv.slice(2);
const want = (name) => ONLY.length === 0 || ONLY.includes(name);
const PAGES = {
  about: { pt: '/pt/sobre/', en: '/en/about/', ru: '/ru/o-proekte/' },
  method: { pt: '/pt/metodo/', en: '/en/method/', ru: '/ru/metod/' },
  legal: { pt: '/pt/legal/', en: '/en/legal/', ru: '/ru/pravovaya-informaciya/' },
  report: { pt: '/pt/corrigir/', en: '/en/report/', ru: '/ru/oshibka/' },
  share: { pt: '/pt/conheco-uma-historia/', en: '/en/share-a-story/', ru: '/ru/znayu-istoriyu/' },
};
const STORY = { pt: '/pt/historia/tripeiros/', en: '/en/story/tripe-eaters-of-porto/', ru: '/ru/istoriya/lyubiteli-potrohov-iz-portu/' };
const TITLE = { pt: 'Os tripeiros', en: 'The Tripe Eaters of Porto', ru: 'Любители потрохов из Порту' };

let failed = 0;
const ok = (name, cond, extra = '') => {
  if (!cond) failed += 1;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
};
const browser = await launchBrowser();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const open = async (path, { width = 1280, js = true, language = null } = {}) => {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  page.close = () => context.close();
  await page.setViewport({ width, height: 900 });
  if (!js) await page.setJavaScriptEnabled(false);
  if (language) await page.evaluateOnNewDocument((l) => Object.defineProperty(navigator, 'language', { get: () => l }), language);
  page.errors = [];
  page.posts = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  // The form service is answered by the test itself: nothing leaves for formsubmit.co.
  await page.setRequestInterception(true);
  page.on('request', (r) => {
    if (/formsubmit\.co/.test(r.url())) {
      page.posts.push({ url: r.url(), body: r.postData() ?? '' });
      // page.slowFail: the service answers late and with an error (the "sending" state and its way out).
      if (page.slowFail) {
        setTimeout(() => r.respond({ status: 500, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"success":"false"}' }), 700);
        return;
      }
      r.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"success":"true"}' });
    } else r.continue();
  });
  await page.goto(`${base}${path}`, { waitUntil: 'load' });
  return page;
};
const text = (page, sel) => page.$eval(sel, (el) => el.innerText.replace(/\s+/g, ' ').trim());

// ---------- 1. The texts of the static pages ----------
if (want('texts')) {
  for (const lang of ['pt', 'en', 'ru']) {
    for (const key of ['about', 'method', 'legal']) {
      const page = await open(PAGES[key][lang], { width: 360 });
      const m = await page.evaluate(() => ({
        h1: document.querySelectorAll('h1').length,
        h2: document.querySelectorAll('article h2').length,
        body: document.querySelector('article').innerText,
        strong: document.querySelectorAll('article strong').length,
        mail: [...document.querySelectorAll('article a[href^="mailto:"]')].length,
        sw: document.documentElement.scrollWidth <= innerWidth,
      }));
      ok(`texts (${lang} ${key}): one h1, headings of the sections, no square brackets, no raw ** or {{ }}, no horizontal scroll`, m.h1 === 1 && m.h2 >= 5 && !/\[|\]|\*\*|\{\{/.test(m.body) && m.sw, `h2 ${m.h2}`);
      if (key === 'about') {
        ok(`texts (${lang} about): the number of stories is filled in from the data`, new RegExp(`\\b${TOTAL}\\b`).test(m.body.split('\n').find((l) => /\d+/.test(l) && /(ready|prontas|Готовы)/i.test(l)) ?? ''), `expected ${TOTAL}`);
        ok(`texts (${lang} about): no address, a link to the contact form, the method page is linked`, m.mail === 0 && (await page.$$eval('article a', (a) => a.some((x) => /\/(corrigir|report|oshibka)\//.test(x.getAttribute('href'))))) && (await page.$$eval('article a', (a) => a.filter((x) => /\/(metodo|method|metod)\//.test(x.getAttribute('href'))).length)) >= 1);
      }
      if (key === 'legal') ok(`texts (${lang} legal): the Near me sentence stays in the browser section`, /(Perto de mim|Near me|Рядом со мной)/.test(m.body));
      ok(`texts (${lang} ${key}): no script errors`, page.errors.length === 0, page.errors.join('; '));
      await page.close();
    }
  }
}

// ---------- 2. The form ----------
if (want('form')) {
  for (const lang of ['pt', 'en', 'ru']) {
    const url = `${base}${STORY[lang]}`;
    const query = `?url=${encodeURIComponent(url)}&title=${encodeURIComponent(TITLE[lang])}`;
    const page = await open(`${PAGES.report[lang]}${query}`, { width: 1280 });
    await wait(300);
    const f = await page.evaluate(() => {
      const mascot = document.querySelector('.report__head img.mascot');
      const r = mascot.getBoundingClientRect();
      const h1 = document.querySelector('.report h1').getBoundingClientRect();
      return {
        storyShown: !document.querySelector('[data-report-story]').hidden,
        freeHidden: document.querySelector('[data-report-free]').hidden,
        title: document.querySelector('[data-report-story-title]').textContent,
        hidden: document.querySelector('[data-report-url]').value,
        mascotW: Math.round(r.width),
        right: r.left > h1.left + 200,
        alt: mascot.alt,
        note: [...document.querySelectorAll('.report__note a')].map((a) => a.getAttribute('href')),
      };
    });
    ok(`form (${lang}): from a story the title is shown with "change" and the long address is not`, f.storyShown && f.freeHidden && f.title === TITLE[lang] && f.hidden === url, JSON.stringify({ title: f.title, hidden: f.hidden }));
    ok(`form (${lang}): the elephant is on the right of the heading, 160 px at most, with a description in the language of the page`, f.right && f.mascotW <= 160 && f.alt.length > 10, `${f.mascotW}px "${f.alt}"`);
    ok(`form (${lang}): the note under the button links to the Legal page (section on the services) and the address`, f.note.some((h) => /#s-terceiros$/.test(h)) && f.note.some((h) => /^mailto:/.test(h)), f.note.join(' '));
    await page.click('[data-report-change]');
    const after = await page.evaluate(() => ({ story: document.querySelector('[data-report-story]').hidden, free: !document.querySelector('[data-report-free]').hidden, focus: document.activeElement?.id, value: document.querySelector('[data-report-url]').value }));
    ok(`form (${lang}): "change" brings the plain field back, focused, with the address in it`, after.story && after.free && after.focus === 'f-url' && after.value === url, JSON.stringify(after));
    await page.close();
    // a phone
    const phone = await open(`${PAGES.report[lang]}${query}`, { width: 320 });
    const p = await phone.evaluate(() => {
      const r = document.querySelector('.report__head img.mascot').getBoundingClientRect();
      const h1 = document.querySelector('.report h1').getBoundingClientRect();
      return { above: r.bottom <= h1.top + 1, w: Math.round(r.width), sw: document.documentElement.scrollWidth <= innerWidth };
    });
    ok(`form (${lang}, 320 px): the elephant above the heading and smaller, no sideways scroll`, p.above && p.w < 160 && p.sw, JSON.stringify(p));
    await phone.close();
  }
  // without a story
  const plain = await open(PAGES.report.en);
  ok('form: without a story the field for a link or a title is shown', !(await plain.$eval('[data-report-free]', (e) => e.hidden)) && (await plain.$eval('[data-report-story]', (e) => e.hidden)));
  await plain.close();
  const nojs = await open(`${PAGES.report.ru}?url=x`, { js: false });
  ok('form without JavaScript: the plain field is there and the form is posted to the service by the id of the form', !(await nojs.$eval('[data-report-free]', (e) => e.hidden)) && (await nojs.$eval('form', (f) => f.method === 'post' && /^https:\/\/formsubmit\.co\/[0-9a-f]{32}$/.test(f.action))));
  await nojs.close();
}

// ---------- 3. The thank-you screen ----------
if (want('thanks')) {
  for (const lang of ['pt', 'en', 'ru']) {
    const url = `${base}${STORY[lang]}`;
    const query = `?url=${encodeURIComponent(url)}&title=${encodeURIComponent(TITLE[lang])}`;
    const page = await open(`${PAGES.report[lang]}${query}`);
    const next = await page.$eval('[data-report-next]', (i) => i.value);
    ok(`thanks (${lang}): the address to return to after the service carries the story and ends at #sent`, /#sent$/.test(next) && next.includes(encodeURIComponent(url)) && next.startsWith('http'), next);
    await page.type('#f-what', 'Uma data errada');
    await page.click('[data-report-submit]');
    await page.waitForFunction(() => !document.getElementById('sent').hidden, { timeout: 5000 });
    const t = await page.evaluate(() => {
      const sent = document.getElementById('sent');
      const back = sent.querySelector('[data-report-back]');
      const buttons = [...sent.querySelectorAll('a.button')].filter((a) => !a.hidden).map((a) => ({ text: a.textContent.trim(), href: a.getAttribute('href') }));
      return { formHidden: document.querySelector('[data-report-form]').hidden, buttons, backHref: back.getAttribute('href'), mascot: sent.querySelector('img.mascot')?.alt ?? '', heading: sent.querySelector('h2').textContent };
    });
    ok(`thanks (${lang}): the form is replaced by the screen with the elephant, two buttons (back to the story, random story)`, t.formHidden && t.buttons.length === 2 && t.backHref === url && /(surpreende-me|surprise-me|udivi-menya)/.test(t.buttons[1].href) && t.mascot.length > 10, JSON.stringify(t));
    ok(`thanks (${lang}): the thank-you says what the elephant does`, /(correr|running|бежит)/.test(t.heading), t.heading);
    ok(`thanks (${lang}): the message reached the (answered) service once, with the address of the story`, page.posts.length === 1 && decodeURIComponent(page.posts[0].body).includes(url));
    await page.close();
    // arrival from the service: the story is in the address and the screen shows at once
    const arrived = await open(`${PAGES.report[lang]}${query}#sent`);
    await wait(300);
    ok(`thanks (${lang}): arriving from the service shows the screen with the way back`, !(await arrived.$eval('#sent', (e) => e.hidden)) && (await arrived.$eval('[data-report-back]', (a, u) => !a.hidden && a.getAttribute('href') === u, url)));
    await arrived.close();
  }
  // while sending: the button is off and says so; after an error it is on again and the message shows
  for (const [lang, sending, submit] of [['pt', 'A enviar…', 'Enviar'], ['en', 'Sending…', 'Send'], ['ru', 'Отправляем…', 'Отправить']]) {
    const page = await open(PAGES.report[lang]);
    page.slowFail = true;
    await page.type('#f-what', 'Uma data errada');
    await page.click('[data-report-submit]');
    await wait(250);
    const during = await page.$eval('[data-report-submit]', (b) => ({ disabled: b.disabled, text: b.textContent.trim() }));
    ok(`form (${lang}): while sending the button is off and says "${sending}"`, during.disabled && during.text === sending, JSON.stringify(during));
    await wait(900);
    const after = await page.evaluate(() => ({ disabled: document.querySelector('[data-report-submit]').disabled, text: document.querySelector('[data-report-submit]').textContent.trim(), failed: !document.querySelector('[data-report-failed]').hidden }));
    ok(`form (${lang}): after an error the button is on again and the message is shown`, !after.disabled && after.text.length > 0 && after.text !== sending && after.failed, JSON.stringify(after));
    await page.close();
  }
  // no story: only the random one
  const none = await open(`${PAGES.report.en}#sent`);
  await wait(300);
  ok('thanks: without a story there is no way back, only "Random story"', (await none.$eval('[data-report-back]', (a) => a.hidden)));
  await none.close();
  // a foreign address must not become a "back" link
  const evil = await open(`${PAGES.report.en}?url=${encodeURIComponent('https://evil.example/x')}&title=x#sent`);
  await wait(300);
  ok('thanks: an address of another site is never offered as the way back', await evil.$eval('[data-report-back]', (a) => a.hidden));
  await evil.close();
}

// ---------- 4. The form "Know a story?" ----------
if (want('share')) {
  for (const lang of ['pt', 'en', 'ru']) {
    const res = await fetch(`${base}${PAGES.share[lang]}`);
    const source = await res.text();
    ok(`share (${lang}): the page exists, is indexable, names the three languages (the sitemap is checked by check:sitemap in the build)`, res.status === 200 && !/name="robots" content="[^"]*noindex/.test(source) && ['pt', 'en', 'ru', 'x-default'].every((l) => source.includes(`hreflang="${l}"`)), `status ${res.status}`);
    const formHtml = source.slice(source.indexOf('<form'), source.indexOf('</form>'));
    ok(`share (${lang}): no "@" anywhere in the HTML of the form`, formHtml.length > 100 && !formHtml.includes('@'));
    const reportSource = await (await fetch(`${base}${PAGES.report[lang]}`)).text();
    const subjectOf = (html) => /name="_subject" value="([^"]*)"/.exec(html)?.[1] ?? '';
    ok(`share (${lang}): the subject line is its own, not the one of the mistake form`, subjectOf(source).length > 5 && subjectOf(source) !== subjectOf(reportSource), `"${subjectOf(source)}" / "${subjectOf(reportSource)}"`);

    const page = await open(PAGES.share[lang], { width: 360 });
    const f = await page.evaluate(() => {
      const form = document.querySelector('[data-report-form]');
      const honey = form.querySelector('[name=_honey]');
      const label = (id) => document.querySelector(`label[for=${id}]`)?.textContent.replace(/\s+/g, ' ').trim() ?? '';
      return {
        action: form.getAttribute('action'),
        method: form.method,
        captcha: form.querySelector('[name=_captcha]')?.value,
        honey: { tab: honey.tabIndex, hidden: honey.getAttribute('aria-hidden'), ac: honey.getAttribute('autocomplete'), right: honey.getBoundingClientRect().right },
        noValidate: form.noValidate,
        required: [...form.querySelectorAll('[required]')].map((e) => e.name),
        marked: [...form.querySelectorAll('.field__required')].map((s) => s.closest('label').htmlFor),
        optionalLabels: ['f-source', 'f-email'].map(label),
        requiredMark: document.querySelector('.field__required')?.textContent.trim(),
        overflow: document.documentElement.scrollWidth - innerWidth,
      };
    });
    ok(`share (${lang}): posts to FormSubmit by the id of the form, no captcha page, the honeypot is out of reach`, /^https:\/\/formsubmit\.co\/[0-9a-f]{32}$/.test(f.action) && f.method === 'post' && f.captcha === 'false' && f.honey.tab === -1 && f.honey.hidden === 'true' && f.honey.ac === 'off' && f.honey.right < 0, JSON.stringify(f.honey));
    ok(`share (${lang}): the required fields (where, what) are required for the browser and marked in their labels; the others are neither`, !f.noValidate && f.required.join() === 'where,what' && f.marked.join() === 'f-where,f-what' && f.requiredMark.length > 3 && f.optionalLabels.every((l) => !l.includes(f.requiredMark)), JSON.stringify(f));
    ok(`share (${lang}): no sideways scroll at 360 px`, f.overflow <= 0);
    // empty: the browser stops the send, nothing leaves
    await page.click('[data-report-submit]');
    const empty = await page.evaluate(() => ({ valid: document.querySelector('[data-report-form]').checkValidity(), focus: document.activeElement?.id, sentHidden: document.getElementById('sent').hidden }));
    ok(`share (${lang}): an empty form is stopped by the browser on the first required field, nothing is sent`, !empty.valid && empty.focus === 'f-where' && empty.sentHidden && page.posts.length === 0, JSON.stringify(empty));
    // filled: one request to the AJAX address, then the thank-you screen with "home" and "surprise me"
    await page.type('#f-where', 'Aldeia de Teste');
    await page.type('#f-what', 'Aconteceu algo por volta de 1700.');
    await page.click('[data-report-submit]');
    await page.waitForFunction(() => !document.getElementById('sent').hidden, { timeout: 5000 });
    const sent = await page.evaluate(() => {
      const sent = document.getElementById('sent');
      return { form: document.querySelector('[data-report-form]').hidden, mascot: sent.querySelector('img.mascot')?.alt ?? '', buttons: [...sent.querySelectorAll('a.button')].filter((a) => !a.hidden).map((a) => a.getAttribute('href')) };
    });
    const post = page.posts[0];
    ok(`share (${lang}): one request to the AJAX address with the place and the text; the thank-you screen with the elephant, "home" and "surprise me"`, page.posts.length === 1 && /formsubmit\.co\/ajax\//.test(post.url) && /Aldeia/.test(decodeURIComponent(post.body)) && decodeURIComponent(post.body).includes(subjectOf(source)) && sent.form && sent.mascot.length > 10 && sent.buttons.length === 2 && sent.buttons[0] === `/${lang}/` && /(surpreende-me|surprise-me|udivi-menya)/.test(sent.buttons[1]), JSON.stringify(sent));
    ok(`share (${lang}): no script errors`, page.errors.length === 0, page.errors.join('; '));
    await page.close();

    // the three places that lead here lead to the page of their own language
    const hrefs = async (path, selector) => {
      const p = await open(path);
      const h = await p.$$eval(selector, (as) => as.map((a) => new URL(a.href).pathname));
      await p.close();
      return h;
    };
    ok(`share (${lang}): the link in the footer leads to the page of the language`, (await hrefs(PAGES.report[lang], '.site-footer a')).includes(PAGES.share[lang]));
    ok(`share (${lang}): the last words of About the project lead there`, (await hrefs(PAGES.about[lang], 'article section:last-of-type .prose p:last-child a')).includes(PAGES.share[lang]));
    ok(`share (${lang}): "Found a mistake?" has the link under the form`, (await hrefs(PAGES.report[lang], '.report__more a')).includes(PAGES.share[lang]));
  }
}

// ---------- 5. The 404 page ----------
if (want('notfound')) {
  for (const [path, lang, title, home, surprise] of [
    ['/pt/nao-existe/', 'pt', 'O elefante fugiu outra vez', 'Início', 'Surpreenda-me'],
    ['/en/nope/', 'en', 'The elephant ran away again', 'Home', 'Surprise me'],
    ['/ru/net-takoy/', 'ru', 'Слон опять сбежал', 'На главную', 'Удиви меня'],
  ]) {
    const page = await open(path);
    await wait(300);
    const n = await page.evaluate(() => {
      const visible = [...document.querySelectorAll('section[data-notfound-lang]')].filter((s) => !s.hidden);
      const s = visible[0];
      return { count: visible.length, lang: s?.dataset.notfoundLang, h1: s?.querySelector('h1').textContent, buttons: [...(s?.querySelectorAll('a.button') ?? [])].map((a) => a.textContent.trim()), mascot: s?.querySelector('img.mascot')?.dataset.mascot, alt: s?.querySelector('img.mascot')?.alt, htmlLang: document.documentElement.lang, headers: document.querySelectorAll('.site-header').length, footers: document.querySelectorAll('.site-footer').length, nav: document.querySelector('.site-nav a')?.textContent.trim(), links: document.querySelectorAll('.notfound__languages').length };
    });
    ok(`404 (${lang}): the text of the language of the address, the elephant, two buttons`, n.count === 1 && n.lang === lang && n.h1.startsWith(title) && n.buttons.join('|') === `${home}|${surprise}` && n.mascot === 'think' && n.alt.length > 10 && n.htmlLang === lang, JSON.stringify(n));
    await page.close();
  }
  // An address without a language: Portuguese, whatever the browser says, and the links to the three home pages under the text.
  const bare = await open('/404.html', { language: 'ru-RU' });
  await wait(300);
  const bareState = await bare.evaluate(() => ({ lang: document.querySelector('section[data-notfound-lang]:not([hidden])')?.dataset.notfoundLang, links: document.querySelectorAll('.notfound__languages a').length, headers: document.querySelectorAll('.site-header:not([hidden])').length }));
  ok('404: an address without a language shows Portuguese and the links to the three languages', bareState.lang === 'pt' && bareState.links === 3, JSON.stringify(bareState));
  await bare.close();
  // The header and the footer are in the language of the address, and only one of each is left; no language links then.
  for (const [path, lang, nav, foot] of [['/en/nope/', 'en', 'Eras', 'About the project'], ['/ru/net-takoy/', 'ru', 'Эпохи', 'О проекте']]) {
    const p = await open(path);
    await wait(300);
    const r = await p.evaluate(() => ({ headers: document.querySelectorAll('.site-header').length, footers: document.querySelectorAll('.site-footer').length, nav: document.querySelector('.site-nav a')?.textContent.trim(), foot: document.querySelector('.site-footer a')?.textContent.trim(), links: document.querySelectorAll('.notfound__languages').length, skip: document.querySelector('.skip-link')?.textContent.trim() }));
    ok(`404 (${lang}): one header and one footer, in ${lang}, and no row of language links`, r.headers === 1 && r.footers === 1 && r.nav.toLowerCase() === nav.toLowerCase() && r.foot.toLowerCase() === foot.toLowerCase() && r.links === 0, JSON.stringify(r));
    await p.close();
  }
  const nojs = await open('/en/nope/', { js: false });
  const j = await nojs.evaluate(() => ({ visible: [...document.querySelectorAll('[data-notfound-lang]')].filter((s) => s.checkVisibility()).map((s) => s.dataset.notfoundLang), links: [...document.querySelectorAll('.notfound__languages a')].map((a) => a.getAttribute('href')) }));
  ok('404 without JavaScript: the Portuguese text and links to the home pages of the three languages', j.visible.join() === 'pt' && j.links.length === 3 && j.links.every((h) => /\/(pt|en|ru)\/$/.test(h)), JSON.stringify(j));
  await nojs.close();
}

await browser.close();
console.log(failed === 0 ? '\nAll service page checks passed' : `\n${failed} check(s) failed`);
process.exit(failed === 0 ? 0 : 1);

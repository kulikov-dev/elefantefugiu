// Browser checks of the map of a journey on a story page (src/components/RouteMap.astro, src/lib/route-map.ts), against dist/ served by serve.mjs:   node route.mjs [markup layout motion]
// The stories that have a route are read from the YAML (field `route`); no story is named here.
//   markup   every published story in every language, from the HTML as served (no JavaScript): the map exists exactly on the stories that have a route, with role="img"
//            and a label "Route: A → B, year", one dot per stop, the list "Route points" with the stops of the data in order, and nowhere else
//   layout   at 360 px (and 1280) in every language: the map stands after the text and before "More", outside it; no horizontal scroll; the labels and the dots are inside the frame
//   motion   the line is whole without JavaScript, drawn once when the map comes into view (the mask grows), and whole at once with "reduce motion"
import { launchBrowser } from './browser.mjs';
import { need, published, ui } from './data.mjs';

const base = process.env.BASE_URL || 'http://localhost:4400';
const ONLY = process.argv.slice(2);
const want = (name) => ONLY.length === 0 || ONLY.includes(name);
let failed = 0;
const ok = (name, cond, extra = '') => {
  if (!cond) failed += 1;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
};

const LANGS = ['pt', 'en', 'ru'];
const SEG = { pt: 'historia', en: 'story', ru: 'istoriya' };
const pathOf = (e, lang) => `/${lang}/${SEG[lang]}/${e.slug[lang]}/`;
const stops = (e) => e.route.points.filter((p) => !p.via);
const withRoute = published.filter((e) => e.route);
const decode = (s) => s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

if (want('markup')) {
  const bad = [];
  let withMap = 0;
  let without = 0;
  for (const e of published) {
    for (const lang of LANGS) {
      const html = await (await fetch(`${base}${pathOf(e, lang)}`)).text();
      const block = html.match(/<section[^>]*data-route[^>]*>([\s\S]*?)<\/section>/);
      if (!e.route) {
        without += 1;
        if (block) bad.push(`${lang}/${e.id}: a map on a story without a route`);
        continue;
      }
      withMap += 1;
      if (!block) {
        bad.push(`${lang}/${e.id}: no map`);
        continue;
      }
      const label = decode(block[1].match(/<svg[^>]*role="img"[^>]*aria-label="([^"]*)"/)?.[1] ?? block[1].match(/<svg[^>]*aria-label="([^"]*)"[^>]*role="img"/)?.[1] ?? '');
      const first = stops(e)[0].name;
      const last = stops(e).at(-1).name;
      // A Russian page of a story that is not ready in Russian shows the English names.
      const l = lang === 'ru' && !e.ru_ready ? 'en' : lang;
      const prefix = ui('route.caption', lang).replace('{from}', first[l]).replace('{to}', last[l]);
      if (!label.startsWith(prefix)) bad.push(`${lang}/${e.id}: label "${label}" does not start with "${prefix}"`);
      const dots = (block[1].match(/<circle[^>]*class="[^"]*route__dot/g) ?? []).length;
      if (dots !== stops(e).length) bad.push(`${lang}/${e.id}: ${dots} dots for ${stops(e).length} stops`);
      const items = [...block[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) => decode(m[1]).split(',')[0].trim());
      if (JSON.stringify(items) !== JSON.stringify(stops(e).map((p) => p.name[l]))) bad.push(`${lang}/${e.id}: the list of points is ${JSON.stringify(items)}`);
      if (!block[1].includes(ui('route.points', lang))) bad.push(`${lang}/${e.id}: no "${ui('route.points', lang)}"`);
    }
  }
  ok(`markup: the map is on exactly the stories with a route (${withMap} pages with, ${without} without), labelled, a dot and a list entry per stop`, bad.length === 0, bad.slice(0, 3).join(' | '));
}

if (want('layout')) {
  const browser = await launchBrowser();
  for (const lang of LANGS) {
    const e = need('a published story with a route', (list) => list.find((x) => x.route));
    for (const width of [360, 1280]) {
      const page = await browser.newPage();
      await page.setViewport({ width, height: 900, isMobile: width < 700, hasTouch: width < 700 });
      page.errors = [];
      page.on('pageerror', (err) => !/ViewTransition opt-in disabled/.test(err.message) && page.errors.push(err.message));
      await page.goto(`${base}${pathOf(e, lang)}`, { waitUntil: 'networkidle0' });
      const geo = await page.evaluate(() => {
        const block = document.querySelector('[data-route]');
        const story = document.getElementById('historia');
        const more = document.getElementById('detalhes');
        const svg = block?.querySelector('svg.route__svg');
        const frame = svg?.getBoundingClientRect();
        const outside = [...(svg?.querySelectorAll('.route__label, .route__dot') ?? [])].filter((el) => {
          const r = el.getBoundingClientRect();
          return r.left < frame.left - 1 || r.right > frame.right + 1 || r.top < frame.top - 1 || r.bottom > frame.bottom + 1;
        }).length;
        const label = svg?.querySelector('.route__label');
        return {
          has: !!block,
          after: !!block && !!story && !!(story.compareDocumentPosition(block) & Node.DOCUMENT_POSITION_FOLLOWING),
          before: !!block && !!more && !!(block.compareDocumentPosition(more) & Node.DOCUMENT_POSITION_FOLLOWING),
          outsideMore: !!block && !more.contains(block),
          scrollX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          outside,
          width: frame?.width ?? 0,
          labelWeight: label ? getComputedStyle(label).fontWeight : '',
          points: block?.querySelector('details')?.open === false,
        };
      });
      ok(`${lang} ${width}px: the map is after the text, before "More" and outside it; the list of points is closed`, geo.has && geo.after && geo.before && geo.outsideMore && geo.points, JSON.stringify(geo));
      ok(`${lang} ${width}px: no horizontal scroll, every label and dot inside the frame, the picture fits the column`, geo.scrollX <= 0 && geo.outside === 0 && geo.width > 200 && geo.width <= width, `scrollX ${geo.scrollX}, outside ${geo.outside}, width ${geo.width}`);
      ok(`${lang} ${width}px: labels in regular weight`, geo.labelWeight === '400', geo.labelWeight);
      ok(`${lang} ${width}px: no script error`, page.errors.length === 0, page.errors.join(' | '));
      await page.close();
    }
    const none = need('a published story without a route', (list) => list.find((x) => !x.route));
    const page = await browser.newPage();
    await page.setViewport({ width: 360, height: 900, isMobile: true, hasTouch: true });
    await page.goto(`${base}${pathOf(none, lang)}`, { waitUntil: 'networkidle0' });
    const count = await page.evaluate(() => document.querySelectorAll('[data-route]').length);
    ok(`${lang} 360px: a story without a route has no map`, count === 0, String(count));
    await page.close();
  }
  await browser.close();
}

if (want('motion')) {
  const e = need('a published story with a route', (list) => list.find((x) => x.route));
  const browser = await launchBrowser();
  const offset = (page) => page.evaluate(() => getComputedStyle(document.querySelector('.route__reveal')).strokeDashoffset);
  // Without JavaScript: the line is whole.
  let page = await browser.newPage();
  await page.setJavaScriptEnabled(false);
  await page.setViewport({ width: 360, height: 900 });
  await page.goto(`${base}${pathOf(e, 'en')}`, { waitUntil: 'networkidle0' });
  ok('no JavaScript: the line is whole', parseFloat(await offset(page)) === 0, await offset(page));
  await page.close();
  // With JavaScript: hidden before it comes into view, then drawn once; it stays whole when the map leaves the screen and returns.
  page = await browser.newPage();
  await page.setViewport({ width: 360, height: 700, isMobile: true, hasTouch: true });
  await page.goto(`${base}${pathOf(e, 'en')}`, { waitUntil: 'networkidle0' });
  const armed = await page.evaluate(() => document.querySelector('[data-route]').classList.contains('route--armed'));
  const before = parseFloat(await offset(page));
  ok('with JavaScript: armed, and the line is not drawn before the map is in view', armed && before === 1, `armed ${armed}, offset ${before}`);
  await page.evaluate(() => document.querySelector('[data-route]').scrollIntoView({ block: 'center' }));
  await new Promise((r) => setTimeout(r, 2000));
  ok('the line is drawn when the map comes into view', parseFloat(await offset(page)) === 0, await offset(page));
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise((r) => setTimeout(r, 300));
  await page.evaluate(() => document.querySelector('[data-route]').scrollIntoView({ block: 'center' }));
  await new Promise((r) => setTimeout(r, 300));
  ok('the line is drawn once: whole after the map leaves and returns', parseFloat(await offset(page)) === 0, await offset(page));
  await page.close();
  // Reduce motion: whole at once, no transition.
  page = await browser.newPage();
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.setViewport({ width: 360, height: 700, isMobile: true, hasTouch: true });
  await page.goto(`${base}${pathOf(e, 'en')}`, { waitUntil: 'networkidle0' });
  const reduced = await page.evaluate(() => ({ offset: getComputedStyle(document.querySelector('.route__reveal')).strokeDashoffset, armed: document.querySelector('[data-route]').classList.contains('route--armed') }));
  ok('reduce motion: the line is whole at once, nothing is armed', parseFloat(reduced.offset) === 0 && !reduced.armed, JSON.stringify(reduced));
  await page.close();
  await browser.close();
}

console.log(failed === 0 ? '\nAll route map checks passed' : `\n${failed} check(s) failed`);
process.exit(failed === 0 ? 0 : 1);

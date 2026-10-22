// Checks the built epoch and thread pages in dist/ against the data (docs/spec.md sections 5.2 and 5.5).
// Expected values are computed here from src/content/*.yaml with plain code, independent of the site's helpers.
// Run after `npm run build` (part of postbuild).
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
const SEG = { pt: { story: 'historia', epoch: 'epoca', thread: 'fio' }, en: { story: 'story', epoch: 'era', thread: 'thread' } };
const MIN_CARDS = 5;
const errors = [];
let pages = 0;

const load = (file) => parse(readFileSync(join(root, 'src/content', file), 'utf8'), { schema: 'core', customTags: ['timestamp'] });
const eventsDir = join(root, 'src/content/events');
const events = readdirSync(eventsDir)
  .filter((n) => n.endsWith('.yaml'))
  .map((n) => parse(readFileSync(join(eventsDir, n), 'utf8'), { schema: 'core', customTags: ['timestamp'] }))
  .filter((e) => e.status === 'ready');
const epochs = load('epochs.yaml').sort((a, b) => a.order - b.order);
const threads = load('threads.yaml');

const startYear = (e) => (typeof e.year === 'number' ? e.year : e.year.from);
const endYear = (e) => (typeof e.year === 'number' ? e.year : e.year.to);
const chrono = (a, b) => startYear(a) - startYear(b) || endYear(a) - endYear(b) || a.id.localeCompare(b.id);
const inEpoch = (epoch) => events.filter((e) => e.epoch === epoch.id).sort(chrono);
const inThread = (thread, list = events) => list.filter((e) => e.threads.includes(thread.id));
const visibleThreads = threads.filter((th) => inThread(th).length >= MIN_CARDS);
const hasPage = (epoch) => epoch.mvp && inEpoch(epoch).length > 0;

// Family mode (docs/spec.md 3.6), written out here on purpose, independent of src/lib/family.ts:
//   off: everything; all: min_age all and not heavy; 12: min_age all or 12 and not heavy.
const MODES = ['off', 'all', '12'];
const shownIn = (e, mode) => mode === 'off' || (!e.sensitive && (String(e.min_age) === 'all' || (mode === '12' && String(e.min_age) === '12')));
const modeCounts = (list) => Object.fromEntries(MODES.map((m) => [m, list.filter((e) => shownIn(e, m)).length]));
const zeroIn = (counts) => MODES.filter((m) => counts[m] === 0);

/**
 * The counters of one fragment, by mode: the markup holds one <span class="fv" data-modes="..."> per distinct number;
 * `number` extracts the number from the text of a variant. Returns null when a mode has no variant or two variants.
 */
function countsByMode(fragment, number) {
  const found = {};
  const parts = [...fragment.matchAll(/<span class="fv"[^>]*?data-modes="([^"]*)"[^>]*>([\s\S]*?)(?=<span class="fv"|$)/g)];
  for (const [, modes, body] of parts) {
    const n = number(body);
    if (n === undefined || Number.isNaN(n)) return null;
    for (const mode of modes.split(' ')) {
      if (mode in found) return null;
      found[mode] = n;
    }
  }
  return MODES.every((m) => m in found) ? found : null;
}
/** Value of an attribute in the text of a tag's attributes; empty string when absent. */
const attr = (attrs, name) => attrs?.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`))?.[1] ?? '';
const sameCounts = (a, b) => a !== null && MODES.every((m) => a[m] === b[m]);
const showCounts = (c) => (c ? `off ${c.off}, all ${c.all}, 12 ${c['12']}` : 'missing or ambiguous');
const countNode = (cls) => (body) => Number(body.match(new RegExp(`${cls}"[^>]*>(\\d+)<`))?.[1]);
const wordCount = (body) => Number(text(body).match(/(\d+)\s+(?:hist\u00f3rias?|stor(?:y|ies))/)?.[1]);

const strip = (html) => html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<script[\s\S]*?<\/script>/g, '');
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;|&#\d+;/g, ' ').replace(/\s+/g, ' ').trim();
const read = (path) => (existsSync(path) ? strip(readFileSync(path, 'utf8')) : null);

/** Checks shared by every listing page: head, headings, alt, ids, noindex. */
function commonChecks(html, where, lang, { placeholder, expectedH1 }) {
  const fail = (m) => errors.push(`${where}: ${m}`);
  const has = (re) => re.test(html);
  if (!has(new RegExp(`<html lang="${lang}"`))) fail(`<html lang="${lang}"> is missing`);
  for (const [name, re] of [
    ['title', /<title>[^<]+<\/title>/],
    ['meta description', /<meta name="description" content="[^"]+"/],
    ['canonical', /<link rel="canonical" href="https?:\/\/[^"]+"/],
    ['hreflang pt', /<link rel="alternate" hreflang="pt" href="https?:\/\/[^"]+"/],
    ['hreflang en', /<link rel="alternate" hreflang="en" href="https?:\/\/[^"]+"/],
    ['hreflang x-default', /<link rel="alternate" hreflang="x-default"/],
    ['og:title', /<meta property="og:title" content="[^"]+"/],
    ['og:url', /<meta property="og:url" content="https?:\/\/[^"]+"/],
  ]) {
    if (!has(re)) fail(`${name} is missing`);
  }
  if (has(/<meta name="robots" content="noindex"/) !== Boolean(placeholder)) fail('noindex must be set exactly when the page shows placeholder text');
  const levels = [...html.matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1]));
  if (levels.filter((l) => l === 1).length !== 1 || levels[0] !== 1) fail('expected exactly one h1, placed first');
  levels.forEach((l, i) => {
    if (i > 0 && l > levels[i - 1] + 1) fail(`heading level jumps from h${levels[i - 1]} to h${l}`);
  });
  const h1 = text(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? '');
  if (h1 !== expectedH1) fail(`h1 is "${h1}", expected "${expectedH1}"`);
  // The mascot pictures are decorative (empty alt on purpose) and are checked by check-mascot.mjs.
  for (const img of html.matchAll(/<img\b(?![^>]*\bclass="mascot)[^>]*>/g)) {
    const alt = img[0].match(/\balt="([^"]*)"/);
    if (!alt || alt[1].trim() === '') fail('img without alt text');
  }
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dup.length) fail(`duplicate ids: ${[...new Set(dup)].join(', ')}`);
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)) {
    if (text(m[2]) === '' && !/aria-label="[^"]+"/.test(m[1])) fail('link without accessible name');
  }
  if (/\btabindex="[1-9]/.test(html)) fail('positive tabindex');
}

const cardSlugsIn = (html, lang) => [...html.matchAll(new RegExp(`<h3[^>]*>\\s*<a href="[^"]*/${SEG[lang].story}/([^"/]+)/"`, 'g'))].map((m) => m[1]);
const slugOf = (e, lang) => e.slug[lang];

const reachableFromFeed = new Map(); // `${lang}:${id}` -> true
const reachableFromThread = new Map();

for (const lang of ['pt', 'en']) {
  // ---------- epoch pages ----------
  for (const epoch of epochs) {
    const dir = join(dist, lang, SEG[lang].epoch, epoch.slug[lang]);
    const where = `${lang}/${SEG[lang].epoch}/${epoch.slug[lang]}`;
    const fail = (m) => errors.push(`${where}: ${m}`);
    const html = read(join(dir, 'index.html'));
    if (!hasPage(epoch)) {
      if (html) fail('page exists but the epoch has no content or is not part of the MVP');
      continue;
    }
    if (!html) {
      fail('page was not built');
      continue;
    }
    pages += 1;
    const feed = inEpoch(epoch);
    const placeholder = epoch.placeholder || feed.some((e) => e.placeholder);
    commonChecks(html, where, lang, { placeholder, expectedH1: epoch.name[lang] });
    if (!html.includes(epoch.theme[lang])) fail('theme phrase is missing');
    if (!html.includes(`${epoch.years.from}\u2013${epoch.years.to}`)) fail('years are missing');

    // feed: exactly the epoch's events, in chronological order, frame/story marked
    const feedHtml = html.match(/<ol class="feed"[\s\S]*?<\/ol>/)?.[0] ?? '';
    const shown = cardSlugsIn(feedHtml, lang);
    const expected = feed.map((e) => slugOf(e, lang));
    if (JSON.stringify(shown) !== JSON.stringify(expected)) fail(`feed order or content differs from the data.\n    expected: ${expected.join(', ')}\n    found:    ${shown.join(', ')}`);
    const articles = [...feedHtml.matchAll(/<article class="([^"]*)" id="c-([^"]+)"/g)];
    for (const e of feed) {
      const a = articles.find((m) => m[2] === e.id);
      if (!a) fail(`card ${e.id} is missing from the feed`);
      else if (!a[1].includes(`ecard--${e.level}`)) fail(`card ${e.id} is not marked as ${e.level}`);
      else reachableFromFeed.set(`${lang}:${e.id}`, true);
    }
    const detailsCount = (feedHtml.match(/<details class="ecard__layer"/g) ?? []).length;
    if (detailsCount !== feed.length) fail(`expected ${feed.length} expandable story layers (<details>), found ${detailsCount}`);
    if ((feedHtml.match(/<article /g) ?? []).length !== feed.length) fail('number of cards in the feed differs from the data');

    // thread chips: visible threads that have cards here; counters equal the data
    const nav = html.match(/<nav aria-label="[^"]*"[^>]*>\s*<ul class="chips"[\s\S]*?<\/nav>/)?.[0] ?? '';
    const wantChips = visibleThreads.map((th) => ({ th, n: inThread(th, feed).length })).filter((c) => c.n > 0);
    const gotChips = [...nav.matchAll(/<a [^>]*href="([^"]*)\/(fio|thread)\/([^"/]+)\/#([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)];
    if (gotChips.length !== wantChips.length) fail(`expected ${wantChips.length} thread chips, found ${gotChips.length}`);
    for (const { th, n } of wantChips) {
      const chip = gotChips.find((m) => m[3] === th.slug[lang]);
      if (!chip) {
        fail(`no chip for thread "${th.id}"`);
        continue;
      }
      const shownCount = Number(chip[5].match(/thread__count"[^>]*>(\d+)</)?.[1]);
      if (shownCount !== n) fail(`counter of "${th.id}" shows ${shownCount}, data says ${n}`);
      if (chip[4] !== `e-${epoch.slug[lang]}`) fail(`chip of "${th.id}" leads to #${chip[4]}, not to this epoch's section`);
    }

    // client controls: same counters as the link chips, filter buttons for the script, data for the filter on every card
    const tools = html.match(/<div class="tools"[\s\S]*?<section class="epoch__feed" aria-labelledby="timeline-title"/)?.[0] ?? '';
    if (!/data-epoch-tools/.test(tools) || !/data-js-only hidden/.test(tools)) fail('filter controls are missing or not hidden until the script runs');
    const noscriptChips = tools.match(/<noscript>[\s\S]*?<\/noscript>/)?.[0] ?? '';
    if (wantChips.length > 0 && !/<a [^>]*thread--link/.test(noscriptChips)) fail('without JavaScript the chips must be links (inside <noscript>)');
    const jsPart = tools.replace(noscriptChips, '');
    const buttons = [...jsPart.matchAll(/<button\b[^>]*data-fio(?:="([^"]*)")?[^>]*>([\s\S]*?)<\/button>/g)];
    if (wantChips.length > 0) {
      const all = buttons.find((b) => (b[1] ?? '') === '');
      if (!all || !sameCounts(countsByMode(all[2], countNode('thread__count')), modeCounts(feed))) {
        fail(`"All" filter button counters differ from the feed (want ${showCounts(modeCounts(feed))}; found ${showCounts(all && countsByMode(all[2], countNode('thread__count')))})`);
      }
      for (const { th } of wantChips) {
        const b = buttons.find((x) => x[1] === th.id);
        const want = modeCounts(inThread(th, feed));
        if (!b) fail(`no filter button for thread "${th.id}"`);
        else if (!sameCounts(countsByMode(b[2], countNode('thread__count')), want)) {
          fail(`filter button of "${th.id}": counters differ (want ${showCounts(want)}; found ${showCounts(countsByMode(b[2], countNode('thread__count')))})`);
        }
        // a chip whose counter is zero in a mode is hidden in that mode (the <li> carries data-hide-in)
        const li = jsPart.match(new RegExp(`<li\\b([^>]*)>\\s*<button[^>]*data-fio="${th.id}"`));
        const hideWant = zeroIn(want).join(' ');
        if (attr(li?.[1], 'data-hide-in') !== hideWant) fail(`filter chip "${th.id}": data-hide-in is "${attr(li?.[1], 'data-hide-in')}", expected "${hideWant}"`);
      }
      if (buttons.length !== wantChips.length + 1) fail(`expected ${wantChips.length + 1} filter buttons, found ${buttons.length}`);
    }
    if ((jsPart.match(/<button\b[^>]*data-view="(timeline|grid)"/g) ?? []).length !== 2) fail('timeline/grid switch needs two buttons');
    for (const e of feed) {
      const li = feedHtml.match(new RegExp(`<li ([^>]*data-threads="([^"]*)"[^>]*)>\\s*<article [^>]*id="c-${e.id}"`));
      if (!li || li[2].split(' ').sort().join(' ') !== [...e.threads].sort().join(' ')) fail(`card ${e.id}: data-threads does not match its threads`);
      else if (!li[1].includes(`data-min-age="${e.min_age}"`) || !li[1].includes(`data-sensitive="${e.sensitive}"`)) fail(`card ${e.id}: the feed item must carry data-min-age="${e.min_age}" and data-sensitive="${e.sensitive}"`);
    }
    // family mode: the message for a mode that leaves the feed empty exists exactly when the data says so
    const emptyWant = zeroIn(modeCounts(feed)).join(' ');
    const emptyGot = html.match(/<div class="family-empty fv fv--block" data-modes="([^"]*)"/)?.[1] ?? '';
    if (emptyGot !== emptyWant) fail(`family-empty message modes are "${emptyGot}", expected "${emptyWant}"`);
    if (!/<style[^>]*>[\s\S]*?<\/style>/.test(readFileSync(join(dir, 'index.html'), 'utf8').match(/<head>[\s\S]*?<\/head>/)?.[0] ?? '')) fail('the prepaint thread filter <style> is missing in <head>');
    if (!/data-empty hidden/.test(html) || !/data-status/.test(html)) fail('empty-thread message or status line is missing');

    // epoch switcher: the MVP epochs as tabs, then the others under one "more eras soon" disclosure; every epoch once;
    // the current one marked, epochs with a page linked, the rest plain text marked --soon
    const switcher = html.match(/<nav class="epoch-switch"[\s\S]*?<\/nav>/)?.[0] ?? '';
    const switchItems = [...switcher.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map((m) => m[1]);
    if (switchItems.length !== epochs.length) fail(`epoch switcher has ${switchItems.length} items, expected ${epochs.length}`);
    if (!/<details class="epoch-switch__more"/.test(switcher)) fail('epoch switcher: the "more eras soon" disclosure is missing');
    [...epochs.filter((e) => e.mvp), ...epochs.filter((e) => !e.mvp)].forEach((other, i) => {
      const item = switchItems[i] ?? '';
      if (!item.includes(other.name[lang])) fail(`epoch switcher item ${i + 1} is not \"${other.name[lang]}\"`);
      const isLink = /<a\b/.test(item);
      if (other.id === epoch.id) {
        if (isLink || !/aria-current="page"/.test(item)) fail('current epoch must be marked with aria-current and not be a link');
      } else if (hasPage(other)) {
        if (!new RegExp(`<a [^>]*href="[^"]*/${SEG[lang].epoch}/${other.slug[lang]}/"`).test(item)) fail(`switcher: epoch "${other.id}" has a page and must be a link`);
      } else if (isLink || !/epoch-switch__item--soon/.test(item)) {
        fail(`switcher: epoch "${other.id}" has no page and must show "coming soon" without a link`);
      }
    });

    // neighbouring epochs: link when the neighbour has a page, otherwise "coming soon" as plain text
    const idx = epochs.findIndex((e) => e.id === epoch.id);
    const pager = html.match(/<nav class="pager"[\s\S]*?<\/nav>/)?.[0] ?? '';
    for (const [offset, rel] of [[-1, 'prev'], [1, 'next']]) {
      const nb = epochs[idx + offset];
      if (!nb) continue;
      if (hasPage(nb)) {
        if (!new RegExp(`<a [^>]*href="[^"]*/${SEG[lang].epoch}/${nb.slug[lang]}/"[^>]*rel="${rel}"|<a [^>]*rel="${rel}"[^>]*href="[^"]*/${SEG[lang].epoch}/${nb.slug[lang]}/"`).test(pager)) fail(`${rel} epoch "${nb.id}" is not linked`);
      } else if (!pager.includes('pager__link--soon') || !pager.includes(nb.name[lang])) {
        fail(`${rel} epoch "${nb.id}" has no content and must show "coming soon"`);
      }
    }
  }

  // ---------- thread pages ----------
  for (const thread of threads) {
    const where = `${lang}/${SEG[lang].thread}/${thread.slug[lang]}`;
    const fail = (m) => errors.push(`${where}: ${m}`);
    const html = read(join(dist, lang, SEG[lang].thread, thread.slug[lang], 'index.html'));
    const visible = visibleThreads.includes(thread);
    if (!visible) {
      if (html) fail(`page exists but the thread has fewer than ${MIN_CARDS} cards`);
      continue;
    }
    if (!html) {
      fail('page was not built');
      continue;
    }
    pages += 1;
    const all = inThread(thread);
    commonChecks(html, where, lang, { placeholder: thread.placeholder || all.some((e) => e.placeholder), expectedH1: thread.name[lang] });
    if (!html.includes(thread.description[lang])) fail('description is missing');
    const header = html.match(/<p class="thread-page__count"[^>]*>[\s\S]*?<\/p>/)?.[0] ?? '';
    if (!sameCounts(countsByMode(header, wordCount), modeCounts(all))) fail(`total counters differ (want ${showCounts(modeCounts(all))}; found ${showCounts(countsByMode(header, wordCount))})`);
    const emptyWant = zeroIn(modeCounts(all)).join(' ');
    const emptyGot = html.match(/<div class="family-empty fv fv--block" data-modes="([^"]*)"/)?.[1] ?? '';
    if (emptyGot !== emptyWant) fail(`family-empty message modes are "${emptyGot}", expected "${emptyWant}"`);

    const sections = epochs.map((epoch) => ({ epoch, list: inThread(thread, inEpoch(epoch)) })).filter((s) => s.list.length > 0);
    const gotSections = [...html.matchAll(/<section id="(e-[^"]+)"[\s\S]*?<\/section>/g)];
    if (gotSections.length !== sections.length) fail(`expected ${sections.length} epoch sections, found ${gotSections.length}`);
    for (const { epoch, list } of sections) {
      const section = gotSections.find((m) => m[1] === `e-${epoch.slug[lang]}`);
      if (!section) {
        fail(`section for epoch "${epoch.id}" is missing`);
        continue;
      }
      const shown = cardSlugsIn(section[0], lang);
      const expected = list.map((e) => slugOf(e, lang));
      if (JSON.stringify(shown) !== JSON.stringify(expected)) fail(`cards of epoch "${epoch.id}" differ from the data.\n    expected: ${expected.join(', ')}\n    found:    ${shown.join(', ')}`);
      list.forEach((e) => reachableFromThread.set(`${lang}:${e.id}`, true));
      if (/<details|ecard--feed/.test(section[0])) fail('thread page must show grid tiles, not expandable feed cards');
      // the epoch chip counter equals the section size
      const chip = html.match(new RegExp(`<a class="chip" href="#e-${epoch.slug[lang]}"[\\s\\S]*?</a>`))?.[0] ?? '';
      if (!sameCounts(countsByMode(chip, countNode('chip__count')), modeCounts(list))) fail(`epoch chip "${epoch.id}": counters differ (want ${showCounts(modeCounts(list))})`);
      const head = section[0].match(/<h2[\s\S]*?<\/h2>/)?.[0] ?? '';
      if (!sameCounts(countsByMode(head, wordCount), modeCounts(list))) fail(`section "${epoch.id}": counters differ (want ${showCounts(modeCounts(list))})`);
      const hideAttr = attr(section[0].match(/^<section\b([^>]*)>/)?.[1], 'data-hide-in');
      if (hideAttr !== zeroIn(modeCounts(list)).join(' ')) fail(`section "${epoch.id}": data-hide-in is "${hideAttr}", expected "${zeroIn(modeCounts(list)).join(' ')}"`);
      const gridHtml = section[0].match(/<ul class="grid"[^>]*>[\s\S]*<\/ul>/)?.[0] ?? '';
      for (const e of list) {
        const li = gridHtml.match(new RegExp(`<li ([^>]*)>\\s*<article [^>]*id="c-${e.id}"`));
        if (!li || !li[1].includes(`data-min-age="${e.min_age}"`) || !li[1].includes(`data-sensitive="${e.sensitive}"`)) fail(`tile ${e.id}: the item must carry data-min-age="${e.min_age}" and data-sensitive="${e.sensitive}"`);
      }
    }
    // thread chips on tiles are left out (the page is about this thread)
    if (/class="thread[ "]/.test(html.match(/<main[\s\S]*<\/main>/)?.[0].replace(/<header class="thread-page__header"[\s\S]*?<\/header>/, '') ?? '')) fail('tiles must not repeat thread chips');
  }
}

// ---------- home pages ----------
const featuredIds = load('featured.yaml').map((f) => f.id);

const SITE_NAME = 'O Elefante Fugiu';
for (const lang of ['pt', 'en']) {
  const where = `${lang}/ (home)`;
  const fail = (m) => errors.push(`${where}: ${m}`);
  const path = join(dist, lang, 'index.html');
  const html = read(path);
  if (!html) {
    fail('page was not built');
    continue;
  }
  pages += 1;
  const raw = readFileSync(path, 'utf8');
  const tiles = epochs.map((epoch) => ({ epoch, page: hasPage(epoch), count: inEpoch(epoch).length }));
  const first = epochs.find(hasPage);
  const placeholder = featuredIds.some((id) => events.find((e) => e.id === id)?.placeholder) || tiles.some((t) => t.page && t.epoch.placeholder);
  commonChecks(html, where, lang, { placeholder, expectedH1: SITE_NAME });

  // hero: tagline, "Start" leads to the first epoch with a page, "Open the map" leads to the map page
  const hero = html.match(/<section class="hero"[\s\S]*?<\/section>/)?.[0] ?? '';
  if (!hero.includes('Foi aqui')) fail('tagline is missing');
  const hrefs = [...hero.matchAll(/<a [^>]*href="([^"]*)"/g)].map((m) => m[1]);
  if (first && !hrefs.some((h) => h.endsWith(`/${lang}/${SEG[lang].epoch}/${first.slug[lang]}/`))) fail('"Start" must lead to the first epoch with a page');
  if (!hrefs.some((h) => h.endsWith(lang === 'pt' ? '/pt/mapa/' : '/en/map/'))) fail('"Open the map" link is missing');

  // showcase: exactly the featured cards, in the order of featured.yaml
  const showcase = html.match(/<section aria-labelledby="showcase-title"[\s\S]*?<\/section>/)?.[0] ?? '';
  const shown = cardSlugsIn(showcase, lang);
  const expected = featuredIds.map((id) => slugOf(events.find((e) => e.id === id), lang));
  if (JSON.stringify(shown) !== JSON.stringify(expected)) fail(`showcase differs from featured.yaml.\n    expected: ${expected.join(', ')}\n    found:    ${shown.join(', ')}`);

  // "Surprise me": button hidden until the script runs; embedded list = published, all ages, not heavy; links are real card pages
  if (!/data-surprise hidden/.test(showcase)) fail('"Surprise me" button must be hidden without JavaScript');
  const list = JSON.parse(raw.match(/<script type="application\/json" id="surprise-data">([\s\S]*?)<\/script>/)?.[1] ?? '[]');
  const wantList = events.filter((e) => !e.sensitive).sort(chrono);
  if (JSON.stringify(list.map((x) => x.id)) !== JSON.stringify(wantList.map((e) => e.id))) fail('surprise list differs from the eligible cards in the data (never a heavy topic, any age)');
  for (const item of list) {
    const ev = events.find((e) => e.id === item.id);
    if (!ev || !item.href.endsWith(`/${lang}/${SEG[lang].story}/${slugOf(ev, lang)}/`)) fail(`surprise link of ${item.id} is not its card page`);
    else if (item.minAge !== String(ev.min_age) || item.sensitive !== Boolean(ev.sensitive)) fail(`surprise item ${item.id} carries a wrong age label or heavy-topic flag`);
  }
  // showcase items carry the data the CSS hides them by
  for (const id of featuredIds) {
    const ev = events.find((e) => e.id === id);
    const li = showcase.match(new RegExp(`<li ([^>]*)>\\s*<article [^>]*id="c-${id}"`));
    if (!li || !li[1].includes(`data-min-age="${ev.min_age}"`) || !li[1].includes(`data-sensitive="${ev.sensitive}"`)) fail(`showcase item ${id} must carry data-min-age="${ev.min_age}" and data-sensitive="${ev.sensitive}"`);
  }

  // epoch tiles: all epochs by order; pages with link, count and theme; the rest "coming soon" without link
  const section = html.match(/<section id="epocas"[\s\S]*?<\/section>/)?.[0] ?? '';
  const items = [...section.matchAll(/<li class="tile ([^"]*)"[^>]*>([\s\S]*?)<\/li>/g)];
  if (items.length !== epochs.length) fail(`expected ${epochs.length} epoch tiles, found ${items.length}`);
  tiles.forEach(({ epoch, page, count }, i) => {
    const [, cls = '', body = ''] = items[i] ?? [];
    if (!body.includes(epoch.name[lang])) fail(`tile ${i + 1} is not "${epoch.name[lang]}"`);
    if (page) {
      if (!cls.includes('tile--link') || !new RegExp(`<a [^>]*href="[^"]*/${SEG[lang].epoch}/${epoch.slug[lang]}/"`).test(body)) fail(`tile "${epoch.id}" must link to its page`);
      const want = modeCounts(inEpoch(epoch));
      const got = countsByMode(body.match(/<p class="tile__count"[^>]*>[\s\S]*?<\/p>/)?.[0] ?? '', wordCount);
      if (!sameCounts(got, want)) fail(`tile "${epoch.id}": counters differ (want ${showCounts(want)}; found ${showCounts(got)})`);
      if (!body.includes(epoch.theme[lang])) fail(`tile "${epoch.id}" misses the theme phrase`);
      if (!body.includes(`${epoch.years.from}\u2013${epoch.years.to}`)) fail(`tile "${epoch.id}" misses the years`);
    } else {
      if (!cls.includes('tile--soon') || /<a\b/.test(body)) fail(`tile "${epoch.id}" has no page: "coming soon" without a link expected`);
      // An MVP epoch that has no published card yet has numeric years only; the others have years_label.
      const yearsText = epoch.years_label ? epoch.years_label[lang] : `${epoch.years.from}–${epoch.years.to}`;
      if (!body.includes(yearsText)) fail(`tile "${epoch.id}" misses its years`);
      if (!/(Em breve|Coming soon)/.test(body)) fail(`tile "${epoch.id}" misses the "coming soon" label`);
    }
  });

  // thread buttons: exactly the visible threads, each a link to its page with the total from the data
  const threadsSection = html.match(/<section aria-labelledby="threads-title"[\s\S]*?<\/section>/)?.[0] ?? '';
  const links = [...threadsSection.matchAll(/<a [^>]*href="[^"]*\/(?:fio|thread)\/([^"/]+)\/"[^>]*>([\s\S]*?)<\/a>/g)];
  if (links.length !== visibleThreads.length) fail(`expected ${visibleThreads.length} thread buttons, found ${links.length}`);
  for (const th of visibleThreads) {
    const l = links.find((m) => m[1] === th.slug[lang]);
    if (!l) fail(`no button for thread "${th.id}"`);
    else {
      const want = modeCounts(inThread(th));
      const got = countsByMode(l[2], countNode('thread__count'));
      if (!sameCounts(got, want)) fail(`counters of thread "${th.id}" differ (want ${showCounts(want)}; found ${showCounts(got)})`);
      const li = threadsSection.match(new RegExp(`<li\\b([^>]*)>\\s*<a [^>]*href="[^"]*/${th.slug[lang]}/"`));
      if (attr(li?.[1], 'data-hide-in') !== zeroIn(want).join(' ')) fail(`thread chip "${th.id}": data-hide-in is "${attr(li?.[1], 'data-hide-in')}", expected "${zeroIn(want).join(' ')}"`);
    }
  }

  // how it works: three steps
  if ((html.match(/<li class="step"/g) ?? []).length !== 3) fail('"How it works" needs exactly three steps');
}

// ---------- reachability: every published card from a feed, and from a thread page when it has a visible thread ----------
for (const lang of ['pt', 'en']) {
  for (const e of events) {
    if (!reachableFromFeed.get(`${lang}:${e.id}`)) errors.push(`${lang}: card ${e.id} cannot be reached from the feed of its epoch`);
    const hasVisibleThread = e.threads.some((id) => visibleThreads.some((th) => th.id === id));
    if (hasVisibleThread && !reachableFromThread.get(`${lang}:${e.id}`)) errors.push(`${lang}: card ${e.id} has a visible thread but is not on its thread page`);
  }
}

if (pages === 0) errors.push('no epoch or thread pages found in dist/');
if (errors.length > 0) {
  console.error(`Listing check failed:\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log(`Listing check passed (${pages} pages: home, epochs, threads: feed order, tiles, counters, sections, neighbours, reachability).`);

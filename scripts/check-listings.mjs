// Checks the built epoch and thread pages in dist/ against the data (docs/spec.md sections 5.2 and 5.5).
// Expected values are computed here from src/content/*.yaml with plain code, independent of the site's helpers.
// Run after `npm run build` (part of postbuild).
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

const root = new URL('..', import.meta.url).pathname;
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
  for (const img of html.matchAll(/<img\b[^>]*>/g)) {
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
    const word = lang === 'pt' ? (all.length === 1 ? 'hist\u00f3ria' : 'hist\u00f3rias') : all.length === 1 ? 'story' : 'stories';
    if (!html.includes(`${all.length} ${word}`)) fail(`total "${all.length} ${word}" is not shown`);

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
      const n = Number(chip.match(/chip__count"[^>]*>(\d+)</)?.[1]);
      if (n !== list.length) fail(`epoch chip "${epoch.id}" shows ${n}, data says ${list.length}`);
    }
    // thread chips on tiles are left out (the page is about this thread)
    if (/class="thread[ "]/.test(html.match(/<main[\s\S]*<\/main>/)?.[0].replace(/<header class="thread-page__header"[\s\S]*?<\/header>/, '') ?? '')) fail('tiles must not repeat thread chips');
  }
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
console.log(`Listing check passed (${pages} epoch and thread pages: feed order, counters, sections, neighbours, reachability).`);

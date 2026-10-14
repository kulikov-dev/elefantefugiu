// Checks the built card pages in dist/ against the data and the accessibility basics.
// Run after `npm run build` (it is part of postbuild). Reads src/content/events/*.yaml.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

const root = new URL('..', import.meta.url).pathname;
const dist = join(root, 'dist');
const SEGMENT = { pt: 'historia', en: 'story' };
const errors = [];
let pages = 0;

const eventsDir = join(root, 'src/content/events');
const events = readdirSync(eventsDir)
  .filter((n) => n.endsWith('.yaml'))
  .map((n) => parse(readFileSync(join(eventsDir, n), 'utf8'), { schema: 'core', customTags: ['timestamp'] }))
  .filter((e) => e.status === 'ready');

const strip = (html) => html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<script[\s\S]*?<\/script>/g, '');
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;|&#\d+;/g, ' ').replace(/\s+/g, ' ').trim();

for (const ev of events) {
  for (const lang of ['pt', 'en']) {
    const where = `${lang}/${SEGMENT[lang]}/${ev.slug[lang]}`;
    const file = join(dist, lang, SEGMENT[lang], ev.slug[lang], 'index.html');
    const fail = (msg) => errors.push(`${where}: ${msg}`);
    if (!existsSync(file)) {
      fail('page was not built');
      continue;
    }
    pages += 1;
    const full = readFileSync(file, 'utf8');
    const html = strip(full);
    const has = (re) => re.test(html);

    // ----- head -----
    if (!has(new RegExp(`<html lang="${lang}"`))) fail(`<html lang="${lang}"> is missing`);
    for (const [name, re] of [
      ['title', /<title>[^<]+<\/title>/],
      ['meta description', /<meta name="description" content="[^"]+"/],
      ['canonical', /<link rel="canonical" href="https?:\/\/[^"]+"/],
      ['hreflang pt', /<link rel="alternate" hreflang="pt" href="https?:\/\/[^"]+"/],
      ['hreflang en', /<link rel="alternate" hreflang="en" href="https?:\/\/[^"]+"/],
      ['hreflang x-default', /<link rel="alternate" hreflang="x-default"/],
      ['og:title', /<meta property="og:title" content="[^"]+"/],
      ['og:description', /<meta property="og:description" content="[^"]+"/],
      ['og:url', /<meta property="og:url" content="https?:\/\/[^"]+"/],
      ['og:image (absolute)', /<meta property="og:image" content="https?:\/\/[^"]+"/],
      ['twitter:card', /<meta name="twitter:card" content="summary_large_image"/],
      ['twitter:image', /<meta name="twitter:image" content="https?:\/\/[^"]+"/],
    ]) {
      if (!has(re)) fail(`${name} is missing`);
    }
    // the other language must exist
    const other = lang === 'pt' ? 'en' : 'pt';
    const otherFile = join(dist, other, SEGMENT[other], ev.slug[other], 'index.html');
    if (!existsSync(otherFile)) fail(`hreflang target ${other}/${SEGMENT[other]}/${ev.slug[other]} does not exist`);
    if (!html.includes(`/${other}/${SEGMENT[other]}/${ev.slug[other]}/`)) fail('hreflang or language switch does not point to the other language slug');

    // ----- headings: one h1, no skipped levels -----
    const levels = [...html.matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1]));
    if (levels.filter((l) => l === 1).length !== 1) fail(`expected exactly one h1, found ${levels.filter((l) => l === 1).length}`);
    if (levels[0] !== 1) fail('the first heading is not h1');
    levels.forEach((l, i) => {
      if (i > 0 && l > levels[i - 1] + 1) fail(`heading level jumps from h${levels[i - 1]} to h${l}`);
    });

    // ----- images, links, buttons, ids -----
    for (const img of html.matchAll(/<img\b[^>]*>/g)) {
      const alt = img[0].match(/\balt="([^"]*)"/);
      if (!alt || alt[1].trim() === '') fail(`img without alt text: ${img[0].slice(0, 80)}`);
    }
    for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)) {
      if (text(m[2]) === '' && !/aria-label="[^"]+"/.test(m[1])) fail(`link without accessible name: ${m[0].slice(0, 80)}`);
    }
    for (const m of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)) {
      if (text(m[2]) === '' && !/aria-label="[^"]+"/.test(m[1])) fail('button without accessible name');
    }
    if (/\btabindex="[1-9]/.test(html)) fail('positive tabindex breaks the keyboard order');
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (dup.length) fail(`duplicate ids: ${[...new Set(dup)].join(', ')}`);
    for (const m of html.matchAll(/aria-labelledby="([^"]+)"/g)) {
      if (!ids.includes(m[1])) fail(`aria-labelledby points to missing id "${m[1]}"`);
    }
    for (const m of html.matchAll(/<a\b[^>]*href="(https?:\/\/[^"]+)"[^>]*>/g)) {
      if (!/rel="[^"]*noopener/.test(m[0]) && !/href="https?:\/\/(localhost|[^"]*\.github\.io)/.test(m[0])) fail(`external link without rel="noopener": ${m[1]}`);
    }

    // ----- required blocks, against the data -----
    if (!has(/<nav class="crumbs"[^>]*aria-label/)) fail('breadcrumbs are missing');
    if (!has(new RegExp(`<h1[^>]*>${ev.title[lang]}</h1>`))) fail('h1 does not contain the event title');
    if (!has(new RegExp(`<span class="tag tag--${ev.label}"`))) fail(`credibility label "${ev.label}" is missing`);
    if (!has(new RegExp(`<span class="age age--${ev.min_age}"`))) fail(`age badge "${ev.min_age}" is missing`);
    // Thread chips: one per thread; a link to the thread page (/fio/ or /thread/) for every thread of the data
    // (all test threads have enough cards to have a page).
    const chips = [...html.matchAll(/<(a|span)\b[^>]*\bclass="thread(?: [^"]*)?"[^>]*>/g)];
    if (chips.length !== ev.threads.length) fail(`expected ${ev.threads.length} thread chips, found ${chips.length}`);
    for (const chip of chips) {
      if (chip[1] !== 'a' || !/href="[^"]*\/(fio|thread)\/[^"]+\/"/.test(chip[0])) fail('thread chip is not a link to a thread page');
    }
    // Epoch crumb leads to the epoch page, not to the home page.
    const crumb = html.match(/<nav class="crumbs"[\s\S]*?<\/nav>/)?.[0] ?? '';
    if (!/<a href="[^"]*\/(epoca|era)\/[^"]+\/"/.test(crumb)) fail('epoch crumb is not a link to an epoch page');
    if (has(/class="heavy"/) !== Boolean(ev.sensitive)) fail(`heavy topic banner should ${ev.sensitive ? '' : 'not '}be shown`);
    if (has(/<meta name="robots" content="noindex"/) !== Boolean(ev.placeholder)) fail('noindex must be set exactly for placeholder cards');
    if (has(/class="placeholder-notice"/) !== Boolean(ev.placeholder)) fail('test-text notice does not match the placeholder flag');
    if (has(/<figure class="figure"/) !== Boolean(ev.image)) fail('illustration block does not match the data (no image means no figure)');
    if (ev.image && text(html.match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/)?.[1] ?? '') === '') fail('figcaption is empty');
    if (ev.image?.caption && !html.includes(ev.image.caption[lang])) fail('image caption is not shown');
    if (ev.image && !/Imagem|Image/.test(html.match(/<figcaption[\s\S]*?<\/figcaption>/)?.[0] ?? '')) fail('credit and licence are not shown');
    if (!has(/<p class="hook"/)) fail('layer 1 (hook) is missing');
    if (!has(/<section id="historia"/)) fail('layer 2 (story, #historia) is missing');
    if (!has(/<details id="detalhes"/)) fail('layer 3 (<details id="detalhes">) is missing');
    if (/<details id="detalhes"[^>]*\bopen\b/.test(html)) fail('layer 3 must be closed by default');
    if (!has(/<section class="bridge"/) || !has(/<address class="bridge__address"/)) fail('"Bridge to today" is missing');
    if (!has(/href="[^"]*\/(mapa|map)\/"/)) fail('"Open on map" link is missing');
    const sources = html.match(/<section class="sources"[\s\S]*?<\/section>/)?.[0] ?? '';
    if ((sources.match(/<li\b/g) ?? []).length !== ev.sources.length) fail(`expected ${ev.sources.length} sources in the list`);
    if (!has(/<p class="checked"/)) fail('check date is missing');
    if (Boolean(ev.interactive) !== has(/data-interactive=/)) fail('interactive placeholder does not match the data');
    if (!has(/data-share-link/) || !has(/data-share-button/)) fail('share widget is missing');
    if (!has(/(corrigir|report)\/\?url=/)) fail('"Found a mistake?" link with the card address is missing');
    if (!has(/rel="(prev|next)"/) && events.filter((e) => e.epoch === ev.epoch).length > 1) fail('previous/next links are missing');
    const nearby = html.match(/<section class="related"[\s\S]*?<\/section>/)?.[0] ?? '';
    const n = (nearby.match(/<li\b/g) ?? []).length;
    if (n < 3 || n > 7) fail(`"Nearby" has ${n} cards, expected 3-7`);
    if (has(/<script[^>]+src="https?:/)) fail('external script');
    if (/<img[^>]*\bsrc="[^"]*"[^>]*>/.test(html) && !/loading="lazy"/.test(html)) fail('illustration is not lazy-loaded');
    if (!full.includes('type="module"')) fail('layer-state script is missing');
  }
}

if (pages === 0) errors.push('no card pages found in dist/');
if (errors.length > 0) {
  console.error(`Card check failed:\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log(`Card check passed (${pages} pages: headings, alt, labels, sources, bridge, meta, hreflang).`);

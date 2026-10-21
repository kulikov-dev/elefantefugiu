// Checks the built card pages in dist/ against the data and the accessibility basics.
// Run after `npm run build` (it is part of postbuild). Reads src/content/events/*.yaml.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
const SEGMENT = { pt: 'historia', en: 'story' };
const errors = [];
let pages = 0;

const eventsDir = join(root, 'src/content/events');
const events = readdirSync(eventsDir)
  .filter((n) => n.endsWith('.yaml'))
  .map((n) => parse(readFileSync(join(eventsDir, n), 'utf8'), { schema: 'core', customTags: ['timestamp'] }))
  .filter((e) => e.status === 'ready');

// A thread has a page (and its chip on a card is a link) from 5 ready cards (src/lib/threads.ts, written out here independently).
const threadCount = new Map();
for (const e of events) for (const id of new Set(e.threads)) threadCount.set(id, (threadCount.get(id) ?? 0) + 1);
const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;').replace(/"/g, '&quot;');

const strip = (html) => html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<script[\s\S]*?<\/script>/g, '');
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;|&#\d+;/g, ' ').replace(/\s+/g, ' ').trim();

// Family mode (docs/spec.md 3.6), rules written out here independently of src/lib/family.ts.
const MODES = ['off', 'all', '12'];
const shownIn = (e, mode) => mode === 'off' || (!e.sensitive && (String(e.min_age) === 'all' || (mode === '12' && String(e.min_age) === '12')));
const idOfHref = (href, lang) => events.find((e) => href.includes(`/${SEGMENT[lang]}/${e.slug[lang]}/`))?.id;
const attrsOf = (tag) => (name) => tag.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`))?.[1];

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

    // ----- family mode: head script, gate, Nearby and previous / next per mode -----
    const head = full.match(/<head>[\s\S]*?<\/head>/)?.[0] ?? '';
    if (!/<script>\(function\(\)\{[\s\S]*?data-family[\s\S]*?data-theme[\s\S]*?<\/script>/.test(head)) fail('the head script that sets data-family and data-theme is missing from <head>');
    if (!/<meta name="color-scheme" content="light dark"/.test(head)) fail('<meta name="color-scheme" content="light dark"> is missing');
    const themeColors = [...head.matchAll(/<meta name="theme-color" content="(#[0-9a-f]{6})" media="\(prefers-color-scheme: (light|dark)\)"/g)].map((m) => m[2]).sort().join(',');
    if (themeColors !== 'dark,light') fail('two theme-color tags with media (light and dark) are expected');
    if (head.indexOf('name="theme-color"') > head.indexOf('data-family')) fail('the theme-color tags must come before the head script (it sets them for an explicit theme)');
    if (!/data-theme-toggle/.test(html) || !/role="radiogroup"[^>]*data-theme-choice/.test(html)) fail('theme: the header button and the footer radio group are expected');
    // Fonts are not preloaded (decision after 7b-1: first paint first; font-display swap and the fallback faces do the rest).
    if (/<link[^>]*rel="preload"[^>]*as="font"/.test(head)) fail('no font preload is expected');
    if (!/<html[^>]*lang="[a-z]{2}"[^>]*data-epoch="[a-z0-9-]+"/.test(full)) fail('the card page needs <html data-epoch="...">');
    if (head.indexOf('data-family') > head.indexOf('rel="stylesheet"') && head.includes('rel="stylesheet"')) fail('the head script must come before the stylesheets (no flash)');
    if (!/role="radiogroup"[^>]*aria-label="[^"]+"/.test(html) || (html.match(/<input type="radio" name="family"/g) ?? []).length !== 3) fail('family toggle: a radio group with an aria-label and three radios is expected');
    const article = html.match(/<article class="card"([^>]*)>/)?.[1] ?? '';
    const gateModes = (attrsOf(article)('data-gate-modes') ?? '').split(' ').filter(Boolean);
    const hiddenIn = MODES.filter((m) => !shownIn(ev, m));
    if (gateModes.join(' ') !== hiddenIn.join(' ')) fail(`data-gate-modes is "${gateModes.join(' ')}", the data says the card is hidden in "${hiddenIn.join(' ')}"`);
    const gateBlock = html.match(/<section class="gate"[\s\S]*?<\/section>/)?.[0] ?? '';
    if (hiddenIn.length > 0) {
      if (!gateBlock) fail('a card some mode hides needs the intermediate screen');
      if (!/data-gate-open/.test(gateBlock) || !/data-gate-back/.test(gateBlock)) fail('the screen needs the "Open" button and the "Back" link');
      const variants = [...gateBlock.matchAll(/<span class="fv"[^>]*?data-modes="([^"]*)"[^>]*>([^<]*)<\/span>/g)];
      for (const m of hiddenIn) {
        const v = variants.find((x) => x[1].split(' ').includes(m));
        if (!v) { fail(`no screen text for mode ${m}`); continue; }
        const age = String(ev.min_age);
        const ageHides = m === 'all' ? age !== 'all' : age === '16';
        const wantAge = ageHides ? (age === '12' ? /12\+/ : /16/) : null;
        if (wantAge && !wantAge.test(v[2])) fail(`mode ${m}: the screen text should name the age ${age}: "${v[2]}"`);
        if (!ageHides && /12\+|16/.test(v[2])) fail(`mode ${m}: the age is not why this card is hidden, but the text names it: "${v[2]}"`);
        const heavy = lang === 'pt' ? /tema difícil/ : /difficult topic/;
        if (ev.sensitive !== heavy.test(v[2])) fail(`mode ${m}: the screen text must mention the heavy topic exactly when the card is sensitive: "${v[2]}"`);
      }
      // the card stays in the HTML
      if (!html.includes('id="historia"') || !html.includes('id="detalhes"') || !/class="gated card__rest"/.test(html)) fail('the card content must stay in the HTML under the screen');
    } else if (gateBlock) fail('a card no mode hides must not have the screen');
    // Nearby and previous / next: for each mode the variant shown holds only cards the mode shows
    const blocks = (cls) => [...html.matchAll(new RegExp(`<div class="fv fv--block"[^>]*?data-modes="([^"]*)"[^>]*>([\\s\\S]*?)(?=<div class="fv fv--block"|<div class="actions"|</div></article>|$)`, 'g'))].filter((b) => b[2].includes(cls));
    for (const [cls, label] of [['class="related"', 'Nearby'], ['class="pager"', 'previous / next']]) {
      const list = blocks(cls);
      const covered = list.flatMap((b) => b[1].split(' '));
      if (MODES.some((m) => covered.filter((x) => x === m).length !== 1)) fail(`${label}: every mode needs exactly one variant (found ${covered.join(' ')})`);
      for (const b of list) {
        const links = [...b[2].matchAll(/<a [^>]*href="([^"]*)"/g)].map((x) => idOfHref(x[1], lang)).filter(Boolean);
        for (const m of b[1].split(' ')) {
          const wrong = links.filter((id) => !shownIn(events.find((e) => e.id === id), m));
          if (wrong.length) fail(`${label}, mode ${m}: leads to hidden card(s) ${wrong.join(', ')}`);
          if (label === 'Nearby' && links.length > 7) fail(`Nearby, mode ${m}: ${links.length} cards, at most 7`);
        }
      }
    }

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
    // The mascot pictures are decorative (empty alt on purpose) and are checked by check-mascot.mjs.
    for (const img of html.matchAll(/<img\b(?![^>]*\bclass="mascot)[^>]*>/g)) {
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
      // aria-labelledby may name several ids separated by spaces
      for (const id of m[1].split(/\s+/)) if (!ids.includes(id)) fail(`aria-labelledby points to missing id "${id}"`);
    }
    for (const m of html.matchAll(/<a\b[^>]*href="(https?:\/\/[^"]+)"[^>]*>/g)) {
      if (!/rel="[^"]*noopener/.test(m[0]) && !/href="https?:\/\/(localhost|[^"]*\.github\.io)/.test(m[0])) fail(`external link without rel="noopener": ${m[1]}`);
    }

    // ----- required blocks, against the data -----
    if (!has(/<nav class="crumbs"[^>]*aria-label/)) fail('breadcrumbs are missing');
    if (!html.includes(`>${escapeHtml(ev.title[lang])}</h1>`)) fail('h1 does not contain the event title');
    if (!has(new RegExp(`<span class="tag tag--${ev.label}"`))) fail(`credibility label "${ev.label}" is missing`);
    // Only 12+ and 16+ are labelled; a card for everyone carries no age badge at all.
    if (String(ev.min_age) === 'all') {
      if (has(/<span class="age /) || /Para todos|All ages/.test(html.match(/<header class="card__header"[\s\S]*?<\/header>/)?.[0] ?? '')) fail('a card for everyone must not show an age badge');
    } else if (!has(new RegExp(`<span class="age age--${ev.min_age}"`))) fail(`age badge "${ev.min_age}" is missing`);
    // Thread chips: one per thread; a link to the thread page (/fio/ or /thread/) for every thread of the data
    // (all test threads have enough cards to have a page).
    const chips = [...html.matchAll(/<(a|span)\b[^>]*\bclass="thread(?: [^"]*)?"[^>]*>/g)];
    if (chips.length !== ev.threads.length) fail(`expected ${ev.threads.length} thread chips, found ${chips.length}`);
    chips.forEach((chip, i) => {
      if ((threadCount.get(ev.threads[i]) ?? 0) < 5) return;
      if (chip[1] !== 'a' || !/href="[^"]*\/(fio|thread)\/[^"]+\/"/.test(chip[0])) fail('thread chip is not a link to a thread page');
    });
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
    // "Open on the map" leads to the map page with this card's id (the map centres on it and opens the preview).
    const bridgeBlock = html.match(/<section class="bridge"[\s\S]*?<\/section>/)?.[0] ?? '';
    const mapLink = bridgeBlock.match(/href="([^"]*\/(?:mapa|map)\/[^"]*)"/)?.[1];
    if (!mapLink) fail('"Open on map" link is missing');
    else if (!new RegExp(`/${lang === 'pt' ? 'mapa' : 'map'}/\\?id=${ev.id}$`).test(mapLink)) fail(`"Open on map" link should end with /?id=${ev.id}, got ${mapLink}`);
    // The bridge block: name, address, the note of the language, and three links.
    const plain = (x) => x.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
    const bridgeText = plain(bridgeBlock);
    for (const [what, want] of [['name', ev.bridge.name], ['address', ev.bridge.address], ['note', ev.bridge.note[lang]]]) if (!bridgeText.includes(want)) fail(`bridge ${what} "${want}" is not in the bridge block`);
    const labels = { pt: { map: 'Ver no mapa', how: 'Como chegar', site: 'Sítio oficial' }, en: { map: 'Open on map', how: 'Get directions', site: 'Official website' } }[lang];
    const links = [...bridgeBlock.matchAll(/<a ([^>]*)>([\s\S]*?)<\/a>/g)].map((m) => ({ attrs: m[1], text: plain(m[2]) }));
    const how = links.find((l) => l.text === labels.how);
    const r5 = (n) => Number(n.toFixed(5));
    const wantOsm = `https://www.openstreetmap.org/?mlat=${r5(ev.bridge.lat)}&mlon=${r5(ev.bridge.lon)}#map=17/${r5(ev.bridge.lat)}/${r5(ev.bridge.lon)}`;
    if (!links.some((l) => l.text === labels.map)) fail(`the "${labels.map}" button is missing`);
    if (!how) fail(`the "${labels.how}" button is missing`);
    else {
      if (!how.attrs.includes(`href="${wantOsm.replace(/&/g, '&amp;')}"`)) fail(`"${labels.how}" should link to ${wantOsm}`);
      if (!/rel="noopener"/.test(how.attrs)) fail(`"${labels.how}" needs rel="noopener"`);
      if (!/data-directions/.test(how.attrs) || !how.attrs.includes(`data-lat="${ev.bridge.lat}"`) || !how.attrs.includes(`data-lon="${ev.bridge.lon}"`)) fail(`"${labels.how}" must carry data-directions, data-lat and data-lon of the bridge`);
    }
    const site = links.find((l) => l.text === labels.site);
    if (!site || !site.attrs.includes(`href="${ev.bridge.url}"`) || !/rel="noopener"/.test(site.attrs)) fail(`the "${labels.site}" link to ${ev.bridge.url} with rel="noopener" is missing`);
    if (/google\.|maps\.apple|bing\.com\/maps|waze|geo:/i.test(bridgeBlock)) fail('the bridge block must not name Google or another service, and the geo: link is made by the script on Android only');
    const sources = html.match(/<section class="sources"[\s\S]*?<\/section>/)?.[0] ?? '';
    if ((sources.match(/<li\b/g) ?? []).length !== ev.sources.length) fail(`expected ${ev.sources.length} sources in the list`);
    // The check date appears once the card has been reviewed (reviewed_on); an unreviewed card shows none.
    if (ev.reviewed_on && !has(/<p class="checked"/)) fail('check date is missing');
    if (!ev.reviewed_on && has(/<p class="checked"/)) fail('check date shown for a card that is not reviewed');
    if (Boolean(ev.interactive) !== has(/data-interactive=/)) fail('interactive placeholder does not match the data');
    if (!has(/data-share-link/) || !has(/data-share-button/)) fail('share widget is missing');
    if (!has(/(corrigir|report)\/\?url=/)) fail('"Found a mistake?" link with the card address is missing');
    if (!has(/rel="(prev|next)"/) && events.filter((e) => e.epoch === ev.epoch).length > 1) fail('previous/next links are missing');
    const nearby = html.match(/<section class="related"[\s\S]*?<\/section>/)?.[0] ?? '';
    const n = (nearby.match(/<li\b/g) ?? []).length;
    if (n < 3 || n > 7) fail(`"Nearby" has ${n} cards, expected 3-7`);
    if (has(/<script[^>]+src="https?:/)) fail('external script');
    if (/<img\b(?![^>]*\bclass="mascot)[^>]*\bsrc="[^"]*"[^>]*>/.test(html) && !/loading="lazy"/.test(html)) fail('illustration is not lazy-loaded');
    if (!full.includes('type="module"')) fail('layer-state script is missing');
  }
}

if (pages === 0) errors.push('no card pages found in dist/');
if (errors.length > 0) {
  console.error(`Card check failed:\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log(`Card check passed (${pages} pages: headings, alt, labels, sources, bridge, meta, hreflang).`);

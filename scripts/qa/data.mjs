// What the browser suites know about the content: read from src/content (the same files the build reads), so no suite hardcodes a
// card, a slug or a count that will change when stories are added.
//   published   cards with status "ready": exactly the cards of the real site
//   fixtures    cards with status "draft" (the test stand-ins evento-exemplo-*): never on the real site, only in the fixture build
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fsPath } from './browser.mjs';

const { parse } = createRequire(import.meta.url)('../../node_modules/yaml');
const content = fsPath(new URL('../../src/content/', import.meta.url));
const read = (name) => parse(readFileSync(`${content}${name}`, 'utf8'));

export const events = readdirSync(`${content}events`)
  .filter((f) => f.endsWith('.yaml'))
  .map((f) => ({ ...parse(readFileSync(`${content}events/${f}`, 'utf8')), file: f }));
export const published = events.filter((e) => e.status === 'ready');
export const fixtures = events.filter((e) => e.status === 'draft');
export const epochs = read('epochs.yaml').sort((a, b) => a.order - b.order);
export const threads = read('threads.yaml');

export const TOTAL = published.length;
export const byId = (id) => events.find((e) => e.id === id);
export const pt = (e) => `/pt/historia/${e.slug.pt}/`;
export const en = (e) => `/en/story/${e.slug.en}/`;
export const inEpoch = (epochId, list = published) => list.filter((e) => e.epoch === epochId);
/** Epochs that have at least one published card, in order. */
export const readyEpochs = epochs.filter((e) => inEpoch(e.id).length > 0);
/** Epochs with no published card ("coming soon"). */
export const comingEpochs = epochs.filter((e) => inEpoch(e.id).length === 0);
/** Threads that have a page: at least `min` published cards (the same rule as src/lib/threads.ts). */
export const inThread = (threadId, list = published) => list.filter((e) => (e.threads ?? []).includes(threadId));
/** First published card that matches, or an error that names what is missing (so the failure says what data the suite needs). */
export function need(what, pick) {
  const found = pick(published);
  if (!found) throw new Error(`The suites need a published card: ${what}. None found in src/content/events.`);
  return found;
}
export const hasInteractive = (e) => !!e.interactive;

/** Page addresses (base path "/"). */
export const epochPath = (e, lang = 'pt') => `/${lang}/${{ pt: 'epoca', en: 'era', ru: 'epoha' }[lang]}/${e.slug[lang]}/`;
export const threadPath = (t, lang = 'pt') => `/${lang}/${{ pt: 'fio', en: 'thread', ru: 'niti' }[lang]}/${t.slug[lang]}/`;
/** Published cards of an epoch in the order of the page (by year, then as the build orders them). */
export const feedOf = (epochId, list = published) => inEpoch(epochId, list).sort((a, b) => a.year - b.year);
/** Threads that have a card in the epoch. */
export const threadsIn = (epochId, list = published) => threads.filter((t) => inEpoch(epochId, list).some((e) => (e.threads ?? []).includes(t.id)));
/** Epochs that have a card of this thread, in order. */
export const epochsOfThread = (threadId, list = published) => epochs.filter((ep) => inEpoch(ep.id, list).some((e) => (e.threads ?? []).includes(threadId)));

/**
 * The same questions asked of the fixture build (variant-plan.mjs): `world.published`, `world.readyEpochs`, `world.feedOf(epochId)` ...
 * Suites that run against VARIANT_URL use this; the others use the plain exports above (the real site).
 */
import { variantOf } from './variant-plan.mjs';
function makeWorld(list) {
  const pub = list.filter((e) => e.status === 'ready');
  const inEp = (id) => pub.filter((e) => e.epoch === id);
  return {
    published: pub,
    TOTAL: pub.length,
    readyEpochs: epochs.filter((e) => inEp(e.id).length > 0),
    inEpoch: inEp,
    feedOf: (id) => inEp(id).sort((a, b) => a.year - b.year),
    threadsIn: (id) => threads.filter((t) => inEp(id).some((e) => (e.threads ?? []).includes(t.id))),
    epochsOfThread: (tid) => epochs.filter((ep) => inEp(ep.id).some((e) => (e.threads ?? []).includes(tid))),
    inThread: (tid) => pub.filter((e) => (e.threads ?? []).includes(tid)),
  };
}
export const real = makeWorld(events);
export const fixture = makeWorld(events.map(variantOf));

/** An interface string of the site (src/i18n/<lang>.json, a dotted key). */
export const ui = (key, lang = 'pt') => key.split('.').reduce((o, k) => o?.[k], JSON.parse(readFileSync(fsPath(new URL(`../../src/i18n/${lang}.json`, import.meta.url)), 'utf8')));
export const featuredIds = read('featured.yaml').map((f) => f.id);
/** The card the "Read" button of the home page opens (src/lib/home.ts). */
export const HOME_START_ID = 'rinoceronte-1515';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { breadcrumbNode, epochNodes, graph, isoYear, pageNodes, serialize, siteNodes, storyNodes, type SchemaContext } from '../src/lib/schema';

const abs = (p: string) => new URL(p, 'https://example.test').href;
const ctx: SchemaContext = {
  lang: 'pt',
  inLanguage: 'pt-PT',
  abs,
  siteName: 'O Elefante Fugiu',
  tagline: 'Foi aqui',
  homeUrl: abs('/pt/'),
  homeLabel: 'Início',
  logoUrl: abs('/logo.png'),
  logoSize: 512,
};
const story = {
  url: abs('/pt/historia/a/'),
  title: 'A',
  description: 'Descrição.',
  image: abs('/img/a.jpg'),
  story: { year: 1514 },
  bridge: { name: 'Teatro', address: 'Praça, Lisboa', lat: 38.7, lon: -9.14 },
  published: '2026-10-21',
  sourceUrls: ['https://other.test/x'],
};

test('site nodes: WebSite with the language and the subtitle, Organization with a PNG logo and no email', () => {
  const [org, site] = siteNodes(ctx);
  assert.equal(org['@type'], 'Organization');
  assert.equal(site['@type'], 'WebSite');
  assert.equal(site.inLanguage, 'pt-PT');
  assert.equal(site.alternateName, 'Foi aqui');
  assert.doesNotMatch(JSON.stringify([org, site]), /@[\w-]+\.|mailto/);
});

test('story: Article with dates, temporalCoverage, Place with geo, citation, no Event; dateModified falls back to published', () => {
  const [article, crumbs] = storyNodes(ctx, story);
  assert.equal(article['@type'], 'Article');
  assert.equal(article.datePublished, '2026-10-21');
  assert.equal(article.dateModified, '2026-10-21');
  assert.deepEqual(article.citation, ['https://other.test/x']);
  assert.equal(article.temporalCoverage, '1514');
  assert.doesNotMatch(JSON.stringify(storyNodes(ctx, story)), /"Event"/, 'a story of the past is not an Event for Google');
  assert.equal(article.about, undefined);
  assert.deepEqual((article.contentLocation as { geo: unknown }).geo, { '@type': 'GeoCoordinates', latitude: 38.7, longitude: -9.14 });
  assert.equal((crumbs.itemListElement as unknown[]).length, 2);
  const [withUpdate] = storyNodes(ctx, { ...story, updated: '2026-11-01', epoch: { name: 'Época', url: abs('/pt/epoca/e/') }, story: { ...story.story, year: { from: 1510, to: 1515 } } });
  assert.equal(withUpdate.dateModified, '2026-11-01');
  assert.equal(withUpdate.temporalCoverage, '1510/1515', 'a span is an ISO interval');
  assert.equal(((withUpdate.isPartOf as Record<string, unknown>)['@type']), 'CollectionPage');
});

test('epoch: CollectionPage, ItemList in order, breadcrumb; page: WebPage or AboutPage', () => {
  const nodes = epochNodes(ctx, { url: abs('/pt/epoca/e/'), name: 'E', description: 'd', stories: [{ url: abs('/pt/historia/a/'), name: 'A' }, { url: abs('/pt/historia/b/'), name: 'B' }] });
  assert.deepEqual(nodes.map((n) => n['@type']), ['CollectionPage', 'ItemList', 'BreadcrumbList']);
  assert.equal(nodes[1].numberOfItems, 2);
  assert.equal((pageNodes(ctx, { url: abs('/pt/sobre/'), name: 'Sobre', description: 'd', type: 'AboutPage' })[0])['@type'], 'AboutPage');
  assert.equal((breadcrumbNode(ctx, abs('/pt/x/'), [{ name: 'X', url: abs('/pt/x/') }]).itemListElement as { position: number }[])[1].position, 2);
});

test('graph and serialize: one document, "<" escaped', () => {
  const doc = graph(ctx, []);
  assert.equal(doc['@context'], 'https://schema.org');
  assert.equal(isoYear(800), '0800');
  assert.equal(isoYear(-140), '-0139', '140 BC is the astronomical year -139');
  assert.equal(isoYear(-1), '0000', '1 BC is the astronomical year 0');
  assert.doesNotMatch(serialize({ a: '</script>' }), /</);
});

test('temporalCoverage: a time further back than four digits is left out, not made up', () => {
  assert.equal('temporalCoverage' in storyNodes(ctx, { ...story, story: { year: -150000000 } })[0], false);
  assert.equal('temporalCoverage' in storyNodes(ctx, { ...story, story: { year: -22000 } })[0], false);
  assert.equal(storyNodes(ctx, { ...story, story: { year: -9999 } })[0].temporalCoverage, '-9998');
});

test('temporalCoverage: a year before the common era is astronomical, in a span too', () => {
  assert.equal(storyNodes(ctx, { ...story, story: { year: -140 } })[0].temporalCoverage, '-0139');
  assert.equal(storyNodes(ctx, { ...story, story: { year: { from: -150, to: -140 } } })[0].temporalCoverage, '-0149/-0139');
});

// Every story of the data has a time of its own in the Article.
import { readFileSync, readdirSync } from 'node:fs';
import { parse } from 'yaml';
test('every story with a year has temporalCoverage in ISO form and no Event', () => {
  const dir = new URL('../src/content/events/', import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith('.yaml'));
  assert.ok(files.length > 0);
  for (const f of files) {
    const e = parse(readFileSync(new URL(f, dir), 'utf8'), { schema: 'core' }) as { id: string; year: number | { from: number; to: number } };
    assert.ok(e.year !== undefined, `${e.id} has a year`);
    const [article] = storyNodes(ctx, { ...story, story: { year: e.year } });
    // A time further back than four digits (the prologue: dinosaurs, the Stone Age) has no honest ISO 8601 year, so the date is left out.
    const start = typeof e.year === 'number' ? e.year : e.year.from;
    if (start < -9999) assert.equal(article.temporalCoverage, undefined, e.id);
    else assert.match(String(article.temporalCoverage), /^-?\d{4}(\/-?\d{4})?$/, e.id);
    assert.doesNotMatch(JSON.stringify(article), /"Event"/);
  }
});

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
  story: { year: 1514, place: { name: 'Roma', lat: 41.9, lon: 12.45 } },
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

test('story: Article with dates, Event, Place with geo, citation; dateModified falls back to published', () => {
  const [article, crumbs] = storyNodes(ctx, story);
  assert.equal(article['@type'], 'Article');
  assert.equal(article.datePublished, '2026-10-21');
  assert.equal(article.dateModified, '2026-10-21');
  assert.deepEqual(article.citation, ['https://other.test/x']);
  assert.deepEqual((article.about as Record<string, unknown>).startDate, '1514');
  assert.deepEqual((article.contentLocation as { geo: unknown }).geo, { '@type': 'GeoCoordinates', latitude: 38.7, longitude: -9.14 });
  assert.equal((crumbs.itemListElement as unknown[]).length, 2);
  const [withUpdate] = storyNodes(ctx, { ...story, updated: '2026-11-01', epoch: { name: 'Época', url: abs('/pt/epoca/e/') }, story: { ...story.story, year: { from: 1510, to: 1515 } } });
  assert.equal(withUpdate.dateModified, '2026-11-01');
  assert.equal((withUpdate.about as Record<string, unknown>).endDate, '1515');
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

// schema.org structured data (JSON-LD), built from the same data as the pages. Pure functions, no Astro imports (tested in plain Node).
// Nothing is written by hand in the story files: a new story gets its markup from its own fields (title, story, year, place, bridge,
// image, sources, published, updated). scripts/check-schema.mjs fails the build when a built page lacks a part of it.
// Every address is absolute (`abs` turns a base-aware path into one). The markup says nothing the page does not show; no FAQ, HowTo,
// Review or rating. The author and publisher is the organization; no person is named.
import type { Lang } from '../i18n/routes';

export type Node = Record<string, unknown>;

export interface SchemaContext {
  lang: Lang;
  /** BCP 47 tag of the page language (pt-PT, en-US, ru-RU). */
  inLanguage: string;
  /** Base-aware path (or already absolute address) -> absolute address on the site. */
  abs: (path: string) => string;
  siteName: string;
  /** The subtitle of the site in this language ("Foi aqui"). */
  tagline: string;
  /** Home page address in this language (absolute). */
  homeUrl: string;
  /** The label of the first crumb ("Início"). */
  homeLabel: string;
  /** The logo as a PNG (absolute address) and its side in pixels. */
  logoUrl: string;
  logoSize: number;
}

export interface Crumb {
  name: string;
  /** Absolute address. */
  url: string;
}

export const ORGANIZATION_ID = (ctx: Pick<SchemaContext, 'abs'>): string => `${ctx.abs('/')}#organization`;
export const WEBSITE_ID = (ctx: Pick<SchemaContext, 'homeUrl'>): string => `${ctx.homeUrl}#website`;

/** WebSite and Organization: on every indexable page. The organization has no email address. */
export function siteNodes(ctx: SchemaContext): Node[] {
  return [
    {
      '@type': 'Organization',
      '@id': ORGANIZATION_ID(ctx),
      name: ctx.siteName,
      url: ctx.abs('/'),
      logo: { '@type': 'ImageObject', url: ctx.logoUrl, width: ctx.logoSize, height: ctx.logoSize },
    },
    {
      '@type': 'WebSite',
      '@id': WEBSITE_ID(ctx),
      name: ctx.siteName,
      alternateName: ctx.tagline,
      url: ctx.homeUrl,
      inLanguage: ctx.inLanguage,
      publisher: { '@id': ORGANIZATION_ID(ctx) },
    },
  ];
}

/** The path of a page: the home page, then the crumbs. */
export function breadcrumbNode(ctx: SchemaContext, pageUrl: string, crumbs: Crumb[]): Node {
  const items = [{ name: ctx.homeLabel, url: ctx.homeUrl }, ...crumbs];
  return {
    '@type': 'BreadcrumbList',
    '@id': `${pageUrl}#breadcrumb`,
    itemListElement: items.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.url })),
  };
}

const place = (name: string, lat: number, lon: number, address?: string): Node => ({
  '@type': 'Place',
  name,
  ...(address ? { address } : {}),
  geo: { '@type': 'GeoCoordinates', latitude: lat, longitude: lon },
});

/**
 * A year as an ISO 8601 year ("1514", "0800"). The data stores a year before the common era as a negative number that counts like
 * the history books ("-140" is 140 BC); ISO 8601 counts astronomically (there is a year 0, so 140 BC is "-0139").
 */
export const isoYear = (year: number): string => (year < -1 ? `-${String(-year - 1).padStart(4, '0')}` : String(Math.max(year + (year < 0 ? 1 : 0), 0)).padStart(4, '0'));

export interface StorySchemaInput {
  url: string;
  title: string;
  description: string;
  /** Absolute address of the main picture (the same as og:image). */
  image: string;
  story: { year: number | { from: number; to: number }; place: { name: string; lat: number; lon: number } };
  bridge: { name: string; address: string; lat: number; lon: number };
  published: string;
  updated?: string | undefined;
  sourceUrls: string[];
  /** The epoch page, when the epoch has one. */
  epoch?: { name: string; url: string } | undefined;
}

/** A story page: Article (about an Event, content location = the place of the "Bridge to today") and BreadcrumbList. */
export function storyNodes(ctx: SchemaContext, input: StorySchemaInput): Node[] {
  const { year } = input.story;
  const [from, to] = typeof year === 'number' ? [year, year] : [year.from, year.to];
  const crumbs: Crumb[] = [...(input.epoch ? [input.epoch] : []), { name: input.title, url: input.url }];
  const breadcrumb = breadcrumbNode(ctx, input.url, crumbs);
  const article: Node = {
    '@type': 'Article',
    '@id': `${input.url}#article`,
    mainEntityOfPage: input.url,
    url: input.url,
    headline: input.title,
    description: input.description,
    image: [input.image],
    inLanguage: ctx.inLanguage,
    datePublished: input.published,
    dateModified: input.updated ?? input.published,
    author: { '@id': ORGANIZATION_ID(ctx) },
    publisher: { '@id': ORGANIZATION_ID(ctx) },
    isPartOf: input.epoch ? { '@type': 'CollectionPage', '@id': `${input.epoch.url}#webpage`, url: input.epoch.url, name: input.epoch.name } : { '@id': WEBSITE_ID(ctx) },
    about: {
      '@type': 'Event',
      name: input.title,
      startDate: isoYear(from),
      ...(to !== from ? { endDate: isoYear(to) } : {}),
      location: place(input.story.place.name, input.story.place.lat, input.story.place.lon),
    },
    contentLocation: place(input.bridge.name, input.bridge.lat, input.bridge.lon, input.bridge.address),
    ...(input.sourceUrls.length > 0 ? { citation: input.sourceUrls } : {}),
  };
  return [article, breadcrumb];
}

export interface EpochSchemaInput {
  url: string;
  name: string;
  description: string;
  /** The stories in the order of the page. */
  stories: { url: string; name: string }[];
}

/** An epoch page: CollectionPage, the list of its stories and BreadcrumbList. */
export function epochNodes(ctx: SchemaContext, input: EpochSchemaInput): Node[] {
  return [
    {
      '@type': 'CollectionPage',
      '@id': `${input.url}#webpage`,
      url: input.url,
      name: input.name,
      description: input.description,
      inLanguage: ctx.inLanguage,
      isPartOf: { '@id': WEBSITE_ID(ctx) },
      mainEntity: { '@id': `${input.url}#stories` },
      breadcrumb: { '@id': `${input.url}#breadcrumb` },
    },
    {
      '@type': 'ItemList',
      '@id': `${input.url}#stories`,
      numberOfItems: input.stories.length,
      itemListElement: input.stories.map((s, i) => ({ '@type': 'ListItem', position: i + 1, url: s.url, name: s.name })),
    },
    breadcrumbNode(ctx, input.url, [{ name: input.name, url: input.url }]),
  ];
}

export interface PageSchemaInput {
  url: string;
  name: string;
  description: string;
  /** AboutPage for "About the project", WebPage for the others. */
  type?: 'WebPage' | 'AboutPage' | 'CollectionPage';
}

/** Map, thread, About, Method, Legal: a page of the site with BreadcrumbList. */
export function pageNodes(ctx: SchemaContext, input: PageSchemaInput): Node[] {
  return [
    {
      '@type': input.type ?? 'WebPage',
      '@id': `${input.url}#webpage`,
      url: input.url,
      name: input.name,
      description: input.description,
      inLanguage: ctx.inLanguage,
      isPartOf: { '@id': WEBSITE_ID(ctx) },
      breadcrumb: { '@id': `${input.url}#breadcrumb` },
    },
    breadcrumbNode(ctx, input.url, [{ name: input.name, url: input.url }]),
  ];
}

/** All the nodes of a page as one JSON-LD document (@graph); `page` are the nodes of the page itself. */
export function graph(ctx: SchemaContext, page: Node[]): Node {
  return { '@context': 'https://schema.org', '@graph': [...siteNodes(ctx), ...page] };
}

/** JSON for a <script type="application/ld+json">: "<" is escaped so no text can close the tag. */
export const serialize = (data: Node): string => JSON.stringify(data).replace(/</g, '\\u003c');

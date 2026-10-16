// Data the map page needs about each card, in one language. Pure helpers (no Astro imports).
import type { Lang } from '../i18n/routes';
import { formatYear, type EventData } from './events';
import type { EpochData } from './epochs';
import { normalizeMinAge, normalizeSensitive, type MinAge } from './family';

export interface MapCardInfo {
  id: string;
  /** Coordinates of the place (not of the "bridge to today" address). */
  lat: number;
  lon: number;
  importance: 1 | 2 | 3;
  threads: string[];
  epoch: string;
  title: string;
  /** "1498 · Lisboa" */
  meta: string;
  hook: string;
  href: string;
  /** Age label and heavy-topic flag: the map hides the cards the family mode hides. */
  minAge: MinAge;
  sensitive: boolean;
}

/** Cards for the map in one language; `hrefOf` builds the (base-aware) card address from the event. */
export function toMapCards(events: readonly EventData[], lang: Lang, hrefOf: (event: EventData) => string): MapCardInfo[] {
  return events.map((e) => ({
    id: e.id,
    lat: e.place.lat,
    lon: e.place.lon,
    importance: e.importance,
    threads: [...e.threads],
    epoch: e.epoch,
    title: e.title[lang],
    meta: `${formatYear(e, lang)} · ${e.place.name}`,
    hook: e.hook[lang],
    href: hrefOf(e),
    minAge: normalizeMinAge(e.min_age),
    sensitive: normalizeSensitive(e.sensitive),
  }));
}

export interface EpochGroup<C> {
  epoch: EpochData;
  cards: C[];
}

/** Cards grouped by epoch in epoch `order`; epochs without cards are left out. Keeps the card order inside a group. */
export function groupByEpoch<C extends { epoch: string }>(cards: readonly C[], epochs: readonly EpochData[]): EpochGroup<C>[] {
  return [...epochs]
    .sort((a, b) => a.order - b.order)
    .map((epoch) => ({ epoch, cards: cards.filter((c) => c.epoch === epoch.id) }))
    .filter((g) => g.cards.length > 0);
}

/** JSON that is safe inside a <script type="application/json"> element. */
export function safeJson(value: unknown): string {
  const separators = new RegExp(`[${String.fromCharCode(0x2028)}${String.fromCharCode(0x2029)}]`, 'g');
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(separators, (ch) => `\\u${ch.charCodeAt(0).toString(16)}`);
}

// Pure helpers for the home page. No Astro imports, so they run in plain unit tests.
import { epochFeed, epochHasContent, type EpochData } from './epochs';
import type { EventData } from './events';
import { ageInfoOf, countByMode, type FamilyMode } from './family';

/** The first epoch (by `order`) that has a page: the target of the "Start" button. */
export function firstMvpEpoch<E extends Pick<EpochData, 'id' | 'order' | 'mvp'>>(epochs: readonly E[], events: readonly EventData[]): E | null {
  return [...epochs].sort((a, b) => a.order - b.order).find((e) => epochHasContent(e, events)) ?? null;
}

export interface EpochTile<E> {
  epoch: E;
  /** True when the epoch has a page; otherwise the tile is a "Coming soon" tile without a link. */
  available: boolean;
  /** Published stories of the epoch; counted from the data at build time. */
  count: number;
  /** The same count for each family mode (off, all, 12). */
  counts: Record<FamilyMode, number>;
}

/** One tile per epoch, in `order`. */
export function epochTiles<E extends Pick<EpochData, 'id' | 'order' | 'mvp'>>(epochs: readonly E[], events: readonly EventData[]): EpochTile<E>[] {
  return [...epochs]
    .sort((a, b) => a.order - b.order)
    .map((epoch) => {
      const feed = epochFeed(epoch, events);
      return { epoch, available: epochHasContent(epoch, events), count: feed.length, counts: countByMode(feed.map(ageInfoOf)) };
    });
}

/** Featured cards in the order of the featured list; ids that are not published are skipped. */
export function pickFeatured(ids: readonly string[], events: readonly EventData[]): EventData[] {
  return ids.map((id) => events.find((e) => e.id === id)).filter((e): e is EventData => e !== undefined);
}

/**
 * Cards "Surprise me" may open: published and never a heavy topic. The age is checked in the browser against
 * the family mode (isSurpriseAllowed): in "off" any age is fine, in the other modes only what the mode shows.
 */
export function surpriseCandidates(events: readonly EventData[]): EventData[] {
  return events.filter((e) => e.status === 'ready' && !e.sensitive);
}

export const SURPRISE_KEY = 'lastSurprise';

/** A random id from the list that differs from the last one; with a single id there is no choice. */
export function pickSurprise(ids: readonly string[], last: string | null, random: () => number = Math.random): string | null {
  if (ids.length === 0) return null;
  const pool = ids.length > 1 ? ids.filter((id) => id !== last) : [...ids];
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))] ?? null;
}

/** localStorage key of the last epoch the reader visited (the id, so it works in every language). */
export const LAST_EPOCH_KEY = 'lastEpoch';

/** The saved epoch id if it is one of the epochs with a page (`known`), otherwise null: a stale or foreign value is ignored. */
export function pickLastEpoch(saved: string | null | undefined, known: readonly string[]): string | null {
  const id = String(saved ?? '').trim();
  return id !== '' && known.includes(id) ? id : null;
}

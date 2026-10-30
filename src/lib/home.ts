// Pure helpers for the home page. No Astro imports, so they run in plain unit tests.
import { epochFeed, epochHasContent, type EpochData } from './epochs';
import type { EventData } from './events';
import { ageInfoOf, countByMode, type FamilyMode } from './family';

/** The first epoch (by `order`) that has a page: the target of the "Start" button. */
export function firstMvpEpoch<E extends Pick<EpochData, 'id' | 'order' | 'mvp'>>(epochs: readonly E[], events: readonly EventData[]): E | null {
  return [...epochs].sort((a, b) => a.order - b.order).find((e) => epochHasContent(e, events)) ?? null;
}

/** The story the main button of the home page opens ("Read in a minute"): the rhinoceros and the elephant, the story the name comes from. */
export const HOME_START_ID = 'rinoceronte-1515';

/** That story if it is published, otherwise nothing (the button then leads to the first epoch). */
export const homeStartStory = <T extends { id: string; status?: string }>(events: readonly T[]): T | null =>
  events.find((e) => e.id === HOME_START_ID && e.status !== 'draft') ?? null;

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

export interface SurpriseChoice {
  id: string | null;
  /** True when every story the mode allows is already read: the id is then one the reader has read, and the page says so. */
  allRead: boolean;
}

/**
 * "Surprise me" with the read marks. `ids` are the stories the family mode allows; `read` is the list of marks, oldest first (a story read
 * again moves to the end, see addRead). Never the story the reader has open (`current`) unless it is the only one.
 * Unread stories come first (random, not the same as `last` when there is a choice). When nothing unread is left, the one read the
 * longest ago (not `last`, so a second click gives another), and `allRead` is true. Without marks it is the plain random choice.
 */
export function chooseSurprise(
  ids: readonly string[],
  read: readonly string[],
  last: string | null,
  current: string | null = null,
  random: () => number = Math.random,
): SurpriseChoice {
  const pool = ids.length > 1 && current ? ids.filter((id) => id !== current) : [...ids];
  if (pool.length === 0) return { id: null, allRead: false };
  const done = new Set(read);
  const unread = pool.filter((id) => !done.has(id));
  if (unread.length > 0) return { id: pickSurprise(unread, last, random), allRead: false };
  const oldestFirst = [...pool].sort((a, b) => read.indexOf(a) - read.indexOf(b));
  const choice = oldestFirst.length > 1 ? oldestFirst.filter((id) => id !== last) : oldestFirst;
  return { id: choice[0] ?? null, allRead: true };
}

/** localStorage key of the last epoch the reader visited (the id, so it works in every language). */
export const LAST_EPOCH_KEY = 'lastEpoch';

/** The saved epoch id if it is one of the epochs with a page (`known`), otherwise null: a stale or foreign value is ignored. */
export function pickLastEpoch(saved: string | null | undefined, known: readonly string[]): string | null {
  const id = String(saved ?? '').trim();
  return id !== '' && known.includes(id) ? id : null;
}

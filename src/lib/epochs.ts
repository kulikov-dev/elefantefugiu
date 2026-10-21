// Pure helpers for epoch and thread pages. No Astro imports, so they run in plain unit tests.
import type { z } from 'astro/zod';
import type { epochSchema, threadSchema } from '../data/schemas';
import { compareChronological, isPublished, type EventData } from './events';
import { countCardsByThread } from './threads';
import type { Localized } from './localize';
import type { Lang } from '../i18n/routes';

export type EpochData = Localized<z.infer<typeof epochSchema>>;
export type ThreadData = Localized<z.infer<typeof threadSchema>>;

/** Published events of an epoch in chronological order: the feed of the epoch page. */
export function epochFeed(epoch: Pick<EpochData, 'id'>, events: readonly EventData[]): EventData[] {
  return events.filter((e) => e.epoch === epoch.id && isPublished(e)).sort(compareChronological);
}

/** An epoch gets a page only when it is part of the MVP and has at least one published event. */
export function epochHasContent(epoch: Pick<EpochData, 'id' | 'mvp'>, events: readonly EventData[]): boolean {
  return epoch.mvp && epochFeed(epoch, events).length > 0;
}

export interface NeighbourEpoch<E> {
  epoch: E;
  /** False means "Coming soon": the epoch exists in the data but has no content yet. */
  available: boolean;
}

/** The epochs next to this one in `order`; an unavailable neighbour is shown as "Coming soon". */
export function neighbourEpochs<E extends Pick<EpochData, 'id' | 'order' | 'mvp'>>(
  epoch: E,
  epochs: readonly E[],
  events: readonly EventData[],
): { prev: NeighbourEpoch<E> | null; next: NeighbourEpoch<E> | null } {
  const sorted = [...epochs].sort((a, b) => a.order - b.order);
  const index = sorted.findIndex((e) => e.id === epoch.id);
  const wrap = (e: E | undefined): NeighbourEpoch<E> | null => (e ? { epoch: e, available: epochHasContent(e, events) } : null);
  if (index < 0) return { prev: null, next: null };
  return { prev: wrap(sorted[index - 1]), next: wrap(sorted[index + 1]) };
}

/** Cards per thread inside one epoch (a card counts for its primary and its second thread). */
export function threadCountsInEpoch(epoch: Pick<EpochData, 'id'>, events: readonly EventData[]): Map<string, number> {
  return countCardsByThread(epochFeed(epoch, events));
}

export interface ThreadSection<E> {
  epoch: E;
  events: EventData[];
}

/** The cards of a thread grouped by epoch, in epoch order; epochs without cards of the thread are left out. */
export function threadSections<E extends Pick<EpochData, 'id' | 'order'>>(
  thread: Pick<ThreadData, 'id'>,
  epochs: readonly E[],
  events: readonly EventData[],
): ThreadSection<E>[] {
  return [...epochs]
    .sort((a, b) => a.order - b.order)
    .map((epoch) => ({ epoch, events: epochFeed(epoch, events).filter((e) => e.threads.includes(thread.id)) }))
    .filter((section) => section.events.length > 0);
}

/** DOM id of the section of an epoch on a thread page; epoch chips and counters link to it. */
export const epochSectionId = (epochSlug: string): string => `e-${epochSlug}`;

/**
 * Years of an epoch as text: `years_label` when the data has one (epochs outside the MVP always do),
 * otherwise "1385\u20131580" built from the numeric range. Empty string if there is neither.
 */
export function epochYearsText(epoch: Pick<EpochData, 'years' | 'years_label'>, lang: Lang): string {
  if (epoch.years_label) return epoch.years_label[lang];
  if (!epoch.years) return '';
  return epoch.years.from === epoch.years.to ? String(epoch.years.from) : `${epoch.years.from}\u2013${epoch.years.to}`;
}

export interface SwitcherItem<E> {
  epoch: E;
  /** current: the page itself; link: another epoch with a page; soon: no page yet ("Coming soon"). */
  state: 'current' | 'link' | 'soon';
}

/** All epochs in `order` for the switcher on an epoch page. An epoch is a link only when it really has a page. */
export function epochSwitcherItems<E extends Pick<EpochData, 'id' | 'order' | 'mvp'>>(
  current: Pick<EpochData, 'id'>,
  epochs: readonly E[],
  events: readonly EventData[],
): SwitcherItem<E>[] {
  return [...epochs]
    .sort((a, b) => a.order - b.order)
    .map((epoch) => ({
      epoch,
      state: epoch.id === current.id ? 'current' : epochHasContent(epoch, events) ? 'link' : 'soon',
    }));
}

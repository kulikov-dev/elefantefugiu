// Pure helpers for epoch and thread pages. No Astro imports, so they run in plain unit tests.
import type { z } from 'astro/zod';
import type { epochSchema, threadSchema } from '../data/schemas';
import { compareChronological, isPublished, yearText, type EventData } from './events';
import { countCardsByThread } from './threads';
import type { Localized } from './localize';
import type { Lang } from '../i18n/routes';

export type EpochData = Localized<z.infer<typeof epochSchema>>;
export type ThreadData = Localized<z.infer<typeof threadSchema>>;

/** True when a field of the epoch other than the preview picture is still provisional: its page then shows test text (and is noindex). */
export const epochHasTestText = (epoch: Pick<EpochData, 'placeholder'>): boolean => epoch.placeholder.some((field) => field !== 'fallback_image');

/** Published events of an epoch in chronological order: the feed of the epoch page. */
export function epochFeed(epoch: Pick<EpochData, 'id'>, events: readonly EventData[]): EventData[] {
  return events.filter((e) => e.epoch === epoch.id && isPublished(e)).sort(compareChronological);
}

/** An epoch gets a page only when it is part of the MVP and has at least one published event. */
export function epochHasContent(epoch: Pick<EpochData, 'id' | 'mvp'>, events: readonly EventData[]): boolean {
  return epoch.mvp && epochFeed(epoch, events).length > 0;
}

/**
 * The nearest epoch with a page on each side of this one, in `order`; epochs without content ("Coming soon") are skipped, so a
 * link never leads to a dead end. `null` when there is none in that direction: the page then shows no link there.
 */
export function neighbourEpochs<E extends Pick<EpochData, 'id' | 'order' | 'mvp'>>(
  epoch: E,
  epochs: readonly E[],
  events: readonly EventData[],
): { prev: E | null; next: E | null } {
  const sorted = [...epochs].sort((a, b) => a.order - b.order);
  const index = sorted.findIndex((e) => e.id === epoch.id);
  if (index < 0) return { prev: null, next: null };
  const available = (e: E) => epochHasContent(e, events);
  return {
    prev: sorted.slice(0, index).reverse().find(available) ?? null,
    next: sorted.slice(index + 1).find(available) ?? null,
  };
}

/**
 * Where "Next" leads from the last story of an epoch: the first story the mode shows (`allowed`) in the nearest later epoch with a page,
 * with that epoch. An epoch whose stories the mode hides all is skipped. `null` after the last such epoch: the page then offers
 * "All eras" instead.
 */
export function nextEpochEntry<E extends Pick<EpochData, 'id' | 'order' | 'mvp'>>(
  epoch: E,
  epochs: readonly E[],
  events: readonly EventData[],
  allowed: (e: EventData) => boolean = () => true,
): { epoch: E; story: EventData } | null {
  const later = [...epochs].filter((e) => e.order > epoch.order && epochHasContent(e, events)).sort((a, b) => a.order - b.order);
  for (const e of later) {
    const story = epochFeed(e, events).find(allowed);
    if (story) return { epoch: e, story };
  }
  return null;
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
  const { from, to } = epoch.years;
  return from === to ? yearText(from, lang) : `${yearText(from, lang)}\u2013${yearText(to, lang)}`;
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

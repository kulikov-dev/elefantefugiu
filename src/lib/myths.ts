// "Myth or fact" (docs/spec.md 5.8): the rules, with no Astro imports. The data is in src/content/myths.yaml (src/lib/myths-data.ts reads it).
import type { MythData } from '../data/schemas';
import type { EventData } from './events';

/** Limits of the text of a card (check:data warns above them). */
export const STATEMENT_MAX_WORDS = 12;
export const ANSWER_MAX_WORDS = 30;

export const wordCount = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length;

/** A claim is shown when the story it rests on is published (and, in family mode, the story is not a heavy topic: the claims rest on stories without `sensitive`). */
export function liveMyths(myths: readonly MythData[], events: readonly Pick<EventData, 'id' | 'sensitive'>[]): MythData[] {
  const byId = new Map(events.map((e) => [e.id, e]));
  return myths.filter((m) => {
    const story = byId.get(m.story);
    return story !== undefined && !story.sensitive;
  });
}

/** The claims in the order of the page: the one asked for by the address first, the others as they are in the file. */
export function mythsInOrder(list: readonly MythData[], first?: string): MythData[] {
  if (!first) return [...list];
  const head = list.filter((m) => m.id === first);
  return [...head, ...list.filter((m) => m.id !== first)];
}

/** A template with {statement} filled in: the Share text "{statement}. Myth or fact?" and og:title "Myth or fact: {statement}?" (a statement that ends with a mark of its own loses it, so no "..?"). */
export const withStatement = (template: string, statement: string): string => template.replace('{statement}', statement.replace(/[.!?]+$/u, ''));

/** The name of the event the counter gets when a card is answered: one event per answer. */
export const answerEvent = (id: string): string => `myth-${id}`;

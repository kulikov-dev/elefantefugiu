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

/** The two events of the end of a game: the result screen is shown, and the result is shared. */
export const FINISH_EVENT = 'myths-finish';
export const SHARE_EVENT = 'myths-share';

export type Choice = 'myth' | 'fact';
export type Outcome = 'hit' | 'miss' | 'part';
export type Band = 'low' | 'mid' | 'high';

/** A "partly" claim has no wrong answer: either button is counted as a hit. */
export const outcomeOf = (verdict: MythData['verdict'], pick: Choice): Outcome => (verdict === 'part' ? 'part' : verdict === pick ? 'hit' : 'miss');

/** The caption of the result by the share of right answers: below a half, below four fifths, the rest (0-4, 5-7, 8-10 of ten). */
export function bandOf(score: number, total: number): Band {
  const share = total > 0 ? score / total : 0;
  return share < 0.5 ? 'low' : share < 0.8 ? 'mid' : 'high';
}

/** The row of squares of a result for a message: 🟦 a hit, ⬜ a miss (no answers in it, only the count). */
export const squaresLine = (hits: readonly boolean[]): string => hits.map((h) => (h ? '🟦' : '⬜')).join('');

/** "{score} of {total}" and the like: fills {name} marks. */
export const fill = (template: string, vars: Readonly<Record<string, string | number>>): string => template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));

/** A copy of the list in a random order (Fisher-Yates); `random` is for tests. */
export function shuffled<T>(list: readonly T[], random: () => number = Math.random): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** The best result is kept in this browser only: {score, total}. */
export const BEST_KEY = 'myths:best';
export interface Best {
  score: number;
  total: number;
}

/** What the browser holds, as a result for a game of `total` claims; anything else (broken, another length of the game) is nothing. */
export function parseBest(raw: string | null, total: number): Best | undefined {
  if (!raw) return undefined;
  try {
    const v = JSON.parse(raw) as Partial<Best>;
    return Number.isInteger(v.score) && v.total === total && v.score! >= 0 && v.score! <= total ? { score: v.score!, total } : undefined;
  } catch {
    return undefined;
  }
}

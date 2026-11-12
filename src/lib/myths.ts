// "Myth or fact" (docs/spec.md 5.8): the rules, with no Astro imports. The claims live in the stories (the field `myth`); src/lib/myths-pool.ts makes the pool of them.
import type { MythData } from '../data/schemas';

/** Limits of the text of a card (check:data warns above them). */
export const STATEMENT_MAX_WORDS = 12;
export const ANSWER_MAX_WORDS = 30;

export const wordCount = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length;

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

/** A round is ten claims of the pool (all of them when there are fewer), with at least three "Myth" and three "Fact" when the pool has so many. */
export const ROUND_SIZE = 10;
export const MIN_PER_VERDICT = 3;
export const roundSizeOf = (poolSize: number): number => Math.min(ROUND_SIZE, poolSize);

interface PickFrom {
  id: string;
  verdict: MythData['verdict'];
}

/**
 * The ids of a new round, in a random order. The balance comes first (the minimum of each of "Myth" and "Fact"), then the claims that were not in `avoid` (the previous round) are taken
 * before those that were, as far as the pool allows. `include` is a claim that must be in the round (the page of one claim) and stands first. `random` is for tests.
 */
export function pickRound(pool: readonly PickFrom[], random: () => number = Math.random, avoid: readonly string[] = [], include?: string): string[] {
  const size = roundSizeOf(pool.length);
  const head = include === undefined ? undefined : pool.find((m) => m.id === include);
  const rest = pool.filter((m) => m !== head);
  const need = size - (head ? 1 : 0);
  const old = new Set(avoid);
  const fresh = (list: readonly PickFrom[]): PickFrom[] => [...shuffled(list.filter((m) => !old.has(m.id)), random), ...shuffled(list.filter((m) => old.has(m.id)), random)];
  const minimum = (verdict: PickFrom['verdict']): number => Math.max(0, Math.min(MIN_PER_VERDICT, pool.filter((m) => m.verdict === verdict).length) - (head?.verdict === verdict ? 1 : 0));
  const chosen = [...fresh(rest.filter((m) => m.verdict === 'myth')).slice(0, minimum('myth')), ...fresh(rest.filter((m) => m.verdict === 'fact')).slice(0, minimum('fact'))].slice(0, need);
  const taken = new Set(chosen.map((m) => m.id));
  const more = fresh(rest.filter((m) => !taken.has(m.id))).slice(0, need - chosen.length);
  const ids = shuffled([...chosen, ...more], random).map((m) => m.id);
  return head ? [head.id, ...ids] : ids;
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

/** The round that is not finished (or just finished), kept in this browser only: the claims of the round in their order and the outcome of each answer so far (null: not answered yet). */
export const GAME_KEY = 'myths:game';
export interface Game {
  order: string[];
  marks: (Outcome | null)[];
}

const OUTCOMES: readonly unknown[] = ['hit', 'miss', 'part'];

/** What the browser holds, as a round over claims of this pool (`ids`); anything else (broken, another length, a claim that has left the pool) is nothing, so a new round starts. */
export function parseGame(raw: string | null, ids: readonly string[]): Game | undefined {
  if (!raw) return undefined;
  try {
    const v = JSON.parse(raw) as Partial<Game>;
    const { order, marks } = v;
    const size = roundSizeOf(ids.length);
    if (!Array.isArray(order) || !Array.isArray(marks) || order.length !== size || marks.length !== size) return undefined;
    if (new Set(order).size !== size || !order.every((id) => ids.includes(id as string))) return undefined;
    if (!marks.every((m) => m === null || OUTCOMES.includes(m))) return undefined;
    return { order: order as string[], marks: marks as (Outcome | null)[] };
  } catch {
    return undefined;
  }
}

/** How many claims are answered; the game is over when all of them are. A hit and a "partly" both count as right. */
export const answered = (game: Game): number => game.marks.filter((m) => m !== null).length;
export const hitsOf = (game: Game): number => game.marks.filter((m) => m === 'hit' || m === 'part').length;

/** The white four-petal pattern in the middle of a hit tile (a miss and an empty tile have none). */
export const HIT_PATTERN =
  '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><g fill="currentColor"><ellipse cx="8" cy="4.6" rx="1.9" ry="2.7"/><ellipse cx="8" cy="11.4" rx="1.9" ry="2.7"/><ellipse cx="4.6" cy="8" rx="2.7" ry="1.9"/><ellipse cx="11.4" cy="8" rx="2.7" ry="1.9"/></g></svg>';

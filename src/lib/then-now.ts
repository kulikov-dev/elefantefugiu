// "Then and now" on an epoch page: the numbers that are calculated, not written by hand. Pure helpers (no Astro imports).
import type { Lang } from '../i18n/routes';
import type { LText } from './localize';

/**
 * How many times the "now" fits into the "then" (both in hours): "the same time" of the card. Under 100 it is a whole number; from 100 it is
 * rounded to tens, because "about 197" claims more than the figures know ("about 200"). At least 1.
 */
export function thenNowRatio(thenHours: number, nowHours: number): number {
  const n = thenHours / nowHours;
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.max(1, n >= 100 ? Math.round(n / 10) * 10 : Math.round(n));
}

/** The text of a card with {n} filled in (the number written the way the language writes it). */
export function thenNowText(card: { text: LText; then_hours?: number | undefined; now_hours?: number | undefined }, lang: Lang): string {
  const text = card.text[lang];
  if (!text.includes('{n}')) return text;
  if (card.then_hours === undefined || card.now_hours === undefined) throw new Error('{n} in the text of a "Then and now" card without then_hours and now_hours');
  return text.replaceAll('{n}', new Intl.NumberFormat({ pt: 'pt-PT', en: 'en-US', ru: 'ru-RU' }[lang]).format(thenNowRatio(card.then_hours, card.now_hours)));
}

/**
 * A figure with its unit must not break across lines ("1 h 40 min" stays together): a space between a digit and a word, and between the
 * hour mark (h, ч) and the digits after it, becomes a no-break space. Other spaces stay, so a long phrase still wraps.
 */
export const tieNumbers = (text: string): string => text.replace(/(\d) (?=\p{L})/gu, '$1 ').replace(/(?<=(?:^|\s)(?:h|ч)) (?=\d)/gu, ' ');

/** The kinds of the cards that are not plain facts, in the order the footnote explains them: estimate, calc. */
export function thenNowNoteKinds(cards: readonly { kind: 'known' | 'estimate' | 'calc' }[]): ('estimate' | 'calc')[] {
  return (['estimate', 'calc'] as const).filter((kind) => cards.some((c) => c.kind === kind));
}

// Where the seven sardines swim (docs/spec.md "Кабинет редкостей"): one place and one number each, in the tail of the main column of the page (never in the text of a story, never
// on a control). The sardine of the result of "Myth or fact" is one: the block of the result is the same on the game page and on the pages of the ranges (/zvanie/).
import type { PageKey } from '../i18n/routes';

export type SardinePlace =
  | { n: number; page: Extract<PageKey, 'about' | 'method' | 'map' | 'games'>; start?: boolean }
  | { n: number; page: 'notfound' | 'myths-result'; start?: boolean }
  | { n: number; page: 'epoch'; epoch: string; start?: boolean };

export const SARDINE_PLACES: readonly SardinePlace[] = [
  { n: 1, page: 'about' },
  { n: 2, page: 'method', start: true },
  { n: 3, page: 'notfound' },
  { n: 4, page: 'map' },
  { n: 5, page: 'games', start: true },
  { n: 6, page: 'myths-result' },
  { n: 7, page: 'epoch', epoch: 'pombal-e-terramoto' },
];

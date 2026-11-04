// What the cards of "Where to start" and their pictures have in common: the build (StartCard, HomeView) and the script that swaps the cards in the
// browser (src/scripts/start-set.ts) use the same widths and sizes, so a swapped card loads the picture a built one would.

export const START_CARD_WIDTHS = [320, 480, 680, 768, 960];
export const START_CARD_QUALITY = 72;
// The width the picture really has (measured in the browser): the showcase is a grid of tiles at least 16 rem wide with a gap of 16 px in a
// container of 1152 px less 2 x 16 px of page padding; a card has a 1 px border. One column below 35 rem (page width less 2 x 16 + 2 px),
// two columns from 35 rem, three from 52 rem, and at 72 rem the container stops growing (361 px).
export const START_CARD_SIZES = '(min-width: 72rem) 361px, (min-width: 52rem) calc((100vw - 64px) / 3 - 2px), (min-width: 35rem) calc(50vw - 26px), calc(100vw - 34px)';

/** The data of one card for the browser: the text of a card of a story or of a pinned page, and its picture when it has one. */
export interface StartCardData {
  href: string;
  hook: string;
  title: string;
  /** The `lang` attribute of the hook when it differs from the page (a Russian page showing the English text); */
  hookLang?: string;
  /** "year · place"; stories only. */
  meta?: string;
  label?: 'documented' | 'legend' | 'debated';
  heavy?: boolean;
  img?: { src: string; srcset?: string; width?: number; height?: number; alt: string; pos?: string };
}

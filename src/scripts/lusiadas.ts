// "Save the Lusiads" on the page of Portugal Day (src/components/LusiadasGame.astro). The game itself is src/scripts/lusiadas-game.mjs; this file hands it the words
// of the page (data-lusiadas) and two events for GoatCounter: the start of a run and a saved manuscript. Repeats are not counted here, GoatCounter does it.
import { mount } from './lusiadas-game.mjs';
import type { Counter } from '../lib/like';

const tell = (event: string): void => {
  (window as unknown as { goatcounter?: Counter }).goatcounter?.count?.({ path: event, title: event, event: true });
};

const root = document.querySelector<HTMLElement>('[data-lusiadas]');
if (root) {
  const words = JSON.parse(root.dataset.lusiadas ?? '{}') as Record<string, string>;
  mount(root, {
    hint: words.hint,
    start: words.start,
    again: words.again,
    won: words.won,
    lost: words.lost,
    aria: words.aria,
    onStart: () => tell('festa-dia-de-portugal-lusiadas-start'),
    onWin: () => tell('festa-dia-de-portugal-lusiadas-win'),
  });
}

// The "Myth or fact" block of the home page shows where the reader is in the game that src/scripts/myths.ts keeps in localStorage: nothing started (empty tiles, "Play"),
// started ("Continue (3 of 12)", the tiles with the answers), finished ("Your result: 7 of 12", "Play again"). Without the script, or with nothing kept, the block stays as the page was built.
import { GAME_KEY, HIT_PATTERN, answered, fill, hitsOf, parseGame, type Game } from '../lib/myths';

const root = document.querySelector<HTMLElement>('[data-home-myths]');
const tiles = root?.querySelector<HTMLElement>('[data-tiles]');
const result = root?.querySelector<HTMLElement>('[data-result]');
const play = root?.querySelector<HTMLElement>('[data-play]');

if (root && tiles && result && play) {
  const ids = JSON.parse(root.dataset.ids ?? '[]') as string[];
  const strings = JSON.parse(root.dataset.strings ?? '{}') as Record<string, string>;
  let game: Game | undefined;
  try {
    game = parseGame(localStorage.getItem(GAME_KEY), ids);
  } catch {
    game = undefined;
  }
  if (game) {
    const total = ids.length;
    const done = answered(game);
    tiles.replaceChildren(
      ...game.marks.map((mark) => {
        const li = document.createElement('li');
        const state = mark === null ? 'empty' : mark === 'miss' ? 'miss' : 'hit';
        li.className = `sq sq--${state}`;
        if (state === 'hit') li.innerHTML = HIT_PATTERN;
        return li;
      }),
    );
    if (done < total) {
      play.textContent = fill(strings.continue ?? '', { done, total });
    } else {
      result.textContent = fill(strings.result ?? '', { score: hitsOf(game), total });
      result.hidden = false;
      play.textContent = strings.again ?? '';
    }
  }
}

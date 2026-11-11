// What the games of the site share (src/components/GameResult.astro, docs/spec.md 5.8): the row of tiles, the counter, the result screen and Share.
// The tiles: a hit is a solid tile with the pattern, a miss a white one, no answer yet an empty frame. The counter is the one already on the site (without it nothing breaks).
import { HIT_PATTERN, fill } from '../lib/myths';

export type TileState = 'empty' | 'hit' | 'miss';
type Counter = { count?: (vars: { path: string; title: string; event: true }) => void };

export const countEvent = (path: string, title: string): void => {
  try {
    (window as unknown as { goatcounter?: Counter }).goatcounter?.count?.({ path, title, event: true });
  } catch {
    // The counter failed: nothing to tell the reader.
  }
};

/** Draws a row of tiles into `target`; `current` is the index of the tile of the open question (-1: none). `label` and `stateLabel` make the hidden text of a tile for screen readers. */
export function drawTiles(target: HTMLElement, states: readonly TileState[], current: number, label: (i: number, state: string) => string, stateLabel: (state: TileState) => string): void {
  target.replaceChildren(
    ...states.map((state, i) => {
      const li = document.createElement('li');
      li.className = `sq sq--${state}${i === current ? ' sq--current' : ''}`;
      if (i === current) li.setAttribute('aria-current', 'step');
      li.innerHTML = state === 'hit' ? HIT_PATTERN : '';
      const text = document.createElement('span');
      text.className = 'visually-hidden';
      text.textContent = label(i, stateLabel(state));
      li.append(text);
      return li;
    }),
  );
}

export interface ResultScreen {
  /** The tiles are in the answers' order; `misses` are the list items of the misses (empty: the block is hidden). */
  show(opts: { title: string; tiles: readonly TileState[]; misses: readonly HTMLElement[] }): void;
  hide(): void;
  /** Share: the text has the title and the squares, never the answers; the dialog of the browser if there is one, otherwise the clipboard. `event` (if any) goes to the counter once per result. */
  onShare(make: () => { title: string; text: string }, event?: string): void;
  onAgain(handler: () => void): void;
  /** Forget that the result was shared (a new game). */
  reset(): void;
}

/** Wires the block of GameResult.astro found in `root`; undefined when it is not there. */
export function initResult(root: HTMLElement, strings: Record<string, string>, shareUrl: string, stateLabel: (state: TileState) => string): ResultScreen | undefined {
  const q = <T extends HTMLElement>(selector: string): T | null => root.querySelector<T>(selector);
  const final = q('[data-final]');
  const scoreEl = q('[data-score]');
  const squares = q('[data-final-squares]');
  const missesBox = q('[data-misses-box]');
  const missesEl = q('[data-misses]');
  const shareButton = q<HTMLButtonElement>('[data-final-share]');
  const againButton = q<HTMLButtonElement>('[data-again]');
  const statusEl = q('[data-final-status]');
  if (!final || !scoreEl || !squares || !missesBox || !missesEl || !shareButton || !againButton || !statusEl) return undefined;
  const s = (key: string, vars: Record<string, string | number> = {}): string => fill(strings[key] ?? '', vars);
  let shared = false;

  return {
    show({ title, tiles, misses }) {
      scoreEl.textContent = title;
      drawTiles(squares, tiles, -1, (i, state) => s('sq_label', { i: i + 1, state }), stateLabel);
      missesBox.hidden = misses.length === 0;
      missesEl.replaceChildren(...misses);
      final.hidden = false;
      scoreEl.focus({ preventScroll: true });
      final.scrollIntoView({ block: 'start' });
    },
    hide() {
      final.hidden = true;
      statusEl.textContent = '';
    },
    onShare(make, event) {
      shareButton.addEventListener('click', async () => {
        const { title, text } = make();
        let done = false;
        if (typeof navigator.share === 'function') {
          try {
            await navigator.share({ title, text, url: shareUrl });
            done = true;
          } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') return; // the person closed the dialog
          }
        }
        if (!done) {
          try {
            await navigator.clipboard.writeText(`${text}\n${shareUrl}`);
            statusEl.textContent = s('copied');
            window.setTimeout(() => (statusEl.textContent = ''), 4000);
            done = true;
          } catch {
            statusEl.textContent = `${s('failed')} ${text} ${shareUrl}`;
          }
        }
        if (done && !shared && event) {
          shared = true;
          countEvent(event, title);
        }
      });
    },
    onAgain(handler) {
      againButton.addEventListener('click', handler);
    },
    reset() {
      shared = false;
      statusEl.textContent = '';
    },
  };
}

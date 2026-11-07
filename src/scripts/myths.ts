// "Myth or fact" (src/views/MythsView.astro, docs/spec.md 5.8). With this script the page is a game: one card at a time, a row of squares at the top (empty / right / wrong),
// a press on "Myth" or "Fact" opens the answer of the card, says whether the guess was right, marks the pressed button, turns both off and shows "Next". After the last card
// comes the result: the score ("7 of 10", never a percent), a line by the range, the misses with links to their stories, Share, Play again (the order is shuffled), Read the stories.
// A game that is not finished is kept in localStorage (the order and the answers) and goes on from the same card; the home page reads it too. A saved game of other claims is dropped.
// The counter (the one already on the site; without it nothing breaks) gets `myth-<id>` per answer, `myths-finish` per result and `myths-share` per shared result. The only thing
// kept is the best result, in localStorage. Without this script the <details> of each card opens by "Answer" and all the cards are in a list.
import { BEST_KEY, FINISH_EVENT, GAME_KEY, HIT_PATTERN, SHARE_EVENT, answerEvent, answered, bandOf, fill, outcomeOf, parseBest, parseGame, shuffled, squaresLine, type Best, type Game, type Outcome, type Choice } from '../lib/myths';

type Counter = { count?: (vars: { path: string; title: string; event: true }) => void };
type Mark = Outcome | undefined;

const root = document.querySelector<HTMLElement>('[data-game]');
const list = document.querySelector<HTMLElement>('.myths__list');
const q = <T extends HTMLElement>(selector: string): T | null => root?.querySelector<T>(selector) ?? null;
const progress = q('[data-progress]');
const stepEl = q('[data-step]');
const squaresEl = q('[data-squares]');
const bestEl = q('[data-best]');
const final = q('[data-final]');
const scoreEl = q('[data-score]');
const finalSquares = q('[data-final-squares]');
const bandEl = q('[data-band]');
const missesBox = q('[data-misses-box]');
const missesEl = q('[data-misses]');
const shareButton = q<HTMLButtonElement>('[data-final-share]');
const againButton = q<HTMLButtonElement>('[data-again]');
const restartButton = q<HTMLButtonElement>('[data-restart]');
const statusEl = q('[data-final-status]');
const endLine = q('.myths__end');
const cards = [...document.querySelectorAll<HTMLElement>('[data-myth]')];

if (root && list && progress && stepEl && squaresEl && bestEl && final && scoreEl && finalSquares && bandEl && missesBox && missesEl && shareButton && againButton && restartButton && statusEl && cards.length > 0) {
  const strings = JSON.parse(root.dataset.strings ?? '{}') as Record<string, string>;
  const shareUrl = root.dataset.shareUrl ?? location.href;
  const total = cards.length;
  const s = (key: string, vars: Record<string, string | number> = {}): string => fill(strings[key] ?? '', vars);

  const count = (path: string, title: string): void => {
    try {
      (window as unknown as { goatcounter?: Counter }).goatcounter?.count?.({ path, title, event: true });
    } catch {
      // The counter failed: nothing to tell the reader.
    }
  };

  let order = cards;
  let index = 0;
  let marks: Mark[] = [];
  let shared = false;

  // The hash of a card brings that card first (the address of one card is already first). Such a game is a visit to one card: it neither continues nor replaces the saved one.
  const wanted = cards.find((c) => c.id === location.hash.slice(1)) ?? document.querySelector<HTMLElement>('.myth--first');
  if (wanted) order = [wanted, ...cards.filter((c) => c !== wanted)];
  const keep = !wanted;

  const readGame = (): Game | undefined => {
    try {
      return parseGame(
        localStorage.getItem(GAME_KEY),
        cards.map((c) => c.id),
      );
    } catch {
      return undefined;
    }
  };
  const saveGame = (): void => {
    if (!keep) return;
    try {
      localStorage.setItem(GAME_KEY, JSON.stringify({ order: order.map((c) => c.id), marks: marks.map((m) => m ?? null) } satisfies Game));
    } catch {
      // Storage is off: the game is simply not kept.
    }
  };
  const dropGame = (): void => {
    if (!keep) return;
    try {
      localStorage.removeItem(GAME_KEY);
    } catch {
      // Nothing was kept.
    }
  };

  const readBest = (): Best | undefined => {
    try {
      return parseBest(localStorage.getItem(BEST_KEY), total);
    } catch {
      return undefined;
    }
  };
  const showBest = (): void => {
    const best = readBest();
    bestEl.hidden = !best;
    if (best) bestEl.textContent = s('best', { score: best.score, total });
  };
  const saveBest = (score: number): void => {
    const best = readBest();
    if (best && best.score >= score) return;
    try {
      localStorage.setItem(BEST_KEY, JSON.stringify({ score, total }));
    } catch {
      // Storage is off: the best result is simply not kept.
    }
  };

  // A claim that is "partly" is counted as a hit, so the square is a hit too.
  const isHit = (m: Mark): boolean => m === 'hit' || m === 'part';

  const drawSquares = (target: HTMLElement, current: number): void => {
    target.replaceChildren(
      ...marks.map((mark, i) => {
        const li = document.createElement('li');
        const state = mark === undefined ? 'empty' : isHit(mark) ? 'hit' : 'miss';
        li.className = `sq sq--${state}${i === current ? ' sq--current' : ''}`;
        if (i === current) li.setAttribute('aria-current', 'step');
        li.innerHTML = state === 'hit' ? HIT_PATTERN : '';
        const label = document.createElement('span');
        label.className = 'visually-hidden';
        label.textContent = s('sq_label', { i: i + 1, state: s(`sq_${state}`) });
        li.append(label);
        return li;
      }),
    );
  };

  const resetCard = (card: HTMLElement): void => {
    const answer = card.querySelector<HTMLDetailsElement>('[data-answer]');
    if (answer) answer.open = false;
    for (const b of card.querySelectorAll<HTMLButtonElement>('[data-pick]')) {
      b.disabled = false;
      b.setAttribute('aria-pressed', 'false');
    }
    const outcome = card.querySelector<HTMLElement>('[data-outcome]');
    if (outcome) outcome.textContent = '';
    const next = card.querySelector<HTMLElement>('[data-next]');
    if (next) next.hidden = true;
  };

  const show = (i: number, focus: boolean): void => {
    index = i;
    order.forEach((card, n) => {
      card.hidden = n !== i;
    });
    stepEl.textContent = s('step', { i: i + 1, total });
    drawSquares(squaresEl, i);
    if (focus) {
      const statement = order[i]!.querySelector<HTMLElement>('.myth__statement');
      statement?.setAttribute('tabindex', '-1');
      statement?.focus({ preventScroll: true });
      progress.scrollIntoView({ block: 'start' });
    }
  };

  const start = (focus: boolean): void => {
    marks = new Array<Mark>(total).fill(undefined);
    shared = false;
    final.hidden = true;
    progress.hidden = false;
    if (endLine) endLine.hidden = true;
    statusEl.textContent = '';
    list.append(...order);
    order.forEach(resetCard);
    showBest();
    restartButton.hidden = true;
    show(0, focus);
  };

  // Goes on from the saved game: the same order, the answers given, the first card not answered yet (all answered: the result).
  const resume = (game: Game): void => {
    const byId = new Map(cards.map((c) => [c.id, c]));
    order = game.order.map((id) => byId.get(id)!);
    start(false);
    marks = game.marks.map((m) => m ?? undefined);
    const done = answered(game);
    if (done === total) {
      finish();
      return;
    }
    restartButton.hidden = false;
    show(done, false);
  };

  const finish = (): void => {
    restartButton.hidden = true;
    const score = marks.filter(isHit).length;
    saveBest(score);
    count(FINISH_EVENT, s('score', { score, total }));
    order.forEach((card) => {
      card.hidden = true;
    });
    progress.hidden = true;
    bestEl.hidden = true;
    if (endLine) endLine.hidden = false;
    scoreEl.textContent = s('score', { score, total });
    drawSquares(finalSquares, -1);
    bandEl.textContent = s(`band_${bandOf(score, total)}`);
    const missed = order.filter((_, n) => !isHit(marks[n]));
    missesBox.hidden = missed.length === 0;
    missesEl.replaceChildren(
      ...missed.map((card) => {
        const li = document.createElement('li');
        const link = card.querySelector<HTMLAnchorElement>('.myth__story');
        const a = document.createElement('a');
        a.href = link?.getAttribute('href') ?? '#';
        a.textContent = card.querySelector('.myth__story-title')?.textContent?.trim() ?? card.dataset.title ?? '';
        li.append(a);
        return li;
      }),
    );
    final.hidden = false;
    scoreEl.focus({ preventScroll: true });
    final.scrollIntoView({ block: 'start' });
  };

  const respond = (card: HTMLElement, picked: HTMLButtonElement): void => {
    const answer = card.querySelector<HTMLDetailsElement>('[data-answer]');
    const body = card.querySelector<HTMLElement>('[data-body]');
    const buttons = [...card.querySelectorAll<HTMLButtonElement>('[data-pick]')];
    if (!answer || !body || answer.open || buttons.some((b) => b.disabled)) return;
    const outcome = outcomeOf((card.dataset.verdict ?? 'myth') as 'myth' | 'fact' | 'part', picked.dataset.pick as Choice);
    marks[order.indexOf(card)] = outcome;
    picked.setAttribute('aria-pressed', 'true');
    for (const b of buttons) b.disabled = true;
    answer.open = true;
    const line = card.querySelector<HTMLElement>('[data-outcome]');
    if (line) line.textContent = s(`outcome_${outcome}`);
    const next = card.querySelector<HTMLElement>('[data-next]');
    if (next) {
      next.hidden = false;
      next.textContent = index === total - 1 ? s('finish') : s('next');
    }
    drawSquares(squaresEl, index);
    restartButton.hidden = false;
    saveGame();
    if (index === total - 1) saveBest(marks.filter(isHit).length);
    count(answerEvent(card.dataset.myth ?? ''), card.dataset.title ?? '');
    body.focus({ preventScroll: true });
  };

  for (const card of cards) {
    for (const b of card.querySelectorAll<HTMLButtonElement>('[data-pick]')) b.addEventListener('click', () => respond(card, b));
    card.querySelector('[data-next]')?.addEventListener('click', () => (index === total - 1 ? finish() : show(index + 1, true)));
  }

  againButton.addEventListener('click', () => {
    order = shuffled(cards);
    start(true);
  });

  // "Start over": the saved game goes, the claims are shuffled again.
  restartButton.addEventListener('click', () => {
    dropGame();
    order = shuffled(cards);
    start(true);
  });

  // Share: the text has the count and the squares, never the answers; the link is the game with ?src=share. The browser's own dialog if there is one, otherwise the text goes to the clipboard.
  shareButton.addEventListener('click', async () => {
    const hits = marks.map(isHit);
    const score = hits.filter(Boolean).length;
    const title = s('share_title', { score, total });
    const text = `${title}\n${squaresLine(hits)}\n${s('share_ask')}`;
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
    if (done && !shared) {
      shared = true;
      count(SHARE_EVENT, title);
    }
  });

  // A finished game on the home page says "Play again": the page then deals a new one, the result stays in the browser until the first answer replaces it.
  const saved = keep ? readGame() : undefined;
  if (saved && answered(saved) < total) {
    resume(saved);
  } else {
    start(false);
  }
}

// "Which came first?" (src/views/OrderView.astro, src/lib/order.ts, docs/spec.md 5.9). Reads /{lang}/order.json (the published stories of the build), keeps the stories the family mode allows
// (the same rule as "Surprise me") and draws a round of ten pairs. A press on a card is the choice: both cards turn off, the pressed one is framed and marked "Your pick", both dates, the mark "First",
// the label of the verdict, the line of what came first, the years between, a plate for each story and "Next". After the last pair the result of src/components/GameResult.astro; "Another round" draws new pairs.
// The round (the pairs, the picks, the pair on the screen) is kept in localStorage `order:game` and goes on from the same pair after the reader has been away (to a story and back, a reload); a finished
// round shows its result until "Another round". A story that is not in the list any more (or not allowed in the family mode now) makes the page start a new round without a word.
// The counter (the one already on the site; without it nothing breaks) gets one event, `order-finish`, when the result is shown for the first time.
import { fill, squaresLine } from '../lib/myths';
import { ORDER_FINISH_EVENT, ORDER_GAME_KEY, allowedIn, between, earlier, makeRound, orderBand, parseOrderGame, toOrderGame, type OrderStory, type Pair } from '../lib/order';
import { pickPlural } from '../lib/plural-pick';
import { storyPlate, verdictLabel } from './answer-parts';
import { currentFamilyMode } from './family-mode';
import { countEvent, drawTiles, initResult, type TileState } from './game-result';

const root = document.querySelector<HTMLElement>('[data-order]');
const q = <T extends HTMLElement>(selector: string): T | null => root?.querySelector<T>(selector) ?? null;
const game = q('[data-game]');
const stepEl = q('[data-step]');
const squaresEl = q('[data-squares]');
const pairEl = q('[data-pair]');
const answerEl = q('[data-answer]');
const verdictEl = q('[data-verdict]');
const outcomeEl = q('[data-outcome]');
const betweenEl = q('[data-between]');
const platesEl = q('[data-plates]');
const nextButton = q<HTMLButtonElement>('[data-next]');
const emptyEl = q('[data-empty]');

if (root && game && stepEl && squaresEl && pairEl && answerEl && verdictEl && outcomeEl && betweenEl && platesEl && nextButton && emptyEl) {
  const strings = JSON.parse(root.dataset.strings ?? '{}') as Record<string, string>;
  const locale = root.dataset.locale ?? 'en';
  // "Share" leads to the page of the range of the result (the same game, a preview of its own), with ?src=share.
  const rankUrls = JSON.parse(root.dataset.rankUrls ?? '{}') as Record<string, string>;
  const s = (key: string, vars: Record<string, string | number> = {}): string => fill(strings[key] ?? '', vars);
  const stateLabel = (state: TileState): string => s(`sq_${state}`);
  const bandNow = (): string => orderBand(marks.filter(Boolean).length, round.length);
  const result = initResult(root, strings, () => rankUrls[bandNow()] ?? location.href, stateLabel);

  let all: OrderStory[] = [];
  let round: Pair[] = [];
  let picks: (0 | 1 | null)[] = [];
  let marks: (boolean | undefined)[] = [];
  let index = 0;

  const save = (): void => {
    try {
      localStorage.setItem(ORDER_GAME_KEY, JSON.stringify(toOrderGame(round, picks, index)));
    } catch {
      // Storage is off: the round is simply not kept.
    }
  };

  const states = (): TileState[] => marks.map((m) => (m === undefined ? 'empty' : m ? 'hit' : 'miss'));
  const drawSquares = (): void => drawTiles(squaresEl, states(), index, (i, state) => s('sq_label', { i: i + 1, state }), stateLabel);
  const key = (r: readonly Pair[]): string => r.map((p) => [p.a.id, p.b.id].sort().join('+')).join(',');

  const cell = (story: OrderStory, k: number): HTMLElement => {
    const wrap = document.createElement('div');
    wrap.className = 'order__cell';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'order__card';
    button.setAttribute('aria-pressed', 'false');
    button.dataset.pick = String(k);
    if (story.img) {
      const img = document.createElement('img');
      img.className = 'order__thumb';
      img.alt = '';
      img.src = story.img.src;
      if (story.img.srcset) {
        img.srcset = story.img.srcset;
        img.sizes = '(min-width: 640px) 340px, 100vw';
      }
      if (story.img.pos) img.style.objectPosition = story.img.pos;
      button.append(img);
    }
    const title = document.createElement('span');
    title.className = 'order__title';
    title.textContent = story.title;
    button.append(title);
    // The hook of the story (or its order_hint) when it does not give the date away; the list has no `hint` for the others.
    if (story.hint) {
      const hint = document.createElement('span');
      hint.className = 'order__hint';
      hint.textContent = story.hint;
      button.append(hint);
    }
    wrap.append(button);
    return wrap;
  };

  const show = (i: number, focus: boolean): void => {
    index = i;
    const pair = round[i]!;
    stepEl.textContent = s('step', { i: i + 1, total: round.length });
    drawSquares();
    answerEl.hidden = true;
    pairEl.replaceChildren(cell(pair.a, 0), cell(pair.b, 1));
    pairEl.querySelectorAll<HTMLButtonElement>('[data-pick]').forEach((b) => b.addEventListener('click', () => respond(Number(b.dataset.pick) as 0 | 1)));
    // After "Next" and "Another round": the focus on the first card, and a smooth scroll to the line "Pair N of 10" (at once under reduced motion), so the pair is in view whole.
    if (focus) {
      pairEl.querySelector<HTMLButtonElement>('[data-pick]')?.focus({ preventScroll: true });
      stepEl.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
  };

  // The answer of the pair on the screen: the pressed card framed and marked, the dates, the label, the line of what came first, the years between, the plates, "Next".
  const reveal = (pick: 0 | 1, focus: boolean): void => {
    const pair = round[index]!;
    const first = earlier(pair);
    const hit = marks[index] === true;
    const buttons = [...pairEl.querySelectorAll<HTMLButtonElement>('[data-pick]')];
    buttons[pick]!.setAttribute('aria-pressed', 'true');
    const yours = document.createElement('span');
    yours.className = 'order__yours';
    yours.textContent = s('yours');
    buttons[pick]!.querySelector('.order__title')?.before(yours);
    [pair.a, pair.b].forEach((story, k) => {
      const b = buttons[k]!;
      b.disabled = true;
      const when = document.createElement('span');
      when.className = 'order__when';
      if (story === first) {
        const mark = document.createElement('span');
        mark.className = 'order__first';
        mark.textContent = s('first');
        when.append(mark);
      }
      const date = document.createElement('span');
      date.className = 'order__date';
      date.textContent = story.date;
      when.append(date);
      b.append(when);
    });
    const gap = between(pair);
    verdictEl.replaceChildren(verdictLabel(hit ? 'fact' : 'myth', s(hit ? 'verdict_hit' : 'verdict_miss')));
    outcomeEl.textContent = s('first_line', { title: first.title });
    betweenEl.textContent = pickPlural(strings, gap.rough ? 'between_about' : 'between', gap.n, locale).replace('{n}', String(gap.n));
    const later = first === pair.a ? pair.b : pair.a;
    platesEl.replaceChildren(...[first, later].map((story) => storyPlate({ href: story.href, title: story.title, thumb: story.thumb, more: s('full_story') })));
    nextButton.textContent = index === round.length - 1 ? s('finish') : s('next');
    answerEl.hidden = false;
    drawSquares();
    if (focus) answerEl.focus({ preventScroll: true });
  };

  const respond = (pick: 0 | 1): void => {
    if (picks[index] !== null) return;
    const pair = round[index]!;
    picks[index] = pick;
    marks[index] = (pick === 0 ? pair.a : pair.b) === earlier(pair);
    save();
    reveal(pick, true);
  };

  // The misses of a round: a pair is two lines, the date in bold and the title, the one that came first on top.
  const missItems = (): HTMLElement[] =>
    round
      .filter((_, n) => !marks[n])
      .map((pair) => {
        const li = document.createElement('li');
        li.className = 'miss-pair';
        const first = earlier(pair);
        [first, first === pair.a ? pair.b : pair.a].forEach((story) => {
          const row = document.createElement('div');
          row.className = 'miss-row';
          const date = document.createElement('b');
          date.className = 'miss-date';
          date.textContent = story.date;
          const a = document.createElement('a');
          a.href = story.href;
          a.textContent = story.title;
          row.append(date, a);
          li.append(row);
        });
        return li;
      });

  const showResult = (): void => {
    game.hidden = true;
    result?.show({ title: s(`band_${orderBand(marks.filter(Boolean).length, round.length)}`), tiles: states(), misses: missItems() });
  };

  const finish = (): void => {
    countEvent(ORDER_FINISH_EVENT, `${marks.filter(Boolean).length}/${round.length}`);
    index = round.length;
    save();
    showResult();
  };

  // A new round: not the same pairs as the last one when there is a choice.
  const start = (focus: boolean): void => {
    // The mode is read at every round: the reader may have changed it.
    const pool = allowedIn(all, currentFamilyMode());
    const last = key(round);
    let next = makeRound(pool);
    for (let tries = 0; tries < 5 && next.length > 0 && key(next) === last; tries += 1) next = makeRound(pool);
    round = next;
    picks = new Array<0 | 1 | null>(round.length).fill(null);
    marks = new Array<boolean | undefined>(round.length).fill(undefined);
    result?.reset();
    result?.hide();
    emptyEl.hidden = round.length > 0;
    game.hidden = round.length === 0;
    if (round.length > 0) {
      index = 0;
      save();
      show(0, focus);
    } else {
      try {
        localStorage.removeItem(ORDER_GAME_KEY);
      } catch {
        // Nothing was kept.
      }
    }
  };

  // Goes on from the kept round: the pair the reader was on (answered or not), or the result of a finished round. Nothing counted: the event went out when the round was finished.
  const resume = (kept: { round: Pair[]; picks: (0 | 1 | null)[]; index: number }): void => {
    round = kept.round;
    picks = kept.picks;
    index = kept.index;
    marks = round.map((p, i) => (picks[i] === null ? undefined : (picks[i] === 0 ? p.a : p.b) === earlier(p)));
    emptyEl.hidden = true;
    result?.reset();
    result?.hide();
    if (kept.index === round.length) {
      showResult();
      return;
    }
    game.hidden = false;
    show(kept.index, false);
    const pick = picks[kept.index];
    if (pick !== null && pick !== undefined) reveal(pick, false);
  };

  nextButton.addEventListener('click', () => {
    if (index === round.length - 1) {
      finish();
    } else {
      index += 1;
      save();
      show(index, true);
    }
  });
  result?.onShare(() => {
    const title = s('share_title', { band: s(`band_${bandNow()}`) });
    return { title, text: `${title}\n${squaresLine(marks.map(Boolean))}\n${s('share_ask')}` };
  });
  result?.onAgain(() => start(true));

  fetch(root.dataset.src ?? '')
    .then((response) => (response.ok ? (response.json() as Promise<OrderStory[]>) : Promise.reject(new Error(String(response.status)))))
    .then((list) => {
      all = list;
      let raw: string | null = null;
      try {
        raw = localStorage.getItem(ORDER_GAME_KEY);
      } catch {
        // Storage is off: a new round.
      }
      const kept = parseOrderGame(raw, list, currentFamilyMode());
      if (kept) resume(kept);
      else start(false);
    })
    .catch(() => {
      emptyEl.hidden = false;
    });
}

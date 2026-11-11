// "Which came first?" (src/views/OrderView.astro, src/lib/order.ts, docs/spec.md 5.9). Reads /{lang}/order.json (the published stories of the build), keeps the stories the family mode allows
// (the same rule as "Surprise me") and draws a round of ten pairs. A press on a card is the choice: both cards turn off, the pressed one stays marked, both dates, the mark "First", the years
// between and the links to the stories come out, then "Next". After the last pair the result of src/components/GameResult.astro; "Another round" draws new pairs. Nothing is kept between visits.
// The counter (the one already on the site; without it nothing breaks) gets one event, `order-finish`, when the result is shown.
import { fill, squaresLine } from '../lib/myths';
import { ORDER_FINISH_EVENT, between, earlier, makeRound, allowedIn, orderBand, type OrderStory, type Pair } from '../lib/order';
import { pickPlural } from '../lib/plural-pick';
import { currentFamilyMode } from './family-mode';
import { countEvent, drawTiles, initResult, type TileState } from './game-result';

const root = document.querySelector<HTMLElement>('[data-order]');
const q = <T extends HTMLElement>(selector: string): T | null => root?.querySelector<T>(selector) ?? null;
const game = q('[data-game]');
const stepEl = q('[data-step]');
const squaresEl = q('[data-squares]');
const pairEl = q('[data-pair]');
const answerEl = q('[data-answer]');
const outcomeEl = q('[data-outcome]');
const betweenEl = q('[data-between]');
const nextButton = q<HTMLButtonElement>('[data-next]');
const emptyEl = q('[data-empty]');

if (root && game && stepEl && squaresEl && pairEl && answerEl && outcomeEl && betweenEl && nextButton && emptyEl) {
  const strings = JSON.parse(root.dataset.strings ?? '{}') as Record<string, string>;
  const locale = root.dataset.locale ?? 'en';
  const shareUrl = root.dataset.shareUrl ?? location.href;
  const s = (key: string, vars: Record<string, string | number> = {}): string => fill(strings[key] ?? '', vars);
  const stateLabel = (state: TileState): string => s(`sq_${state}`);
  const result = initResult(root, strings, shareUrl, stateLabel);

  let all: OrderStory[] = [];
  let round: Pair[] = [];
  let marks: (boolean | undefined)[] = [];
  let index = 0;

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
    pairEl.querySelectorAll<HTMLButtonElement>('[data-pick]').forEach((b) => b.addEventListener('click', () => respond(pair, Number(b.dataset.pick), b)));
    if (focus) {
      pairEl.focus({ preventScroll: true });
      stepEl.scrollIntoView({ block: 'start' });
    }
  };

  const respond = (pair: Pair, picked: number, button: HTMLButtonElement): void => {
    const buttons = [...pairEl.querySelectorAll<HTMLButtonElement>('[data-pick]')];
    if (buttons.some((b) => b.disabled)) return;
    const first = earlier(pair);
    const hit = (picked === 0 ? pair.a : pair.b) === first;
    marks[index] = hit;
    button.setAttribute('aria-pressed', 'true');
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
      const read = document.createElement('a');
      read.className = 'order__read';
      read.href = story.href;
      read.textContent = s('read');
      const hidden = document.createElement('span');
      hidden.className = 'visually-hidden';
      hidden.textContent = `: ${story.title}`;
      read.append(hidden);
      b.parentElement?.append(read);
    });
    const gap = between(pair);
    outcomeEl.textContent = s(hit ? 'outcome_hit' : 'outcome_miss');
    betweenEl.textContent = pickPlural(strings, gap.rough ? 'between_about' : 'between', gap.n, locale).replace('{n}', String(gap.n));
    nextButton.textContent = index === round.length - 1 ? s('finish') : s('next');
    answerEl.hidden = false;
    drawSquares();
    answerEl.focus({ preventScroll: true });
  };

  const finish = (): void => {
    const hits = marks.filter(Boolean).length;
    countEvent(ORDER_FINISH_EVENT, `${hits}/${round.length}`);
    game.hidden = true;
    result?.show({
      title: s(`band_${orderBand(hits, round.length)}`),
      tiles: states(),
      misses: round
        .filter((_, n) => !marks[n])
        .map((pair) => {
          const li = document.createElement('li');
          // The one that came first goes first, each with its date: the list says what was before what.
          const first = earlier(pair);
          [first, first === pair.a ? pair.b : pair.a].forEach((story, k) => {
            if (k > 0) li.append(' — ');
            const a = document.createElement('a');
            a.href = story.href;
            a.textContent = story.title;
            li.append(a, ` (${story.date})`);
          });
          return li;
        }),
    });
  };

  // A new round: not the same pairs as the last one when there is a choice.
  const start = (focus: boolean): void => {
    // The mode is read at every round: the reader may have changed it.
    const pool = allowedIn(all, currentFamilyMode());
    const last = key(round);
    let next = makeRound(pool);
    for (let tries = 0; tries < 5 && next.length > 0 && key(next) === last; tries += 1) next = makeRound(pool);
    round = next;
    marks = new Array<boolean | undefined>(round.length).fill(undefined);
    result?.reset();
    result?.hide();
    emptyEl.hidden = round.length > 0;
    game.hidden = round.length === 0;
    if (round.length > 0) show(0, focus);
  };

  nextButton.addEventListener('click', () => (index === round.length - 1 ? finish() : show(index + 1, true)));
  result?.onShare(() => {
    const title = s('share_title', { band: s(`band_${orderBand(marks.filter(Boolean).length, round.length)}`) });
    return { title, text: `${title}\n${squaresLine(marks.map(Boolean))}\n${s('share_ask')}` };
  });
  result?.onAgain(() => start(true));

  fetch(root.dataset.src ?? '')
    .then((response) => (response.ok ? (response.json() as Promise<OrderStory[]>) : Promise.reject(new Error(String(response.status)))))
    .then((list) => {
      all = list;
      start(false);
    })
    .catch(() => {
      emptyEl.hidden = false;
    });
}

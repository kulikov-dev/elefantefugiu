// "Cut a slice" on the page of Christmas (src/components/BoloGame.astro). Every press on the cake cuts the next slice: it slides out, the one cut before is eaten (crumbs
// on the plate), and a speech bubble over the slice tells what it held (candied fruit, the gift or the bean). The bean and the gift lie in two different random
// slices; the state stays in localStorage (festa-natal-bolo: { year, cut, fava, brinde }), a new calendar year in Lisbon is a new cake. Without storage it works
// until the page is reloaded. The rules and the drawing are in src/lib/bolo-rei.mjs. Two events go to GoatCounter: the first slice of a visit and the eighth.
import { H, N, W, anchor, draw, readState, shift, whatIn } from '../lib/bolo-rei.mjs';
import { lisbonToday } from '../lib/publication.mjs';
import type { Counter } from '../lib/like';

const KEY = 'festa-natal-bolo';
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const NARROW = 480; // a stage narrower than this (px) puts the bubble under the cake, so that it does not cover it
const AFTER_LAST = 2600; // the last slice stays on show this long (ms) before the plate is cleared

interface Texts {
  hint: string;
  fruit: { head: string; text: string };
  brinde: { head: string; text: string };
  fava: { head: string; text: string };
  done: string;
}

/** Small icons for the bubble: a candied cherry, the bean, a figurine in a crown. */
const ICON = {
  fruit:
    '<svg viewBox="-17 -17 34 34" aria-hidden="true"><path d="M2 -6 C4 -12 9 -14 12 -14" fill="none" stroke="var(--festa-angelica)" stroke-width="2" stroke-linecap="round"/><circle cx="0" cy="3" r="9" fill="var(--festa-cherry)" stroke="var(--festa-ink)" stroke-width="1.6"/><circle cx="-3" cy="0" r="2.4" fill="var(--festa-shell)"/></svg>',
  fava: '<svg viewBox="-17 -17 34 34" aria-hidden="true"><path d="M-13 3 C-14 -8 -4 -12 1 -8 C5 -5 9 -10 13 -5 C17 1 10 10 0 10 C-8 10 -12 8 -13 3 Z" fill="var(--festa-warm)" stroke="var(--festa-ink)" stroke-width="1.8"/><path d="M-1 -6 C-2 -2 -1 2 1 3" fill="none" stroke="var(--festa-ink)" stroke-width="1.5" stroke-linecap="round"/></svg>',
  brinde:
    '<svg viewBox="-17 -17 34 34" aria-hidden="true"><path d="M-10 13 L10 13 L8 2 L-8 2 Z" fill="var(--festa-warm)" stroke="var(--festa-ink)" stroke-width="1.6" stroke-linejoin="round"/><circle cx="0" cy="-3.5" r="5.2" fill="var(--festa-shell)" stroke="var(--festa-ink)" stroke-width="1.6"/><path d="M-6 -8 L-6 -14 L-3 -10.5 L0 -15.5 L3 -10.5 L6 -14 L6 -8 Z" fill="var(--festa-warm)" stroke="var(--festa-ink)" stroke-width="1.4" stroke-linejoin="round"/></svg>',
};

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

/** The day to count for: `?hoje=` (or the one the tab remembered from it), otherwise today in Lisbon. */
function today(): string {
  const valid = (d: string | null): d is string => d !== null && DAY.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`));
  const asked = new URLSearchParams(location.search).get('hoje');
  if (valid(asked)) return asked;
  try {
    const kept = sessionStorage.getItem('hoje');
    if (valid(kept)) return kept;
  } catch {
    // no storage: today
  }
  return lisbonToday();
}

const storage = (): Storage | undefined => {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
};

const root = document.querySelector<HTMLElement>('[data-bolo]');
if (root) {
  const texts: Texts = JSON.parse(root.dataset.bolo ?? '{}');
  const cake = root.querySelector<HTMLButtonElement>('.bolo__cake')!;
  const svg = cake.querySelector<SVGSVGElement>('svg')!;
  const stage = root.querySelector<HTMLElement>('.bolo__stage')!;
  const bubble = root.querySelector<HTMLElement>('.bolo__bubble')!;
  const hint = root.querySelector<HTMLElement>('.bolo__hint')!;
  const done = root.querySelector<HTMLElement>('.bolo__done')!;
  const year = Number(today().slice(0, 4));
  const reduced = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const eaten = (n: number): number[] => Array.from({ length: n }, (_, i) => i);

  let state = readState(storage()?.getItem(KEY), year);
  let count = state.cut;
  let counted = false; // the first slice of this visit has been counted
  let timer: number | undefined;

  const save = (): void => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // no storage: the cake lasts until the page is reloaded
    }
  };
  const tell = (event: string): void => {
    (window as unknown as { goatcounter?: Counter }).goatcounter?.count?.({ path: event, title: event, event: true });
  };
  const hideBubble = (): void => {
    bubble.hidden = true;
    bubble.innerHTML = '';
  };
  const finish = (): void => {
    window.clearTimeout(timer);
    hideBubble();
    svg.innerHTML = draw({ gone: eaten(N) });
    done.textContent = texts.done;
    hint.hidden = true;
    cake.setAttribute('aria-disabled', 'true');
  };
  const showBubble = (i: number): void => {
    const what = whatIn(state, i);
    const item = texts[what];
    bubble.innerHTML = `${ICON[what]}<span><b>${esc(item.head)}</b> ${esc(item.text)}</span>`;
    const w = stage.clientWidth;
    // Wide: over the slice (the point comes from the drawing). Narrow: under the cake, in the flow, the tail up to the slice. Inside the stage either way.
    const below = w < NARROW;
    bubble.classList.toggle('bolo__bubble--below', below);
    bubble.hidden = false;
    const a = anchor(i);
    const ax = (a[0] / W) * w;
    const bw = bubble.offsetWidth;
    const left = Math.min(Math.max(ax - bw / 2, 0), w - bw);
    bubble.style.left = below ? '' : `${left}px`;
    bubble.style.marginLeft = below ? `${left}px` : '';
    bubble.style.top = below ? '' : `${Math.max((a[1] / H) * stage.clientHeight, bubble.offsetHeight + 16)}px`;
    bubble.style.setProperty('--tail', `${Math.min(Math.max(ax - left, 18), bw - 18)}px`);
  };
  const cut = (): void => {
    if (count >= N || cake.getAttribute('aria-disabled') === 'true') return;
    const i = count;
    count += 1;
    state = { ...state, cut: count };
    save();
    hint.hidden = true;
    window.clearTimeout(timer);
    const still = reduced();
    svg.innerHTML = draw({ gone: eaten(i), out: i, slid: still });
    const slice = svg.querySelector<SVGGElement>('.cut');
    if (slice && !still) {
      const [dx, dy] = shift(i);
      requestAnimationFrame(() => requestAnimationFrame(() => (slice.style.transform = `translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px)`)));
    }
    showBubble(i);
    if (!counted) {
      counted = true;
      tell('festa-natal-bolo-cut');
    }
    if (count >= N) {
      cake.setAttribute('aria-disabled', 'true');
      tell('festa-natal-bolo-eaten');
      timer = window.setTimeout(finish, AFTER_LAST);
    }
  };

  // A cake that was started before: the eaten slices are gone, and no hint.
  if (count >= N) finish();
  else if (count > 0) svg.innerHTML = draw({ gone: eaten(count) });
  hint.hidden = count > 0;
  cake.disabled = false;
  cake.addEventListener('click', cut);
  window.addEventListener('resize', hideBubble);
}

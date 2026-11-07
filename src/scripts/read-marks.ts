// "Read" marks: records the story whose end has been seen after enough time on the page, shows the tick in the lists, "read N of M" on the
// epoch page and the reset button of the legal page. Everything is in try/catch: without localStorage the site works as before. Nothing is
// sent anywhere (no counter event).
import { READ_DELAY_MS, READ_KEY, addRead, parseRead, readProgress, type StoryOnPage } from '../lib/read-marks';
import { cssUrl } from '../lib/azulejo';
import { CELEBRATION_START_PAUSE_MS, PANNO_CELEBRATED_PREFIX, celebrationPlan, firstUnread, layOrder, openSet, wantsReplay, pannoCelebratedKey, showPannoLine } from '../lib/panno';
import { pickPlural } from '../lib/plural-pick';
import { wirePannoReward } from './panno-reward';
import { currentFamilyMode, onFamilyChange } from './family-mode';

const load = (): string[] => {
  try {
    return parseRead(localStorage.getItem(READ_KEY));
  } catch {
    return [];
  }
};
const save = (list: string[]): void => {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify(list));
  } catch {
    // Blocked storage: the mark is simply not kept.
  }
};

/** The age data of a story in a list sits on the item that holds it (data-min-age, data-sensitive); without it the story is shown in every mode. */
function onPage(): StoryOnPage[] {
  return [...document.querySelectorAll<HTMLElement>('[data-story]')].map((el) => {
    const holder = el.closest<HTMLElement>('[data-min-age]');
    return { id: el.dataset.story ?? '', minAge: holder?.dataset.minAge, sensitive: holder?.dataset.sensitive };
  });
}

/** The flag of the moment of assembly lives next to the marks, so the reset of the legal page sweeps it too. Storage that cannot be read counts as "celebrated": the moment must not play again and again. */
function celebrated(epochId: string): boolean {
  try {
    return localStorage.getItem(pannoCelebratedKey(epochId)) !== null;
  } catch {
    return true;
  }
}

function markCelebrated(epochId: string): void {
  try {
    localStorage.setItem(pannoCelebratedKey(epochId), '1');
  } catch {
    // Blocked storage: the flag is simply not kept.
  }
}

/** `?panno=replay` plays once per page load, not again at every redraw (family mode). */
let replayShown = false;

/** The moment of assembly that is running or waiting for the panel to come into view; a redraw of the panel ends it first. */
let moment: { cancel: () => void } | undefined;

/**
 * The moment of assembly (docs/spec.md 5.2): the panel waits with every tile closed; when the whole panel is in view (and after a short pause) the
 * tiles settle one by one in a fixed random order, a glint passes over the panel, the rim of the colour of the epoch fades in, then the closing line
 * and "Share" appear. A press on the panel jumps to the finished state. The flag is set when it starts, so it plays once. Nothing scrolls the page;
 * only transform and opacity move. `tiles` are in the order they are laid; `settle` draws the finished panel and shows the closing line.
 */
function startMoment(panel: HTMLElement, cells: HTMLElement[], tiles: HTMLElement[], settle: () => void, replay: boolean): void {
  const epochId = panel.dataset.epochId ?? '';
  const timers: number[] = [];
  const at = (ms: number, run: () => void): void => void timers.push(window.setTimeout(run, ms));
  const frame = panel.querySelector<HTMLElement>('.panno__frame') ?? panel;
  let wait: number | undefined;
  let started = false;
  // A panel taller than the screen can never be seen whole: then "whole" is as much of the screen as it can fill.
  const seen = (e: IntersectionObserverEntry): boolean => e.isIntersecting && (e.intersectionRatio >= 0.9 || e.intersectionRect.height >= window.innerHeight * 0.9);
  const observer = new IntersectionObserver(
    (entries) => {
      const e = entries[entries.length - 1];
      if (!e) return;
      window.clearTimeout(wait);
      wait = seen(e) ? window.setTimeout(run, CELEBRATION_START_PAUSE_MS) : undefined;
    },
    { threshold: Array.from({ length: 11 }, (_, i) => i / 10) },
  );
  const clear = (): void => {
    observer.disconnect();
    window.clearTimeout(wait);
    timers.forEach((id) => window.clearTimeout(id));
    panel.removeEventListener('pointerdown', skip);
    cells.forEach((cell) => cell.removeAttribute('data-anim'));
    delete panel.dataset.moment;
    delete panel.dataset.sheen;
    moment = undefined;
  };
  // A press or tap on the panel while it plays: the finished state at once.
  const skip = (): void => {
    if (!started) return;
    clear();
    settle();
  };
  const run = (): void => {
    observer.disconnect();
    started = true;
    if (!replay) markCelebrated(epochId);
    const plan = celebrationPlan(tiles.length);
    tiles.forEach((cell, i) =>
      at(plan.tiles[i] ?? 0, () => {
        cell.setAttribute('data-anim', '');
        cell.setAttribute('data-open', '');
      }),
    );
    at(plan.sheenAt, () => (panel.dataset.sheen = ''));
    at(plan.rimAt, () => {
      delete panel.dataset.sheen;
      panel.dataset.moment = 'rim';
    });
    at(plan.revealAt, () => {
      clear();
      settle();
    });
  };
  moment = { cancel: clear };
  panel.dataset.moment = 'tiles';
  panel.addEventListener('pointerdown', skip);
  observer.observe(frame);
}

/**
 * The panel of the epoch page: the pieces won, the line under it, and the first story not read yet as its link (all read: no link). Only the
 * stories the mode shows count. The picture is asked for only when a piece is open (its address waits in data-image).
 */
function showPanno(read: string[]): void {
  moment?.cancel();
  const panel = document.querySelector<HTMLElement>('[data-panno]');
  const grid = panel?.querySelector<HTMLAnchorElement>('[data-panno-grid]');
  if (!panel || !grid) return;
  const stories = onPage();
  const mode = currentFamilyMode();
  const { n, m } = readProgress(stories, read, mode);
  panel.hidden = m === 0;
  const d = panel.dataset;
  const order = (d.order ?? '').split(',').filter(Boolean).map(Number);
  const open = openSet(n, m, order);
  const all = m > 0 && n === m;
  panel.toggleAttribute('data-complete', all);
  // First time the panel is shown assembled: the tiles of the last story wait closed for the moment of assembly.
  // Reduced motion (or no IntersectionObserver) gets the finished panel at once.
  // `?panno=replay` plays the moment once more for a finished panel (a look at it): the flag stays as it is.
  const replay = all && !replayShown && wantsReplay(location.search);
  if (all) replayShown = true;
  const staging = all && (replay || !celebrated(d.epochId ?? ''));
  const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window);
  if (staging && still && !replay) markCelebrated(d.epochId ?? '');
  const lay = staging && !still ? layOrder(d.epochId ?? '', order.length).filter((piece) => open.has(piece)) : [];
  const shownOpen: ReadonlySet<number> = lay.length > 0 ? new Set<number>() : open;
  if ((open.size > 0 || all) && d.imageSmall && d.imageLarge && !panel.style.getPropertyValue('--panno-image')) panel.style.setProperty('--panno-image', `image-set(${cssUrl(d.imageSmall)} 1x, ${cssUrl(d.imageLarge)} 2x)`);
  const cells = [...grid.querySelectorAll<HTMLElement>('[data-piece]')];
  cells.forEach((cell) => cell.toggleAttribute('data-open', shownOpen.has(Number(cell.dataset.piece))));
  // Two lines: "3 of 11 read" and what a story does to the panel. With nothing read only the second line; all read: only the closing line.
  const counted = pickPlural({ p_one: d.one ?? '', p_few: d.few ?? '', p_many: d.many ?? '', p_other: d.other ?? '' }, 'p', n, d.locale ?? 'en').replace('{n}', String(n)).replace('{m}', String(m));
  const count = panel.querySelector<HTMLElement>('[data-panno-count]');
  const hint = panel.querySelector<HTMLElement>('[data-panno-hint]');
  const zoom = panel.querySelector<HTMLElement>('[data-panno-zoom]');
  const share = panel.querySelector<HTMLElement>('[data-panno-share]');
  // The reward is for the whole panel only: the panel becomes a button (enlarge) and "Share" appears. In the moment of assembly it waits for the end of it.
  const reveal = (): void => {
    if (count) {
      count.textContent = all ? (d.done ?? '') : n === 0 ? '' : counted;
      count.hidden = !all && n === 0;
    }
    if (hint) hint.hidden = all;
    if (zoom) zoom.hidden = !all;
    if (share) share.hidden = !all;
    // The share line counts the stories of the panel as the reader sees them (family mode included): "{stories}" of the template is "N stories" in the right form.
    if (all) d.shareText = (d.shareTemplate ?? '').replace('{stories}', pickPlural({ p_one: d.storiesOne ?? '', p_few: d.storiesFew ?? '', p_many: d.storiesMany ?? '', p_other: d.storiesOther ?? '' }, 'p', m, d.locale ?? 'en').replace('{n}', String(m)));
  };
  if (lay.length > 0) {
    if (count) count.hidden = true;
    if (hint) hint.hidden = false;
    if (zoom) zoom.hidden = true;
    if (share) share.hidden = true;
    const tiles = lay.map((piece) => cells.find((cell) => Number(cell.dataset.piece) === piece)).filter((cell): cell is HTMLElement => cell !== undefined);
    // The finished panel, drawn at the end of the moment or when a press cuts it short.
    const settle = (): void => {
      cells.forEach((cell) => cell.toggleAttribute('data-open', open.has(Number(cell.dataset.piece))));
      reveal();
    };
    startMoment(panel, cells, tiles, settle, replay);
  } else reveal();
  const alt = pickPlural({ p_one: d.altOne ?? '', p_few: d.altFew ?? '', p_many: d.altMany ?? '', p_other: d.altOther ?? '' }, 'p', open.size, d.locale ?? 'en').replace('{n}', String(open.size)).replace('{m}', String(order.length));
  const next = all ? undefined : firstUnread(stories, read, mode);
  const href = next ? (JSON.parse(d.links ?? '{}') as Record<string, string>)[next] : undefined;
  if (href) {
    grid.href = href;
    grid.removeAttribute('role');
    grid.setAttribute('aria-label', `${alt}. ${d.continue}`);
  } else {
    grid.removeAttribute('href');
    grid.setAttribute('role', 'img');
    grid.setAttribute('aria-label', alt);
  }
}

/**
 * The line at the foot of a story: with this story counted, every story of its epoch that the mode shows is read, and the panel of the epoch
 * has not been celebrated yet. The line is in the page hidden, so without this script it is not there.
 */
function showStoryPanno(read: string[]): void {
  const line = document.querySelector<HTMLElement>('[data-story-panno]');
  if (!line) return;
  try {
    const onEpoch = JSON.parse(line.dataset.stories ?? '[]') as StoryOnPage[];
    line.hidden = !showPannoLine(onEpoch, read, currentFamilyMode(), celebrated(line.dataset.epochId ?? ''));
  } catch {
    // Data that does not parse: no line.
  }
}

/** The tick in the lists, and "read N of M" on the epoch page (only the stories the mode shows). */
function show(): void {
  const read = load();
  const done = new Set(read);
  document.querySelectorAll<HTMLElement>('[data-story]').forEach((el) => el.toggleAttribute('data-read', done.has(el.dataset.story ?? '')));
  const progress = document.querySelector<HTMLElement>('[data-read-progress]');
  if (progress) {
    const { n, m } = readProgress(onPage(), read, currentFamilyMode());
    const d = progress.dataset;
    // "read N of M" agrees with N (Portuguese "lida 1 de 11", "lidas 2 de 11"): the form comes from Intl.PluralRules of the page.
    const forms = { p_one: d.one ?? '', p_few: d.few ?? '', p_many: d.many ?? '', p_other: d.other ?? '' };
    progress.textContent = pickPlural(forms, 'p', n, d.locale ?? 'en').replace('{n}', String(n)).replace('{m}', String(m));
    progress.toggleAttribute('data-shown', n > 0);
  }
  showPanno(read);
}

/**
 * The story is marked when two things have happened: its end came into view, and the page has been open for READ_DELAY_MS with the tab
 * visible (time with the tab hidden does not count). Leaving the page before that marks nothing. A test may shorten the wait with
 * window.__readDelayMs.
 */
function watchEnd(): void {
  const end = document.querySelector<HTMLElement>('[data-story-end]');
  const id = end?.dataset.storyEnd;
  if (!end || !id || !('IntersectionObserver' in window)) return;
  const override = (window as unknown as { __readDelayMs?: unknown }).__readDelayMs;
  const delay = typeof override === 'number' && override >= 0 ? override : READ_DELAY_MS;
  let seen = false;
  let visibleMs = 0;
  let last = performance.now();
  const check = (): void => {
    if (!seen || visibleMs < delay) return;
    clearInterval(timer);
    observer.disconnect();
    const read = addRead(load(), id);
    save(read);
    showStoryPanno(read);
  };
  const timer = window.setInterval(() => {
    const now = performance.now();
    if (document.visibilityState === 'visible') visibleMs += now - last;
    last = now;
    check();
  }, 250);
  const observer = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      seen = true;
      check();
    }
  });
  observer.observe(end);
}

/** The button of the legal page. */
function watchReset(): void {
  const button = document.querySelector<HTMLButtonElement>('[data-read-reset]');
  if (!button) return;
  const status = document.querySelector<HTMLElement>('[data-read-reset-status]');
  button.addEventListener('click', () => {
    try {
      localStorage.removeItem(READ_KEY);
      // The flags of the moment of assembly go with the marks: a panel read again assembles again.
      Object.keys(localStorage)
        .filter((key) => key.startsWith(PANNO_CELEBRATED_PREFIX))
        .forEach((key) => localStorage.removeItem(key));
    } catch {
      // Blocked storage: there is nothing to reset.
    }
    if (status) status.textContent = button.dataset.done ?? '';
    show();
  });
}

const pannoPanel = document.querySelector<HTMLElement>('[data-panno]');
if (pannoPanel) wirePannoReward(pannoPanel);
show();
onFamilyChange(show);
watchEnd();
watchReset();

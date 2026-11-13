// "Through the centuries": the player of the map page (docs/spec.md 5.4). The map island hands it the map and the cards; the rules (the order, the window,
// the places, the spreading of markers on one spot) are in src/lib/timetravel.ts. Loaded only when the reader presses the button or comes with ?era=.
import type * as L from 'leaflet';
import { pickPlural } from '../lib/plural-pick';
import { READ_KEY, parseRead } from '../lib/read-marks';
import type { Bounds } from '../lib/markers';
import { isIsland } from '../lib/map-data';
import {
  READ_EVENT_PATH,
  TT_CHOOSE_OVER,
  TT_MIN_STORIES,
  TT_SESSION_KEY,
  TT_VIEW,
  TT_WHOLE,
  WHOLE_BOUNDS,
  drawnRange,
  epochRuns,
  panAboveCard,
  parseSession,
  coversMainland,
  playlist,
  startEventPath,
  stepIndex,
  unreadOf,
  yearSpan,
  type TtCard,
  type TtChip,
  type TtInfo,
} from '../lib/timetravel';

export interface TtConfig {
  info: Record<string, TtInfo>;
  epochs: Record<string, { name: string; order: number; years: string }>;
  chips: TtChip[];
  whole: string;
  strings: Record<string, string>;
}

export interface TtMapCard extends TtCard {
  title: string;
  hook: string;
  href: string;
  overseas?: unknown;
}

export interface TtHost {
  root: HTMLElement;
  stage: HTMLElement;
  map: L.Map;
  locale: string;
  animate: boolean;
  /** The cards the family mode shows. */
  cards: () => TtMapCard[];
  /** The thread filter of the map. */
  fio: () => string | null;
  bounds: () => Bounds;
  /**
   * Shows the box, keeping `bottom` pixels free at the foot and `right` at the right edge (under the card), never closer than `maxZoom`.
   * `tall`: the height of the box fills the map and its west edge stands at the left edge; the east is cut where the card is.
   */
  fit: (box: Bounds, bottom: number, animate: boolean, maxZoom?: number, right?: number, tall?: boolean) => void;
  /** The epoch filter goes to "All epochs" when the mode starts. */
  clearEpoch: () => void;
  /** Redraws the markers (the island calls `apply` for the layers it draws). */
  refresh: () => void;
  /** The address changed (the place of the start is part of it). */
  address: () => void;
  /** The mode ends: the map keeps to its own area again. */
  leave: () => void;
  /** The pressed button of the page, to give the focus back when the mode ends. */
  startButton: HTMLButtonElement;
}

const BEHAVIOUR = {
  /** How long a story stays, in ms. */
  dwellMs: 4000,
  /** Markers closer than this, in px, are on one spot and are laid on a small ring (never a long row: see `spreadPoints`). */
  spreadSame: 6,
  /** The room between neighbours on a ring, in px, and the widest ring. */
  spreadGap: 14,
  spreadMax: 28,
  /** The room kept between a marker and the card when the map pans, in px. */
  clearPx: 32,
  panSeconds: 0.3,
  /** A swipe of the card is at least this long, in px. */
  swipePx: 48,
  /** A card on a phone is at most this share of the map (the style says the same; the fit before the first story is made with it). */
  cardShare: 0.45,
  /** A year written longer than this ('150 млн лет назад') is set in a smaller type to stay on one line. */
  longYear: 8,
  /** How long the card names a new epoch, in ms. */
  epochBannerMs: 1000,
  /** The zoom of a flight to an island, and its length in seconds. */
  islandZoom: 9,
  flySeconds: 0.6,
  /** A card on a wide screen stands at the right (the style says the same: from this width in px). */
  wideMin: 960,
};

const fill = (template: string, vars: Record<string, string | number>) => template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

const ICONS: Record<string, string> = {
  prev: '<path d="M6 5v14M19 5v14l-10-7z" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  next: '<path d="M18 5v14M5 5v14l10-7z" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  pause: '<path d="M7 4.5h3.5v15H7zM13.5 4.5H17v15h-3.5z" fill="currentColor"/>',
  play: '<path d="M7 4.5v15l12-7.5z" fill="currentColor"/>',
  close: '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
};

function iconButton(icon: keyof typeof ICONS, label: string): HTMLButtonElement {
  const b = el('button', 'tt-btn');
  b.type = 'button';
  b.setAttribute('aria-label', label);
  b.title = label;
  b.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">${ICONS[icon]}</svg>`;
  return b;
}

const readIds = (): string[] => {
  try {
    return parseRead(localStorage.getItem(READ_KEY));
  } catch {
    return [];
  }
};

type Phase = 'play' | 'hint' | 'choose' | 'final' | 'unread';

export function createTimetravel(cfg: TtConfig, host: TtHost) {
  const { root, stage, map } = host;
  const S = cfg.strings;
  const page = document.querySelector<HTMLElement>('.map-page');
  const scaleBox = document.querySelector<HTMLElement>('[data-tt-scale]');
  const epochOrder = Object.fromEntries(Object.entries(cfg.epochs).map(([id, e]) => [id, e.order]));
  const byId = (id: string) => host.cards().find((c) => c.id === id);

  let active = false;
  let phase: Phase = 'play';
  let list: TtMapCard[] = [];
  let idx = 0;
  let src = TT_VIEW;
  let playing = false;
  let elapsed = 0;
  let frame = 0;
  let last = 0;
  let readSet = new Set<string>();
  /** The markers of the map as the island last drew them (they may lie on a ring, off the point of their story). */
  let drawn = new Map<string, L.Marker>();
  /** The stories drawn at the last redraw (a story that was not there appears with a fade). */
  const shown = new Set<string>();
  /** The window of the show: the map as it was when it started. Panning and the thread filter do not change which stories play. */
  let win: Bounds = host.bounds();

  // ---- the card -------------------------------------------------------------------------------------------------------

  const card = el('div', 'tt-card');
  card.setAttribute('role', 'region');
  card.setAttribute('aria-label', S.card_label!);
  card.hidden = true;
  const prog = el('div', 'tt-card__prog');
  const progBar = el('i', '');
  prog.append(progBar);

  const play = el('div', 'tt-card__play');
  const live = el('div', 'tt-card__live');
  live.setAttribute('aria-live', 'polite');
  live.setAttribute('aria-atomic', 'true');
  const top = el('div', 'tt-card__top');
  const yearEl = el('p', 'tt-card__year');
  const eraEl = el('p', 'tt-card__era');
  const countEl = el('span', 'tt-card__count');
  top.append(yearEl, countEl);
  const titleEl = el('h2', 'tt-card__title');
  const hookEl = el('p', 'tt-card__hook');
  live.append(top, eraEl, titleEl, hookEl);
  const acts = el('div', 'tt-card__acts');
  const readLink = el('a', 'button tt-card__read', S.read);
  const prevBtn = iconButton('prev', S.prev!);
  const toggleBtn = iconButton('pause', S.pause!);
  const nextBtn = iconButton('next', S.next!);
  const closeBtn = iconButton('close', S.exit!);
  acts.append(readLink, prevBtn, toggleBtn, nextBtn, closeBtn);
  play.append(live, acts);

  const other = el('div', 'tt-card__other');
  /** A new epoch: for a second the card names it and says its years (over the story, the show goes on). */
  const banner = el('div', 'tt-card__epoch');
  banner.hidden = true;
  banner.setAttribute('aria-hidden', 'true');
  const bannerName = el('p', 'tt-card__epoch-name');
  const bannerYears = el('p', 'tt-card__epoch-years');
  banner.append(bannerName, bannerYears);
  card.append(prog, play, other, banner);
  stage.append(card);
  // On a phone the attribution of the map stays above the card: the style reads the height from here.
  new ResizeObserver(() => root.style.setProperty('--tt-card-height', card.hidden ? '0px' : `${card.offsetHeight}px`)).observe(card);

  // ---- the scale above the map ------------------------------------------------------------------------------------------

  const renderScale = () => {
    if (!scaleBox) return;
    scaleBox.hidden = !active || phase === 'hint' || phase === 'choose' || list.length === 0;
    if (scaleBox.hidden) return;
    const n = list.length;
    const pos = (i: number) => `${(((i + 0.5) / n) * 100).toFixed(3)}%`;
    const bar = el('div', 'tt-scale__bar');
    for (const run of epochRuns(list.map((c) => c.epoch))) {
      const seg = el('span', 'tt-scale__seg');
      seg.style.flex = String(run.count);
      seg.style.setProperty('--tt-tone', `var(--tone-${run.epoch}, var(--epoch-primary))`);
      bar.append(seg);
    }
    const ticks = el('div', 'tt-scale__ticks');
    list.forEach((c, i) => {
      const tick = el('span', 'tt-scale__tick');
      tick.style.left = pos(i);
      tick.classList.toggle('tt-scale__tick--read', readSet.has(c.id));
      ticks.append(tick);
    });
    const at = phase === 'final' ? n - 1 : idx;
    scaleBox.setAttribute('role', 'slider');
    scaleBox.tabIndex = 0;
    scaleBox.setAttribute('aria-valuemin', '1');
    scaleBox.setAttribute('aria-valuemax', String(n));
    scaleBox.setAttribute('aria-valuenow', String(at + 1));
    scaleBox.setAttribute('aria-valuetext', `${cfg.info[list[at]!.id]!.year} · ${list[at]!.title}`);
    const run = el('span', 'tt-scale__run');
    run.style.left = pos(at);
    run.style.setProperty('--tt-tone', `var(--tone-${list[at]!.epoch}, var(--epoch-primary))`);
    const first = el('span', 'tt-scale__label tt-scale__label--first', cfg.info[list[0]!.id]!.year);
    const lastLabel = el('span', 'tt-scale__label tt-scale__label--last', cfg.info[list[n - 1]!.id]!.year);
    const now = el('span', 'tt-scale__label tt-scale__label--now', cfg.info[list[at]!.id]!.year);
    now.style.left = pos(at);
    scaleBox.replaceChildren(first, lastLabel, now, bar, ticks, run);
    // The label of the runner goes when it would lie on the label of an end (the same year, or the runner is near the end).
    const hits = (a: DOMRect, b: DOMRect) => a.left < b.right + 4 && b.left < a.right + 4;
    const nowRect = now.getBoundingClientRect();
    now.hidden = hits(nowRect, first.getBoundingClientRect()) || hits(nowRect, lastLabel.getBoundingClientRect());
  };

  // ---- drawing the card -----------------------------------------------------------------------------------------------

  const fade = () => {
    if (!host.animate) return;
    card.classList.remove('tt-card--in');
    void card.offsetWidth;
    card.classList.add('tt-card--in');
  };

  const placeName = (): string => (src === TT_WHOLE ? cfg.whole : (cfg.chips.find((c) => c.key === src)?.name ?? ''));

  const renderPlay = () => {
    const c = list[idx]!;
    const info = cfg.info[c.id]!;
    const era = cfg.epochs[c.epoch];
    card.style.setProperty('--tt-tone', `var(--tone-${c.epoch}, var(--epoch-primary))`);
    yearEl.textContent = info.year;
    yearEl.classList.toggle('tt-card__year--long', info.year.length > BEHAVIOUR.longYear);
    progBar.style.width = `${Math.min(elapsed / BEHAVIOUR.dwellMs, 1) * 100}%`;
    eraEl.textContent = era?.name ?? '';
    titleEl.textContent = c.title;
    hookEl.textContent = c.hook;
    readLink.href = c.href;
    countEl.textContent = fill(S.count!, { i: idx + 1, total: list.length });
    prevBtn.disabled = idx === 0;
    updateToggle();
  };

  const updateToggle = () => {
    toggleBtn.hidden = !host.animate;
    const label = playing ? S.pause! : S.play!;
    toggleBtn.setAttribute('aria-label', label);
    toggleBtn.title = label;
    toggleBtn.querySelector('svg')!.innerHTML = ICONS[playing ? 'pause' : 'play']!;
    prog.hidden = !host.animate || phase !== 'play';
    prog.classList.toggle('tt-card__prog--paused', !playing);
  };

  const closeTop = () => {
    const b = iconButton('close', S.exit!);
    b.classList.add('tt-card__close');
    b.addEventListener('click', () => exit(true));
    return b;
  };

  const renderOther = () => {
    other.replaceChildren();
    if (phase === 'hint' || phase === 'choose') {
      const choose = phase === 'choose';
      const title = el('p', 'tt-card__big', choose ? S.choose_title : S.hint_title);
      const text = el('p', 'tt-card__sub', choose ? S.choose_text : S.hint_text);
      const chips = el('ul', 'tt-card__chips');
      chips.setAttribute('aria-label', S.places_label!);
      for (const chip of choose ? cfg.chips : [...cfg.chips, { key: TT_WHOLE, name: cfg.whole, count: 0 }]) {
        const li = document.createElement('li');
        const b = el('button', 'map-chip', chip.name);
        b.type = 'button';
        b.dataset.ttPlace = chip.key;
        if (chip.count) b.append(' ', el('small', 'tt-card__chip-count', String(chip.count)));
        b.addEventListener('click', () => begin(chip.key, undefined, true));
        li.append(b);
        chips.append(li);
      }
      other.append(closeTop(), title, text, chips);
      if (choose) {
        const all = el('button', 'button tt-card__all', fill(S.choose_all!, { n: list.length }));
        all.type = 'button';
        all.dataset.ttAll = '';
        all.addEventListener('click', () => begin(src, undefined, true));
        other.append(all);
      }
    } else if (phase === 'final') {
      const n = list.length;
      const first = cfg.info[list[0]!.id]!.year;
      const lastYear = cfg.info[list[n - 1]!.id]!.year;
      const head = src === TT_VIEW ? pickPlural(S, 'final_view', n, host.locale) : pickPlural(S, 'final_place', n, host.locale);
      const title = el('p', 'tt-card__big');
      title.append(fill(head, { n, place: placeName() }), el('br', ''), el('span', 'tt-card__span', yearSpan(first, lastYear, S.span!)));
      const row = el('div', 'tt-card__final-acts');
      const again = el('button', 'button button--secondary', S.again);
      again.type = 'button';
      again.addEventListener('click', () => go(0, false));
      row.append(again);
      const unread = unreadOf(list, readIds());
      if (unread.length > 0) {
        const b = el('button', 'button', fill(S.unread!, { n: unread.length }));
        b.type = 'button';
        b.addEventListener('click', () => {
          phase = 'unread';
          render();
          other.querySelector<HTMLElement>('a')?.focus();
        });
        row.append(b);
      }
      other.append(closeTop(), title, row);
    } else if (phase === 'unread') {
      const title = el('p', 'tt-card__big', S.unread_title);
      const ol = el('ol', 'tt-card__unread');
      for (const c of unreadOf(list, readIds())) {
        const li = document.createElement('li');
        const a = el('a', 'tt-card__unread-link', `${cfg.info[c.id]!.year} · ${c.title}`);
        a.href = c.href;
        a.addEventListener('click', () => remember(c.id));
        li.append(a);
        ol.append(li);
      }
      const back = el('button', 'button button--secondary', S.back);
      back.type = 'button';
      back.addEventListener('click', () => {
        phase = 'final';
        render();
      });
      other.append(closeTop(), title, ol, back);
    }
  };

  function render(clear = true) {
    readSet = new Set(readIds());
    card.hidden = !active;
    play.hidden = phase !== 'play';
    other.hidden = phase === 'play';
    card.classList.toggle('tt-card--other', phase !== 'play');
    if (!active) return;
    if (phase === 'play') renderPlay();
    else renderOther();
    updateToggle();
    renderScale();
    if (clear) fade();
    host.refresh();
    if (phase === 'play' && clear) keepClear();
  }

  // ---- keeping the point out from under the card ------------------------------------------------------------------------

  const cardTop = (): { top: number; left: number; right: number } => {
    const a = card.getBoundingClientRect();
    const b = stage.getBoundingClientRect();
    return { top: a.top - b.top, left: a.left - b.left, right: a.right - b.left };
  };

  /** The room the card takes from the map: at the right on a wide screen, at the foot on a phone. */
  const wide = () => window.matchMedia(`(min-width: ${BEHAVIOUR.wideMin}px)`).matches;
  const insetFor = (): { right: number; bottom: number } => {
    if (wide()) {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const token = parseFloat(getComputedStyle(root).getPropertyValue('--tt-card-width')) || 25;
      return { right: token * rem + BEHAVIOUR.clearPx, bottom: 0 };
    }
    return { right: 0, bottom: card.hidden ? stage.clientHeight * BEHAVIOUR.cardShare : Math.min(card.getBoundingClientRect().height, stage.clientHeight * BEHAVIOUR.cardShare) };
  };

  /** Where the map was before a flight to an island (null: it is at the mainland). */
  let home: { center: L.LatLng; zoom: number } | null = null;

  /** The map centre that puts `at` in the part of the map the card leaves free. */
  const centreFor = (at: L.LatLngExpression, zoom: number): L.LatLng => {
    const inset = insetFor();
    const p = map.project(at, zoom);
    return map.unproject(p.add([inset.right / 2, inset.bottom / 2]), zoom);
  };

  /** A flight is on: the pan that keeps the point from the card waits for its end (a pan would stop the flight half way). */
  let flying = false;
  const flyTo = (center: L.LatLng, zoom: number, arrived?: () => void) => {
    flying = true;
    map.once('moveend', () => {
      flying = false;
      arrived?.();
      keepClear();
    });
    if (host.animate) map.flyTo(center, zoom, { duration: BEHAVIOUR.flySeconds });
    else map.setView(center, zoom, { animate: false });
  };

  function keepClear() {
    const c = list[idx];
    if (!c || card.hidden) return;
    const at = drawn.get(c.id)?.getLatLng() ?? ([c.lat, c.lon] as L.LatLngTuple);
    // The islands are not in the window: their story is flown to; the next story of the mainland brings the map back to where it was.
    if (isIsland(c.lat, c.lon)) {
      if (flying || !map.getBounds().contains(at)) {
        home ??= { center: map.getCenter(), zoom: map.getZoom() };
        flyTo(centreFor(at, BEHAVIOUR.islandZoom), BEHAVIOUR.islandZoom);
        return;
      }
    } else if (home) {
      // `home` stays until the map is there (a story of an island may come before): then the way back starts from the right place.
      flyTo(home.center, home.zoom, () => {
        const now = list[idx];
        if (!now || !isIsland(now.lat, now.lon)) home = null;
      });
      return;
    }
    if (flying) return;
    const p = map.latLngToContainerPoint(at);
    const box = cardTop();
    if (p.x < box.left - BEHAVIOUR.clearPx || p.x > box.right + BEHAVIOUR.clearPx) return;
    const dy = panAboveCard(p.y, box.top, BEHAVIOUR.clearPx);
    if (dy > 0) map.panBy([0, dy], { animate: host.animate, duration: BEHAVIOUR.panSeconds });
  }

  // ---- moving along the list ------------------------------------------------------------------------------------------------

  let bannerTimer = 0;
  const hideBanner = () => {
    clearTimeout(bannerTimer);
    banner.hidden = true;
  };
  const showBanner = (epoch: string) => {
    const e = cfg.epochs[epoch];
    if (!e) return;
    bannerName.textContent = e.name;
    bannerYears.textContent = e.years;
    card.style.setProperty('--tt-tone', `var(--tone-${epoch}, var(--epoch-primary))`);
    banner.hidden = false;
    banner.classList.toggle('tt-card__epoch--still', !host.animate);
    clearTimeout(bannerTimer);
    bannerTimer = window.setTimeout(hideBanner, BEHAVIOUR.epochBannerMs);
  };

  function go(i: number, keepPlaying = true) {
    const before = phase === 'play' ? list[idx]?.epoch : undefined;
    idx = stepIndex(i, 0, list.length);
    phase = 'play';
    elapsed = 0;
    if (!keepPlaying) playing = host.animate;
    render();
    if (before !== undefined && before !== list[idx]!.epoch) showBanner(list[idx]!.epoch);
  }

  function finish() {
    phase = 'final';
    playing = false;
    render();
  }

  function setPlaying(on: boolean) {
    playing = on && host.animate;
    last = 0;
    updateToggle();
  }

  const loop = (now: number) => {
    frame = requestAnimationFrame(loop);
    const dt = last ? Math.min(now - last, 100) : 0;
    last = now;
    if (!active || phase !== 'play' || !playing || document.hidden) return;
    elapsed += dt;
    progBar.style.width = `${Math.min(elapsed / BEHAVIOUR.dwellMs, 1) * 100}%`;
    if (elapsed >= BEHAVIOUR.dwellMs) {
      if (idx < list.length - 1) go(idx + 1);
      else finish();
    }
  };

  // ---- start and end -----------------------------------------------------------------------------------------------------

  const count = (path: string) => {
    try {
      (window as unknown as { goatcounter?: { count?: (v: { path: string; title: string; event: true }) => void } }).goatcounter?.count?.({ path, title: path, event: true });
    } catch {
      // The counter is off or failed: the mode works the same.
    }
  };

  const wantedPlace = () => (src === TT_VIEW || src === TT_WHOLE ? null : src);

  const compute = () =>
    playlist({ cards: host.cards(), info: cfg.info, bounds: win, fio: host.fio(), epochOrder, place: wantedPlace(), islands: (src === TT_VIEW || src === TT_WHOLE) && coversMainland(win) });

  /**
   * Starts from the button (`view`: the window as it is now) or from a place chip. `resumeId`: back from a story, the same story and on pause.
   * With many stories in the window the start asks first (`choose`); `skipChoice` is the answer.
   */
  function begin(key: string, resumeId?: string, skipChoice = false) {
    const first = !active;
    src = key;
    active = true;
    host.clearEpoch();
    // A start from a place, or from a view that holds the whole mainland: the map shows that place (the mainland, never the islands), in the part the card leaves free.
    if (!resumeId && (key !== TT_VIEW || coversMainland(host.bounds()))) {
      const chip = key === TT_WHOLE || key === TT_VIEW ? undefined : cfg.chips.find((c) => c.key === key);
      host.fit(chip?.bounds ?? WHOLE_BOUNDS, insetFor().bottom, false, undefined, insetFor().right, !chip && wide());
    }
    win = host.bounds();
    list = compute();
    root.dataset.tt = 'on';
    if (page) page.dataset.tt = 'on';
    host.startButton.setAttribute('aria-pressed', 'true');
    elapsed = 0;
    last = 0;
    if (list.length < TT_MIN_STORIES) {
      phase = 'hint';
      playing = false;
      render();
      host.address();
      if (first) card.querySelector<HTMLElement>('.map-chip')?.focus({ preventScroll: true });
      return;
    }
    if (!resumeId && !skipChoice && list.length > TT_CHOOSE_OVER && (key === TT_VIEW || key === TT_WHOLE)) {
      phase = 'choose';
      playing = false;
      render();
      host.address();
      if (first) card.querySelector<HTMLElement>('.map-chip')?.focus({ preventScroll: true });
      return;
    }
    const at = resumeId ? list.findIndex((c) => c.id === resumeId) : -1;
    idx = Math.max(at, 0);
    phase = 'play';
    playing = host.animate && at < 0;
    render(false);
    // Before the first story: the map is shown with room under the card, so the point is rarely under it (no move when nothing is covered).
    if (!resumeId) fitUnderCard();
    host.address();
    if (!resumeId) count(startEventPath(key));
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(loop);
    if (first) (toggleBtn.hidden ? nextBtn : toggleBtn).focus({ preventScroll: true });
  }

  /** The start from a place, or from the button when some story lies under the card: the stories are shown above it. */
  function fitUnderCard() {
    const box = cardTop();
    const covered = list.filter((c) => !isIsland(c.lat, c.lon)).some((c) => {
      const p = map.latLngToContainerPoint([c.lat, c.lon]);
      return p.y > box.top - BEHAVIOUR.clearPx && p.x > box.left - BEHAVIOUR.clearPx && p.x < box.right + BEHAVIOUR.clearPx;
    });
    if (!covered) return;
    // The islands are not part of the window: the fit holds the mainland stories only (the map flies to an island when its story comes).
    const pts = list.filter((c) => !isIsland(c.lat, c.lon)).map((c) => ({ lat: c.lat, lon: c.lon }));
    const bounds = {
      south: Math.min(...pts.map((p) => p.lat)),
      north: Math.max(...pts.map((p) => p.lat)),
      west: Math.min(...pts.map((p) => p.lon)),
      east: Math.max(...pts.map((p) => p.lon)),
    };
    const inset = insetFor();
    host.fit(bounds, inset.bottom, host.animate, map.getZoom(), inset.right);
  }

  function exit(focus: boolean) {
    if (!active) return;
    active = false;
    playing = false;
    cancelAnimationFrame(frame);
    list = [];
    home = null;
    hideBanner();
    shown.clear();
    card.hidden = true;
    if (scaleBox) scaleBox.hidden = true;
    delete root.dataset.tt;
    if (page) delete page.dataset.tt;
    host.startButton.setAttribute('aria-pressed', 'false');
    host.leave();
    host.refresh();
    host.address();
    if (focus) host.startButton.focus();
  }

  /** The window, the thread filter or the family mode changed: the list is counted again and the story stays when it is still in it. */
  function recompute() {
    if (!active) return;
    const keep = phase === 'play' ? list[idx]?.id : undefined;
    list = compute();
    if (list.length < TT_MIN_STORIES) phase = 'hint';
    else if (phase === 'choose') idx = 0;
    else if (phase === 'hint') {
      phase = 'play';
      idx = 0;
    } else if (phase === 'play') idx = Math.max(list.findIndex((c) => c.id === keep), 0);
    else idx = Math.min(idx, list.length - 1);
    elapsed = 0;
    render();
  }

  // ---- reading a story ---------------------------------------------------------------------------------------------------------

  function remember(id: string) {
    count(READ_EVENT_PATH);
    try {
      sessionStorage.setItem(TT_SESSION_KEY, JSON.stringify({ id, src }));
    } catch {
      // No storage: "Back" then lands on the map as it is.
    }
  }
  readLink.addEventListener('click', () => remember(list[idx]!.id));

  /** Back from a story (history): the mode comes up on the same story and on pause. The map is already where it was (the island restores its view). */
  function resume(): boolean {
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(TT_SESSION_KEY);
      sessionStorage.removeItem(TT_SESSION_KEY);
    } catch {
      return false;
    }
    const saved = parseSession(raw);
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (!saved || nav?.type !== 'back_forward' || !byId(saved.id)) return false;
    begin(saved.src, saved.id);
    return list.some((c) => c.id === saved.id);
  }

  // ---- controls ----------------------------------------------------------------------------------------------------------------------

  /** The scale is a hand-wound rewind: any move of it pauses the show and the card shows the chosen story at once. */
  const seek = (i: number, settle: boolean) => {
    if (!active || list.length === 0 || (phase !== 'play' && phase !== 'final')) return;
    setPlaying(false);
    idx = stepIndex(i, 0, list.length);
    phase = 'play';
    elapsed = 0;
    hideBanner();
    render(settle);
  };
  const indexAt = (clientX: number) => {
    const r = scaleBox!.getBoundingClientRect();
    return Math.floor(((clientX - r.left) / Math.max(r.width, 1)) * list.length);
  };
  if (scaleBox) {
    let dragging = false;
    scaleBox.addEventListener('pointerdown', (e) => {
      if (!active || (phase !== 'play' && phase !== 'final')) return;
      dragging = true;
      scaleBox.setPointerCapture(e.pointerId);
      seek(indexAt(e.clientX), false);
    });
    scaleBox.addEventListener('pointermove', (e) => {
      if (dragging) seek(indexAt(e.clientX), false);
    });
    const release = () => {
      if (!dragging) return;
      dragging = false;
      keepClear();
    };
    scaleBox.addEventListener('pointerup', release);
    scaleBox.addEventListener('pointercancel', release);
  }

  /** One story on; after the last one the summary. */
  const step = (by: 1 | -1) => {
    if (phase === 'final' && by < 0) go(list.length - 1);
    else if (by > 0 && idx >= list.length - 1) finish();
    else go(idx + by);
  };
  prevBtn.addEventListener('click', () => step(-1));
  nextBtn.addEventListener('click', () => step(1));
  toggleBtn.addEventListener('click', () => setPlaying(!playing));
  closeBtn.addEventListener('click', () => exit(true));

  let swipeFrom: { x: number; y: number } | null = null;
  play.addEventListener('pointerdown', (e) => {
    swipeFrom = (e.target as HTMLElement).closest('a,button') ? null : { x: e.clientX, y: e.clientY };
  });
  play.addEventListener('pointerup', (e) => {
    if (!swipeFrom || phase !== 'play') return;
    const dx = e.clientX - swipeFrom.x;
    const dy = e.clientY - swipeFrom.y;
    swipeFrom = null;
    if (Math.abs(dx) >= BEHAVIOUR.swipePx && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
  });

  document.addEventListener(
    'keydown',
    (e) => {
      if (!active || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      const target = e.target as HTMLElement;
      if (target.closest('input,textarea,select,[contenteditable]')) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        exit(true);
      } else if ((phase === 'play' || phase === 'final') && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        // The map moves by the arrow keys; while the mode runs they move along the stories.
        e.preventDefault();
        e.stopPropagation();
        if (target === scaleBox) seek((phase === 'final' ? list.length - 1 : idx) + (e.key === 'ArrowRight' ? 1 : -1), true);
        else if (phase === 'play' || e.key === 'ArrowLeft') step(e.key === 'ArrowRight' ? 1 : -1);
      } else if (target === scaleBox && (e.key === 'Home' || e.key === 'End')) {
        e.preventDefault();
        seek(e.key === 'Home' ? 0 : list.length - 1, true);
      } else if (phase === 'play' && e.key === ' ' && !target.closest('a,button') && host.animate) {
        e.preventDefault();
        setPlaying(!playing);
      }
    },
    true,
  );

  // ---- what the island needs -------------------------------------------------------------------------------------------------------

  const rangeNow = (): [number, number] => drawnRange(list.map((c) => c.epoch), idx, phase === 'play' ? 'play' : phase === 'final' || phase === 'unread' ? 'all' : 'none');
  /** The ids of the stories that are on the map now (the island spreads only these on rings). */
  const drawnIds = (): Set<string> => {
    const [from, to] = rangeNow();
    return new Set(list.slice(from, to + 1).map((c) => c.id));
  };

  /** The markers drawn on the map are decorated by the state of the show: dim (not yet), seen, read, the current one (larger, one soft pulse). */
  function apply(layers: Map<string, L.Marker>) {
    drawn = layers;
    const index = new Map(list.map((c, i) => [c.id, i]));
    const [from, to] = rangeNow();
    const now = new Set<string>();
    for (const [id, marker] of layers) {
      const node = marker.getElement();
      if (!node) continue;
      const i = index.get(id);
      const drawnNow = i !== undefined && i >= from && i <= to;
      const current = phase === 'play' && i === idx;
      if (drawnNow) now.add(id);
      node.classList.toggle('mk--tt-hide', !drawnNow);
      // The story that comes: it appears at its moment (a short fade); the ones before it stay, dim.
      if (current && !shown.has(id) && host.animate) {
        node.classList.add('mk--tt-in');
        node.addEventListener('animationend', () => node.classList.remove('mk--tt-in'), { once: true });
      }
      node.classList.toggle('mk--tt-dim', drawnNow && !current);
      node.classList.toggle('mk--tt-read', readSet.has(id));
      node.classList.toggle('mk--tt-cur', current);
      marker.setZIndexOffset(current ? 1000 : 0);
      if (current) node.style.setProperty('--tt-tone', `var(--tone-${list[idx]!.epoch}, var(--epoch-primary))`);
    }
    shown.clear();
    for (const id of now) shown.add(id);
  }

  /** A press on a marker: the story of the list is shown and the show waits. */
  function pick(id: string): boolean {
    const i = list.findIndex((c) => c.id === id);
    if (!active || i < 0) return false;
    setPlaying(false);
    go(i);
    return true;
  }

  return {
    get active() {
      return active;
    },
    /** The place key for the address while the mode runs from a chip. */
    era: (): string | null => (active && src !== TT_VIEW ? src : null),
    start: () => begin(TT_VIEW),
    begin,
    exit,
    recompute,
    resume,
    apply,
    pick,
    drawnIds,
    spread: [BEHAVIOUR.spreadSame, BEHAVIOUR.spreadGap, BEHAVIOUR.spreadMax] as const,
  };
}

export type Timetravel = ReturnType<typeof createTimetravel>;

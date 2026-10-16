// Epoch page controls: thread filter and timeline/grid switch. Everything is optional:
// without this script the page is the plain timeline and the thread chips are links to thread pages.
// State lives in the address (?fio=mar&vista=grelha) and is written with replaceState (no extra history entries).
import { matchesThread, parseState, serializeState, type FilterState } from '../lib/epoch-filter';
import { isVisibleInMode } from '../lib/family';
import { currentFamilyMode, onFamilyChange } from './family-mode';

const root = document.querySelector<HTMLElement>('[data-epoch-tools]');
const feed = document.querySelector<HTMLElement>('ol.feed');

if (root && feed) {
  const known = (root.dataset.threads ?? '').split(',').filter(Boolean);
  const items = [...feed.children] as HTMLElement[];
  const controls = root.querySelector<HTMLElement>('[data-js-only]');
  const empty = document.querySelector<HTMLElement>('[data-empty]');
  const status = root.querySelector<HTMLElement>('[data-status]');
  const fioButtons = [...root.querySelectorAll<HTMLButtonElement>('button[data-fio]')];
  const viewButtons = [...root.querySelectorAll<HTMLButtonElement>('button[data-view]')];

  let state: FilterState = parseState(location.search, known);

  const write = () => {
    // Keep the card hash only while that card is still shown.
    let hash = location.hash;
    const match = hash.match(/^#c-(.+)$/);
    if (match) {
      const card = document.getElementById(`c-${decodeURIComponent(match[1]!)}`);
      if (card?.closest('li')?.hidden) hash = '';
    }
    try {
      history.replaceState(history.state, '', location.pathname + serializeState(state) + hash);
    } catch {
      // Some contexts forbid it; the page still works, only the address is not updated.
    }
  };

  // Family mode hides items with CSS (data-min-age, data-sensitive); the counts here follow the same rule.
  const allowedByMode = (item: HTMLElement) =>
    isVisibleInMode({ minAge: item.dataset.minAge, sensitive: item.dataset.sensitive }, currentFamilyMode());

  const render = () => {
    let shown = 0;
    let shownByMode = 0;
    for (const item of items) {
      const visible = matchesThread((item.dataset.threads ?? '').split(' '), state.fio);
      item.hidden = !visible;
      if (allowedByMode(item)) shownByMode += 1;
      if (visible && allowedByMode(item)) shown += 1;
    }
    feed.dataset.view = state.grid ? 'grid' : 'timeline';
    // The grid view is driven by <html data-vista>, which the head script already set from the address.
    if (state.grid) document.documentElement.dataset.vista = 'grelha';
    else delete document.documentElement.dataset.vista;
    // Same for the thread: the prepaint CSS keys on <html data-fio>, so it must follow every change of the filter.
    if (state.fio) document.documentElement.dataset.fio = state.fio;
    else delete document.documentElement.dataset.fio;
    feed.hidden = shown === 0;
    // "No stories of this thread here" only when the mode leaves something to filter; an empty mode has its own message.
    if (empty) empty.hidden = !(shown === 0 && shownByMode > 0);
    for (const b of fioButtons) b.setAttribute('aria-pressed', String((b.dataset.fio || null) === state.fio));
    for (const b of viewButtons) b.setAttribute('aria-pressed', String((b.dataset.view === 'grid') === state.grid));
    if (status) {
      const template = shown === 1 ? status.dataset.one : status.dataset.other;
      status.textContent = (template ?? '').replace('{n}', String(shown));
    }
  };

  const set = (next: FilterState) => {
    const threadChanged = next.fio !== state.fio;
    state = next;
    render();
    write();
    // The map on this page (if any) shows the same thread.
    if (threadChanged) document.dispatchEvent(new CustomEvent('map:filter', { detail: { fio: state.fio } }));
  };

  for (const b of fioButtons) b.addEventListener('click', () => set({ ...state, fio: b.dataset.fio || null }));
  for (const b of viewButtons) b.addEventListener('click', () => set({ ...state, grid: b.dataset.view === 'grid' }));
  empty?.querySelector('button')?.addEventListener('click', () => set({ ...state, fio: null }));

  if (controls) controls.hidden = false;
  render();
  // The mode changed (toggle, another tab, "Show all modes"): recount the status line and the empty message.
  onFamilyChange(render);
  // Clean up an address with unknown values (the state above already ignored them).
  if (serializeState(state) !== location.search) write();
}

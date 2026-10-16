// State of the epoch page controls, kept in the address: ?fio=mar&vista=grelha.
// Pure functions without DOM access, so they run in plain unit tests; the script only wires them to the page.

export interface FilterState {
  /** Thread id, or null for "all". */
  fio: string | null;
  /** True for the grid view; the default view is the timeline. */
  grid: boolean;
}

export const PARAM_THREAD = 'fio';
export const PARAM_VIEW = 'vista';
export const VIEW_GRID = 'grelha';

/** Reads the state from a query string. An unknown thread id or view is ignored (shows everything). */
export function parseState(search: string, knownThreads: readonly string[]): FilterState {
  const params = new URLSearchParams(search);
  const fio = params.get(PARAM_THREAD);
  return {
    fio: fio !== null && knownThreads.includes(fio) ? fio : null,
    grid: params.get(PARAM_VIEW) === VIEW_GRID,
  };
}

/** Query string for a state: empty for the default state, otherwise "?fio=mar&vista=grelha". */
export function serializeState(state: FilterState): string {
  const params = new URLSearchParams();
  if (state.fio) params.set(PARAM_THREAD, state.fio);
  if (state.grid) params.set(PARAM_VIEW, VIEW_GRID);
  const query = params.toString();
  return query ? `?${query}` : '';
}

/** A card matches when the filter is off or the thread is its primary or its second thread. */
export function matchesThread(cardThreads: readonly string[], fio: string | null): boolean {
  return fio === null || cardThreads.includes(fio);
}

/**
 * CSS that applies ?fio= before the first paint: the head script puts the thread on <html data-fio>,
 * these rules hide the feed items of other threads. One rule per known thread id (a CSS rule cannot compare
 * two attribute values), so the list comes from the data at build time. The page script does the same later.
 */
export function feedFilterCss(threadIds: readonly string[]): string {
  return threadIds
    .filter((id) => /^[A-Za-z0-9_-]+$/.test(id))
    .map((id) => `html[data-fio="${id}"] .feed__item:not([data-threads~="${id}"]){display:none}`)
    .join('\n');
}

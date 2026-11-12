// The page "Games" (src/views/GamesView.astro, docs/spec.md 5.10): under each game the state of it in this browser, read from what the games keep (nothing is written here):
// not started (or nothing kept): "Start"; on the way: "Continue (question 5 of 12)" / "Continue (pair 4 of 10)"; finished: the caption of the last result. Blocked storage: "Start".
import { GAME_KEY, answered, bandOf, fill, hitsOf, parseGame } from '../lib/myths';
import { ORDER_GAME_KEY, ROUND_SIZE, orderBand } from '../lib/order';

const root = document.querySelector<HTMLElement>('[data-games]');
if (root) {
  const strings = JSON.parse(root.dataset.strings ?? '{}') as Record<string, string>;
  const mythIds = JSON.parse(root.dataset.mythIds ?? '[]') as string[];
  const s = (key: string, vars: Record<string, string | number> = {}): string => fill(strings[key] ?? '', vars);
  const put = (game: string, text: string): void => {
    const el = root.querySelector<HTMLElement>(`[data-game-card="${game}"] [data-state]`);
    if (el) el.textContent = text;
  };
  const read = (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  };

  const myths = parseGame(read(GAME_KEY), mythIds);
  if (myths) {
    const done = answered(myths);
    const total = myths.order.length;
    if (done === total) put('myths', s(`myths_band_${bandOf(hitsOf(myths), total)}`));
    else if (done > 0) put('myths', s('continue_myths', { done: done + 1, total }));
  }

  try {
    const kept = JSON.parse(read(ORDER_GAME_KEY) ?? 'null') as { pairs?: unknown[]; picks?: unknown[]; hits?: unknown[]; index?: number } | null;
    const total = kept?.pairs?.length ?? 0;
    if (kept && total >= 1 && total <= ROUND_SIZE && kept.picks?.length === total && kept.hits?.length === total && Number.isInteger(kept.index) && kept.index! >= 0 && kept.index! <= total) {
      if (kept.index === total) put('order', s(`order_band_${orderBand(kept.hits!.filter((h) => h === true).length, total)}`));
      else if (kept.index! > 0 || kept.picks[0] !== null) put('order', s('continue_order', { done: kept.index! + 1, total }));
    }
  } catch {
    // Not a round of ours: "Start".
  }
}

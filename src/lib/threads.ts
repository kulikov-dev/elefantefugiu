// Which threads are shown in filters and menus (decision after stage 2).
// A thread is shown when it has at least MIN_CARDS_PER_THREAD ready cards,
// counting a card for both its primary and its second thread.

// 1: every thread that has a published card is in the filters (decision of the owner after the first real cards; it was 5
// while there were only test cards). Raise it to hide threads that are still thin.
export const MIN_CARDS_PER_THREAD = 1;

export interface ThreadedCard {
  threads: readonly string[];
  /** Cards without a status are counted; drafts are not published, so they are not counted. */
  status?: 'draft' | 'ready';
}

/** Number of published cards per thread id (a card counts once per thread it lists). */
export function countCardsByThread(cards: readonly ThreadedCard[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const card of cards) {
    if (card.status === 'draft') continue;
    for (const id of new Set(card.threads)) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

/** Threads that have enough cards to appear in filters and menus; keeps the input order. */
export function visibleThreads<T extends { id: string }>(
  threads: readonly T[],
  cards: readonly ThreadedCard[],
  min: number = MIN_CARDS_PER_THREAD,
): T[] {
  const counts = countCardsByThread(cards);
  return threads.filter((thread) => (counts.get(thread.id) ?? 0) >= min);
}

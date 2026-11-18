// "Surprise me" as a deck without repeats. The deck is a shuffled list of the story ids not shown yet (unread stories first, then the read ones);
// every press takes the next one, so no story comes twice until the whole deck is gone. The ids are the same in every language, so is the deck.
// Pure functions: the storage and the page are in src/scripts/surprise-bag.ts.

export const SURPRISE_BAG_KEY = 'surpriseBag';

export interface SurpriseBag {
  /** Ids still to show, in the order they come. */
  queue: string[];
  /** Ids already shown from the deck in use; with `queue` they make the deck, so an id in neither is a new story. */
  shown: string[];
  /** The story shown last (the first one of a new deck is never this one). */
  last: string | null;
}

export interface SurpriseDraw {
  id: string | null;
  bag: SurpriseBag;
}

const isIds = (value: unknown): value is string[] => Array.isArray(value) && value.every((id) => typeof id === 'string' && id.length > 0 && id.length <= 120);

/** The saved value as a deck; anything that is not one (or nothing) is null. */
export function parseBag(raw: string | null | undefined): SurpriseBag | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<SurpriseBag> | null;
    if (!value || !isIds(value.queue) || !isIds(value.shown)) return null;
    const last = typeof value.last === 'string' ? value.last : null;
    return { queue: [...new Set(value.queue)], shown: [...new Set(value.shown)], last };
  } catch {
    return null;
  }
}

/** Fisher-Yates on a copy. */
export function shuffle<T>(list: readonly T[], random: () => number = Math.random): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.min(i, Math.floor(random() * (i + 1)));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** A new deck of `ids`: unread (shuffled) first, then read (shuffled); the first card is not `last` when there is a choice. */
export function buildDeck(ids: readonly string[], read: readonly string[], last: string | null, random: () => number = Math.random): string[] {
  const done = new Set(read);
  const deck = [...shuffle(ids.filter((id) => !done.has(id)), random), ...shuffle(ids.filter((id) => done.has(id)), random)];
  if (deck.length > 1 && deck[0] === last) [deck[0], deck[1]] = [deck[1]!, deck[0]!];
  return deck;
}

/**
 * The next story. `allowed` are the ids the family mode allows (a deck id outside it is dropped, a new one is put into the deck), `read` the read
 * marks, `current` the story the reader has open: it is skipped and stays in the deck for later (unless it is the only story there is).
 * A used-up deck is replaced by a new one that does not begin with `last`.
 */
export function drawSurprise(
  saved: SurpriseBag | null,
  allowed: readonly string[],
  read: readonly string[],
  current: string | null = null,
  random: () => number = Math.random,
): SurpriseDraw {
  const ids = [...new Set(allowed)];
  if (ids.length === 0) return { id: null, bag: { queue: [], shown: saved?.shown ?? [], last: saved?.last ?? null } };
  const ok = new Set(ids);
  const last = saved?.last ?? null;
  let queue = (saved?.queue ?? []).filter((id) => ok.has(id));
  let shown = (saved?.shown ?? []).filter((id) => ok.has(id));
  const known = new Set([...queue, ...shown]);
  const done = new Set(read);
  // A story that came after the deck was made goes to a random place among the unread ones (the front part of the deck).
  for (const id of ids.filter((x) => !known.has(x))) {
    const unread = queue.filter((x) => !done.has(x)).length;
    const at = done.has(id) ? queue.length - Math.floor(random() * (queue.length - unread + 1)) : Math.floor(random() * (unread + 1));
    queue.splice(Math.min(at, queue.length), 0, id);
  }
  let fresh = false;
  if (!queue.some((id) => id !== current)) {
    // Nothing left but the open story (or nothing): the deck is used up, a new one begins.
    queue = buildDeck(ids, read, last, random);
    shown = [];
    fresh = true;
  }
  // The first card of a new deck is not the last shown one, even when the open story stands in front of it.
  const id = (fresh && queue.find((x) => x !== current && x !== last)) || queue.find((x) => x !== current) || queue[0] || null;
  if (id === null) return { id: null, bag: { queue, shown, last } };
  return { id, bag: { queue: queue.filter((x) => x !== id), shown: [...shown, id], last: id } };
}

// The storage side of "Surprise me" (src/lib/surprise-bag.ts has the rules): the deck lives in localStorage under one key, inside try/catch;
// when the storage is blocked it lives in the memory of the page (which helps on a page that draws more than once, and costs nothing otherwise).
import { drawSurprise, parseBag, SURPRISE_BAG_KEY, type SurpriseBag } from '../lib/surprise-bag';
import { parseRead, READ_KEY } from '../lib/read-marks';

let memory: SurpriseBag | null = null;

const load = (): SurpriseBag | null => {
  try {
    return parseBag(localStorage.getItem(SURPRISE_BAG_KEY)) ?? memory;
  } catch {
    return memory;
  }
};

const save = (bag: SurpriseBag): void => {
  memory = bag;
  try {
    localStorage.setItem(SURPRISE_BAG_KEY, JSON.stringify(bag));
    localStorage.removeItem('lastSurprise'); // the key of the earlier version
  } catch {
    // Storage blocked: the deck stays in memory.
  }
};

/** The id of the next story for `allowed` ids (the family mode applied), or null when there is none; `allRead` when all of them are read. */
export function nextSurprise(allowed: readonly string[], current: string | null): { id: string | null; allRead: boolean } {
  let read: string[] = [];
  try {
    read = parseRead(localStorage.getItem(READ_KEY));
  } catch {
    // Storage blocked: nothing is known to be read.
  }
  const { id, bag } = drawSurprise(load(), allowed, read, current);
  if (id !== null) save(bag);
  const done = new Set(read);
  const pool = allowed.length > 1 && current ? allowed.filter((x) => x !== current) : allowed;
  return { id, allRead: id !== null && pool.length > 0 && pool.every((x) => done.has(x)) };
}

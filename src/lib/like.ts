// "I liked it" (docs/STATE.md): one anonymous event "like/<id of the story>" to GoatCounter (the counter that is already on the site) per reader and story.
// The id of the story has no language, so the Portuguese, English and Russian pages of a story add up. Pure helpers, no Astro or DOM imports, so the rules run in plain
// unit tests; src/scripts/like.ts is the page.

export const LIKE_PREFIX = 'like:';
/** The key in localStorage that remembers that this reader liked the story. */
export const likeKey = (id: string): string => `${LIKE_PREFIX}${id}`;
/** The path of the event in GoatCounter (the section "Pages", with the filter "like/"). */
export const likePath = (id: string): string => `like/${id}`;

/** What GoatCounter's count.js gives the page (window.goatcounter); absent when the script did not load or the counter is off. */
export interface Counter {
  count?: (vars: { path: string; title: string; event: true }) => void;
}

export interface LikeDeps {
  counter?: Counter | undefined;
  storage?: Pick<Storage, 'getItem' | 'setItem'> | undefined;
  /** The stories liked during this page load: what remembers the like when localStorage is blocked. */
  done: Set<string>;
}

/** Has this reader liked the story (in this page load or, with storage, before)? */
export function isLiked(id: string, deps: LikeDeps): boolean {
  if (deps.done.has(id)) return true;
  try {
    return deps.storage?.getItem(likeKey(id)) === '1';
  } catch {
    return false;
  }
}

/**
 * The reader presses the button: the like is remembered and, the first time only, one event is sent. Without GoatCounter (not loaded, switched off with
 * #toggle-goatcounter, a local address) or without storage nothing breaks: the reader is thanked all the same. `sent` is true when count() was called.
 */
export function like(story: { id: string; title: string }, deps: LikeDeps): { already: boolean; sent: boolean } {
  if (isLiked(story.id, deps)) return { already: true, sent: false };
  deps.done.add(story.id);
  try {
    deps.storage?.setItem(likeKey(story.id), '1');
  } catch {
    // Blocked storage: the like holds until the page is closed.
  }
  let sent = false;
  try {
    if (typeof deps.counter?.count === 'function') {
      deps.counter.count({ path: likePath(story.id), title: story.title, event: true });
      sent = true;
    }
  } catch {
    // The counter failed: nothing to tell the reader.
  }
  return { already: false, sent };
}

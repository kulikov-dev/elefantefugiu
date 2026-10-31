// The texts of a link preview (Open Graph, Twitter) of a story: the title is the short name of the story, the description is the hook.
// Pure functions, no Astro imports.

export const OG_TITLE_MAX = 60;
export const OG_DESCRIPTION_MAX = 200;

/** The text as it is when it fits; otherwise cut at a word with "…" at the end, never longer than `max` characters. */
export function cutAtWord(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const head = clean.slice(0, max - 1);
  const space = head.lastIndexOf(' ');
  const cut = (space > max / 2 ? head.slice(0, space) : head).replace(/[\s,;:–—-]+$/u, '');
  return `${cut}…`;
}

/** og:title and twitter:title: the title of the story (a title longer than 60 characters is cut at a word; the list of such titles is in the report of the build). */
export const ogTitle = (title: string): string => cutAtWord(title, OG_TITLE_MAX);

/** og:description and twitter:description: the whole hook (cut at a word with "…" when it is longer than 200 characters). */
export const ogDescription = (hook: string): string => cutAtWord(hook, OG_DESCRIPTION_MAX);

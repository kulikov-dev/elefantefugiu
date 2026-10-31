// Cross-document View Transitions (a page change in the browser, no SPA): which elements share a name, and what the browser may fetch ahead.
// Pure functions, no Astro imports, so they run in plain unit tests.

/** The name that joins the picture of a story in a list to the main picture of its page. The slug of the language of the page is plain ASCII. */
export const storyTransitionName = (slug: string): string => `story-${slug.replace(/[^A-Za-z0-9_-]/g, '-')}`;

/** The name of the header (logo, language, theme, family mode): it stays in place while the rest of the page fades. */
export const HEADER_TRANSITION_NAME = 'site-header';

/** Class of the named pictures: the CSS gives the pair of snapshots of every one of them the same fit (view-transition-class). */
export const STORY_IMAGE_CLASS = 'story-image';

// A name must be unique on a page, or the browser gives up the whole transition. One set per page (the key is the request of the page being
// rendered); the first picture of a story gets the name, a second one of the same story on the same page gets none.
const claimed = new WeakMap<object, Set<string>>();

/** The inline style for the picture of a story, or undefined when this page already gave the name to an earlier picture of the same story. */
export function claimStoryName(page: object, slug: string): string | undefined {
  const name = storyTransitionName(slug);
  let names = claimed.get(page);
  if (!names) claimed.set(page, (names = new Set()));
  if (names.has(name)) return undefined;
  names.add(name);
  return name;
}

/**
 * Speculation rules: the browser fetches (prefetch, never prerender: a prerendered page would run the counter without a visit) the internal
 * page a reader points at or touches (eagerness "moderate"). Links with a query or a fragment, links outside the site and /p/ (the short
 * address that redirects) are left out. `base` is the base path of the site without a trailing slash ("" or "/elefante").
 */
export function speculationRules(base: string) {
  return {
    prefetch: [
      {
        where: {
          and: [
            { href_matches: `${base}/*` },
            { not: { href_matches: `${base}/p/*` } },
            { not: { selector_matches: '[href*="?"], [href*="#"]' } },
          ],
        },
        eagerness: 'moderate',
      },
    ],
  };
}

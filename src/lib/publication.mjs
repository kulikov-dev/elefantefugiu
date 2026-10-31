// When a story is visible on the site (docs/STATE.md, "Queue of stories"): its status is `ready` AND its `published` day is not after today's day in Lisbon at the moment of
// the build. A story with a day in the future behaves like a draft: no page, no link, no map point, no line in the sitemap. The site is rebuilt every day
// (the schedule of .github/workflows/deploy.yml), so a story queued for a day comes out in the first build of that day. One function decides, for pages (src/lib/events.ts,
// isPublished) and for the scripts that read the YAML files themselves (sitemap, previews, checks). Plain JavaScript on purpose: the scripts import it too.

export const SITE_TIME_ZONE = 'Europe/Lisbon';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
let formatter;

/** The day (YYYY-MM-DD) of a moment in Lisbon. */
export function lisbonToday(now = new Date()) {
  formatter ??= new Intl.DateTimeFormat('en-CA', { timeZone: SITE_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
  return formatter.format(now);
}

/**
 * "Today" of a build: the day in Lisbon now, or the day in SITE_TODAY (YYYY-MM-DD) when it is set: the stand-in builds and the tests choose their own day.
 * @param {Record<string, string | undefined>} [env]
 */
export function buildToday(env = typeof process === 'undefined' ? {} : process.env) {
  const forced = env.SITE_TODAY?.trim();
  return forced && DAY.test(forced) ? forced : lisbonToday();
}

/** The day of a `published` field as YYYY-MM-DD (a string, or a Date that a YAML parser made of an unquoted day); undefined when there is none. */
export function publishedDay(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'string' && DAY.test(value.trim().slice(0, 10))) return value.trim().slice(0, 10);
  return undefined;
}

/**
 * Is the story visible on `today`? `ready`, and published today or before. A story without a day (a stand-in object of a test) is not held back by the date.
 * @param {{ status?: string, published?: unknown }} story
 * @param {string} [today]
 */
export function isLive(story, today = buildToday()) {
  if (story.status !== 'ready') return false;
  const day = publishedDay(story.published);
  return day === undefined || day <= today;
}

/** A story that is ready but waits for its day: the queue (`npm run schedule`). */
export function isQueued(story, today = buildToday()) {
  const day = publishedDay(story.published);
  return story.status === 'ready' && day !== undefined && day > today;
}

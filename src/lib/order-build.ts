// Which stories get into "Which came first?" and how one is written down for the game (docs/spec.md 5.9). Pure, no Astro imports (the pictures are added in order-data.ts).
// Nothing is a hand-kept list or a flag in a story: the stories published that day, minus a heavy topic and the prologue.
import type { Lang } from '../i18n/routes';
import { storyPath } from '../i18n/routes';
import { formatYear, isPublished, yearRange, type EventData } from './events';
import { normalizeMinAge, normalizeSensitive } from './family';
import { hintOf } from './order-hint.mjs';
import { DEEPEST_YEAR, hasTwoYears, isRoughDate, sortYear, type OrderStory } from './order';

export type OrderExclusion = 'sensitive' | 'prologue';

const labels = (e: Pick<EventData, 'year_label'>): (string | undefined)[] => Object.values(e.year_label ?? {});

/** Why a published story is not in the game; undefined: it is in. */
export function orderExclusion(e: Pick<EventData, 'year' | 'sensitive'>): OrderExclusion | undefined {
  if (normalizeSensitive(e.sensitive)) return 'sensitive';
  if (yearRange(e)[0] < DEEPEST_YEAR) return 'prologue';
  return undefined;
}

/** The stories of the game: published today (a draft and a story queued for a later day are out) and not excluded. */
export const orderEvents = <E extends EventData>(events: readonly E[]): E[] => events.filter((e) => isPublished(e) && orderExclusion(e) === undefined);

/** One story as /{lang}/order.json holds it, without the thumbnail. */
export function orderEntry(e: EventData, lang: Lang): OrderStory {
  const [from, to] = yearRange(e);
  const hint = hintOf(e, lang);
  return {
    id: e.id,
    title: e.title[lang],
    ...(hint ? { hint } : {}),
    href: storyPath(lang, e.slug[lang]),
    year: sortYear(from, to),
    from,
    to,
    // A label with two years ("1906 e 2020": the opening and a later event) is shown in the game as the first year only, the year the story is sorted by.
    date: hasTwoYears(labels(e)) ? formatYear({ year: e.year, years_ago: e.years_ago }, lang) : formatYear(e, lang),
    epoch: e.epoch,
    minAge: normalizeMinAge(e.min_age),
    rough: isRoughDate(from, to, labels(e)),
  };
}

// The providers of pinned cards for the showcase on the home page (src/lib/start-set.ts): anniversaries (from the day of a story) and holidays.
// Pure functions, no Astro imports. A provider returns Pin objects; start-set.ts decides which of them show on a day.
import type { Pin, Say, StartStory } from './start-set';

const MONTH_DAY = /^(\d{2})-(\d{2})$/;

/** "On this day in 1877" in each language (docs/STATE.md: the wording is fixed by the owner). */
export const anniversaryLabel = (year: number): Say => ({
  pt: `Neste dia, em ${year}`,
  en: `On this day in ${year}`,
  ru: `В этот день в ${year} году`,
});

/** Is `MM-DD` a real day of the calendar in `year` (02-29 only in a leap year)? */
export function isCalendarDay(year: number, monthDay: string): boolean {
  const m = MONTH_DAY.exec(monthDay);
  if (!m) return false;
  const date = new Date(Date.UTC(year, Number(m[1]) - 1, Number(m[2])));
  return date.getUTCFullYear() === year && date.getUTCMonth() === Number(m[1]) - 1 && date.getUTCDate() === Number(m[2]);
}

/**
 * The anniversaries that fall in `year`: one pin for every story with a day (`day`, MM-DD) and a year after 0, the window being that one day.
 * Stories with a period or a year before the common era have no `day` in the data, so they never get here. A story of a heavy topic is not pinned:
 * "On this day" on the first screen should not open with a disaster. At most one anniversary a day: when several stories share a day, the
 * candidates in the order of their ids give the one at the index `year % number of candidates`, so one year shows one story and the next another.
 */
export function anniversaryPins(stories: readonly StartStory[], year: number): Pin[] {
  const byDay = new Map<string, StartStory[]>();
  for (const story of stories) {
    if (story.sensitive || story.day === undefined || story.year === undefined || story.year < 1 || !isCalendarDay(year, story.day)) continue;
    byDay.set(story.day, [...(byDay.get(story.day) ?? []), story]);
  }
  return [...byDay.entries()].map(([monthDay, candidates]): Pin => {
    const sorted = [...candidates].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const story = sorted[year % sorted.length]!;
    const day = `${year}-${monthDay}`;
    return { id: `anniversary:${story.id}`, kind: 'anniversary', from: day, to: day, priority: 0, label: anniversaryLabel(story.year!), target: { type: 'story', id: story.id } };
  });
}

/** All the pins that can show on a day: anniversaries and holidays of the year of that day. */
export const pinsFor = (stories: readonly StartStory[], year: number, holidays: readonly Pin[] = []): Pin[] => [...anniversaryPins(stories, year), ...holidays];

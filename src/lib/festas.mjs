// The holidays (src/data/festas.yaml): the date of a holiday in a year, its window and "which holiday is on now". Pure functions with no Astro or
// DOM imports: the build and the tests use them, and the same rule runs in the browser (src/lib/head-script.ts), where the build hands it the
// list of days as data, so a test can compare the two.
//
// The window of a holiday is the 3 days before it and the day itself, by the date in Lisbon (the day comes from the caller: `buildToday()` in the build,
// `lisbonToday()` or `?hoje=` in a browser). When windows meet, the holiday whose day is today wins, otherwise the nearest.
// Plain JavaScript with JSDoc types on purpose (like publication.mjs): the browser suites of scripts/qa import it too. src/lib/festas.ts gives it its TypeScript names.

/** The days before a holiday on which its window opens. */
export const WINDOW_DAYS = 3;

/**
 * The rule of a date: a fixed day (MM-DD) or a number of days from Easter (Carnival is -47).
 * @typedef {{ fixed: string } | { easter: number }} DateRule
 * @typedef {{ id: string, enabled: boolean, date: DateRule }} FestaRef
 * @typedef {{ id: string, day: string, inWindow: boolean }} FestaNow
 */

const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** @param {string} day */
const dayNumber = (day) => Date.parse(`${day}T00:00:00Z`) / 86_400_000;
/** @param {number} n */
const dayOf = (n) => new Date(n * 86_400_000).toISOString().slice(0, 10);
/** @param {number} n */
const pad = (n) => String(n).padStart(2, '0');

/**
 * `day` (YYYY-MM-DD) moved by `n` days.
 * @param {string} day
 * @param {number} n
 */
export const addDays = (day, n) => dayOf(dayNumber(day) + n);

/**
 * Easter Sunday of `year` by the Gregorian rule (Meeus/Jones/Butcher), YYYY-MM-DD.
 * @param {number} year
 */
export function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * The day of a holiday in `year`, YYYY-MM-DD.
 * @param {DateRule} rule
 * @param {number} year
 */
export function festaDay(rule, year) {
  return 'fixed' in rule ? `${year}-${rule.fixed}` : addDays(easterSunday(year), rule.easter);
}

const MONTHS = {
  pt: ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  ru: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
};

/**
 * A day as people say it: "9 февраля", "9 de fevereiro", "February 9".
 * @param {string} day YYYY-MM-DD
 * @param {'pt' | 'en' | 'ru'} lang
 */
export function formatDay(day, lang) {
  const name = MONTHS[lang][Number(day.slice(5, 7)) - 1];
  const n = Number(day.slice(8, 10));
  return lang === 'pt' ? `${n} de ${name}` : lang === 'en' ? `${name} ${n}` : `${n} ${name}`;
}

/**
 * The next day of the holiday that is not before `today` (this year's or next year's), YYYY-MM-DD.
 * @param {FestaRef} festa
 * @param {string} today
 */
export function nextDay(festa, today) {
  const year = Number(today.slice(0, 4));
  return occurrences(festa, year, year + 1).map((o) => o.day).find((d) => d >= today) ?? festaDay(festa.date, year);
}

/**
 * The text of a moving holiday carries `{date}`: it is replaced by the day of the holiday as people say it (the strings at the top of the object only).
 * @template {Record<string, any>} T
 * @param {T} text
 * @param {string} day
 * @param {'pt' | 'en' | 'ru'} lang
 * @returns {T}
 */
export function fillDate(text, day, lang) {
  const said = formatDay(day, lang);
  return /** @type {T} */ (Object.fromEntries(Object.entries(text).map(([k, v]) => [k, typeof v === 'string' ? v.split('{date}').join(said) : v])));
}

/**
 * The window of a holiday that falls on `day`: first and last day, both included.
 * @param {string} day
 */
export const windowOf = (day) => ({ from: addDays(day, -WINDOW_DAYS), to: day });

/**
 * The days (YYYY-MM-DD) of the holiday in the years from `first` to `last`.
 * @param {FestaRef} festa
 * @param {number} first
 * @param {number} last
 * @returns {{ id: string, day: string }[]}
 */
export const occurrences = (festa, first, last) =>
  Array.from({ length: last - first + 1 }, (_, i) => ({ id: festa.id, day: festaDay(festa.date, first + i) }));

/**
 * Which holiday is on at `today`. Only the enabled holidays count, unless `forced` names one (`?festa=<id>`, for a preview: it is on whatever the date
 * and whether or not it is enabled). Nothing in a window: the nearest enabled holiday to come with `inWindow: false` (the build puts its markup on the
 * page, hidden). `undefined` when there is no enabled holiday or `today` is not a day. `day` is the day of the holiday the window belongs to.
 * @param {readonly FestaRef[]} festas
 * @param {string} today
 * @param {string | null} [forced]
 * @returns {FestaNow | undefined}
 */
export function festaNow(festas, today, forced) {
  if (!DAY.test(today) || Number.isNaN(dayNumber(today))) return undefined;
  const year = Number(today.slice(0, 4));
  /** @param {FestaRef} festa */
  const near = (festa) => occurrences(festa, year - 1, year + 1).filter((o) => o.day >= today);
  const forcedFesta = forced ? festas.find((f) => f.id === forced) : undefined;
  if (forcedFesta) {
    const next = near(forcedFesta).sort((a, b) => (a.day < b.day ? -1 : 1))[0];
    return { id: forcedFesta.id, day: next?.day ?? festaDay(forcedFesta.date, year), inWindow: true };
  }
  const upcoming = festas
    .filter((f) => f.enabled)
    .flatMap(near)
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : a.id < b.id ? -1 : 1));
  // The nearest day first: a holiday today has the smallest day, and of the windows that meet the one that ends first is the nearer.
  const first = upcoming[0];
  if (!first) return undefined;
  return { id: first.id, day: first.day, inWindow: windowOf(first.day).from <= today };
}

/**
 * Is `today` in the window of the holiday in some year? (The page of a holiday is indexed only then.)
 * @param {FestaRef} festa
 * @param {string} today
 */
export function isInWindow(festa, today) {
  if (!DAY.test(today)) return false;
  const year = Number(today.slice(0, 4));
  return occurrences(festa, year - 1, year + 1).some((o) => {
    const w = windowOf(o.day);
    return w.from <= today && today <= w.to;
  });
}

/**
 * The days the browser needs: every day of every enabled holiday from the year before to two years after `year`. The head script reads it as
 * `[[id, day], ...]`; a build is made every day, so the list is always fresh.
 * @param {readonly FestaRef[]} festas
 * @param {number} year
 * @returns {[string, string][]}
 */
export function festaDays(festas, year) {
  return festas.filter((f) => f.enabled).flatMap((f) => occurrences(f, year - 1, year + 2).map((o) => /** @type {[string, string]} */ ([o.id, o.day])));
}

/**
 * The CSS that turns the markup of the holidays on (src/styles/festas.css hides it): the markup of a holiday shows while <html data-festa> names it, and the line
 * "this holiday is celebrated on ..." of its page shows (in the place of its date, `data-festa-on`) while it does not. One rule pair per id; ids are `[a-z0-9-]` (festaSchema), so nothing is escaped.
 * @param {readonly string[]} ids
 */
export const festaRules = (ids) =>
  ids.map((id) => `html[data-festa="${id}"] [data-festa-show="${id}"]{display:block}html[data-js]:not([data-festa="${id}"]) [data-festa-off="${id}"]{display:block}html[data-js]:not([data-festa="${id}"]) [data-festa-on="${id}"]{display:none}`).join('');

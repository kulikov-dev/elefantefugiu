// "Years ago" for stories older than the common era by thousands or millions of years (the prologue epoch: dinosaurs, the Stone Age).
// Plain JS with no imports, so the schema, the pages and the build scripts all read the same rules.

/** The units of the field: `n` is a whole number of millions or of thousands of years. */
export const AGO_UNITS = { million: 1_000_000, thousand: 1_000 };

/** How many years ago: 150 million gives 150000000. */
export const yearsAgoCount = (ago) => ago.n * AGO_UNITS[ago.unit];

/**
 * Problems of a `years_ago` value next to the `year` of the story (the sort key, a negative number). The year may differ from the exact count
 * by 1 % at most (two stories "about 150 million years ago" are told apart by it); the Russian caption has one plural form for "thousand",
 * so a count of thousands must end in 0 or 5-9 (or its caption is written as `year_label`).
 */
export function yearsAgoProblems(ago, year) {
  const out = [];
  if (typeof year !== 'number') out.push('years_ago needs a single year (the sort key), not a period');
  else if (Math.abs(-year - yearsAgoCount(ago)) > yearsAgoCount(ago) * 0.01) out.push(`year ${year} is not within 1 % of -${yearsAgoCount(ago)} (years_ago)`);
  if (ago.unit === 'thousand' && !/^(0|[5-9])$/.test(String(ago.n).slice(-1))) out.push('a count of thousands ends in 0 or 5-9 (the Russian plural), otherwise write year_label');
  return out;
}

/** The first year of a feed item that is "millions of years ago": the scale of the dinosaurs, not of people. */
export const MILLIONS_FROM = -1_000_000;

/** Index of the story in a feed (sorted by year) before which the scale breaks: the first one after a story from millions of years ago; -1 when none. */
export function scaleGapIndex(years) {
  for (let i = 1; i < years.length; i++) if (years[i - 1] <= MILLIONS_FROM && years[i] > MILLIONS_FROM) return i;
  return -1;
}

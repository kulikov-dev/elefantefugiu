// The prologue epoch: stories told in "years ago" (millions and thousands of years), the break of the scale on the timeline, the order against the other
// epochs and the panel in family mode. The data cases take the epoch from the data (the one that has `scale_gap`), no number of stories is written here.
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { ageInfoOf, isVisibleInMode, FAMILY_MODES } from '../../src/lib/family';
import { compareChronological, formatYear, scaleYearText, yearParts, yearsAgoText } from '../../src/lib/events';
import { openOrder, openPieces, openSet } from '../../src/lib/panno';
import { readProgress } from '../../src/lib/read-marks';
import { MILLIONS_FROM, scaleGapIndex, yearsAgoCount, yearsAgoProblems } from '../../src/lib/years-ago.mjs';

describe('years ago: the caption of a story', () => {
  it('is written per language from the count and the unit', () => {
    expect(yearsAgoText({ n: 150, unit: 'million' }, 'ru')).toBe('около 150 млн лет назад');
    expect(yearsAgoText({ n: 150, unit: 'million' }, 'pt')).toBe('há cerca de 150 milhões de anos');
    expect(yearsAgoText({ n: 150, unit: 'million' }, 'en')).toBe('about 150 million years ago');
    expect(yearsAgoText({ n: 28, unit: 'thousand' }, 'ru')).toBe('около 28 тысяч лет назад');
    expect(yearsAgoText({ n: 28, unit: 'thousand' }, 'pt')).toBe('há cerca de 28 mil anos');
    expect(yearsAgoText({ n: 28, unit: 'thousand' }, 'en')).toBe('about 28,000 years ago');
  });

  it('formatYear uses year_label first, then years_ago, then the number', () => {
    const base = { year: -150_000_000 };
    expect(formatYear({ ...base, years_ago: { n: 150, unit: 'million' } }, 'en')).toBe('about 150 million years ago');
    expect(formatYear({ ...base, year_label: { pt: 'a', en: 'b', ru: 'в' }, years_ago: { n: 150, unit: 'million' } }, 'en')).toBe('b');
    expect(formatYear({ year: -140 }, 'en')).toBe('140 BC');
  });

  it('the narrow column of the timeline breaks the scale text in two short lines', () => {
    expect(yearParts(scaleYearText({ year: -1, years_ago: { n: 170, unit: 'million' } }, 'ru'))).toEqual(['170 млн', 'лет назад']);
    expect(yearParts(scaleYearText({ year: -1, years_ago: { n: 28, unit: 'thousand' } }, 'en'))).toEqual(['28,000', 'years ago']);
    expect(yearParts(scaleYearText({ year: -1, years_ago: { n: 170, unit: 'million' } }, 'pt'))).toEqual(['170 milhões', 'de anos']);
    expect(yearParts('IV в. до н. э.')).toEqual(['IV в.', 'до н. э.']);
  });
});

describe('years ago: the rules of the field', () => {
  it('year is the sort key and stays within 1 % of the count', () => {
    expect(yearsAgoCount({ n: 150, unit: 'million' })).toBe(150_000_000);
    expect(yearsAgoProblems({ n: 150, unit: 'million' }, -150_000_000)).toEqual([]);
    expect(yearsAgoProblems({ n: 150, unit: 'million' }, -149_000_000)).toEqual([]);
    expect(yearsAgoProblems({ n: 150, unit: 'million' }, -120_000_000)).toHaveLength(1);
    expect(yearsAgoProblems({ n: 150, unit: 'million' }, { from: -1, to: 0 })).toHaveLength(1);
  });

  it('a count of thousands ends in 0 or 5-9 (one Russian plural)', () => {
    expect(yearsAgoProblems({ n: 28, unit: 'thousand' }, -28_000)).toEqual([]);
    expect(yearsAgoProblems({ n: 22, unit: 'thousand' }, -22_000)).toHaveLength(1);
  });
});

describe('scale gap', () => {
  it('is before the first story that is not from millions of years ago, and only there', () => {
    expect(scaleGapIndex([-170e6, -152e6, -150e6, -28_000, -22_000])).toBe(3);
    expect(scaleGapIndex([-28_000, -22_000, 1385])).toBe(-1);
    expect(scaleGapIndex([-170e6, -152e6])).toBe(-1);
    expect(scaleGapIndex([])).toBe(-1);
    expect(MILLIONS_FROM).toBeLessThan(-100_000);
  });
});

type Raw = { id: string; epoch: string; year: number | { from: number; to: number }; status: string; min_age: unknown; sensitive: unknown };
const dir = new URL('../../src/content/events/', import.meta.url);
const events: Raw[] = readdirSync(dir).filter((f) => f.endsWith('.yaml')).map((f) => parse(readFileSync(new URL(f, dir), 'utf8')) as Raw);
const epochs = parse(readFileSync(new URL('../../src/content/epochs.yaml', import.meta.url), 'utf8')) as { id: string; order: number; mvp: boolean; scale_gap?: unknown; panno?: { cols: number; rows: number } }[];
const start = (e: Raw): number => (typeof e.year === 'number' ? e.year : e.year.from);
const withGap = epochs.filter((e) => e.scale_gap && e.mvp);

describe('epochs with a scale gap, in the data', () => {
  it('there is one to test', () => {
    expect(withGap.length, 'need an epoch with scale_gap').toBeGreaterThan(0);
  });

  for (const epoch of withGap) {
    const own = events.filter((e) => e.epoch === epoch.id && e.status === 'ready');
    const feed = [...own].sort((a, b) => compareChronological(a as never, b as never));

    it(`${epoch.id}: the feed is in order of the age, the stories of millions of years first, with the break between the two parts`, () => {
      const years = feed.map(start);
      expect(years).toEqual([...years].sort((a, b) => a - b));
      const at = scaleGapIndex(years);
      expect(at, 'the stories of the epoch are on both sides of the gap').toBeGreaterThan(0);
      expect(years.slice(0, at).every((y) => y <= MILLIONS_FROM)).toBe(true);
      expect(years.slice(at).every((y) => y > MILLIONS_FROM)).toBe(true);
    });

    it(`${epoch.id}: every story is earlier than every story of the epochs that come after it (the order of the lists is the order of the years)`, () => {
      const latest = Math.max(...own.map(start));
      const later = new Set(epochs.filter((e) => e.order > epoch.order).map((e) => e.id));
      for (const e of events.filter((x) => later.has(x.epoch) && x.status === 'ready')) expect(start(e), e.id).toBeGreaterThan(latest);
    });

    it(`${epoch.id}: the panel in family mode opens whole once every story the mode shows is read`, () => {
      expect(epoch.panno, 'the epoch has a panel').toBeDefined();
      const pieces = epoch.panno!.cols * epoch.panno!.rows;
      const order = openOrder(epoch.id, epoch.panno!.cols, epoch.panno!.rows);
      const onPage = feed.map((e) => ({ id: e.id, ...ageInfoOf(e) }));
      for (const mode of FAMILY_MODES) {
        const shown = onPage.filter((s) => isVisibleInMode(s, mode));
        const all = readProgress(onPage, shown.map((s) => s.id), mode);
        expect(all.n, mode).toBe(all.m);
        expect(all.m, mode).toBe(shown.length);
        expect(openPieces(all.n, all.m, pieces), mode).toBe(pieces);
        expect(openSet(all.n, all.m, order).size, mode).toBe(pieces);
        if (shown.length > 1) {
          const one = readProgress(onPage, shown.slice(1).map((s) => s.id), mode);
          expect(openPieces(one.n, one.m, pieces), `${mode}: one story short`).toBeLessThan(pieces);
        }
      }
      // The family mode hides something here (the heavy story), so its "all read" is a smaller count than in the mode "off".
      const off = onPage.filter((s) => isVisibleInMode(s, 'off')).length;
      const family = onPage.filter((s) => isVisibleInMode(s, 'all')).length;
      expect(family).toBeLessThan(off);
    });
  }
});

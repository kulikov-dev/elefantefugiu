import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { addDays, easterSunday, festaDay, festaDays, festaNow, festaRules, fillDate, formatDay, isInWindow, nextDay, windowOf, type FestaRef } from '../../src/lib/festas';
import { headScript } from '../../src/lib/head-script';
import { lisbonToday } from '../../src/lib/publication.mjs';

// Made-up holidays: the input is part of the test, not the content of the site.
const fixed = (id: string, day: string, enabled = true): FestaRef => ({ id, enabled, date: { fixed: day } });
const dec1 = fixed('dec1', '12-01');

describe('Easter and Carnival', () => {
  it('counts Easter by the Gregorian rule', () => {
    expect(easterSunday(2026)).toBe('2026-04-05');
    expect(easterSunday(2027)).toBe('2027-03-28');
    expect(easterSunday(2028)).toBe('2028-04-16');
  });

  it('puts Carnival 47 days before Easter', () => {
    expect(festaDay({ easter: -47 }, 2027)).toBe('2027-02-09');
    expect(festaDay({ easter: 0 }, 2026)).toBe('2026-04-05');
  });

  it('puts a fixed day in the year asked for', () => {
    expect(festaDay({ fixed: '12-01' }, 2031)).toBe('2031-12-01');
  });

  it('gives the Tuesday of Carnival in the years after, with its window from Saturday', () => {
    const carnival: FestaRef = { id: 'carnival', enabled: true, date: { easter: -47 } };
    for (const [year, day] of [['2027', '2027-02-09'], ['2028', '2028-02-29'], ['2029', '2029-02-13'], ['2030', '2030-03-05']]) {
      expect(festaDay(carnival.date, Number(year))).toBe(day);
      expect(new Date(day + 'T00:00:00Z').getUTCDay()).toBe(2);
      expect(new Date(windowOf(day).from + 'T00:00:00Z').getUTCDay()).toBe(6);
    }
    expect(windowOf('2027-02-09')).toEqual({ from: '2027-02-06', to: '2027-02-09' });
    expect(isInWindow(carnival, '2027-02-06')).toBe(true);
    expect(isInWindow(carnival, '2027-02-05')).toBe(false);
    expect(isInWindow(carnival, '2027-02-10')).toBe(false);
  });

  it('puts the day of a moving holiday in {date} of its text, for the next time it comes', () => {
    const carnival: FestaRef = { id: 'carnival', enabled: true, date: { easter: -47 } };
    expect(nextDay(carnival, '2027-02-09')).toBe('2027-02-09');
    expect(nextDay(carnival, '2027-02-10')).toBe('2028-02-29');
    expect(formatDay('2027-02-09', 'ru')).toBe('9 февраля');
    expect(formatDay('2027-02-09', 'pt')).toBe('9 de fevereiro');
    expect(formatDay('2027-02-09', 'en')).toBe('February 9');
    expect(fillDate({ date: '{date}', head: '{date} · Карнавал', rest: ['{date}'] }, '2027-02-09', 'ru')).toEqual({ date: '9 февраля', head: '9 февраля · Карнавал', rest: ['{date}'] });
  });
});

describe('the window', () => {
  it('opens 3 days before the holiday and closes at the end of its day', () => {
    expect(windowOf('2026-12-01')).toEqual({ from: '2026-11-28', to: '2026-12-01' });
    expect(isInWindow(dec1, '2026-11-27')).toBe(false);
    expect(isInWindow(dec1, '2026-11-28')).toBe(true);
    expect(isInWindow(dec1, '2026-12-01')).toBe(true);
    expect(isInWindow(dec1, '2026-12-02')).toBe(false);
  });

  it('keeps the boundaries by the clock in Lisbon (23:59 and 00:00)', () => {
    // Winter in Lisbon is UTC+0.
    expect(lisbonToday(new Date('2026-11-27T23:59:00Z'))).toBe('2026-11-27');
    expect(lisbonToday(new Date('2026-11-28T00:00:00Z'))).toBe('2026-11-28');
    expect(lisbonToday(new Date('2026-12-01T23:59:00Z'))).toBe('2026-12-01');
    expect(lisbonToday(new Date('2026-12-02T00:00:00Z'))).toBe('2026-12-02');
    const on = (iso: string) => festaNow([dec1], lisbonToday(new Date(iso)))?.inWindow;
    expect(on('2026-11-27T23:59:00Z')).toBe(false);
    expect(on('2026-11-28T00:00:00Z')).toBe(true);
    expect(on('2026-12-01T23:59:00Z')).toBe(true);
    expect(on('2026-12-02T00:00:00Z')).toBe(false);
  });

  it('is by Lisbon time in summer too (UTC+1: midnight in Lisbon is 23:00 UTC the day before)', () => {
    expect(lisbonToday(new Date('2026-06-09T22:59:00Z'))).toBe('2026-06-09');
    expect(lisbonToday(new Date('2026-06-09T23:00:00Z'))).toBe('2026-06-10');
  });

  it('crosses the New Year', () => {
    const jan1 = fixed('jan1', '01-01');
    expect(festaNow([jan1], '2026-12-29')).toMatchObject({ id: 'jan1', day: '2027-01-01', inWindow: true });
    expect(festaNow([jan1], '2026-12-28')?.inWindow).toBe(false);
  });
});

describe('which holiday is on', () => {
  it('gives the next holiday, outside the window, so the build has markup for it', () => {
    expect(festaNow([dec1], '2026-11-04')).toEqual({ id: 'dec1', day: '2026-12-01', inWindow: false });
    expect(festaNow([dec1], '2026-12-02')).toEqual({ id: 'dec1', day: '2027-12-01', inWindow: false });
  });

  it('prefers the holiday whose day is today, then the nearest', () => {
    const list = [dec1, fixed('dec3', '12-03')];
    expect(festaNow(list, '2026-11-29')?.id).toBe('dec1');
    expect(festaNow(list, '2026-11-30')?.id).toBe('dec1');
    expect(festaNow(list, '2026-12-01')?.id).toBe('dec1');
    expect(festaNow(list, '2026-12-02')?.id).toBe('dec3');
    expect(festaNow(list, '2026-12-03')?.id).toBe('dec3');
    // Two holidays on one day: the id decides.
    expect(festaNow([fixed('b', '12-01'), fixed('a', '12-01')], '2026-12-01')?.id).toBe('a');
  });

  it('skips a holiday that is not enabled', () => {
    expect(festaNow([fixed('off', '12-01', false)], '2026-11-30')).toBeUndefined();
    expect(festaNow([fixed('off', '12-01', false), fixed('on', '12-25')], '2026-11-30')).toEqual({ id: 'on', day: '2026-12-25', inWindow: false });
  });

  it('?festa=<id> turns a holiday on whatever the date and whether or not it is enabled', () => {
    expect(festaNow([dec1], '2026-07-01', 'dec1')).toMatchObject({ id: 'dec1', inWindow: true });
    expect(festaNow([fixed('off', '12-01', false)], '2026-07-01', 'off')).toMatchObject({ id: 'off', inWindow: true });
    expect(festaNow([dec1], '2026-11-30', 'nothing')).toMatchObject({ id: 'dec1', inWindow: true });
  });

  it('gives nothing for a day that is not a day', () => {
    expect(festaNow([dec1], 'tomorrow')).toBeUndefined();
    expect(festaNow([dec1], '2026-13-45')).toBeUndefined();
  });

  it('follows Easter and Carnival', () => {
    const list: FestaRef[] = [
      { id: 'carnaval', enabled: true, date: { easter: -47 } },
      { id: 'pascoa', enabled: true, date: { easter: 0 } },
    ];
    expect(festaNow(list, '2027-02-06')).toMatchObject({ id: 'carnaval', inWindow: true });
    expect(festaNow(list, '2027-02-05')).toMatchObject({ id: 'carnaval', inWindow: false });
    expect(festaNow(list, '2027-03-25')).toMatchObject({ id: 'pascoa', inWindow: true });
  });
});

describe('the head script', () => {
  const festas: FestaRef[] = [dec1, fixed('dec3', '12-03'), fixed('off', '12-02', false), { id: 'pascoa', enabled: true, date: { easter: 0 } }];
  const known = festas.map((f) => f.id);
  const run = (search: string) => {
    const attrs: Record<string, string> = {};
    runInNewContext(headScript([], undefined, { days: festaDays(festas, 2026), ids: known }), {
      document: { documentElement: { setAttribute: (n: string, v: string) => void (attrs[n] = v) }, querySelectorAll: () => [] },
      localStorage: { getItem: () => null },
      location: { search },
      URLSearchParams,
      String,
    });
    return attrs['data-festa'];
  };

  it('agrees with festaNow on every day of two years', () => {
    for (let day = '2026-01-01'; day < '2028-01-01'; day = addDays(day, 1)) {
      const expected = festaNow(festas, day);
      expect(run(`?hoje=${day}`), day).toBe(expected?.inWindow ? expected.id : undefined);
    }
  });

  it('takes ?festa= of a holiday it knows, even a disabled one, and ignores an unknown one', () => {
    expect(run('?hoje=2026-07-01&festa=dec1')).toBe('dec1');
    expect(run('?hoje=2026-07-01&festa=off')).toBe('off');
    expect(run('?hoje=2026-07-01&festa=nothing')).toBeUndefined();
  });

  it('ignores a ?hoje= that is not a day (and uses the day in Lisbon)', () => {
    const now = festaNow(festas, lisbonToday());
    expect(run('?hoje=2026-13-45')).toBe(now?.inWindow ? now.id : undefined);
  });

  it('lets ?festa= win over ?hoje=', () => {
    expect(run('?hoje=2026-11-30&festa=dec3')).toBe('dec3');
  });
});

describe('the tab icon', () => {
  const icons = { dec1: { svg: '/f/a.svg', png: '/f/a-32.png', apple: '/f/a-180.png' } };
  const festas: FestaRef[] = [dec1];
  type Link = { fi: string; fn: string; href: string; sizes?: string; removed?: boolean };
  const links = (): Link[] => [
    { fi: 'png', fn: '/n.png', href: '/n.png', sizes: '96x96' },
    { fi: 'svg', fn: '/n.svg', href: '/n.svg' },
    { fi: 'ico', fn: '/n.ico', href: '/n.ico' },
    { fi: 'apple', fn: '/n.apple', href: '/n.apple' },
  ];
  const run = (search: string, list: Link[], built = false) => {
    const nodes = list.map((l) => ({
      getAttribute: (n: string) => (n === 'data-fi' ? l.fi : n === 'data-fn' ? l.fn : null),
      setAttribute: (n: string, v: string) => void (n === 'href' ? (l.href = v) : n === 'sizes' ? (l.sizes = v) : undefined),
      remove: () => void (l.removed = true),
    }));
    runInNewContext(headScript([], undefined, { days: festaDays(festas, 2026), ids: ['dec1'], icons, built }), {
      document: { documentElement: { setAttribute: () => undefined }, querySelectorAll: (q: string) => (q === 'link[data-fi]' ? nodes : []) },
      localStorage: { getItem: () => null },
      location: { search },
      URLSearchParams,
      String,
    });
    return list;
  };

  it('swaps the icons in the window and drops the ICO', () => {
    const [png, svg, ico, apple] = run('?hoje=2026-11-30', links());
    expect(png).toMatchObject({ href: '/f/a-32.png', sizes: '32x32' });
    expect(svg!.href).toBe('/f/a.svg');
    expect(apple!.href).toBe('/f/a-180.png');
    expect(ico!.removed).toBe(true);
  });

  it('leaves the usual icons alone outside the window', () => {
    const [png, svg, ico, apple] = run('?hoje=2026-12-05', links());
    expect([png!.href, svg!.href, ico!.href, apple!.href]).toEqual(['/n.png', '/n.svg', '/n.ico', '/n.apple']);
    expect(ico!.removed).toBeUndefined();
  });

  it('puts the usual icons back when the page was built in the window and the reader is outside it', () => {
    const built = [
      { fi: 'png', fn: '/n.png', href: '/f/a-32.png', sizes: '32x32' },
      { fi: 'svg', fn: '/n.svg', href: '/f/a.svg' },
      { fi: 'apple', fn: '/n.apple', href: '/f/a-180.png' },
    ];
    const [png, svg, apple] = run('?hoje=2026-12-05', built, true);
    expect(png).toMatchObject({ href: '/n.png', sizes: '96x96' });
    expect([svg!.href, apple!.href]).toEqual(['/n.svg', '/n.apple']);
  });

  it('takes ?festa= for the icon too', () => {
    expect(run('?hoje=2026-07-01&festa=dec1', links())[1]!.href).toBe('/f/a.svg');
  });
});

describe('festaRules', () => {
  it('writes a pair of rules for each id', () => {
    expect(festaRules(['a'])).toBe('html[data-festa="a"] [data-festa-show="a"]{display:block}html[data-js]:not([data-festa="a"]) [data-festa-off="a"]{display:block}html[data-js]:not([data-festa="a"]) [data-festa-on="a"]{display:none}');
    expect(festaRules([])).toBe('');
  });
});

describe('the holidays of the site (src/data/festas.yaml)', () => {
  it('a holiday is whole: Russian alone is fine for now, but with pt or en it has all three; an enabled one has a story, and no {date} is left', async () => {
    const { FESTAS, festaText } = await import('../../src/lib/festas-data');
    for (const festa of FESTAS) {
      const langs = (['pt', 'en', 'ru'] as const).filter((l) => festaText(festa, l));
      if (langs.length > 0) expect(festaText(festa, 'ru'), `${festa.id} has a text but not in ru`).toBeDefined();
      if (langs.includes('pt') || langs.includes('en')) expect(langs, `${festa.id}: with pt or en the holiday has all three languages`).toEqual(['pt', 'en', 'ru']);
    }
    for (const festa of FESTAS.filter((f) => f.enabled)) {
      expect(festaText(festa, 'ru'), `${festa.id} in ru`).toBeDefined();
      for (const lang of ['pt', 'en', 'ru'] as const) {
        const text = festaText(festa, lang);
        if (text) expect(JSON.stringify([text.date, text.head_date, text.name]), `${festa.id} in ${lang}`).not.toContain('{date}');
      }
      expect(festa.story, `${festa.id} needs a story of the day`).toBeTruthy();
    }
  });
});

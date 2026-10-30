import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { eventSchema } from '../../src/data/schemas';
import { has, plural, pluralCategory, pluralForms, t } from '../../src/i18n';
import { ROUTES, LANGS, FALLBACK_CHAIN, STORY_SEGMENT, EPOCH_SEGMENT, THREAD_SEGMENT, altPaths, pagePath, storyPath } from '../../src/i18n/routes';
import { isRuStandIn, textLangOf } from '../../src/lib/events';
import { chooseLang, rootScript } from '../../src/lib/lang-choice';
import { localize, missingRu } from '../../src/lib/localize';
import { pickPlural } from '../../src/lib/plural-pick';

/** A card by file name, or a number for a placeholder card (evento-exemplo-NN). */
const event = (n: string) => parse(readFileSync(fileURLToPath(new URL(`../../src/content/events/${/^\d+$/.test(n) ? `evento-exemplo-${n}` : n}.yaml`, import.meta.url)), 'utf8'), { schema: 'core', customTags: ['timestamp'] });

describe('fallback language: ru -> en -> pt', () => {
  const data = { title: { pt: 'Título', en: 'Title', ru: 'Заголовок' }, list: [{ pt: 'a', en: 'b' }], when: new Date('2026-01-01') };

  it('uses the Russian text when the event is ready for it', () => {
    expect(localize(data, true).title.ru).toBe('Заголовок');
  });
  it('uses the English text when the event is not ready, even if some Russian text exists', () => {
    expect(localize(data, false).title.ru).toBe('Title');
  });
  it('uses English when Russian is missing, and Portuguese when English is empty too', () => {
    expect(localize(data, true).list[0]!.ru).toBe('b');
    expect(localize({ pt: 'só pt', en: '  ' }, true).ru).toBe('só pt');
  });
  it('keeps pt and en as they are and leaves dates and other values alone', () => {
    const out = localize(data, false);
    expect(out.title.pt).toBe('Título');
    expect(out.title.en).toBe('Title');
    expect(out.when).toBeInstanceOf(Date);
  });
  it('the chain in the routes agrees: ru goes to en, then pt; en to pt; pt to nothing', () => {
    expect(FALLBACK_CHAIN).toEqual({ pt: [], en: ['pt'], ru: ['en', 'pt'] });
  });
});

describe('ru_ready in the schema', () => {
  it('an event without Russian and ru_ready false is valid (the default)', () => {
    const e = event('17');
    expect(e.ru_ready).toBeUndefined();
    const parsed = eventSchema.safeParse(e);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.ru_ready).toBe(false);
  });
  it('ru_ready true without Russian texts fails, naming the field and the language ru', () => {
    const parsed = eventSchema.safeParse({ ...event('17'), ru_ready: true });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const paths = parsed.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('slug.ru');
      expect(paths).toContain('title.ru');
      expect(paths).toContain('hook.ru');
      expect(paths).toContain('story.ru');
      expect(paths).toContain('more.ru');
      expect(paths).toContain('bridge.note.ru');
      expect(paths.every((p) => p.endsWith('.ru'))).toBe(true);
    }
  });
  it('the real cards are ready in Russian and valid; the Russian texts sit in every text object', () => {
    for (const n of ['aljubarrota-1385', 'cantino-1502', 'casa-da-neve-1782', 'douro-1756', 'elefantes-malaca-1511', 'guerra-laranjas-1801', 'legiao-portuguesa-1812', 'motim-companhia-1757', 'ponte-das-barcas-1809', 'rinoceronte-1515', 'terramoto-1755', 'torres-vedras-1810', 'tripeiros-1415']) {
      const e = event(n);
      expect(e.ru_ready).toBe(true);
      expect(eventSchema.safeParse(e).success, n).toBe(true);
      expect(missingRu(e), n).toEqual([]);
    }
  });
  it('the test cards of the Estado Novo epoch are not ready in Russian', () => {
    for (const n of ['17', '18', '24']) expect(event(n).ru_ready).toBeUndefined();
  });
  it('missingRu lists the paths of text objects without ru, including inside lists', () => {
    expect(missingRu({ a: { pt: 'x', en: 'y' }, g: [{ label: { pt: 'x', en: 'y', ru: 'z' } }, { label: { pt: 'x', en: 'y' } }] })).toEqual(['a', 'g[1].label']);
  });
  it('the Russian texts of the test events follow the same length rules', () => {
    for (const n of ['aljubarrota-1385', 'cantino-1502', 'casa-da-neve-1782', 'douro-1756', 'elefantes-malaca-1511', 'guerra-laranjas-1801', 'legiao-portuguesa-1812', 'motim-companhia-1757', 'ponte-das-barcas-1809', 'rinoceronte-1515', 'terramoto-1755', 'torres-vedras-1810', 'tripeiros-1415']) {
      const e = event(n);
      const words = (s: string) => s.trim().split(/\s+/).length;
      expect(words(e.hook.ru), `${n} hook`).toBeLessThanOrEqual(12);
      expect(words(e.story.ru), `${n} story`).toBeGreaterThanOrEqual(40);
      expect(words(e.story.ru), `${n} story`).toBeLessThanOrEqual(90);
      expect(words(e.more.ru), `${n} more`).toBeLessThanOrEqual(250);
    }
  });
});

describe('addresses', () => {
  it('Russian has an address for every page and a segment for cards, epochs and threads', () => {
    for (const key of Object.keys(ROUTES) as (keyof typeof ROUTES)[]) expect(ROUTES[key].ru, key).toBeDefined();
    expect([STORY_SEGMENT.ru, EPOCH_SEGMENT.ru, THREAD_SEGMENT.ru]).toEqual(['istoriya', 'epoha', 'niti']);
    expect(pagePath('ru', 'map')).toBe('/ru/karta/');
    expect(pagePath('ru', 'home')).toBe('/ru/');
    expect(storyPath('ru', 'abc')).toBe('/ru/istoriya/abc/');
  });
  it('slugs and static addresses are Latin lower case with hyphens', () => {
    for (const key of Object.keys(ROUTES) as (keyof typeof ROUTES)[]) expect(ROUTES[key].ru).toMatch(/^[a-z0-9-]*$/);
  });
  it('altPaths builds the same page in every language', () => {
    expect(altPaths((l) => `/${l}/x/`)).toEqual({ pt: '/pt/x/', en: '/en/x/', ru: '/ru/x/' });
    expect(LANGS).toEqual(['pt', 'en', 'ru']);
  });
});

describe('the root chooses the language', () => {
  it('a saved choice wins over the browser', () => {
    expect(chooseLang('ru', 'en-GB')).toBe('ru');
    expect(chooseLang('pt', 'ru-RU')).toBe('pt');
    expect(chooseLang('en', 'ru')).toBe('en');
  });
  it('without a saved choice the browser language decides: ru -> ru, en -> en, anything else -> pt', () => {
    expect(chooseLang(null, 'ru-RU')).toBe('ru');
    expect(chooseLang(null, 'ru')).toBe('ru');
    expect(chooseLang(undefined, 'en-US')).toBe('en');
    expect(chooseLang(null, 'EN')).toBe('en');
    expect(chooseLang(null, 'pt-BR')).toBe('pt');
    expect(chooseLang(null, 'de-DE')).toBe('pt');
    expect(chooseLang(null, '')).toBe('pt');
    expect(chooseLang(null, undefined)).toBe('pt');
  });
  it('an unknown or damaged saved value is ignored', () => {
    expect(chooseLang('de', 'ru-RU')).toBe('ru');
    expect(chooseLang('', 'en')).toBe('en');
    expect(chooseLang('constructor', 'de')).toBe('pt');
  });

  const hrefs = { pt: '/pt/', en: '/en/', ru: '/ru/' };
  const run = (saved: string | null, language: string, throws = false) => {
    let went = '';
    runInNewContext(rootScript(hrefs), {
      localStorage: { getItem: () => (throws ? (() => { throw new Error('blocked'); })() : saved) },
      navigator: { language },
      location: { replace: (to: string) => void (went = to) },
      String,
      Object,
    });
    return went;
  };
  it('the inline script goes where chooseLang says, for every combination', () => {
    for (const saved of [null, 'pt', 'en', 'ru', 'de', '', 'constructor']) {
      for (const language of ['ru-RU', 'ru', 'en-GB', 'pt-PT', 'de', '', 'RU']) {
        expect(run(saved, language), `${saved} / ${language}`).toBe(hrefs[chooseLang(saved, language)]);
      }
    }
  });
  it('the inline script survives blocked storage', () => {
    expect(run(null, 'ru-RU', true)).toBe('/ru/');
    expect(run(null, 'fr', true)).toBe('/pt/');
  });
});

describe('Russian interface strings and plurals', () => {
  it('has all the keys of Portuguese (check:i18n also checks this at build)', () => {
    expect(t('ru', 'nav.map')).toBe('Карта');
    expect(has('ru', 'plural.stories_few')).toBe(true);
    expect(has('pt', 'plural.stories_few')).toBe(false);
  });
  it('picks one, few, many and other for Russian numbers', () => {
    expect([1, 2, 4, 5, 11, 21, 22, 25, 0].map((n) => pluralCategory('ru', n))).toEqual(['one', 'few', 'few', 'many', 'many', 'one', 'few', 'many', 'many']);
    expect(plural('ru', 'plural.stories', 1)).toBe('1 история');
    expect(plural('ru', 'plural.stories', 3)).toBe('3 истории');
    expect(plural('ru', 'plural.stories', 5)).toBe('5 историй');
    expect(plural('ru', 'plural.stories', 21)).toBe('21 история');
    expect(plural('ru', 'plural.stories', 12)).toBe('12 историй');
  });
  it('Portuguese and English still have two forms', () => {
    expect(plural('en', 'plural.stories', 1)).toBe('1 story');
    expect(plural('en', 'plural.stories', 2)).toBe('2 stories');
    expect(plural('pt', 'plural.stories', 5)).toBe('5 histórias');
    expect(Object.keys(pluralForms('en', 'map.cluster')).sort()).toEqual(['one', 'other']);
    expect(Object.keys(pluralForms('ru', 'map.cluster')).sort()).toEqual(['few', 'many', 'one', 'other']);
  });
  it('the browser picker agrees with the server for every count and language', () => {
    const locale = { pt: 'pt-PT', en: 'en-US', ru: 'ru-RU' } as const;
    for (const lang of LANGS) {
      const strings = Object.fromEntries(Object.entries(pluralForms(lang, 'map.in_area')).map(([k, v]) => [`in_area_${k}`, v]));
      for (const n of [0, 1, 2, 3, 4, 5, 11, 12, 21, 22, 100, 101]) {
        expect(pickPlural(strings, 'in_area', n, locale[lang]).replace('{n}', String(n)), `${lang} ${n}`).toBe(plural(lang, 'map.in_area', n));
      }
    }
  });
});

describe('text language and stand-in pages', () => {
  it('a card not ready in Russian is a stand-in only on /ru/', () => {
    expect(isRuStandIn({ ru_ready: false }, 'ru')).toBe(true);
    expect(isRuStandIn({ ru_ready: false }, 'en')).toBe(false);
    expect(isRuStandIn({ ru_ready: true }, 'ru')).toBe(false);
  });
  it('marks the language of the text that differs from the page', () => {
    expect(textLangOf({ placeholder: false, ru_ready: false }, 'ru')).toBe('en');
    expect(textLangOf({ placeholder: false, ru_ready: true }, 'ru')).toBeUndefined();
    expect(textLangOf({ placeholder: false, ru_ready: false }, 'pt')).toBeUndefined();
    expect(textLangOf({ placeholder: true, ru_ready: false }, 'ru')).toBe('la');
    expect(textLangOf({ placeholder: true, ru_ready: true }, 'ru')).toBeUndefined();
    expect(textLangOf({ placeholder: true, ru_ready: true }, 'pt')).toBe('la');
  });
});

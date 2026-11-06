import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { mythListSchema, type MythData } from '../../src/data/schemas';
import { ROUTES, mythPath, pagePath } from '../../src/i18n/routes';
import { ANSWER_MAX_WORDS, STATEMENT_MAX_WORDS, answerEvent, liveMyths, mythsInOrder, withStatement, wordCount } from '../../src/lib/myths';

const myth = (id: string, story = `story-${id}`): MythData => ({ id, story, verdict: 'myth', statement: { pt: 'a', en: 'b', ru: 'в' }, answer: { pt: 'a', en: 'b', ru: 'в' } });

describe('rules', () => {
  it('counts words', () => {
    expect(wordCount('  Лифт Санта-Жушта   построил Эйфель ')).toBe(4);
    expect(wordCount('')).toBe(0);
  });

  it('keeps the claims whose story is on the site and is not a heavy topic', () => {
    const list = [myth('a'), myth('b'), myth('c')];
    const events = [{ id: 'story-a', sensitive: false }, { id: 'story-c', sensitive: true }];
    expect(liveMyths(list, events).map((m) => m.id)).toEqual(['a']);
  });

  it('puts the claim of the address first and keeps the order of the rest', () => {
    const list = [myth('a'), myth('b'), myth('c'), myth('d')];
    expect(mythsInOrder(list, 'c').map((m) => m.id)).toEqual(['c', 'a', 'b', 'd']);
    expect(mythsInOrder(list).map((m) => m.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(mythsInOrder(list, 'nope').map((m) => m.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('fills a template with the statement and drops a mark at its end', () => {
    expect(withStatement('{statement}. Миф или правда?', 'Укулеле придумали на Гавайях')).toBe('Укулеле придумали на Гавайях. Миф или правда?');
    expect(withStatement('Миф или правда: {statement}?', 'Слон испугался носорога?')).toBe('Миф или правда: Слон испугался носорога?');
  });

  it('names the counter event of an answer', () => {
    expect(answerEvent('lello')).toBe('myth-lello');
  });
});

describe('addresses', () => {
  it('the page and the card have the pattern of the other service pages', () => {
    expect(ROUTES.myths).toEqual({ pt: 'mito-ou-verdade', en: 'myth-or-fact', ru: 'mif-ili-pravda' });
    expect(pagePath('ru', 'myths')).toBe('/ru/mif-ili-pravda/');
    expect(mythPath('pt', 'lello')).toBe('/pt/mito-ou-verdade/lello/');
    expect(mythPath('en', 'lello')).toBe('/en/myth-or-fact/lello/');
  });
});

describe('src/content/myths.yaml', () => {
  const root = join(__dirname, '../..');
  const list = mythListSchema.parse(parse(readFileSync(join(root, 'src/content/myths.yaml'), 'utf8')));
  const stories = new Map(
    readdirSync(join(root, 'src/content/events'))
      .filter((f) => f.endsWith('.yaml'))
      .map((f) => {
        const e = parse(readFileSync(join(root, 'src/content/events', f), 'utf8'));
        return [e.id as string, e] as const;
      }),
  );

  it('has claims, with no id twice', () => {
    expect(list.length).toBeGreaterThan(0);
    expect(new Set(list.map((m) => m.id)).size).toBe(list.length);
  });

  it('rests every claim on a ready story that is not a heavy topic', () => {
    for (const m of list) {
      const s = stories.get(m.story);
      expect(s, `${m.id}: story ${m.story}`).toBeDefined();
      expect(s.status, m.id).toBe('ready');
      expect(s.sensitive, m.id).toBe(false);
    }
  });

  it('keeps the texts within the limits in every language', () => {
    for (const m of list)
      for (const lang of ['pt', 'en', 'ru'] as const) {
        expect(wordCount(m.statement[lang]), `${m.id} ${lang} statement`).toBeLessThanOrEqual(STATEMENT_MAX_WORDS);
        expect(wordCount(m.answer[lang]), `${m.id} ${lang} answer`).toBeLessThanOrEqual(ANSWER_MAX_WORDS);
      }
  });
});

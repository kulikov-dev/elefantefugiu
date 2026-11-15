import { describe, expect, it } from 'vitest';
import type { GlossaryTerm } from '../../src/data/schemas';
import { GLOSSARY } from '../../src/lib/glossary-data';
import { FESTAS } from '../../src/lib/festas-data';
import { inlineMatchers, markParagraph, mentioningStories, renderMark, termRegex } from '../../src/lib/glossary';

// Small terms of the test's own: the real file is checked at the end for its shape.
const term = (id: string, ru: string[], en: string[], over: Partial<GlossaryTerm> = {}): GlossaryTerm => ({
  id,
  term: id,
  inline: true,
  name: { ru: id, en: id },
  forms: { ru, en },
  text: { ru: `ru ${id}`, en: `en ${id}` },
  ...over,
});
const baixa = term('baixa', ['Байш*'], ['Baixa']);
const chiado = term('chiado', ['Шиаду'], ['Chiado']);
const html = (text: string, terms: GlossaryTerm[], lang: 'ru' | 'en', seen = new Set<string>()) =>
  markParagraph(text, inlineMatchers(terms, lang), seen, (t, matched) => `[${t.id}:${matched}]`);

describe('termRegex', () => {
  it('finds the forms of a word and `*` stands for an ending', () => {
    const re = termRegex(baixa, 'ru')!;
    expect('Байша, Байшу, Байши, Байше'.match(re)).toEqual(['Байша', 'Байшу', 'Байши', 'Байше']);
  });
  it('is case-insensitive and finds whole words only', () => {
    const re = termRegex(chiado, 'en')!;
    expect('the chiado and CHIADO'.match(re)).toEqual(['chiado', 'CHIADO']);
    expect('Chiadox'.match(re)).toBeNull();
    expect('xChiado'.match(re)).toBeNull();
  });
  it('does not take a word out of a hyphenated name', () => {
    const re = termRegex(term('prata', ['Прата'], []), 'ru')!;
    expect('Руа-да-Прата'.match(re)).toBeNull();
    expect('на Прата-стрит'.match(re)).toBeNull();
    expect('Прата, и'.match(re)).toEqual(['Прата']);
  });
  it('escapes the characters of a form that are regex syntax', () => {
    const re = termRegex(term('x', ['а.б'], []), 'ru')!;
    expect('аxб'.match(re)).toBeNull();
    expect('а.б'.match(re)).toEqual(['а.б']);
  });
  it('is undefined for a language without forms', () => {
    expect(termRegex(term('x', ['а'], []), 'en')).toBeUndefined();
  });
});

describe('markParagraph', () => {
  it('marks the first mention only, across paragraphs sharing `seen`', () => {
    const seen = new Set<string>();
    expect(html('Байша и снова Байша.', [baixa], 'ru', seen)).toBe('[baixa:Байша] и снова Байша.');
    expect(html('Ещё раз Байшу.', [baixa], 'ru', seen)).toBe('Ещё раз Байшу.');
  });
  it('marks several words in the order they stand in the text', () => {
    expect(html('Шиаду над Байшей', [baixa, chiado], 'ru')).toBe('[chiado:Шиаду] над [baixa:Байшей]');
  });
  it('escapes the text around the marks', () => {
    expect(html('<b>Chiado</b> & "x"', [chiado], 'en')).toBe('&lt;b&gt;[chiado:Chiado]&lt;/b&gt; &amp; &quot;x&quot;');
  });
  it('leaves a word that is not inline, and a language without forms, unmarked', () => {
    expect(html('Chiado', [term('chiado', [], ['Chiado'], { inline: false })], 'en')).toBe('Chiado');
    expect(html('Chiado', [term('chiado', ['Шиаду'], [])], 'en')).toBe('Chiado');
  });
});

describe('renderMark', () => {
  it('makes a button, a tooltip with the text and the link to the word on the glossary page', () => {
    const out = renderMark(term('baixa', [], [], { text: { ru: 'нижний <город>', en: 'lower' } }), 'Байша', 'ru', '/ru/slovarik/', 'Все слова →');
    expect(out).toContain('<button type="button" class="gl__term" aria-describedby="gl-baixa">Байша</button>');
    expect(out).toContain('id="gl-baixa"');
    expect(out).toContain('нижний &lt;город&gt;');
    expect(out).toContain('href="/ru/slovarik/#baixa"');
    expect(out).toContain('data-pagefind-ignore');
  });
});

describe('mentioningStories', () => {
  const texts = [
    { id: 'a', text: 'В Байше' },
    { id: 'b', text: 'ничего' },
    { id: 'c', text: 'Байша ещё раз' },
  ];
  it('lists the stories whose text has a form of the word', () => {
    expect(mentioningStories(baixa, 'ru', texts)).toEqual(['a', 'c']);
  });
  it('lists none for a language without forms', () => {
    expect(mentioningStories(term('x', ['Байш*'], []), 'en', texts)).toEqual([]);
  });
});

describe('the glossary file', () => {
  it('has unique ids and a text, a name and the forms in ru and en', () => {
    expect(new Set(GLOSSARY.map((t) => t.id)).size).toBe(GLOSSARY.length);
    for (const t of GLOSSARY) for (const lang of ['ru', 'en'] as const) expect(t.text[lang].length, `${t.id} ${lang}`).toBeGreaterThan(10);
  });
  it('has forms in some language for every inline word', () => {
    for (const t of GLOSSARY.filter((x) => x.inline)) expect(t.forms.ru.length + t.forms.en.length, t.id).toBeGreaterThan(0);
  });
  it('names only the holidays that exist', () => {
    const ids = new Set(FESTAS.map((f) => f.id));
    for (const t of GLOSSARY.filter((x) => x.festa)) expect(ids.has(t.festa!), t.id).toBe(true);
  });
});

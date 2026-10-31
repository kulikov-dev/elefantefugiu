import { describe, expect, it } from 'vitest';
import { OG_DESCRIPTION_MAX, OG_TITLE_MAX, cutAtWord, ogDescription, ogTitle } from '../../src/lib/og-text';

describe('cutAtWord', () => {
  it('a text that fits is left as it is (spaces tidied)', () => {
    expect(cutAtWord('O rinoceronte e o elefante', 60)).toBe('O rinoceronte e o elefante');
    expect(cutAtWord('  two   words ', 60)).toBe('two words');
    expect(cutAtWord('a'.repeat(60), 60)).toBe('a'.repeat(60));
  });
  it('a longer text is cut at a word, ends with "…" and is never longer than the limit', () => {
    const text = 'Os doces dos frades, ou talvez a melhor publicidade do século XIX';
    const cut = cutAtWord(text, 60);
    expect(cut.endsWith('…')).toBe(true);
    expect(cut.length).toBeLessThanOrEqual(60);
    expect(text.startsWith(cut.slice(0, -1))).toBe(true);
    expect(cut).toBe('Os doces dos frades, ou talvez a melhor publicidade do…');
  });
  it('no comma or dash is left before the ellipsis, and a word longer than the limit is cut inside', () => {
    expect(cutAtWord('Uma frase, com vírgula, que passa do limite de vinte', 22)).toBe('Uma frase, com…');
    expect(cutAtWord('x'.repeat(100), 10)).toBe(`${'x'.repeat(9)}…`);
  });
});

describe('the texts of a preview', () => {
  it('the title is cut at 60 characters, the description (the hook) at 200', () => {
    expect(OG_TITLE_MAX).toBe(60);
    expect(OG_DESCRIPTION_MAX).toBe(200);
    expect(ogTitle('Curto')).toBe('Curto');
    const hook = `${'palavra '.repeat(40)}fim`;
    expect(ogDescription(hook).length).toBeLessThanOrEqual(200);
    expect(ogDescription('Uma linha só.')).toBe('Uma linha só.');
  });
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { azulejoRule, cssUrl, DEFAULT_PATTERN, DIRECTED, EPOCH_PATTERN, patternFor, stripPatternFor, waitPatternFor } from '../../src/lib/azulejo';

const files = {
  bussola: '/b/bussola.svg',
  rombo: '/b/rombo.svg',
  rosa: '/b/rosa.svg',
  no: '/b/no.svg',
  'no-v': '/b/no-v.svg',
  tapete: '/b/tapete.svg',
  onda: '/b/onda.svg',
  'onda-v': '/b/onda-v.svg',
  canto: '/b/canto.svg',
  estrela: '/b/estrela.svg',
  xadrez: '/b/xadrez.svg',
  'xadrez-v': '/b/xadrez-v.svg',
  pegada: '/b/pegada.svg',
  'pegada-v': '/b/pegada-v.svg',
};
const epochIds: string[] = parse(readFileSync('src/content/epochs.yaml', 'utf8')).filter((e: { mvp?: boolean }) => e.mvp).map((e: { id: string }) => e.id);

describe('azulejo patterns', () => {
  it('each open (MVP) epoch has a pattern of its own, and the file of it exists', () => {
    expect(epochIds.length).toBeGreaterThan(0);
    for (const id of epochIds) expect(EPOCH_PATTERN[id], id).toBeDefined();
    expect(new Set(epochIds.map((id) => EPOCH_PATTERN[id])).size).toBe(epochIds.length);
    for (const name of Object.values(EPOCH_PATTERN)) expect(() => readFileSync(`src/assets/azulejo/${name}.svg`), name).not.toThrow();
  });

  it('the old epochs keep their patterns; the new ones have knot, carpet and waves', () => {
    expect(EPOCH_PATTERN['avis-e-descobrimentos']).toBe('bussola');
    expect(EPOCH_PATTERN['pombal-e-terramoto']).toBe('rombo');
    expect(EPOCH_PATTERN['estado-novo-e-25-de-abril']).toBe('rosa');
    expect(EPOCH_PATTERN['lusitania-e-roma']).toBe('no');
    expect(EPOCH_PATTERN['uniao-restauracao-e-ouro-do-brasil']).toBe('tapete');
    expect(EPOCH_PATTERN['monarquia-e-republica']).toBe('onda');
  });

  it('the epochs prepared for later have their patterns already (star-and-cross, chequer band, footprints), all different from the others', () => {
    expect(EPOCH_PATTERN['suevos-visigodos-e-mouros']).toBe('estrela');
    expect(EPOCH_PATTERN['nascimento-do-reino-e-reconquista']).toBe('xadrez');
    expect(EPOCH_PATTERN['antes-de-portugal']).toBe('pegada');
    const names = Object.values(EPOCH_PATTERN);
    expect(new Set(names).size).toBe(names.length);
    expect(stripPatternFor('antes-de-portugal')).toBe('pegada-v');
    expect(stripPatternFor('suevos-visigodos-e-mouros')).toBe('estrela');
    expect(stripPatternFor('nascimento-do-reino-e-reconquista')).toBe('xadrez-v');
  });

  it('pages outside an epoch get the default pattern', () => {
    expect(patternFor(undefined)).toBe(DEFAULT_PATTERN);
    expect(patternFor('an-epoch-that-does-not-exist')).toBe(DEFAULT_PATTERN);
  });

  it('the waiting tile is the pattern of the epoch, never the rose (that one gives the compass)', () => {
    expect(waitPatternFor('avis-e-descobrimentos')).toBe('bussola');
    expect(waitPatternFor('pombal-e-terramoto')).toBe('rombo');
    expect(waitPatternFor('estado-novo-e-25-de-abril')).toBe('bussola');
    expect(waitPatternFor('lusitania-e-roma')).toBe('no');
    expect(waitPatternFor('monarquia-e-republica')).toBe('onda');
    expect(waitPatternFor(undefined)).toBe('bussola');
  });

  it('cssUrl keeps quotes and backslashes from breaking the inline style', () => {
    expect(cssUrl('/a/b.svg')).toBe('url("/a/b.svg")');
    expect(cssUrl('data:image/svg+xml,a"b\\c')).toBe('url("data:image/svg+xml,a%22b%5Cc")');
  });

  it('azulejoRule names the pattern of the epoch and the corner', () => {
    expect(azulejoRule(files, 'pombal-e-terramoto')).toBe(':root{--azulejo-url:url("/b/rombo.svg");--azulejo-strip-url:url("/b/rombo.svg");--azulejo-wait-url:url("/b/rombo.svg");--azulejo-corner-url:url("/b/canto.svg")}');
    expect(azulejoRule(files, undefined)).toContain('--azulejo-url:url("/b/bussola.svg")');
  });

  it('the vertical strip of a directed pattern (braid, waves) has its own turned tile, the others use the same file', () => {
    for (const id of Object.keys(EPOCH_PATTERN)) {
      const own = patternFor(id);
      const strip = stripPatternFor(id);
      expect(strip, id).toBe(DIRECTED.includes(own) ? `${own}-v` : own);
      expect(() => readFileSync(`src/assets/azulejo/${strip}.svg`), strip).not.toThrow();
    }
    expect(DIRECTED.length).toBeGreaterThan(0);
    for (const name of DIRECTED) expect(readFileSync(`src/assets/azulejo/${name}-v.svg`, 'utf8')).toContain('rotate(90 40 40)');
    expect(azulejoRule(files, 'monarquia-e-republica')).toContain('--azulejo-strip-url:url("/b/onda-v.svg")');
    expect(azulejoRule(files, 'lusitania-e-roma')).toContain('--azulejo-strip-url:url("/b/no-v.svg")');
  });
});

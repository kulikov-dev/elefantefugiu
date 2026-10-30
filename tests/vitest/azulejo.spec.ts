import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { azulejoRule, cssUrl, DEFAULT_PATTERN, EPOCH_PATTERN, patternFor, waitPatternFor } from '../../src/lib/azulejo';

const files = {
  bussola: '/b/bussola.svg',
  rombo: '/b/rombo.svg',
  rosa: '/b/rosa.svg',
  no: '/b/no.svg',
  tapete: '/b/tapete.svg',
  onda: '/b/onda.svg',
  canto: '/b/canto.svg',
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
    expect(azulejoRule(files, 'pombal-e-terramoto')).toBe(':root{--azulejo-url:url("/b/rombo.svg");--azulejo-wait-url:url("/b/rombo.svg");--azulejo-corner-url:url("/b/canto.svg")}');
    expect(azulejoRule(files, undefined)).toContain('--azulejo-url:url("/b/bussola.svg")');
  });
});

import { describe, expect, it } from 'vitest';
import { azulejoRule, cssUrl, DEFAULT_PATTERN, EPOCH_PATTERN, patternFor, waitPatternFor } from '../../src/lib/azulejo';

const files = { bussola: '/b/bussola.svg', rombo: '/b/rombo.svg', rosa: '/b/rosa.svg', canto: '/b/canto.svg' };

describe('azulejo patterns', () => {
  it('each MVP epoch has its own pattern (compass, rhombus, rose)', () => {
    expect(EPOCH_PATTERN['avis-e-descobrimentos']).toBe('bussola');
    expect(EPOCH_PATTERN['pombal-e-terramoto']).toBe('rombo');
    expect(EPOCH_PATTERN['estado-novo-e-25-de-abril']).toBe('rosa');
  });

  it('pages outside an epoch get the default pattern', () => {
    expect(patternFor(undefined)).toBe(DEFAULT_PATTERN);
    expect(patternFor('lusitania-e-roma')).toBe(DEFAULT_PATTERN);
  });

  it('the waiting tile is the compass or the rhombus, never the rose', () => {
    expect(waitPatternFor('avis-e-descobrimentos')).toBe('bussola');
    expect(waitPatternFor('pombal-e-terramoto')).toBe('rombo');
    expect(waitPatternFor('estado-novo-e-25-de-abril')).toBe('bussola');
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

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ANALYTICS_CONFIG_SCRIPT, GOATCOUNTER_ENDPOINT, analyticsEnabled } from '../../src/lib/analytics';

describe('analyticsEnabled', () => {
  it('counts on a public address only', () => {
    expect(analyticsEnabled('https://elefantefugiu.github.io')).toBe(true);
    expect(analyticsEnabled('https://example.org')).toBe(true);
    expect(analyticsEnabled('http://localhost:4321')).toBe(false);
    expect(analyticsEnabled('http://127.0.0.1:4400')).toBe(false);
    expect(analyticsEnabled('http://192.168.1.5:4321')).toBe(false);
    expect(analyticsEnabled('')).toBe(false);
  });
});

describe('the configuration that runs before count.js', () => {
  const run = (search: string, referrer: string) => {
    const g = { goatcounter: undefined as unknown as { no_events: boolean; referrer: (r: string) => string; path: (p: string) => string } };
    new Function('window', 'location', ANALYTICS_CONFIG_SCRIPT)(g, { search });
    return { no_events: g.goatcounter.no_events, referrer: g.goatcounter.referrer(referrer), path: g.goatcounter.path };
  };

  it('counts page views only (no click events)', () => {
    expect(run('', '').no_events).toBe(true);
  });

  it('sends ?src=... as the referrer, else the real referrer', () => {
    expect(run('?src=qr', 'https://example.org/').referrer).toBe('qr');
    expect(run('?a=1&src=reddit', '').referrer).toBe('reddit');
    expect(run('?src=ig&b=2', '').referrer).toBe('ig');
    expect(run('', 'https://example.org/').referrer).toBe('https://example.org/');
    expect(run('?source=x', 'r').referrer).toBe('r');
  });

  it('counts the page without its query, so a QR visit and a plain visit are one page', () => {
    const { path } = run('?src=qr', '');
    expect(path('/pt/historia/x/?src=qr')).toBe('/pt/historia/x/');
    expect(path('/pt/mapa/?card=a&f=b#c')).toBe('/pt/mapa/');
    expect(path('/pt/')).toBe('/pt/');
  });

  it('takes only a short, plain name', () => {
    expect(run('?src=<script>', 'r').referrer).toBe('r');
    expect(run('?src=' + 'a'.repeat(33), 'r').referrer).toBe('r');
  });
});

describe('the copy of count.js', () => {
  const file = readFileSync(new URL('../../public/vendor/goatcounter/count.js', import.meta.url), 'utf8');

  it('is GoatCounter count.js under the ISC licence', () => {
    expect(file).toMatch(/GoatCounter: https:\/\/www\.goatcounter\.com/);
    expect(file).toMatch(/ISC license/);
  });

  it('sends nothing to any address but the one in data-goatcounter', () => {
    expect(file).not.toMatch(/gc\.zgo\.at|goatcounter\.com\/count/);
    expect(GOATCOUNTER_ENDPOINT).toBe('https://elefantefugiu.goatcounter.com/count');
  });
});

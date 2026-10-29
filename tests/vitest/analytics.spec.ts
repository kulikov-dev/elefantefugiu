import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { rootScript } from '../../src/lib/lang-choice';
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
  type Config = { no_events: boolean; referrer: (r: string) => string; path: (p: string) => string; get_data?: (v?: unknown) => { q?: string } };
  const run = (search: string, referrer: string, hostname = 'elefantefugiu.pt') => {
    const g = { goatcounter: undefined as unknown as Config };
    new Function('window', 'location', ANALYTICS_CONFIG_SCRIPT)(g, { search, hostname });
    return { g, no_events: g.goatcounter.no_events, referrer: g.goatcounter.referrer(referrer), path: g.goatcounter.path };
  };
  it('counts page views only (no click events)', () => {
    expect(run('', '').no_events).toBe(true);
  });

  it('sends ?src=... as the referrer, else the referrer of another site as it is', () => {
    expect(run('?src=qr', 'https://example.org/').referrer).toBe('qr');
    expect(run('?a=1&src=reddit', '').referrer).toBe('reddit');
    expect(run('?src=ig&b=2', '').referrer).toBe('ig');
    expect(run('', 'https://example.org/').referrer).toBe('https://example.org/');
    expect(run('?source=x', 'https://example.org/').referrer).toBe('https://example.org/');
    expect(run('', 'android-app://org.telegram.messenger/').referrer).toBe('android-app://org.telegram.messenger/');
  });

  it('sends no referrer for a direct visit and for a move inside the site (also with www)', () => {
    expect(run('', '').referrer).toBe('');
    expect(run('', 'https://elefantefugiu.pt/pt/historia/x/').referrer).toBe('');
    expect(run('', 'https://www.elefantefugiu.pt/').referrer).toBe('');
    expect(run('', 'https://ELEFANTEFUGIU.pt/pt/').referrer).toBe('');
    expect(run('', 'not an address').referrer).toBe('');
  });

  it('tells the old address of the site (kulikov-dev.github.io) as one name', () => {
    expect(run('', 'https://kulikov-dev.github.io/elefantefugiu/pt/').referrer).toBe('old-domain');
    expect(run('', 'https://kulikov-dev.github.io/').referrer).toBe('old-domain');
    expect(run('?src=qr', 'https://kulikov-dev.github.io/').referrer).toBe('qr');
  });

  it('takes ?utm_source=... as a synonym of src, and src wins when both are there', () => {
    expect(run('?utm_source=newsletter', 'https://example.org/').referrer).toBe('newsletter');
    expect(run('?a=1&utm_source=instagram.com&b=2', '').referrer).toBe('instagram.com');
    expect(run('?utm_source=news&src=qr', '').referrer).toBe('qr');
    expect(run('?utm_source=<script>', 'https://example.org/').referrer).toBe('https://example.org/');
  });

  it('counts the page without its query, so a QR visit and a plain visit are one page', () => {
    const { path } = run('?src=qr', '');
    expect(path('/pt/historia/x/?src=qr')).toBe('/pt/historia/x/');
    expect(path('/pt/mapa/?card=a&f=b#c')).toBe('/pt/mapa/');
    expect(path('/pt/')).toBe('/pt/');
  });

  it('takes only a short, plain name', () => {
    expect(run('?src=<script>', 'https://example.org/').referrer).toBe('https://example.org/');
    expect(run('?src=' + 'a'.repeat(33), '').referrer).toBe('');
  });
});

describe('the root page and /p/{id} keep the query when they redirect (src/lib/lang-choice.ts)', () => {
  const go = (target: string, search: string, hash = '') => {
    let went = '';
    runInNewContext(rootScript({ pt: target, en: target, ru: target }), {
      localStorage: { getItem: () => null },
      navigator: { language: 'pt-PT' },
      location: { search, hash, replace: (to: string) => void (went = to) },
      String,
      Object,
    });
    return went;
  };
  it('passes ?src and any other query on, with the hash', () => {
    expect(go('/pt/', '?src=ig')).toBe('/pt/?src=ig');
    expect(go('/pt/', '?utm_source=news&x=1', '#a')).toBe('/pt/?utm_source=news&x=1#a');
    expect(go('/pt/', '')).toBe('/pt/');
  });
  it('on /p/{id} the default ?src=qr stays unless the reader came with one of their own', () => {
    expect(go('/pt/historia/x/?src=qr', '')).toBe('/pt/historia/x/?src=qr');
    expect(go('/pt/historia/x/?src=qr', '?src=ig')).toBe('/pt/historia/x/?src=ig');
    expect(go('/pt/historia/x/?src=qr', '?utm_source=news')).toBe('/pt/historia/x/?src=qr&utm_source=news');
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

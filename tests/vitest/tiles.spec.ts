import { describe, expect, it } from 'vitest';
import { CARTO_ATTRIBUTION, DEFAULT_TILE_ATTRIBUTION, DEFAULT_TILE_URL, isDarkTheme, tileConfig, tileUrlFor } from '../../src/lib/tiles';

describe('tileConfig', () => {
  it('uses OpenStreetMap when nothing is set', () => {
    expect(tileConfig({})).toEqual({ url: DEFAULT_TILE_URL, attribution: DEFAULT_TILE_ATTRIBUTION, isDefault: true });
    expect(tileConfig({ TILE_URL: '  ', TILE_ATTRIBUTION: '' }).isDefault).toBe(true);
  });

  it('takes a custom provider with its attribution', () => {
    const c = tileConfig({ TILE_URL: 'https://tiles.example.com/{z}/{x}/{y}.png', TILE_ATTRIBUTION: '© Example' });
    expect(c).toEqual({ url: 'https://tiles.example.com/{z}/{x}/{y}.png', attribution: '© Example', isDefault: false });
  });

  it('refuses a custom URL without attribution, without https or without placeholders', () => {
    expect(() => tileConfig({ TILE_URL: 'https://t.example.com/{z}/{x}/{y}.png' })).toThrow(/TILE_ATTRIBUTION/);
    expect(() => tileConfig({ TILE_URL: 'http://t.example.com/{z}/{x}/{y}.png', TILE_ATTRIBUTION: 'x' })).toThrow(/https/);
    expect(() => tileConfig({ TILE_URL: 'https://t.example.com/{z}/{x}.png', TILE_ATTRIBUTION: 'x' })).toThrow(/\{y\}/);
  });

  it('allows a custom attribution on the default server', () => {
    expect(tileConfig({ TILE_ATTRIBUTION: 'custom' }).attribution).toBe('custom');
  });
});

describe('CARTO basemaps', () => {
  const carto = tileConfig({ CARTO_KEY: 'abc-123_X' });

  it('with a key: Voyager for the light theme, Dark Matter for the dark one, the key as a parameter', () => {
    expect(carto.url).toBe('https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=abc-123_X');
    expect(carto.urlDark).toBe('https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png?key=abc-123_X');
    expect(carto.isDefault).toBe(false);
  });

  it('the attribution names OpenStreetMap contributors and CARTO, both with a link', () => {
    expect(carto.attribution).toBe(CARTO_ATTRIBUTION);
    expect(CARTO_ATTRIBUTION).toMatch(/<a href="https:\/\/www\.openstreetmap\.org\/copyright"[^>]*>OpenStreetMap<\/a> contributors/);
    expect(CARTO_ATTRIBUTION).toMatch(/<a href="https:\/\/carto\.com\/attributions"[^>]*>CARTO<\/a>/);
  });

  it('no key means the old OpenStreetMap server and no dark style', () => {
    expect(tileConfig({ CARTO_KEY: '  ' })).toEqual({ url: DEFAULT_TILE_URL, attribution: DEFAULT_TILE_ATTRIBUTION, isDefault: true });
    expect(tileConfig({}).urlDark).toBeUndefined();
  });

  it('a key that could change the address is refused', () => {
    expect(() => tileConfig({ CARTO_KEY: 'a&b=c' })).toThrow(/CARTO_KEY/);
    expect(() => tileConfig({ CARTO_KEY: 'a/../b' })).toThrow(/CARTO_KEY/);
  });

  it('TILE_URL with its attribution wins over the key', () => {
    const c = tileConfig({ CARTO_KEY: 'k', TILE_URL: 'https://t.example.com/{z}/{x}/{y}.png', TILE_ATTRIBUTION: '© Example' });
    expect(c.url).toBe('https://t.example.com/{z}/{x}/{y}.png');
    expect(c.urlDark).toBeUndefined();
  });
});

describe('the tiles follow the theme', () => {
  it('an explicit choice wins over the device, "system" and a missing attribute follow the device', () => {
    expect(isDarkTheme('dark', false)).toBe(true);
    expect(isDarkTheme('light', true)).toBe(false);
    expect(isDarkTheme('system', true)).toBe(true);
    expect(isDarkTheme(null, true)).toBe(true);
    expect(isDarkTheme(null, false)).toBe(false);
  });

  it('the dark address only when there is one', () => {
    const tile = { url: 'light', urlDark: 'dark' };
    expect(tileUrlFor(tile, true)).toBe('dark');
    expect(tileUrlFor(tile, false)).toBe('light');
    expect(tileUrlFor({ url: 'light' }, true)).toBe('light');
  });
});


import { describe, expect, it } from 'vitest';
import { DEFAULT_TILE_ATTRIBUTION, DEFAULT_TILE_URL, tileConfig } from '../../src/lib/tiles';

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

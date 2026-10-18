import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { normalizeFamilyMode } from '../../src/lib/family';
import { headScript } from '../../src/lib/head-script';
import { normalizeTheme, THEME_COLORS } from '../../src/lib/theme';

/** Runs the script against a fake page and returns the attributes it set on <html>. */
function run(options: { stored?: string | null; theme?: string | null; search?: string; storageThrows?: boolean; threads?: string[] }) {
  const attrs: Record<string, string> = {};
  const documentElement = { setAttribute: (name: string, value: string) => void (attrs[name] = value) };
  const metas = [{ content: 'x', setAttribute(n: string, v: string) { if (n === 'content') this.content = v; } }, { content: 'y', setAttribute(n: string, v: string) { if (n === 'content') this.content = v; } }];
  const storage = {
    getItem: (key: string) => {
      if (options.storageThrows) throw new Error('blocked');
      if (key === 'theme') return options.theme ?? null;
      return key === 'family' ? (options.stored ?? null) : null;
    },
  };
  runInNewContext(headScript(options.threads ?? ['mar', 'natureza']), {
    document: { documentElement, querySelectorAll: () => metas },
    localStorage: storage,
    location: { search: options.search ?? '' },
    URLSearchParams,
    String,
  });
  return Object.assign(attrs, { __metas: metas.map((m) => m.content) as unknown as string });
}

describe('head script', () => {
  it('sets data-js and data-family="off" when the storage is empty', () => {
    expect(run({})).toMatchObject({ 'data-js': '', 'data-family': 'off', 'data-theme': 'system' });
  });
  it('reads the stored mode', () => {
    expect(run({ stored: 'all' })['data-family']).toBe('all');
    expect(run({ stored: '12' })['data-family']).toBe('12');
    expect(run({ stored: 'off' })['data-family']).toBe('off');
  });
  it('falls back to "off" for an unknown value', () => {
    expect(run({ stored: 'kids' })['data-family']).toBe('off');
    expect(run({ stored: '16' })['data-family']).toBe('off');
  });
  it('still sets data-family and data-js when the storage is blocked', () => {
    expect(run({ storageThrows: true })).toMatchObject({ 'data-js': '', 'data-family': 'off', 'data-theme': 'system' });
  });
  it('agrees with normalizeFamilyMode for every value that can be stored', () => {
    for (const stored of ['all', '12', 'off', ' ALL ', '12+', '', 'x', '16', 'true']) {
      expect(run({ stored })['data-family']).toBe(normalizeFamilyMode(stored));
    }
  });
  it('sets data-vista only for ?vista=grelha', () => {
    expect(run({ search: '?vista=grelha' })['data-vista']).toBe('grelha');
    expect(run({ search: '?vista=other' })['data-vista']).toBeUndefined();
    expect(run({ search: '' })['data-vista']).toBeUndefined();
  });
  it('sets data-fio only for a known thread', () => {
    expect(run({ search: '?fio=mar' })['data-fio']).toBe('mar');
    expect(run({ search: '?fio=nope' })['data-fio']).toBeUndefined();
    expect(run({ search: '?fio=' })['data-fio']).toBeUndefined();
  });
  it('reads fio and vista together, and survives a storage error', () => {
    expect(run({ search: '?fio=natureza&vista=grelha', storageThrows: true })).toMatchObject({
      'data-js': '',
      'data-family': 'off',
      'data-theme': 'system',
      'data-fio': 'natureza',
      'data-vista': 'grelha',
    });
  });
  it('sets data-theme from the stored choice and falls back to system', () => {
    expect(run({ theme: 'dark' })['data-theme']).toBe('dark');
    expect(run({ theme: 'light' })['data-theme']).toBe('light');
    for (const bad of [null, '', 'system', 'sepia', 'DARKISH']) expect(run({ theme: bad })['data-theme']).toBe(bad === 'DARKISH' ? 'system' : 'system');
    expect(run({ theme: ' DARK ' })['data-theme']).toBe(normalizeTheme(' DARK '));
  });
  it('agrees with normalizeTheme for every value that can be stored', () => {
    for (const theme of ['light', 'dark', 'system', ' Light ', '', 'x', '1']) expect(run({ theme })['data-theme']).toBe(normalizeTheme(theme));
  });
  it('paints the browser UI colour only for an explicit theme', () => {
    expect(String(run({ theme: 'dark' }).__metas)).toBe(`${THEME_COLORS.dark},${THEME_COLORS.dark}`);
    expect(String(run({ theme: 'light' }).__metas)).toBe(`${THEME_COLORS.light},${THEME_COLORS.light}`);
    expect(String(run({ theme: 'system' }).__metas)).toBe('x,y');
  });
  it('still sets the theme when the storage is blocked', () => {
    expect(run({ storageThrows: true, theme: 'dark' })['data-theme']).toBe('system');
  });
  it('is short', () => {
    expect(headScript(['a', 'b', 'c', 'd', 'e']).length).toBeLessThan(1100);
  });
});

import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { normalizeFamilyMode } from '../../src/lib/family';
import { headScript } from '../../src/lib/head-script';

/** Runs the script against a fake page and returns the attributes it set on <html>. */
function run(options: { stored?: string | null; search?: string; storageThrows?: boolean; threads?: string[] }) {
  const attrs: Record<string, string> = {};
  const documentElement = { setAttribute: (name: string, value: string) => void (attrs[name] = value) };
  const storage = {
    getItem: (key: string) => {
      if (options.storageThrows) throw new Error('blocked');
      return key === 'family' ? (options.stored ?? null) : null;
    },
  };
  runInNewContext(headScript(options.threads ?? ['mar', 'natureza']), {
    document: { documentElement },
    localStorage: storage,
    location: { search: options.search ?? '' },
    URLSearchParams,
    String,
  });
  return attrs;
}

describe('head script', () => {
  it('sets data-js and data-family="off" when the storage is empty', () => {
    expect(run({})).toEqual({ 'data-js': '', 'data-family': 'off' });
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
    expect(run({ storageThrows: true })).toEqual({ 'data-js': '', 'data-family': 'off' });
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
    expect(run({ search: '?fio=natureza&vista=grelha', storageThrows: true })).toEqual({
      'data-js': '',
      'data-family': 'off',
      'data-fio': 'natureza',
      'data-vista': 'grelha',
    });
  });
  it('is short', () => {
    expect(headScript(['a', 'b', 'c', 'd', 'e']).length).toBeLessThan(700);
  });
});

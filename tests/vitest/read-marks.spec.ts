import { describe, expect, it } from 'vitest';
import { READ_DELAY_MS, READ_LIMIT, addRead, parseRead, readProgress } from '../../src/lib/read-marks';

describe('parseRead', () => {
  it('reads an array of ids and nothing else', () => {
    expect(parseRead('["a","b"]')).toEqual(['a', 'b']);
    expect(parseRead(null)).toEqual([]);
    expect(parseRead('')).toEqual([]);
    expect(parseRead('not json')).toEqual([]);
    expect(parseRead('{"a":1}')).toEqual([]);
    expect(parseRead('["a",1,null,"",{"x":1},"b","a"]')).toEqual(['a', 'b']);
  });
  it('keeps at most READ_LIMIT ids, the newest', () => {
    const many = JSON.stringify(Array.from({ length: READ_LIMIT + 10 }, (_, i) => `s${i}`));
    const list = parseRead(many);
    expect(list).toHaveLength(READ_LIMIT);
    expect(list.at(-1)).toBe(`s${READ_LIMIT + 9}`);
  });
});

describe('addRead', () => {
  it('adds an id once, at the end', () => {
    expect(addRead(['a', 'b'], 'c')).toEqual(['a', 'b', 'c']);
    expect(addRead(['a', 'b'], 'a')).toEqual(['b', 'a']);
    expect(addRead(['a'], '')).toEqual(['a']);
  });
  it('drops the oldest past the limit', () => {
    const full = Array.from({ length: READ_LIMIT }, (_, i) => `s${i}`);
    const next = addRead(full, 'new');
    expect(next).toHaveLength(READ_LIMIT);
    expect(next[0]).toBe('s1');
    expect(next.at(-1)).toBe('new');
  });
});

describe('readProgress', () => {
  const story = (id: string, minAge = 'all', sensitive = false) => ({ id, minAge, sensitive });
  const page = [story('a'), story('b', '12'), story('c', '16'), story('d', 'all', true), story('a')];
  it('counts the different stories of the page that are read', () => {
    expect(readProgress(page, ['a', 'b', 'x'], 'off')).toEqual({ n: 2, m: 4 });
    expect(readProgress([], ['a'], 'off')).toEqual({ n: 0, m: 0 });
    expect(readProgress([story('a')], [], 'off')).toEqual({ n: 0, m: 1 });
  });
  it('counts only the stories the family mode shows, in M and in N', () => {
    expect(readProgress(page, ['a', 'b', 'c', 'd'], 'all')).toEqual({ n: 1, m: 1 });
    expect(readProgress(page, ['a', 'b', 'c', 'd'], '12')).toEqual({ n: 2, m: 2 });
    expect(readProgress(page, ['c', 'd'], 'all')).toEqual({ n: 0, m: 1 });
  });
  it('knows the delay of the mark: twenty seconds', () => {
    expect(READ_DELAY_MS).toBe(20_000);
  });
});

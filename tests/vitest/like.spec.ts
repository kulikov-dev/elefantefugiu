import { describe, expect, it, vi } from 'vitest';
import { isLiked, like, likeKey, likePath } from '../../src/lib/like';

const memory = () => {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), data };
};
const story = { id: 'rinoceronte-1515', title: 'O rinoceronte e o elefante' };

describe('likePath and likeKey', () => {
  it('the path has no language: the id of the story, so pt, en and ru add up', () => {
    expect(likePath('rinoceronte-1515')).toBe('like/rinoceronte-1515');
    expect(likePath('rinoceronte-1515')).not.toMatch(/\/(pt|en|ru)\b/);
    expect(likeKey('rinoceronte-1515')).toBe('like:rinoceronte-1515');
  });
});

describe('like', () => {
  it('sends one event with the path, the title and event: true, and remembers it', () => {
    const count = vi.fn();
    const storage = memory();
    const result = like(story, { counter: { count }, storage, done: new Set() });
    expect(result).toEqual({ already: false, sent: true });
    expect(count).toHaveBeenCalledTimes(1);
    expect(count).toHaveBeenCalledWith({ path: 'like/rinoceronte-1515', title: 'O rinoceronte e o elefante', event: true });
    expect(storage.data.get('like:rinoceronte-1515')).toBe('1');
  });

  it('a second press sends nothing more, in the same page load and after a reload (the key in storage)', () => {
    const count = vi.fn();
    const storage = memory();
    const done = new Set<string>();
    like(story, { counter: { count }, storage, done });
    expect(like(story, { counter: { count }, storage, done })).toEqual({ already: true, sent: false });
    // a new page load: the set is empty, the storage remembers
    expect(like(story, { counter: { count }, storage, done: new Set() })).toEqual({ already: true, sent: false });
    expect(count).toHaveBeenCalledTimes(1);
  });

  it('another story is another like', () => {
    const count = vi.fn();
    const deps = { counter: { count }, storage: memory(), done: new Set<string>() };
    like(story, deps);
    like({ id: 'aljubarrota-1385', title: 'x' }, deps);
    expect(count).toHaveBeenCalledTimes(2);
  });

  it('without GoatCounter (not loaded, switched off) the reader is thanked all the same and nothing is sent', () => {
    for (const counter of [undefined, {}, { count: undefined }]) {
      const storage = memory();
      expect(like(story, { counter, storage, done: new Set() })).toEqual({ already: false, sent: false });
      expect(isLiked(story.id, { counter, storage, done: new Set() })).toBe(true);
    }
  });

  it('a counter that throws does not break the like', () => {
    const count = vi.fn(() => {
      throw new Error('blocked');
    });
    expect(like(story, { counter: { count }, storage: memory(), done: new Set() })).toEqual({ already: false, sent: false });
  });

  it('without localStorage (undefined, or one that throws) the like holds for the page load: one event, then nothing', () => {
    const count = vi.fn();
    const throwing = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    for (const storage of [undefined, throwing]) {
      count.mockClear();
      const done = new Set<string>();
      expect(like(story, { counter: { count }, storage, done })).toEqual({ already: false, sent: true });
      expect(like(story, { counter: { count }, storage, done })).toEqual({ already: true, sent: false });
      expect(count).toHaveBeenCalledTimes(1);
      // a new load without storage: not remembered, one event again (by design: nothing can be kept)
      expect(isLiked(story.id, { counter: { count }, storage, done: new Set() })).toBe(false);
    }
  });
});

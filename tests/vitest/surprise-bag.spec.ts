import { describe, expect, it } from 'vitest';
import { buildDeck, drawSurprise, parseBag, shuffle, type SurpriseBag } from '../../src/lib/surprise-bag';

const ids = (n: number) => Array.from({ length: n }, (_, i) => `s${i}`);

/** `presses` draws in a row, the deck kept between them like the storage does. */
function press(allowed: string[], read: string[], presses: number, start: SurpriseBag | null = null, current: string | null = null) {
  let bag = start;
  const got: string[] = [];
  for (let i = 0; i < presses; i += 1) {
    const draw = drawSurprise(bag, allowed, read, current);
    bag = draw.bag;
    got.push(draw.id!);
  }
  return { got, bag: bag! };
}

describe('drawSurprise', () => {
  it('shows N stories on the first N presses, all different', () => {
    for (let n = 2; n <= 50; n += 7) {
      const { got } = press(ids(n), [], n);
      expect(new Set(got).size).toBe(n);
    }
  });

  it('does not repeat anything in 30 presses with 44 stories, read or not', () => {
    const all = ids(44);
    for (const read of [[], all.slice(0, 20), all]) expect(new Set(press(all, read, 30).got).size).toBe(30);
  });

  it('puts the unread stories first, then the read ones', () => {
    const all = ids(10);
    const read = ['s1', 's4', 's7'];
    const { got } = press(all, read, 10);
    expect(new Set(got.slice(0, 7))).toEqual(new Set(all.filter((id) => !read.includes(id))));
    expect(new Set(got.slice(7))).toEqual(new Set(read));
  });

  it('never begins a new deck with the story shown last', () => {
    for (let n = 2; n <= 6; n += 1) {
      for (let round = 0; round < 200; round += 1) {
        const { got } = press(ids(n), [], n * 3);
        for (let i = 1; i < got.length; i += 1) expect(got[i]).not.toBe(got[i - 1]);
      }
    }
  });

  it('with one story it gives that story every time', () => {
    expect(press(['a'], [], 4).got).toEqual(['a', 'a', 'a', 'a']);
    expect(drawSurprise(null, [], []).id).toBeNull();
  });

  it('skips the open story without spending it', () => {
    const all = ids(5);
    const first = drawSurprise(null, all, [], null, () => 0.5).bag;
    const open = first.queue[0]!;
    const draw = drawSurprise(first, all, [], open);
    expect(draw.id).not.toBe(open);
    expect(draw.bag.queue).toContain(open);
    // The rest of the deck comes out, then the open story is the last one left.
    const rest = press(all, [], 3, draw.bag, open).got;
    expect(rest).not.toContain(open);
  });

  it('with only the open story left a new deck begins, and it is not the open one or the last one', () => {
    const bag: SurpriseBag = { queue: ['s0'], shown: ['s1', 's2'], last: 's2' };
    for (let i = 0; i < 100; i += 1) {
      const draw = drawSurprise(bag, ['s0', 's1', 's2'], [], 's0');
      expect(draw.id).toBe('s1');
      expect(draw.bag.shown).toEqual(['s1']);
    }
  });

  it('adds a new story to the unread part of the deck', () => {
    const all = ids(6);
    const read = ['s0', 's1', 's2'];
    const start = press(all, read, 1).bag;
    const unreadLeft = start.queue.filter((id) => !read.includes(id)).length;
    const seen = new Set<number>();
    for (let i = 0; i < 300; i += 1) {
      const draw = drawSurprise(start, [...all, 'new'], read);
      // The deck as it was before this draw: the story drawn, then what is left.
      const position = [draw.id, ...draw.bag.queue].indexOf('new');
      expect(position).toBeGreaterThanOrEqual(0);
      expect(position).toBeLessThanOrEqual(unreadLeft);
      seen.add(position);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('drops the ids that are gone or hidden', () => {
    const bag: SurpriseBag = { queue: ['a', 'gone', 'b'], shown: ['hidden', 'c'], last: 'c' };
    const draw = drawSurprise(bag, ['a', 'b', 'c'], []);
    expect(draw.id).toBe('a');
    expect(draw.bag.queue).toEqual(['b']);
    expect(draw.bag.shown).toEqual(['c', 'a']);
  });
});

describe('buildDeck, shuffle, parseBag', () => {
  it('keeps every id once', () => {
    expect([...buildDeck(ids(9), ['s2', 's3'], null)].sort()).toEqual(ids(9));
    expect([...shuffle(ids(9))].sort()).toEqual(ids(9));
  });

  it('reads a saved deck and nothing else', () => {
    expect(parseBag('{"queue":["a","a","b"],"shown":["c"],"last":"c"}')).toEqual({ queue: ['a', 'b'], shown: ['c'], last: 'c' });
    expect(parseBag('{"queue":["a"],"shown":[]}')?.last).toBeNull();
    for (const bad of [null, '', 'x', '[]', '{"queue":1,"shown":[]}', '{"queue":[1],"shown":[]}']) expect(parseBag(bad)).toBeNull();
  });
});

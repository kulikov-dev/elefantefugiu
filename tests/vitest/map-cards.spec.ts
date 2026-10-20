import { describe, expect, it } from 'vitest';
import { groupByEpoch, safeJson, toMapCards } from '../../src/lib/map-cards';
import type { EventData } from '../../src/lib/events';
import type { EpochData } from '../../src/lib/epochs';

const event = (over: Record<string, unknown>) =>
  ({
    id: 'e1',
    slug: { pt: 'e-um', en: 'e-one' },
    title: { pt: 'Um', en: 'One' },
    epoch: 'a',
    level: 'frame',
    year: 1498,
    place: { name: 'Lisboa', lat: 38.7, lon: -9.1 },
    bridge: { name: 'Mosteiro', address: 'Praça do Império', lat: 38.69, lon: -9.2, url: 'https://x.y', note: { pt: 'n', en: 'n' } },
    threads: ['mar', 'natureza'],
    importance: 3,
    min_age: 'all',
    sensitive: false,
    hook: { pt: 'Gancho', en: 'Hook' },
    ...over,
  }) as unknown as EventData;

describe('toMapCards', () => {
  it('takes coordinates from the bridge, not from the place, and text in the page language', () => {
    const [c] = toMapCards([event({})], 'en', (e) => `/en/story/${e.slug.en}/`);
    expect(c).toEqual({
      id: 'e1',
      lat: 38.69,
      lon: -9.2,
      bridgeName: 'Mosteiro',
      bridgeAddress: 'Praça do Império',
      importance: 3,
      threads: ['mar', 'natureza'],
      epoch: 'a',
      title: 'One',
      meta: '1498 · Lisboa',
      hook: 'Hook',
      href: '/en/story/e-one/',
      minAge: 'all',
      sensitive: false,
    });
  });

  it('puts the marker at the bridge in Portugal when the place is abroad (Goa)', () => {
    const goa = event({ place: { name: 'Goa', lat: 15.5009, lon: 73.9116 } });
    const [c] = toMapCards([goa], 'pt', () => '/x/');
    expect([c!.lat, c!.lon]).toEqual([38.69, -9.2]);
    expect(c!.meta).toBe('1498 · Goa');
  });

  it('never reads the place coordinates (they may be anywhere in the world)', () => {
    const [near, far] = toMapCards([event({ place: { name: 'a', lat: 38.7, lon: -9.1 } }), event({ id: 'e2', place: { name: 'b', lat: -33.9, lon: 151.2 } })], 'pt', () => '/x/');
    expect([near!.lat, near!.lon]).toEqual([far!.lat, far!.lon]);
  });

  it('carries the age label and the heavy-topic flag, normalised', () => {
    const [c] = toMapCards([event({ min_age: 12, sensitive: true })], 'pt', () => '/x/');
    expect([c!.minAge, c!.sensitive]).toEqual(['12', true]);
  });
});

describe('groupByEpoch', () => {
  const epochs = [
    { id: 'b', order: 2 },
    { id: 'a', order: 1 },
    { id: 'c', order: 3 },
  ] as unknown as EpochData[];

  it('orders by epoch order, keeps card order, drops empty epochs', () => {
    const groups = groupByEpoch([{ id: '1', epoch: 'b' }, { id: '2', epoch: 'a' }, { id: '3', epoch: 'b' }], epochs);
    expect(groups.map((g) => [g.epoch.id, g.cards.map((c) => c.id)])).toEqual([
      ['a', ['2']],
      ['b', ['1', '3']],
    ]);
  });
});

describe('safeJson', () => {
  it('cannot close the script element', () => {
    const s = safeJson({ t: '</script><b>' });
    expect(s).not.toContain('</script>');
    expect(JSON.parse(s)).toEqual({ t: '</script><b>' });
  });
});

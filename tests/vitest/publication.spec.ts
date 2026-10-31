import { describe, expect, it } from 'vitest';
import { buildToday, isLive, isQueued, lisbonToday, publishedDay } from '../../src/lib/publication.mjs';
import { cardNeighbours, isPublished, nearbyCards, type EventData } from '../../src/lib/events';
import { epochFeed, type EpochData } from '../../src/lib/epochs';
import { surpriseCandidates, homeStartStory } from '../../src/lib/home';
import { countCardsByThread } from '../../src/lib/threads';

// Dates come from the clock of the test, not from the data: yesterday, today and tomorrow in Lisbon.
const addDays = (day: string, n: number): string => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const today = buildToday();
const yesterday = addDays(today, -1);
const tomorrow = addDays(today, 1);

describe('lisbonToday: the day in Lisbon, not in UTC', () => {
  it('summer time (UTC+1): 23:30 UTC on 30 June is already 1 July in Lisbon; winter time (UTC+0): 23:30 UTC on 31 October is still 31 October', () => {
    expect(lisbonToday(new Date('2026-06-30T23:30:00Z'))).toBe('2026-07-01');
    expect(lisbonToday(new Date('2026-06-30T22:59:00Z'))).toBe('2026-06-30');
    expect(lisbonToday(new Date('2026-10-31T23:30:00Z'))).toBe('2026-10-31');
    expect(lisbonToday(new Date('2026-01-15T00:00:00Z'))).toBe('2026-01-15');
  });
  it('the clocks go forward and back on the right nights (last Sundays of March and October)', () => {
    expect(lisbonToday(new Date('2026-03-28T23:30:00Z'))).toBe('2026-03-28');
    expect(lisbonToday(new Date('2026-03-29T23:30:00Z'))).toBe('2026-03-30');
    expect(lisbonToday(new Date('2026-10-24T23:30:00Z'))).toBe('2026-10-25');
    expect(lisbonToday(new Date('2026-10-25T23:30:00Z'))).toBe('2026-10-25');
  });
});

describe('buildToday', () => {
  it('SITE_TODAY sets the day of the build; anything that is not a day is ignored', () => {
    expect(buildToday({ SITE_TODAY: '2030-02-03' })).toBe('2030-02-03');
    expect(buildToday({ SITE_TODAY: ' 2030-02-03 ' })).toBe('2030-02-03');
    expect(buildToday({ SITE_TODAY: 'tomorrow' })).toBe(lisbonToday());
    expect(buildToday({})).toBe(lisbonToday());
  });
});

describe('isLive: ready and published today or before', () => {
  it('yesterday and today are live, tomorrow is queued, a draft is never live', () => {
    expect(isLive({ status: 'ready', published: yesterday }, today)).toBe(true);
    expect(isLive({ status: 'ready', published: today }, today)).toBe(true);
    expect(isLive({ status: 'ready', published: tomorrow }, today)).toBe(false);
    expect(isQueued({ status: 'ready', published: tomorrow }, today)).toBe(true);
    expect(isQueued({ status: 'ready', published: today }, today)).toBe(false);
    expect(isLive({ status: 'draft', published: yesterday }, today)).toBe(false);
    expect(isQueued({ status: 'draft', published: tomorrow }, today)).toBe(false);
  });
  it('a Date made by a YAML parser works like the string; a story without a day is not held back', () => {
    expect(publishedDay(new Date('2026-10-30T00:00:00Z'))).toBe('2026-10-30');
    expect(isLive({ status: 'ready', published: new Date(`${tomorrow}T00:00:00Z`) }, today)).toBe(false);
    expect(isLive({ status: 'ready' }, today)).toBe(true);
  });
});

// A small world: one story of each kind in one epoch.
const story = (id: string, published: string, extra: Partial<EventData> = {}) =>
  ({ id, epoch: 'e', year: 1500, status: 'ready', published, threads: ['mar'], sensitive: false, min_age: 'all', place: { name: 'x', short: 'x', lat: 38, lon: -9 }, bridge: { lat: 38, lon: -9 }, ...extra }) as unknown as EventData;
const world = [story('old', yesterday), story('now', today), story('later', tomorrow)];
const epoch = { id: 'e' } as unknown as EpochData;

describe('the pages take their stories through isPublished', () => {
  it('isPublished (src/lib/events.ts) is the rule of the build day', () => {
    expect(world.map(isPublished)).toEqual([true, true, false]);
  });
  it('the epoch has no queued story', () => {
    expect(epochFeed(epoch, world).map((e) => e.id).sort()).toEqual(['now', 'old']);
  });
  it('Previous / Next and Nearby never lead to a queued story', () => {
    const all = [...world, story('later2', tomorrow)];
    const n = cardNeighbours(world[0]!, all, () => true);
    expect([n.prev?.id, n.next?.id].includes('later')).toBe(false);
    expect(nearbyCards(world[0]!, all, { allowed: () => true }).map(({ event }) => event.id)).not.toContain('later');
  });
  it('"Surprise me", the start story of the home page and the thread counters ignore it', () => {
    expect(surpriseCandidates(world).map((e) => e.id).sort()).toEqual(['now', 'old']);
    expect(homeStartStory([{ id: 'rinoceronte-1515', status: 'ready', published: tomorrow }])).toBeNull();
    expect(homeStartStory([{ id: 'rinoceronte-1515', status: 'ready', published: yesterday }])?.id).toBe('rinoceronte-1515');
    expect(countCardsByThread(world).get('mar')).toBe(2);
  });
});

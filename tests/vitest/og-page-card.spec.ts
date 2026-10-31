import { readFileSync, readdirSync } from 'node:fs';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { AZULEJO, FRAME, epochPalette, patternName, tileBody } from '../../scripts/lib/og-card.mjs';
import { PAGE_PLATE, PANEL, epochYears, liveEpochs } from '../../scripts/lib/og-page-card.mjs';
import { SAFE } from '../../scripts/lib/og-card.mjs';
import { epochYearsText } from '../../src/lib/epochs';

const css = readFileSync('src/styles/tokens.css', 'utf8');
const epochs = parse(readFileSync('src/content/epochs.yaml', 'utf8')) as Record<string, any>[];
const events = readdirSync('src/content/events')
  .filter((f) => f.endsWith('.yaml'))
  .map((f) => parse(readFileSync(`src/content/events/${f}`, 'utf8'))) as Record<string, any>[];

describe('liveEpochs: which epochs get a card', () => {
  const pic = { file: 'x.webp' };
  const sample = [
    { id: 'open', fallback_image: pic },
    { id: 'no-story', fallback_image: pic },
    { id: 'draft-only', fallback_image: pic },
    { id: 'no-picture' },
    { id: 'provisional', fallback_image: 'images/placeholders/epoch-c.svg' },
  ];
  const stories = [
    { epoch: 'open', status: 'ready' },
    { epoch: 'draft-only', status: 'draft' },
    { epoch: 'no-picture', status: 'ready' },
    { epoch: 'provisional', status: 'ready' },
  ];
  it('an epoch with a published story and a picture of its own; not an epoch without a page, without a published story or with a provisional picture', () => {
    expect(liveEpochs(sample, stories).map((e: { id: string }) => e.id)).toEqual(['open']);
  });
  it('in the real data: only epochs that have a published story, each with a pattern of its own and its own colours', () => {
    const live = liveEpochs(epochs, events);
    expect(live.length).toBeGreaterThan(0);
    for (const epoch of live) {
      expect(events.some((e) => e.status === 'ready' && e.epoch === epoch.id), epoch.id).toBe(true);
      expect(AZULEJO[epoch.id as keyof typeof AZULEJO], epoch.id).toBeTruthy();
      const p = epochPalette(css, epoch.id);
      expect(p, epoch.id).not.toEqual(epochPalette(css, 'no-such-epoch'));
    }
  });
  it('an epoch that is not open is not made: no published story, no card', () => {
    const closed = epochs.filter((e) => !events.some((s) => s.status === 'ready' && s.epoch === e.id));
    expect(closed.length).toBeGreaterThan(0);
    const live = new Set(liveEpochs(epochs, events).map((e: { id: string }) => e.id));
    for (const e of closed) expect(live.has(e.id), e.id).toBe(false);
  });
});

describe('the pattern and the colour of an epoch card are those of its frames and its page', () => {
  it('the pattern is the one the site gives the epoch, the colour is the primary colour of its palette', () => {
    expect(patternName('avis-e-descobrimentos')).toBe('bussola');
    expect(epochPalette(css, 'avis-e-descobrimentos').primary).toBe('#0f5c73');
    expect(patternName('monarquia-e-republica')).toBe('onda');
    expect(epochPalette(css, 'monarquia-e-republica').primary).toBe('#2e4d66');
    // the home page: the compass in the colours of the site
    expect(patternName('home')).toBe('bussola');
    expect(epochPalette(css, 'home')).toMatchObject({ primary: '#9a3f22', tint: '#f6f1e7' });
  });
  it('a tile of the field is FRAME px for every pattern: the compass of the home page is the same size as the tiles of the epochs', () => {
    for (const id of [...Object.keys(AZULEJO), 'home']) {
      const { size } = tileBody(patternName(id), '#000');
      expect((size * (FRAME / size)).toFixed(6), id).toBe(FRAME.toFixed(6));
    }
    expect(tileBody('bussola', '#000').size).toBe(60);
  });
});

describe('epochYears: the years as the header of the epoch page says them', () => {
  it('the same text as epochYearsText of the site, for every epoch and language', () => {
    for (const epoch of epochs) for (const lang of ['pt', 'en', 'ru'] as const) expect(epochYears(epoch, lang), `${epoch.id} ${lang}`).toBe(epochYearsText(epoch as never, lang));
  });
});

describe('layout of the page cards', () => {
  it('the plate is inside the central square; the panel and the plate fit under each other on the card', () => {
    const left = SAFE.left + (SAFE.width - PAGE_PLATE.width) / 2;
    expect(left).toBeGreaterThanOrEqual(SAFE.left);
    expect(left + PAGE_PLATE.width).toBeLessThanOrEqual(SAFE.left + SAFE.width);
    expect(PAGE_PLATE.width).toBe(600);
    expect(PAGE_PLATE.height).toBe(72);
    expect(PANEL.top + PANEL.height + 2 * PANEL.rim + 12 + PAGE_PLATE.height).toBeLessThanOrEqual(630);
  });
});

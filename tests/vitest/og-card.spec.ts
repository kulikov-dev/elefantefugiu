import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AZULEJO, DIRECTED, FRAME, H, PLATE, SAFE, STRIP, W, bandSvg, cardHash, cropBox, epochPalette, epochTitle, frameBands, parseFocus } from '../../scripts/lib/og-card.mjs';
import { DIRECTED as SITE_DIRECTED, EPOCH_PATTERN } from '../../src/lib/azulejo';

const css = readFileSync('src/styles/tokens.css', 'utf8');

describe('parseFocus', () => {
  it('reads "x% y%" and takes the centre for anything else', () => {
    expect(parseFocus('45% 55%')).toEqual({ x: 0.45, y: 0.55 });
    expect(parseFocus('0% 100%')).toEqual({ x: 0, y: 1 });
    for (const bad of [undefined, '', 'center', '50%', '150% x']) expect(parseFocus(bad as string | undefined)).toEqual({ x: 0.5, y: 0.5 });
  });
});

describe('cropBox (object-fit: cover with object-position)', () => {
  it('a picture wider than the box is cut at the sides, taller than the box at the top and bottom', () => {
    expect(cropBox(2000, 500, 1000, 500, undefined)).toEqual({ left: 500, top: 0, width: 1000, height: 500 });
    expect(cropBox(1000, 2000, 1000, 500, undefined)).toEqual({ left: 0, top: 750, width: 1000, height: 500 });
  });
  it('the focus moves the crop: 0% is the first edge, 100% the last, 50% the middle', () => {
    expect(cropBox(2000, 500, 1000, 500, '0% 50%').left).toBe(0);
    expect(cropBox(2000, 500, 1000, 500, '100% 50%').left).toBe(1000);
    expect(cropBox(2000, 500, 1000, 500, '25% 50%').left).toBe(250);
    expect(cropBox(1000, 2000, 1000, 500, '50% 0%').top).toBe(0);
    expect(cropBox(1000, 2000, 1000, 500, '50% 100%').top).toBe(1500);
  });
  it('the crop has the aspect of the box and stays inside the picture, for a real story picture and its focus', () => {
    const box = cropBox(1264, 848, 1120, 526, '50% 55%');
    expect(box.width / box.height).toBeCloseTo(1120 / 526, 1);
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.top).toBeGreaterThanOrEqual(0);
    expect(box.left + box.width).toBeLessThanOrEqual(1264);
    expect(box.top + box.height).toBeLessThanOrEqual(848);
  });
  it('a picture of exactly the aspect is not cropped', () => {
    expect(cropBox(1120, 560, 1120, 560, '30% 70%')).toEqual({ left: 0, top: 0, width: 1120, height: 560 });
  });
});

describe('epochPalette (light colours from src/styles/tokens.css)', () => {
  it('Avis: the primary colour, the tint of its page and its line', () => {
    expect(epochPalette(css, 'avis-e-descobrimentos')).toMatchObject({ primary: '#0f5c73', tint: '#e3e8dc', line: '#c3ccb8' });
  });
  it('Pombal and Lusitania have their own colours', () => {
    expect(epochPalette(css, 'pombal-e-terramoto')).toMatchObject({ primary: '#a9482a', tint: '#f3e2cb' });
    expect(epochPalette(css, 'lusitania-e-roma')).toMatchObject({ primary: '#7a2e1c', tint: '#f3e7dc' });
  });
  it('every epoch of the table has its own colours, and an unknown epoch gets the colours of the site', () => {
    for (const id of ['antes-de-portugal', 'avis-e-descobrimentos', 'pombal-e-terramoto', 'estado-novo-e-25-de-abril', 'lusitania-e-roma', 'suevos-visigodos-e-mouros', 'nascimento-do-reino-e-reconquista', 'uniao-restauracao-e-ouro-do-brasil', 'monarquia-e-republica']) {
      const p = epochPalette(css, id);
      expect(p.primary, id).toMatch(/^#[0-9a-f]{6}$/);
      expect(p.tint, id).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(epochPalette(css, 'no-such-epoch')).toMatchObject({ primary: '#9a3f22', tint: '#f6f1e7' });
  });
});

describe('epochTitle', () => {
  it('the name in the language of the page, falling back to en and pt', () => {
    expect(epochTitle({ pt: 'Avis', en: 'Avis EN', ru: 'Авис' }, 'ru')).toBe('Авис');
    expect(epochTitle({ pt: 'Avis', en: 'Avis EN' }, 'ru')).toBe('Avis EN');
    expect(epochTitle({ pt: ' Avis ' }, 'en')).toBe('Avis');
  });
});

describe('cardHash', () => {
  it('the same inputs give the same hash, any change gives another', () => {
    const a = cardHash([Buffer.from('picture'), '50% 50%', '#0f5c73', 'Avis']);
    expect(cardHash([Buffer.from('picture'), '50% 50%', '#0f5c73', 'Avis'])).toBe(a);
    expect(a).toMatch(/^[0-9a-f]{10}$/);
    expect(cardHash([Buffer.from('picture2'), '50% 50%', '#0f5c73', 'Avis'])).not.toBe(a);
    expect(cardHash([Buffer.from('picture'), '50% 51%', '#0f5c73', 'Avis'])).not.toBe(a);
    expect(cardHash([Buffer.from('picture'), '50% 50%', '#0f5c74', 'Avis'])).not.toBe(a);
    expect(cardHash([Buffer.from('picture'), '50% 50%', '#0f5c73', 'Авис'])).not.toBe(a);
  });
});

describe('layout', () => {
  it('the plate stays inside the central square, the strip inside the frame', () => {
    const left = SAFE.left + (SAFE.width - PLATE.width) / 2;
    expect(left).toBeGreaterThanOrEqual(SAFE.left);
    expect(left + PLATE.width).toBeLessThanOrEqual(SAFE.left + SAFE.width);
    expect(SAFE).toEqual({ left: 285, width: 630 });
    expect(PLATE.height).toBeLessThanOrEqual(STRIP);
    expect(W - 2 * FRAME).toBe(1120);
    expect(H - 2 * FRAME - STRIP).toBeGreaterThan(400);
  });
});

describe('frame of the azulejo pattern', () => {
  it('uses the patterns of the site: the same pattern for every epoch, the same directed ones', () => {
    for (const [epoch, name] of Object.entries(EPOCH_PATTERN)) expect((AZULEJO as Record<string, string>)[epoch], epoch).toBe(name);
    expect([...DIRECTED].sort()).toEqual([...SITE_DIRECTED].sort());
  });
  it('the bands are whole: 28 tiles of 40 px on the top and the bottom, 14 on each side over the height between the corners', () => {
    for (const band of frameBands('lusitania-e-roma')) {
      expect(band.count).toBe(band.vertical ? 14 : 28);
      expect(band.length).toBe(band.vertical ? H - 2 * FRAME : W - 2 * FRAME);
    }
    expect(frameBands('lusitania-e-roma').filter((b) => !b.vertical).every((b) => b.length / b.count === FRAME)).toBe(true);
  });
  it('a directed pattern is turned on the sides (zigzag, wave, chequer); a pattern that is the same turned is used as it is', () => {
    for (const epoch of ['lusitania-e-roma', 'monarquia-e-republica', 'nascimento-do-reino-e-reconquista']) {
      const bands = frameBands(epoch);
      const [name] = bands.filter((b) => !b.vertical).map((b) => b.file);
      expect(bands.filter((b) => b.vertical).every((b) => b.file === `${name}-v`), epoch).toBe(true);
      expect(bands.some((b) => b.flip), epoch).toBe(false);
    }
    for (const epoch of ['avis-e-descobrimentos', 'pombal-e-terramoto', 'uniao-restauracao-e-ouro-do-brasil', 'suevos-visigodos-e-mouros']) {
      expect(new Set(frameBands(epoch).map((b) => b.file)).size, epoch).toBe(1);
    }
  });
  it('the trail of footprints goes round clockwise: top right, right side down, bottom left, left side up', () => {
    const bands = Object.fromEntries(frameBands('antes-de-portugal').map((b) => [b.side, b]));
    // the files: pegada points right, pegada-v points down; a flipped band runs the other way
    expect(bands.top).toMatchObject({ file: 'pegada', flip: false });
    expect(bands.right).toMatchObject({ file: 'pegada-v', flip: false });
    expect(bands.bottom).toMatchObject({ file: 'pegada', flip: true });
    expect(bands.left).toMatchObject({ file: 'pegada-v', flip: true });
    expect(bandSvg(bands.bottom, '#000')).toContain('scale(-1 1)');
    expect(bandSvg(bands.left, '#000')).toContain('scale(1 -1)');
    expect(bandSvg(bands.top, '#000')).not.toContain('scale(-1');
  });
  it('a band is one picture: the number of tiles is the number of groups, and the size is the size of the band', () => {
    const left = frameBands('monarquia-e-republica').find((b) => b.side === 'left')!;
    const svg = bandSvg(left, '#2e4d66');
    expect(svg).toContain(`width="${FRAME}" height="${H - 2 * FRAME}"`);
    expect(svg.split('<g transform="translate(0 ').length - 1).toBe(14);
    expect(svg).toContain('#2e4d66');
  });
});

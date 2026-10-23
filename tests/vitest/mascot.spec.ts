import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FLASH_EPOCH } from '../../src/lib/events';
import { POSES, POSE_SIZE, mascotAllowed, poseFile } from '../../src/lib/mascot';

const root = fileURLToPath(new URL('../../', import.meta.url));

describe('mascot poses', () => {
  it('every pose has a picture in public/mascot and a size', () => {
    for (const pose of POSES) {
      expect(existsSync(`${root}public/${poseFile(pose)}`), pose).toBe(true);
      expect(POSE_SIZE[pose].width, pose).toBeGreaterThan(0);
      expect(POSE_SIZE[pose].height, pose).toBeGreaterThan(0);
    }
  });

  it('the pictures are WebP with transparency (the cream background of the originals is gone)', () => {
    for (const pose of POSES) {
      const head = readFileSync(`${root}public/${poseFile(pose)}`).subarray(0, 32);
      expect(head.subarray(0, 4).toString('latin1'), pose).toBe('RIFF');
      expect(head.subarray(8, 12).toString('latin1'), pose).toBe('WEBP');
      // The extended header (VP8X) carries the alpha flag, bit 4 of the flags byte.
      expect(head.subarray(12, 16).toString('latin1'), pose).toBe('VP8X');
      expect((head[20]! & 0x10) !== 0, `${pose} has alpha`).toBe(true);
    }
  });

  it('the originals are kept outside public/, so they are not published', () => {
    expect(existsSync(`${root}docs/mascot/originals/run.png`)).toBe(true);
    expect(existsSync(`${root}public/mascot/run.png`)).toBe(false);
  });
});

describe('where the mascot may appear', () => {
  it('not on a heavy card', () => {
    expect(mascotAllowed({ sensitive: true })).toBe(false);
  });
  it('not on a card for readers 16+, as a number or a string', () => {
    expect(mascotAllowed({ min_age: '16' })).toBe(false);
    expect(mascotAllowed({ min_age: 16 })).toBe(false);
  });
  it('not on the pages of the regime epoch', () => {
    expect(mascotAllowed({ epoch: FLASH_EPOCH })).toBe(false);
  });
  it('yes on a plain page', () => {
    expect(mascotAllowed({})).toBe(true);
    expect(mascotAllowed({ sensitive: false, min_age: '12', epoch: 'avis-e-descobrimentos' })).toBe(true);
    expect(mascotAllowed({ min_age: 'all' })).toBe(true);
  });
});

describe('the mascot is never put on a page that can be heavy', () => {
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => (statSync(`${dir}/${n}`).isDirectory() ? walk(`${dir}/${n}`) : [`${dir}/${n}`]));
  const users = ['src/views', 'src/components', 'src/pages', 'src/layouts']
    .flatMap((d) => walk(`${root}${d}`))
    .filter((f) => f.endsWith('.astro') && /<Mascot\b/.test(readFileSync(f, 'utf8')))
    .map((f) => f.slice(root.length));
  it('only these files draw the mascot (none of them is a card page, a card layer or the card parts)', () => {
    expect(users.sort()).toEqual(
      ['src/components/Logo.astro', 'src/components/PagerNav.astro', 'src/pages/404.astro', 'src/views/EpochView.astro', 'src/views/HomeView.astro', 'src/views/ReportView.astro', 'src/views/ThreadView.astro'].sort(),
    );
    for (const heavy of ['StoryView', 'CardLayers', 'BridgeBlock', 'SourceList', 'NextStory', 'EventCard', 'HeavyTopicBanner']) {
      expect(users.some((f) => f.includes(heavy)), heavy).toBe(false);
    }
  });
  it('on the epoch page the mascot is behind mascotAllowed() (not on the regime epoch)', () => {
    const text = readFileSync(`${root}src/views/EpochView.astro`, 'utf8');
    expect(text.match(/mascotAllowed\(/g)?.length ?? 0).toBeGreaterThan(0);
    expect(text.match(/<Mascot/g)?.length ?? 0).toBeGreaterThan(0);
  });
  it('on a thread page the mascot is only inside the "nothing to show in this mode" message, which exists when family mode hides every story', () => {
    const text = readFileSync(`${root}src/views/ThreadView.astro`, 'utf8');
    const uses = [...text.matchAll(/<Mascot/g)];
    expect(uses.length).toBe(1);
    expect(text.slice(Math.max(0, uses[0]!.index! - 400), uses[0]!.index)).toMatch(/family-empty/);
  });
});

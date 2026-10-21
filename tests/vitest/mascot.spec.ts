import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
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

import { describe, expect, it } from 'vitest';
import { localize } from '../../src/lib/localize';

describe('the remark of a source', () => {
  it('is not filled from another language: a missing language stays missing', () => {
    const out = localize({ hook: { pt: 'a', en: 'b' }, sources: [{ title: 'T', url: 'https://x.org', type: 'press', accessed: new Date(), note: { pt: 'nota', en: 'note' } }] }, true);
    expect(out.hook.ru).toBe('b');
    expect((out.sources[0]!.note as Record<string, string>).ru).toBeUndefined();
  });
});

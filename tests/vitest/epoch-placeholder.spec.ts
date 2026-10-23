import { describe, expect, it } from 'vitest';
import { epochSchema } from '../../src/data/schemas';
import { epochHasTestText } from '../../src/lib/epochs';

describe('placeholder marks of an epoch, per field', () => {
  it('only a missing preview picture does not make the page test text', () => {
    expect(epochHasTestText({ placeholder: [] })).toBe(false);
    expect(epochHasTestText({ placeholder: ['fallback_image'] })).toBe(false);
    expect(epochHasTestText({ placeholder: ['theme'] })).toBe(true);
    expect(epochHasTestText({ placeholder: ['fallback_image', 'style'] })).toBe(true);
  });
  it('the schema takes a list of known fields, none by default, and rejects a typo or the old yes/no', () => {
    const base = { id: 'x', slug: { pt: 'x', en: 'x' }, order: 1, name: { pt: 'X', en: 'X' }, years_label: { pt: '1', en: '1' }, mvp: false };
    expect(epochSchema.parse(base).placeholder).toEqual([]);
    expect(epochSchema.parse({ ...base, placeholder: ['fallback_image'] }).placeholder).toEqual(['fallback_image']);
    expect(() => epochSchema.parse({ ...base, placeholder: ['colour'] })).toThrow();
    expect(() => epochSchema.parse({ ...base, placeholder: true })).toThrow();
  });
});

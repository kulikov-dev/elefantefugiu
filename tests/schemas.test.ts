import { test } from 'node:test';
import assert from 'node:assert/strict';
import { minAge } from '../src/data/schemas';

test('min_age is normalised to a string', () => {
  assert.equal(minAge.parse(12), '12');
  assert.equal(minAge.parse('12'), '12');
  assert.equal(minAge.parse(16), '16');
  assert.equal(minAge.parse('16'), '16');
  assert.equal(minAge.parse('all'), 'all');
});

test('min_age rejects other values', () => {
  for (const bad of [14, '14', 'ALL', '', null, undefined, '12+']) {
    assert.equal(minAge.safeParse(bad).success, false, `should reject ${String(bad)}`);
  }
});

// ---- epochs outside the MVP (stage 4a follow-up) ----
import { epochSchema } from '../src/data/schemas';

const baseEpoch = { id: 'e', slug: { pt: 'e', en: 'e' }, order: 1, name: { pt: 'E', en: 'E' }, placeholder: false };
const fullStyle = { bg: '#fff', accent: '#000', heading_font: 'serif', frame: '1px solid #000' };

test('epochSchema: epoch outside the MVP needs years_label only', () => {
  const ok = epochSchema.safeParse({ ...baseEpoch, mvp: false, years_label: { pt: 'séc. V', en: '5th century' } });
  assert.equal(ok.success, true);
  const missing = epochSchema.safeParse({ ...baseEpoch, mvp: false });
  assert.equal(missing.success, false);
  assert.match(JSON.stringify(missing.error?.issues), /years_label/);
});

test('epochSchema: MVP epoch needs years, theme and style', () => {
  const bad = epochSchema.safeParse({ ...baseEpoch, mvp: true });
  assert.equal(bad.success, false);
  const fields = (bad.error?.issues ?? []).map((i) => i.path[0]).sort();
  assert.deepEqual(fields, ['style', 'theme', 'years']);
  const ok = epochSchema.safeParse({
    ...baseEpoch,
    mvp: true,
    years: { from: 1385, to: 1580 },
    theme: { pt: 'x', en: 'x' },
    style: fullStyle,
  });
  assert.equal(ok.success, true);
});

test('epochSchema: a typo in a field name is an error (strict)', () => {
  const bad = epochSchema.safeParse({ ...baseEpoch, mvp: false, years_label: { pt: 'a', en: 'a' }, year_label: 'x' });
  assert.equal(bad.success, false);
});

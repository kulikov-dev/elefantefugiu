import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { THEME_COLOR } from '../src/lib/theme';

test('theme-color meta equals the accent colour token', () => {
  const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');
  const accent = css.match(/--color-accent:\s*(#[0-9a-fA-F]{6});/)?.[1];
  assert.equal(THEME_COLOR.toLowerCase(), accent?.toLowerCase());
});

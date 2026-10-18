import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nextTheme, normalizeTheme, THEME_COLORS, THEMES } from '../src/lib/theme';

const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');

test('theme-color metas equal the page background tokens (light and dark)', () => {
  const [, light, dark] = css.match(/--color-bg:\s*light-dark\((#[0-9a-fA-F]{6}),\s*(#[0-9a-fA-F]{6})\)/) ?? [];
  assert.equal(THEME_COLORS.light.toLowerCase(), light?.toLowerCase());
  assert.equal(THEME_COLORS.dark.toLowerCase(), dark?.toLowerCase());
});

test('normalizeTheme: light and dark are kept, anything else is system', () => {
  assert.equal(normalizeTheme('light'), 'light');
  assert.equal(normalizeTheme(' DARK '), 'dark');
  for (const bad of [null, undefined, '', 'system', 'auto', 'sepia', 1]) assert.equal(normalizeTheme(bad), 'system');
});

test('nextTheme goes system, light, dark and round again', () => {
  assert.deepEqual(THEMES.map(nextTheme), ['light', 'dark', 'system']);
});

test('tokens: every colour of the theme is a light-dark() pair and the two theme rules exist', () => {
  assert.match(css, /color-scheme:\s*light dark;/);
  assert.match(css, /:root\[data-theme='light'\]\s*{\s*color-scheme:\s*light;/);
  assert.match(css, /:root\[data-theme='dark'\]\s*{\s*color-scheme:\s*dark;/);
  for (const name of ['bg', 'surface', 'text', 'muted', 'border']) assert.match(css, new RegExp(`--color-${name}:\\s*light-dark\\(`));
});

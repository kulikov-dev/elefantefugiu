// Theme choice: "system" (follow the device), "light" or "dark" (docs/visual-direction.md section 2).
// The choice is kept in localStorage (key "theme") and put on <html data-theme> by the head script before the first
// paint; the CSS (tokens.css) turns it into color-scheme, which picks the side of every light-dark() colour.
// "system" and a missing attribute both follow the device, so a reader without JavaScript still gets the right theme.

export type Theme = 'system' | 'light' | 'dark';

export const THEMES: readonly Theme[] = ['system', 'light', 'dark'];
export const THEME_KEY = 'theme';

/** The browser UI colour (<meta name="theme-color">). A meta tag cannot read CSS variables, so the values live here;
 *  tests/theme.test.ts checks that they equal --color-bg in src/styles/tokens.css. */
export const THEME_COLORS = { light: '#f6f1e7', dark: '#14110e' } as const;

/** A stored or typed value to a theme; anything unknown means "system". */
export function normalizeTheme(value: unknown): Theme {
  const text = String(value ?? '').trim().toLowerCase();
  return text === 'light' || text === 'dark' ? text : 'system';
}

/** The order of the header button: system, light, dark, and round again. */
export function nextTheme(theme: Theme): Theme {
  return THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]!;
}

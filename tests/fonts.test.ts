import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

// Only the Latin subset of each font is shipped (fonts.css). Every LETTER of the site text, in both languages, must be
// inside its unicode-range, or that character would be drawn in a system font. Punctuation and arrows may fall back.
const root = new URL('../', import.meta.url).pathname;
const css = readFileSync(join(root, 'src/styles/fonts.css'), 'utf8');

function ranges(text: string): [number, number][] {
  return [...text.matchAll(/U\+([0-9A-F]+)(?:-([0-9A-F]+))?/gi)].map((m) => [parseInt(m[1]!, 16), parseInt(m[2] ?? m[1]!, 16)]);
}
const latin = ranges(css.match(/unicode-range:\s*([^;]+);/)![1]!);
const inRange = (ch: string) => latin.some(([a, b]) => ch.codePointAt(0)! >= a && ch.codePointAt(0)! <= b);

function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) for (const v of value) strings(v, out);
  else if (value && typeof value === 'object') for (const v of Object.values(value)) strings(v, out);
  return out;
}

const texts: string[] = [];
for (const lang of ['pt', 'en']) texts.push(...strings(JSON.parse(readFileSync(join(root, `src/i18n/${lang}.json`), 'utf8'))));
const content = join(root, 'src/content');
for (const file of readdirSync(content, { recursive: true }) as string[]) {
  if (file.endsWith('.yaml')) texts.push(...strings(parse(readFileSync(join(content, file), 'utf8'), { schema: 'core', customTags: ['timestamp'] })));
}

test('the Latin subset covers every letter of the site text (pt, en, content)', () => {
  const missing = new Set<string>();
  for (const text of texts) for (const ch of text) if (/\p{L}/u.test(ch) && !inRange(ch)) missing.add(ch);
  assert.deepEqual([...missing], []);
});

test('the Portuguese letters are covered: ã õ ç á é ê í ó ú â à', () => {
  for (const ch of 'ãõçáéêíóúâàÃÕÇÁÉÊ') assert.ok(inRange(ch), ch);
});

test('no Cyrillic face is declared (the Russian language is not in the site yet)', () => {
  const code = css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(code, /U\+04|cyrillic/i);
});

test('every web face swaps and has a metric-matched fallback face', () => {
  const faces = css.match(/@font-face\s*{[^}]*}/g)!;
  const web = faces.filter((f) => /url\(/.test(f));
  const fallback = faces.filter((f) => /local\(/.test(f));
  assert.ok(web.length >= 4);
  for (const f of web) assert.match(f, /font-display:\s*swap/);
  for (const family of ['Playfair Display', 'Source Serif 4', 'Oswald']) {
    assert.ok(fallback.some((f) => f.includes(`${family} Fallback`) && /size-adjust/.test(f) && /ascent-override/.test(f)), family);
  }
});

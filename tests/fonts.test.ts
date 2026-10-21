import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

// Only the Latin subset of each font is shipped (fonts.css). Every LETTER of the site text, in both languages, must be
// inside its unicode-range, or that character would be drawn in a system font. Punctuation and arrows may fall back.
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const css = readFileSync(join(root, 'src/styles/fonts.css'), 'utf8');

function ranges(text: string): [number, number][] {
  return [...text.matchAll(/U\+([0-9A-F]+)(?:-([0-9A-F]+))?/gi)].map((m) => [parseInt(m[1]!, 16), parseInt(m[2] ?? m[1]!, 16)]);
}
const declared = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/unicode-range:\s*([^;]+);/g)].map((m) => ranges(m[1]!));
const latin = declared[0]!;
const cyrillic = declared.find((r) => r.some(([a, b]) => a <= 0x0410 && b >= 0x044f))!;
const within = (set: [number, number][], ch: string) => set.some(([a, b]) => ch.codePointAt(0)! >= a && ch.codePointAt(0)! <= b);
const inRange = (ch: string) => within(latin, ch) || within(cyrillic, ch);

function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) for (const v of value) strings(v, out);
  else if (value && typeof value === 'object') for (const v of Object.values(value)) strings(v, out);
  return out;
}

const texts: string[] = [];
for (const lang of ['pt', 'en', 'ru']) texts.push(...strings(JSON.parse(readFileSync(join(root, `src/i18n/${lang}.json`), 'utf8'))));
const content = join(root, 'src/content');
for (const file of readdirSync(content, { recursive: true }) as string[]) {
  if (file.endsWith('.yaml')) texts.push(...strings(parse(readFileSync(join(content, file), 'utf8'), { schema: 'core', customTags: ['timestamp'] })));
}

test('the Latin and Cyrillic subsets cover every letter of the site text (pt, en, ru, content)', () => {
  const missing = new Set<string>();
  for (const text of texts) for (const ch of text) if (/\p{L}/u.test(ch) && !inRange(ch)) missing.add(ch);
  assert.deepEqual([...missing], []);
});

test('the Portuguese letters are covered: ã õ ç á é ê í ó ú â à', () => {
  for (const ch of 'ãõçáéêíóúâàÃÕÇÁÉÊ') assert.ok(inRange(ch), ch);
});

test('the Russian letters are covered by the Cyrillic subset, including ё and the quotation marks', () => {
  for (const ch of 'абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ') assert.ok(within(cyrillic, ch), ch);
  for (const ch of '«»—…') assert.ok(inRange(ch) || /[«»—…]/.test(ch), ch);
});

test('Portuguese and English interface text holds no Cyrillic letter (the Cyrillic files stay off those pages)', () => {
  for (const lang of ['pt', 'en']) {
    const text = strings(JSON.parse(readFileSync(join(root, `src/i18n/${lang}.json`), 'utf8'))).join(' ');
    assert.doesNotMatch(text, /[Ѐ-ӿ]/, lang);
  }
});

test('the Cyrillic subset has the weights the Russian pages use: Playfair, Source Serif 400 italic 400 600, Oswald 600, each with its fallback', () => {
  const code = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const faces = code.match(/@font-face\s*{[^}]*}/g)!.filter((f) => f.includes('U+0400'));
  const web = faces.filter((f) => /url\(/.test(f));
  assert.equal(web.length, 5);
  for (const needle of ['playfair-display-cyrillic-wght-normal', 'source-serif-4-cyrillic-400-normal', 'source-serif-4-cyrillic-400-italic', 'source-serif-4-cyrillic-600-normal', 'oswald-cyrillic-600-normal']) {
    assert.ok(web.some((f) => f.includes(needle)), needle);
  }
  for (const f of web) assert.match(f, /font-display:\s*swap/);
  for (const family of ['Playfair Display', 'Source Serif 4', 'Oswald']) {
    assert.ok(faces.some((f) => f.includes(`${family} Fallback`) && /size-adjust/.test(f)), family);
  }
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

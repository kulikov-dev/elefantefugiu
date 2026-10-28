// Prints the Cyrillic fallback @font-face rules for src/styles/fonts.css (run when a font or the Russian text changes):
//   node scripts/font-fallbacks-cyrillic.mjs [--times=path/to/times.ttf] [--arial=path/to/arial.ttf]
// Like font-fallbacks.mjs, but the average letter width is measured on CYRILLIC letters, weighted by how often each
// letter occurs in the site's Russian interface text (src/i18n/ru.json): Latin metrics from @capsizecss/metrics would
// not describe the Cyrillic glyphs. The system fonts are read from files (Times New Roman and Arial are metric-compatible
// with Liberation Serif/Sans and Tinos/Arimo, so the numbers fit those too). Vertical metrics come from the web font.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { create } from 'fontkitten';

const root = fileURLToPath(new URL('..', import.meta.url));
const arg = (name, fallbacks) => {
  const given = process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
  return [given, ...fallbacks].find((p) => p && existsSync(p));
};
const times = arg('times', ['C:/Windows/Fonts/times.ttf', '/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf']);
const arial = arg('arial', ['C:/Windows/Fonts/arial.ttf', '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf']);
if (!times || !arial) throw new Error('give --times= and --arial= (paths to Times New Roman / Liberation Serif and Arial / Liberation Sans)');

// Letter frequencies of the Russian site text.
const strings = (v) => (typeof v === 'string' ? [v] : Object.values(v).flatMap(strings));
const sample = strings(JSON.parse(readFileSync(`${root}src/i18n/ru.json`, 'utf8'))).join(' ');
const letters = [...sample].filter((c) => /[\u0400-\u04ff]/.test(c));
const freq = new Map();
for (const c of letters) freq.set(c, (freq.get(c) ?? 0) + 1);

const open = (path) => create(readFileSync(path));
const avg = (font) => {
  let sum = 0;
  let n = 0;
  for (const [c, count] of freq) {
    const glyph = font.glyphForCodePoint(c.codePointAt(0));
    if (!glyph || glyph.id === 0) continue; // not in this font
    sum += glyph.advanceWidth * count;
    n += count;
  }
  return { width: sum / n / font.unitsPerEm, covered: n / letters.length };
};

const fb = (dir) => `${root}node_modules/${dir}`;
const pairs = [
  { family: 'Source Serif 4', file: fb('@fontsource/source-serif-4/files/source-serif-4-cyrillic-400-normal.woff2'), system: times, locals: ['Times New Roman', 'Liberation Serif', 'Tinos'] },
  { family: 'Playfair Display', file: fb('@fontsource-variable/playfair-display/files/playfair-display-cyrillic-wght-normal.woff2'), system: times, locals: ['Times New Roman', 'Liberation Serif', 'Tinos'], boost: 1.023 },
  { family: 'Oswald', file: fb('@fontsource/oswald/files/oswald-cyrillic-600-normal.woff2'), system: arial, locals: ['Arial', 'Liberation Sans', 'Arimo'] },
];
const pct = (n) => `${(n * 100).toFixed(2)}%`;
const RANGE = 'U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116';
console.log(`/* Cyrillic letters measured on ${letters.length} letters of ru.json; the system font is ${times.split(/[\/]/).pop()} / ${arial.split(/[\/]/).pop()}. */`);
for (const { family, file, system, locals, boost = 1 } of pairs) {
  const web = open(file);
  const fallback = open(system);
  const w = avg(web);
  const f = avg(fallback);
  if (w.covered < 0.99 || f.covered < 0.99) throw new Error(`${family}: the font lacks some letters (web ${w.covered.toFixed(3)}, system ${f.covered.toFixed(3)})`);
  // boost: the headings are set in weights 600-800, 2-3% wider than the regular weight measured here (see font-fallbacks.mjs).
  const sizeAdjust = (w.width / f.width) * boost;
  console.log(`@font-face {
  font-family: '${family} Fallback';
  src: ${locals.map((n) => `local('${n}')`).join(', ')};
  size-adjust: ${pct(sizeAdjust)};
  ascent-override: ${pct(web.ascent / (web.unitsPerEm * sizeAdjust))};
  descent-override: ${pct(Math.abs(web.descent) / (web.unitsPerEm * sizeAdjust))};
  line-gap-override: ${pct(web.lineGap / (web.unitsPerEm * sizeAdjust))};
  unicode-range: ${RANGE};
}
`);
}

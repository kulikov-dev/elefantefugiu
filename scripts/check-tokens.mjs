// Colours, fonts and sizes come from src/styles/tokens.css only. This check scans every stylesheet and every <style>
// block of the components and fails on values written directly. Allowed outside tokens.css:
//   - 1px hairlines (borders, the visually-hidden technique), 0, percentages, unitless numbers,
//     and 100vh / 100dvh / 100svh (the whole screen height);
//   - media query breakpoints (a media query cannot read a custom property);
//   - values inside var(...) fallbacks are still checked.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const src = join(root, 'src');
const errors = [];

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

/** CSS text with its line numbers: whole .css files, or the <style> blocks of .astro files. */
function cssParts(file, text) {
  if (file.endsWith('.css')) return [{ css: text, offset: 0 }];
  const parts = [];
  for (const m of text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
    parts.push({ css: m[1], offset: text.slice(0, m.index + m[0].indexOf(m[1])).split('\n').length - 1 });
  }
  return parts;
}

for (const file of walk(src)) {
  if (!/\.(css|astro)$/.test(file) || file.endsWith('tokens.css')) continue;
  const text = readFileSync(file, 'utf8');
  for (const { css, offset } of cssParts(file, text)) {
    css.split('\n').forEach((raw, i) => {
      const line = raw.replace(/\/\*.*?\*\//g, '');
      if (!line.trim() || /^\s*@media/.test(line)) return;
      const where = `${relative(root, file)}:${offset + i + 1}`;
      const bad = (what) => errors.push(`${where}: ${what}: ${raw.trim()}`);
      if (/:[^;{]*#[0-9a-fA-F]{3,8}\b/.test(line)) bad('colour written directly');
      if (/\b(rgba?|hsla?|oklch|oklab)\(/.test(line)) bad('colour function written directly');
      if (/font-family\s*:/.test(line) && !/var\(--|inherit/.test(line)) bad('font family written directly');
      // sizes: any number with a length unit except 0 and 1px
      for (const m of line.matchAll(/(?<![\w-])(-?\d*\.?\d+)(px|rem|em|ch|vh|vw|svh|dvh|vmin|vmax|pt)\b/g)) {
        if (m[1] === '100' && /^(vh|dvh|svh)$/.test(m[2])) continue;
        if (m[1] === '0' || (m[1] === '1' && m[2] === 'px') || (m[1] === '-1' && m[2] === 'px')) continue;
        bad(`size ${m[0]} written directly`);
      }
    });
  }
}

if (errors.length) {
  console.error(`Token check failed (${errors.length}):`);
  for (const e of errors) console.error(`- ${e}`);
  process.exit(1);
}
console.log('Token check passed: no colours, fonts or sizes written outside tokens.css.');

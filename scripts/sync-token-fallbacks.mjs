// Keeps the fallback block of src/styles/tokens.css in step with its light-dark() colours.
//   node scripts/sync-token-fallbacks.mjs          rewrites the block
//   node scripts/sync-token-fallbacks.mjs --check  fails when the block is out of date (npm run check:contrast runs this)
//
// A browser without light-dark() cannot use a declaration like `--color-bg: light-dark(#f6f1e7, #14110e)`. Custom
// properties are not checked when the stylesheet is parsed, so a plain `--color-bg: #f6f1e7;` written before it would be
// overridden by the broken value, not kept as a fallback. What works is a block under
// `@supports not (color: light-dark(#000, #fff))` that sets the same custom properties to their LIGHT values: the browsers
// that lack the function get the light theme, the others never see the block. The block is generated, never edited by hand.
import { readFileSync, writeFileSync } from 'node:fs';

const file = new URL('../src/styles/tokens.css', import.meta.url);
const BEGIN = '/* BEGIN generated: light-dark() fallback (node scripts/sync-token-fallbacks.mjs) */';
const END = '/* END generated: light-dark() fallback */';

function splitTop(text) {
  const parts = [];
  let depth = 0;
  let cur = '';
  for (const ch of text) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) {
      parts.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  parts.push(cur.trim());
  return parts;
}

/** Replaces every light-dark(a, b) in a value by a. */
function lightSide(value) {
  let out = value;
  for (;;) {
    const at = out.indexOf('light-dark(');
    if (at < 0) return out;
    let depth = 0;
    let end = at + 'light-dark'.length;
    for (; end < out.length; end += 1) {
      if (out[end] === '(') depth += 1;
      if (out[end] === ')') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    out = out.slice(0, at) + splitTop(out.slice(at + 'light-dark('.length, end))[0] + out.slice(end + 1);
  }
}

export function buildBlock(css) {
  const withoutBlock = css.includes(BEGIN) ? css.slice(0, css.indexOf(BEGIN)) + css.slice(css.indexOf(END) + END.length) : css;
  const plain = withoutBlock.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [...plain.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .map(([, selector, body]) => ({ selector: selector.trim(), decls: [...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].filter(([, , v]) => v.includes('light-dark(')) }))
    .filter((r) => r.decls.length > 0);
  const lines = rules.map((r) => `  ${r.selector} {\n${r.decls.map(([, k, v]) => `    ${k}: ${lightSide(v.trim())};`).join('\n')}\n  }`);
  return `${BEGIN}\n/* Browsers without light-dark() get the light theme: the same custom properties with their light values. */\n@supports not (color: light-dark(#000, #fff)) {\n${lines.join('\n\n')}\n}\n${END}`;
}

export function withBlock(css) {
  const base = css.includes(BEGIN) ? css.slice(0, css.indexOf(BEGIN)).replace(/\s+$/, '') + css.slice(css.indexOf(END) + END.length) : css;
  return `${base.replace(/\s+$/, '')}\n\n${buildBlock(css)}\n`;
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  const css = readFileSync(file, 'utf8');
  const next = withBlock(css);
  if (process.argv.includes('--check')) {
    if (next !== css) {
      console.error('The light-dark() fallback block in src/styles/tokens.css is out of date: run  node scripts/sync-token-fallbacks.mjs');
      process.exit(1);
    }
    console.log('Fallback block is in step with the light-dark() colours.');
  } else {
    writeFileSync(file, next);
    console.log('Fallback block written to src/styles/tokens.css');
  }
}

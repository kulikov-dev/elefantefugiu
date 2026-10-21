// WCAG contrast of every colour pair the design uses, in every theme (light, dark) and every epoch palette.
// Reads src/styles/tokens.css (light-dark() pairs, var() chains, the rules of <html data-epoch="...">), resolves each
// token for each scope and checks the pairs below. Fails (exit 1) when a pair is under its threshold.
//   4.5:1  text of normal size       3:1  large text, edges of controls, focus ring, graphics (WCAG 1.4.3, 1.4.11)
// --color-border is a divider, not the edge of a control, so it is listed for information only (no threshold);
// controls use --color-border-strong.
import { readFileSync } from 'node:fs';
import { withBlock } from './sync-token-fallbacks.mjs';

const source = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');
// The generated @supports-not block (light values for browsers without light-dark()) must match the light-dark() colours.
if (withBlock(source) !== source) {
  console.error('FAIL  the light-dark() fallback block in src/styles/tokens.css is out of date: run  node scripts/sync-token-fallbacks.mjs');
  process.exit(1);
}
// The block holds the light values only; it is not a theme of its own, so it is left out of the contrast table.
const fallbackAt = source.indexOf('/* BEGIN generated');
const css = (fallbackAt < 0 ? source : source.slice(0, fallbackAt)).replace(/\/\*[\s\S]*?\*\//g, '');

// ---- parse the rules ----
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({
  selector: selector.trim(),
  props: Object.fromEntries([...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(([, k, v]) => [k, v.trim()])),
}));
const epochIds = [...css.matchAll(/:root\[data-epoch='([a-z0-9-]+)'\]/g)].map((m) => m[1]);
const scopes = [{ id: 'base', epoch: null }, ...epochIds.map((id) => ({ id, epoch: id }))];

function propsFor(scope) {
  const out = {};
  for (const rule of rules) {
    const sel = rule.selector;
    const applies = sel === ':root' || (scope.epoch && (sel === ':root[data-epoch]' || sel === ':root[data-epoch] main' || sel === `:root[data-epoch='${scope.epoch}']`));
    if (applies) Object.assign(out, rule.props);
  }
  return out;
}

// ---- resolve a token for a theme ----
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

function resolveText(text, props, theme, guard = 0) {
  if (guard > 30) throw new Error(`token loop: ${text}`);
  let out = text.replace(/var\((--[\w-]+)\)/g, (_, name) => {
    if (!(name in props)) throw new Error(`unknown token ${name}`);
    return resolveText(props[name], props, theme, guard + 1);
  });
  for (;;) {
    const at = out.indexOf('light-dark(');
    if (at < 0) break;
    let depth = 0;
    let end = at + 'light-dark'.length;
    for (; end < out.length; end += 1) {
      if (out[end] === '(') depth += 1;
      if (out[end] === ')') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    const [light, dark] = splitTop(out.slice(at + 'light-dark('.length, end));
    out = out.slice(0, at) + (theme === 'light' ? light : dark) + out.slice(end + 1);
  }
  return out.trim();
}

function parseColor(text) {
  const hex = text.match(/^#([0-9a-f]{6})$/i);
  if (hex) return { r: parseInt(hex[1].slice(0, 2), 16), g: parseInt(hex[1].slice(2, 4), 16), b: parseInt(hex[1].slice(4, 6), 16), a: 1 };
  const rgb = text.match(/^rgb\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:\s*\/\s*([\d.]+))?\s*\)$/i);
  if (rgb) return { r: +rgb[1], g: +rgb[2], b: +rgb[3], a: rgb[4] === undefined ? 1 : +rgb[4] };
  throw new Error(`cannot read colour "${text}"`);
}

const over = (top, back) => ({ r: top.r * top.a + back.r * (1 - top.a), g: top.g * top.a + back.g * (1 - top.a), b: top.b * top.a + back.b * (1 - top.a), a: 1 });
const lin = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = ({ r, g, b }) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// ---- the pairs ----
// [id, foreground token, background token or "token over token", threshold (null: information only)]
const T = 4.5;
const G = 3;
const PAIRS = [
  ['text on page', 'text', 'epoch-tint', T],
  ['text on page (base bg)', 'text', 'bg', T],
  ['text on surface', 'text', 'surface', T],
  ['text on hover surface', 'text', 'surface-hover', T],
  ['text on wash', 'text', 'accent-tint', T],
  ['text on overlay (over page)', 'text', 'overlay>epoch-tint', T],
  ['text on overlay (over map bg)', 'text', 'overlay>bg', T],
  ['muted on page', 'muted', 'epoch-tint', T],
  ['muted on page (base bg)', 'muted', 'bg', T],
  ['muted on surface', 'muted', 'surface', T],
  ['muted on wash', 'muted', 'accent-tint', T],
  ['link on page', 'accent', 'epoch-tint', T],
  ['link on page (base bg)', 'accent', 'bg', T],
  ['link on surface', 'accent', 'surface', T],
  ['link on wash', 'accent', 'accent-tint', T],
  ['link hover on page', 'accent-strong', 'epoch-tint', T],
  ['link hover on surface', 'accent-strong', 'surface', T],
  ['button text', 'on-accent', 'accent', T],
  ['button text, hover', 'on-accent', 'accent-strong', T],
  ['epoch primary text on page', 'epoch-primary', 'epoch-tint', T],
  ['epoch primary text on surface', 'epoch-primary', 'surface', T],
  ['epoch accent text on page', 'epoch-accent', 'epoch-tint', T],
  ['epoch accent text on surface', 'epoch-accent', 'surface', T],
  ['epoch alt text on page', 'epoch-alt', 'epoch-tint', T],
  ['epoch alt text on surface', 'epoch-alt', 'surface', T],
  ['text on epoch surface', 'text', 'epoch-surface', T],
  ['muted on epoch surface', 'muted', 'epoch-surface', T],
  ['link on epoch surface', 'accent', 'epoch-surface', T],
  ['link hover on epoch surface', 'accent-strong', 'epoch-surface', T],
  ['flash text on page', 'epoch-flash', 'epoch-tint', T],
  ['flash text on epoch surface', 'epoch-flash', 'epoch-surface', T],
  ['flash hover text on epoch surface', 'epoch-flash-strong', 'epoch-surface', T],
  ['button text on flash', 'on-accent', 'epoch-flash', T],
  ['control edge on epoch surface', 'border-strong', 'epoch-surface', G],
  ['focus ring on epoch surface', 'focus', 'epoch-surface', G],
  ['heavy-topic text', 'heavy-ink', 'heavy-bg', T],
  ['label documented', 'label-documented-ink', 'label-documented-bg', T],
  ['label legend', 'label-legend-ink', 'label-legend-bg', T],
  ['label debated', 'label-debated-ink', 'label-debated-bg', T],
  ['test-text notice', 'notice-ink', 'notice-bg', T],
  ['control edge on page', 'border-strong', 'epoch-tint', G],
  ['control edge on surface', 'border-strong', 'surface', G],
  ['control edge on wash', 'border-strong', 'accent-tint', G],
  ['focus ring on page', 'focus', 'epoch-tint', G],
  ['focus ring on surface', 'focus', 'surface', G],
  ['focus ring on wash', 'focus', 'accent-tint', G],
  ['heavy-topic frame on its bg', 'heavy-border', 'heavy-bg', G],
  ['heavy-topic frame on page', 'heavy-border', 'epoch-tint', G],
  ['notice frame on its bg', 'notice-border', 'notice-bg', G],
  ['epoch accent bar on page', 'epoch-accent', 'epoch-tint', G],
  ['tone blue on surface', 'viz-tone-blue', 'surface', G],
  ['tone red on surface', 'viz-tone-red', 'surface', G],
  ['tone green on surface', 'viz-tone-green', 'surface', G],
  ['tone ochre on surface', 'viz-tone-ochre', 'surface', G],
  ['tone grey on surface', 'viz-tone-grey', 'surface', G],
  ['tone blue on water wash', 'viz-tone-blue', 'accent-tint', G],
  ['tone red on water wash', 'viz-tone-red', 'accent-tint', G],
  ['tone green on water wash', 'viz-tone-green', 'accent-tint', G],
  ['tone ochre on water wash', 'viz-tone-ochre', 'accent-tint', G],
  ['tone grey on water wash', 'viz-tone-grey', 'accent-tint', G],
  ['divider on page (decorative)', 'border', 'epoch-tint', null],
  ['divider on surface (decorative)', 'border', 'surface', null],
];

function colorOf(spec, props, theme) {
  const [top, back] = spec.split('>');
  const get = (name) => parseColor(resolveText(`var(--${name === 'epoch-tint' || name.startsWith('epoch-') || name.startsWith('viz-') ? name : `color-${name}`})`, props, theme));
  const color = get(top);
  return back ? over(color, get(back)) : color;
}

const columns = [];
for (const scope of scopes) for (const theme of ['light', 'dark']) columns.push({ scope, theme, props: propsFor(scope) });

let failures = 0;
const rows = PAIRS.map(([id, fg, bg, need]) => {
  const cells = columns.map(({ scope, theme, props }) => {
    const background = colorOf(bg, props, theme);
    const foreground = colorOf(fg, props, theme);
    const r = ratio(over(foreground, background), background);
    const bad = need !== null && r < need;
    if (bad) {
      failures += 1;
      console.error(`FAIL  ${id} [${scope.id}, ${theme}]: ${r.toFixed(2)}:1, needs ${need}:1`);
    }
    return { r, bad };
  });
  return { id, need, cells };
});

// The two theme-color metas must be the page background of each theme.
const names = (c) => `${c.scope.id.split('-')[0].slice(0, 6)} ${c.theme[0].toUpperCase()}`;
const pad = (s, n) => String(s).padEnd(n);
console.log(`\nContrast (WCAG), ${PAIRS.length} pairs x ${columns.length} scopes (base + ${epochIds.length} epochs, light and dark). "!" marks a pair under its threshold.\n`);
console.log(`${pad('pair', 36)} ${pad('need', 5)} ${columns.map((c) => pad(names(c), 9)).join(' ')}`);
for (const row of rows) {
  console.log(`${pad(row.id, 36)} ${pad(row.need ?? 'info', 5)} ${row.cells.map((c) => pad(c.r.toFixed(1) + (c.bad ? '!' : ''), 9)).join(' ')}`);
}
const lowest = Math.min(...rows.filter((r) => r.need !== null).flatMap((r) => r.cells.map((c) => c.r / r.need)));
console.log(`\n${failures === 0 ? 'Contrast check passed' : `Contrast check FAILED: ${failures} pair(s)`} (${rows.filter((r) => r.need !== null).length * columns.length} checks; the tightest pair is ${lowest.toFixed(2)} times its threshold).`);
process.exit(failures === 0 ? 0 : 1);

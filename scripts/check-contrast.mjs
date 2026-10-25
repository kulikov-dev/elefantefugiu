// WCAG contrast of every colour pair the design uses, in every theme (light, dark) and every epoch palette.
// Reads src/styles/tokens.css (light-dark() pairs, var() chains, the rules of <html data-epoch="...">), resolves each
// token for each scope and checks the pairs below. Fails (exit 1) when a pair is under its threshold.
//   4.5:1  text of normal size       3:1  large text, edges of controls, focus ring, graphics (WCAG 1.4.3, 1.4.11)
// --color-border is a divider, not the edge of a control, so it is listed for information only (no threshold);
// controls use --color-border-strong.
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
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
  ['label documented on epoch surface', 'label-documented-ink', 'epoch-surface', T],
  ['label legend on epoch surface', 'label-legend-ink', 'epoch-surface', T],
  ['label debated on epoch surface', 'label-debated-ink', 'epoch-surface', T],
  ['text on pattern, highest opacity (page)', 'text', 'pattern@azulejo-opacity-frame>epoch-tint', T],
  ['text on pattern, highest opacity (surface)', 'text', 'pattern@azulejo-opacity-frame>epoch-surface', T],
  ['muted on pattern, under-text opacity (page)', 'muted', 'pattern@azulejo-opacity>epoch-tint', T],
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
  ['marker fill on map land', 'accent', 'map-land', G],
  ['marker fill on map water', 'accent', 'map-water', G],
  ['marker ring on its fill', 'surface', 'accent', G],
  ['story marker edge on map land', 'accent', 'map-land', G],
  ['story marker edge on map water', 'accent', 'map-water', G],
  ['selected marker outline on map land', 'ink', 'map-land', G],
  ['selected marker outline on map water', 'ink', 'map-water', G],
  ['text on marker caption (over map land)', 'text', 'overlay>map-land', T],
  ['divider on page (decorative)', 'border', 'epoch-tint', null],
  ['divider on surface (decorative)', 'border', 'surface', null],
];

function colorOf(spec, props, theme) {
  // "pattern@<opacity token>>base": the pattern layer (the epoch's primary colour at that opacity) lying on a base colour.
  // Text is never drawn over a pattern by design; this is the worst case, a solid pattern pixel at the highest opacity.
  const layer = spec.match(/^pattern@([\w-]+)>(.+)$/);
  if (layer) {
    const alpha = Number(resolveText(`var(--${layer[1]})`, props, theme));
    const pixel = { ...colorOf('epoch-primary', props, theme), a: alpha };
    return over(pixel, colorOf(layer[2], props, theme));
  }
  const [top, back] = spec.split('>');
  // The ground of the map: the land and water colours of the CARTO styles Voyager (light theme) and Dark Matter (dark theme),
  // taken from their style files at basemaps.cartocdn.com/gl/voyager-gl-style and dark-matter-gl-style.
  const MAP_GROUND = { light: { 'map-land': '#fbf8f3', 'map-water': '#b0d0d6' }, dark: { 'map-land': '#0e0e0e', 'map-water': '#2c353c' } };
  const get = (name) => MAP_GROUND[theme]?.[name] ? parseColor(MAP_GROUND[theme][name]) : parseColor(resolveText(`var(--${name === 'epoch-tint' || name.startsWith('epoch-') || name.startsWith('viz-') ? name : `color-${name}`})`, props, theme));
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

// ---- thread colours (src/content/threads.yaml: `color` for the light theme, `color_dark`, lighter, for the dark one) ----
// The dot of a thread is a graphic beside the name of the thread: 3:1 against the surfaces it lies on in its theme, and the five
// colours of a theme far enough from each other (CIE76 colour difference) that two neighbours are never taken for one.
const THREAD_GRAPHIC = 3;
const THREAD_APART = 20;
const threadData = parse(readFileSync(new URL('../src/content/threads.yaml', import.meta.url), 'utf8'));
const baseProps = propsFor(scopes[0]);
for (const { id, color, color_dark: colorDark } of threadData) {
  for (const [theme, value] of [['light', color], ['dark', colorDark]]) {
    for (const ground of ['surface', 'bg']) {
      const r = ratio(parseColor(value), colorOf(ground, baseProps, theme));
      if (r < THREAD_GRAPHIC) {
        failures += 1;
        console.error(`FAIL  thread "${id}" ${value} on ${ground} [${theme}]: ${r.toFixed(2)}:1, needs ${THREAD_GRAPHIC}:1`);
      }
    }
  }
}
const toLab = ({ r, g, b }) => {
  const [R, G, B] = [r, g, b].map(lin);
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const [x, y, z] = [(0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047, 0.2126 * R + 0.7152 * G + 0.0722 * B, (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883];
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
};
let closest = Infinity;
for (const key of ['color', 'color_dark']) {
  for (let i = 0; i < threadData.length; i++) {
    for (let j = i + 1; j < threadData.length; j++) {
      const a = toLab(parseColor(threadData[i][key]));
      const b = toLab(parseColor(threadData[j][key]));
      const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      closest = Math.min(closest, d);
      if (d < THREAD_APART) {
        failures += 1;
        console.error(`FAIL  threads "${threadData[i].id}" and "${threadData[j].id}" look alike (${key}): difference ${d.toFixed(1)}, needs ${THREAD_APART}`);
      }
    }
  }
}
console.log(`
Thread colours, light: ${threadData.map((t) => `${t.id} ${t.color}`).join(', ')}.
Thread colours, dark: ${threadData.map((t) => `${t.id} ${t.color_dark}`).join(', ')}.
The closest two of a theme differ by ${closest.toFixed(1)} (needs ${THREAD_APART}).`);

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

// The bolo-rei of the page of Christmas (docs/drafts/bolo-rei.js, approved by the owner): a puffy ring on a plate, 8 slices, candied fruit, drawn as an SVG string.
// The same code draws the whole cake at build time (the home page and the page of the holiday without JavaScript: festa-art.mjs) and the cut cake in the
// browser (src/scripts/bolo-rei.ts), so both look alike. The cake is `draw({ gone, out })` for an <svg viewBox="0 0 400 240">; the rest is the rules of the
// game (what lies in which slice, the state kept in localStorage). Plain JavaScript with no Astro or DOM imports: the build, the browser and the tests import it.
// Colours are the --festa-* tokens (src/styles/tokens.css); candied fruit and the glaze have tokens of their own.

export const N = 8;
/** The size of the drawing (viewBox), for putting HTML over it. */
export const W = 400;
export const H = 240;

const CX = 200;
const CY = 128;
const R = 152;
const r = 50;
const K = 0.44;
const D = 30;
const STEP = 360 / N;
const CRUMB = 'color-mix(in srgb, var(--festa-warm) 30%, var(--festa-shell))';
const CRUST = 'color-mix(in srgb, var(--festa-warm) 80%, var(--festa-glaze))';
const SHADE = 'color-mix(in srgb, var(--festa-warm) 64%, var(--festa-glaze-deep))';
const CHERRY = 'var(--festa-cherry)';
const GREEN = 'var(--festa-angelica)';
const PEEL = 'var(--festa-peel)';
const INK = 'var(--festa-ink)';
const SHELL = 'var(--festa-shell)';

const rad = (d) => (d * Math.PI) / 180;
/** How coordinates are written: one decimal, or whole numbers for the static drawing (draw sets it). */
let whole = false;
const num = (v) => String(whole ? Math.round(v) : Math.round(v * 10) / 10);
/** Points of the cross-section of the ring (the profile of a slice). */
const PROFILE = 10;
const pt = (rr, deg) => [CX + rr * Math.cos(rad(deg)), CY + rr * Math.sin(rad(deg)) * K];
const hgt = (t) => D * Math.pow(Math.sin(Math.PI * t), 0.75); // rounded loaf profile
/* the ring is hand-made: radius and height wobble a little round the circle */
const wob = (deg) => 1 + 0.022 * Math.sin(rad(deg * 6 + 20)) + 0.012 * Math.sin(rad(deg * 11));
const hwob = (deg) => 1 + 0.13 * Math.sin(rad(deg * 5 + 40)) + 0.07 * Math.sin(rad(deg * 13 + 10));
function surf(t, deg, lift) {
  const p = pt((r + (R - r) * t) * wob(deg), deg);
  p[1] -= hgt(t) * hwob(deg) * (lift == null ? 1 : lift);
  return p;
}
const P = (q) => `${num(q[0])} ${num(q[1])}`;
/** Twice the signed area of a polygon (its direction round). */
const area = (pts) => pts.reduce((a, q, i) => { const n = pts[(i + 1) % pts.length]; return a + q[0] * n[1] - n[0] * q[1]; }, 0);
/** A closed shape. Every one runs the same way round, so that many of them in one path (one fill) join and never cut a hole in each other. */
const poly = (pts) => `M${(area(pts) < 0 ? pts.slice().reverse() : pts).map(P).join(' L')} Z`;
const polyline = (pts) => `M${pts.map(P).join(' L')}`;
const center = (i) => 90 + i * STEP; // slice 0 faces the viewer, the rest go round
function seed(i, j) {
  const x = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** An SVG element as a string; `inner` is already markup. */
function el(name, attrs, inner) {
  const a = Object.entries(attrs)
    .map(([k, v]) => ` ${k}="${v}"`)
    .join('');
  return inner == null ? `<${name}${a}/>` : `<${name}${a}>${inner}</${name}>`;
}
const path = (d, attrs) => el('path', { d, ...attrs });

/** The parts of [a, b] (degrees) that fall inside [lo, hi]. */
function clip(a, b, lo, hi) {
  const out = [];
  for (let s = -360; s <= 360; s += 360) {
    const x = Math.max(a, lo + s);
    const y = Math.min(b, hi + s);
    if (y > x) out.push([x, y]);
  }
  return out;
}

/** Outline of the slice body seen from above: for each angle, the highest point of the cross-section. */
function outline(a, b) {
  const up = [];
  const n = 16;
  for (let i = 0; i <= n; i++) {
    const d = a + ((b - a) * i) / n;
    let mn = null;
    for (let j = 0; j <= 20; j++) {
      const q = surf(j / 20, d);
      if (!mn || q[1] < mn[1]) mn = q;
    }
    up.push(mn);
  }
  return up;
}

/** Where the cut slice slides to: out and a little towards the viewer. */
export function shift(i) {
  const c = rad(center(i));
  return [Math.cos(c) * 34, Math.sin(c) * 34 * K + 10];
}

/** Where the speech bubble over a cut slice points: the top of the slice after it slid out, in viewBox units (400 x 240). */
export function anchor(i) {
  const p = surf(0.5, center(i));
  const sh = shift(i);
  return [p[0] + sh[0], p[1] + sh[1] - 8];
}

const INK_LINE = { stroke: INK, 'stroke-width': 1.8, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', fill: 'none' };

/** The cut surface of a slice at angle d: crumb under a thin crust, with bits of fruit. */
function face(i, d) {
  let s = path(poly(Array.from({ length: 21 }, (_, j) => surf(j / 20, d))), { ...INK_LINE, fill: CRUMB });
  const crust = Array.from({ length: 19 }, (_, j) => surf((j + 1) / 20, d, 0.86));
  s += path(polyline(crust), { fill: 'none', stroke: CRUST, 'stroke-width': 2.6, 'stroke-linecap': 'round' });
  for (let m = 0; m < 6; m++) {
    const t = 0.18 + 0.64 * seed(i * 7 + m, d);
    const q = surf(t, d, 0.25 + 0.45 * seed(m, i + d));
    s +=
      m < 3
        ? el('rect', { x: num(q[0] - 2.5), y: num(q[1] - 2), width: 5, height: 4, rx: 1, fill: [CHERRY, GREEN, PEEL][m], stroke: INK, 'stroke-width': 0.6 })
        : el('ellipse', { cx: num(q[0]), cy: num(q[1]), rx: 1.6, ry: 1.1, fill: INK, opacity: 0.45 });
  }
  return el('g', {}, s);
}

/** One slice. `open`: the set of slices next to it that are gone (their cut surface shows). `sweep`: steps round the slice (more is smoother, and heavier). */
function slice(i, open, extra, sweep) {
  const c = center(i);
  const a = c - STEP / 2;
  const b = c + STEP / 2;
  const openA = open.has((i + N - 1) % N);
  const openB = open.has((i + 1) % N);
  const showA = Math.cos(rad(a)) < 0; // faces turned towards the viewer
  const showB = Math.cos(rad(b)) > 0;
  const fa = openA ? face(i, a) : '';
  const fb = openB ? face(i, b) : '';
  let s = (fa && !showA ? fa : '') + (fb && !showB ? fb : '');

  // body: the cross-section swept round the ring, filled without outline so slices join without seams (closed joints overlap a little)
  const ea = openA ? a : a - 0.8;
  const eb = openB ? b : b + 0.8;
  const arches = [];
  for (let st = 0; st <= sweep; st++) {
    const dd = ea + ((eb - ea) * st) / sweep;
    arches.push(Array.from({ length: PROFILE + 1 }, (_, j) => surf(j / PROFILE, dd)));
  }
  // all the pieces of one fill are one path with many subpaths
  let body = '';
  arches.forEach((arch, st) => {
    body += poly(arch);
    if (st) body += poly(arches[st - 1].concat(arch.slice().reverse()));
  });
  s += path(body, { fill: CRUST, stroke: CRUST, 'stroke-width': 1 });
  // shade the lower slope that faces the viewer, as an opaque tone so overlapping joints leave no lines
  let shade = '';
  let prev = null;
  for (let st = 0; st <= sweep; st++) {
    const dd = ea + ((eb - ea) * st) / sweep;
    const front = Math.sin(rad(dd)) > 0;
    const sl = Array.from({ length: 5 }, (_, j) => surf(front ? 0.8 + 0.05 * j : 0.2 - 0.05 * j, dd));
    if (prev && prev.front === front) shade += poly(prev.pts.concat(sl.slice().reverse()));
    prev = { pts: sl, front };
  }
  if (shade) s += path(shade, { fill: SHADE, stroke: SHADE, 'stroke-width': 1 });

  const arcAt = (t, [from, to]) => polyline(Array.from({ length: 13 }, (_, k) => surf(t, from + ((to - from) * k) / 12)));
  // outline the base where it meets the plate
  clip(a, b, 0, 180).forEach((seg) => (s += path(arcAt(1, seg), INK_LINE)));
  clip(a, b, 180, 360).forEach((seg) => (s += path(arcAt(0, seg), INK_LINE)));
  // top silhouette: the highest point of each cross-section
  s += path(polyline(outline(a, b)), INK_LINE);
  // side silhouettes at the far left and right of the ring
  [0, 180].forEach((e) => {
    clip(a, b, e - 0.01, e + 0.01).forEach(() => (s += path(polyline(Array.from({ length: 9 }, (_, k) => surf((k + 8) / 16, e))), INK_LINE)));
  });
  // glaze shine along the top
  const hl = Array.from({ length: 9 }, (_, k) => surf(0.5, a + STEP * (0.1 + (0.8 * k) / 8), 1.04));
  s += path(polyline(hl), { fill: 'none', stroke: SHELL, 'stroke-width': 2.4, 'stroke-linecap': 'round', opacity: 0.7 });

  // toppings: candied cherries (the "jewels"), candied orange slices, long candied strips, pine nuts, sugar
  const tops = [];
  for (let j = 0; j < 4; j++) tops.push({ d: a + STEP * (0.14 + 0.24 * j) + (seed(i, j) - 0.5) * 5, t: 0.3 + 0.4 * seed(j + 1, i), kind: (i + j) % 4 });
  tops.sort((x, y) => surf(x.t, x.d)[1] - surf(y.t, y.d)[1]);
  tops.forEach((tp, j) => {
    const p = surf(tp.t, tp.d);
    const tr = `translate(${P(p)}) rotate(${(seed(i, j + 5) * 50 - 25).toFixed(0)})`;
    if (tp.kind === 0) {
      s += el('circle', { cx: num(p[0]), cy: num(p[1] - 3), r: 6.5, fill: (i + j) % 3 ? CHERRY : GREEN, stroke: INK, 'stroke-width': 1.3 });
      s += el('circle', { cx: num(p[0] - 2.2), cy: num(p[1] - 5.4), r: 1.8, fill: SHELL });
    } else if (tp.kind === 1) {
      s += path('M-11 2 A11 7 0 0 1 11 2 Z', { fill: PEEL, stroke: INK, 'stroke-width': 1.4, 'stroke-linejoin': 'round', transform: tr });
      s += path('M0 2 L-7 -2 M0 2 L0 -4 M0 2 L7 -2', { stroke: INK, 'stroke-width': 1, transform: tr });
    } else if (tp.kind === 2) {
      s += el('rect', { x: -9, y: -3, width: 18, height: 6, rx: 2.5, fill: (i + j) % 2 ? GREEN : CHERRY, stroke: INK, 'stroke-width': 1.3, transform: tr });
      s += path('M-5 -1 L5 -1', { stroke: INK, 'stroke-width': 0.9, opacity: 0.6, transform: tr });
    } else {
      s += el('ellipse', { cx: 0, cy: 0, rx: 4.6, ry: 2.4, fill: SHELL, stroke: INK, 'stroke-width': 1.1, transform: tr });
      s += el('ellipse', { cx: 6, cy: 3, rx: 4.6, ry: 2.4, fill: SHELL, stroke: INK, 'stroke-width': 1.1, transform: tr });
    }
  });
  for (let m = 0; m < 6; m++) {
    const q = surf(0.2 + 0.6 * seed(i + 3, m), a + STEP * (0.08 + 0.84 * seed(m, i + 7)));
    s += el('rect', { x: num(q[0] - 2.2), y: num(q[1] - 1.4), width: 4.4, height: 2.8, rx: 1, fill: SHELL, stroke: INK, 'stroke-width': 0.6 });
  }
  s += fa && showA ? fa : '';
  s += fb && showB ? fb : '';
  return el('g', { class: extra ? 'slice cut' : 'slice', 'data-i': i, ...(extra ?? {}) }, s);
}

/**
 * The inner markup of the cake's <svg viewBox="0 0 400 240">.
 * `gone`: the eaten slices (crumbs on the plate). `out`: the slice that was just cut (-1: none); it is slides out when its
 * `.cut` group gets the transform `shift(out)` (the page does that; `slid: true` puts it there from the start, for "reduce motion").
 * `sweep`: steps round a slice (more is smoother and heavier). `whole`: coordinates as whole numbers (the static drawing, lighter).
 * @param {{ gone?: Iterable<number>, out?: number, slid?: boolean, sweep?: number, whole?: boolean }} [state]
 */
export function draw(state = {}) {
  const gone = new Set(state.gone ?? []);
  const out = state.out ?? -1;
  const sweep = state.sweep ?? 10;
  whole = state.whole === true;
  // plate with a dotted rim
  let s = el('ellipse', { cx: CX, cy: CY + 16, rx: 192, ry: 88, fill: 'var(--festa-plate)', stroke: INK, 'stroke-width': 2 });
  s += el('ellipse', { cx: CX, cy: CY + 13, rx: 170, ry: 74, fill: 'none', stroke: INK, 'stroke-width': 1.2 });
  let rim = '';
  for (let k = 0; k < 30; k++) rim += el('circle', { cx: num(CX + 181 * Math.cos(rad(k * 12))), cy: num(CY + 16 + 81 * Math.sin(rad(k * 12))), r: 1.8 });
  s += el('g', { fill: INK }, rim);
  // crumbs where slices were eaten
  [...gone].forEach((i) => {
    for (let m = 0; m < 4; m++) {
      const q = pt(r + (R - r) * (0.2 + 0.6 * seed(i, m + 11)), center(i) + (seed(m, i + 2) - 0.5) * STEP * 0.8);
      s += el('circle', { cx: num(q[0]), cy: num(q[1]), r: (1.4 + 1.2 * seed(i, m)).toFixed(1), fill: 'var(--festa-warm)', stroke: INK, 'stroke-width': 0.8 });
    }
  });
  const open = new Set(gone);
  if (out >= 0) open.add(out);
  // back to front, as the approved drawing does (the slice that was cut slides out in its own place in the row)
  const order = [];
  for (let i = 0; i < N; i++) if (!gone.has(i)) order.push(i);
  order.sort((x, y) => Math.sin(rad(center(x))) - Math.sin(rad(center(y))));
  const all = new Set(Array.from({ length: N }, (_, i) => i));
  order.forEach((i) => {
    if (i !== out) {
      s += slice(i, open, null, sweep);
      return;
    }
    const sh = state.slid ? shift(out) : [0, 0];
    s += slice(out, all, { style: `transform:translate(${num(sh[0])}px,${num(sh[1])}px)` }, sweep);
  });
  return s;
}

/** The whole cake, as the home page shows it and the page shows it without JavaScript. */
export const cake = () => draw({ whole: true });

// ---- the game: what lies in which slice, and what the browser remembers ----

/** Random slices for the bean (fava) and the gift (brinde), never the same one. */
export function randomItems(random = Math.random) {
  const fava = Math.floor(random() * N);
  const brinde = (fava + 1 + Math.floor(random() * (N - 1))) % N;
  return { fava, brinde };
}

/** A fresh state of the cake for `year`. */
export const freshState = (year, random = Math.random) => ({ year, cut: 0, ...randomItems(random) });

const isSlice = (v) => Number.isInteger(v) && v >= 0 && v < N;

/**
 * The state kept in localStorage (`{ year, cut, fava, brinde }`, as a string or null): the stored one when it is whole and belongs to `year`, otherwise a fresh one
 * (another year is another cake with new random slices; anything damaged is no cake at all).
 * @param {string | null | undefined} raw
 * @param {number} year
 */
export function readState(raw, year, random = Math.random) {
  try {
    const s = JSON.parse(raw ?? 'null');
    if (s && s.year === year && Number.isInteger(s.cut) && s.cut >= 0 && s.cut <= N && isSlice(s.fava) && isSlice(s.brinde) && s.fava !== s.brinde) {
      return { year, cut: s.cut, fava: s.fava, brinde: s.brinde };
    }
  } catch {
    // damaged: a fresh cake
  }
  return freshState(year, random);
}

/** What lay in slice `i`: the bean, the gift or just candied fruit. */
export const whatIn = (state, i) => (state.fava === i ? 'fava' : state.brinde === i ? 'brinde' : 'fruit');

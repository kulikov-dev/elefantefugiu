// The small map of a journey in a story (docs/spec.md 5.3a): a static SVG model made at build time from the points of `route`. Pure functions, no Astro imports.
// The land comes from Natural Earth (src/lib/route-geo.ts), projected (Mercator) to the frame of the route and simplified; the line goes through the points
// (sea and air: a smooth curve, land: straight, river: along the course of the river); a `via` point only bends the line and is not drawn.
import type { LText } from './localize';
import type { RouteGeo, Ring } from './route-geo';

export type RouteMode = 'sea' | 'land' | 'air' | 'river';
type Lang = 'pt' | 'en' | 'ru';

export interface MapPoint {
  name?: LText | undefined;
  lat: number;
  lng: number;
  year?: number | undefined;
  date?: LText | undefined;
  via?: true | undefined;
  mode?: RouteMode | undefined;
  approx?: boolean | undefined;
  river?: string | undefined;
  /** `ferry`: the leg that arrives at this point went over water (a river crossed by a ferry inside a journey by land). */
  leg?: 'ferry' | undefined;
}
export interface MapRoute {
  points: MapPoint[];
  approx?: boolean | undefined;
  /** The years of the caption when the span of the years of the stops does not match the story ("1515–1516"). */
  years?: string | undefined;
}

/** The frame of the map in SVG units: one unit is about one pixel on a phone (the picture scales to the width of its column). */
export const ROUTE_FRAME = { w: 360, h: 270, padX: 34, padY: 26, font: 13, minSpanDeg: 1.5 } as const;
/** Width of the label line in units per character (an estimate for the text face of the site) and the longest line before it is wrapped. */
const CHAR_W = 0.56;
const WRAP_AT = 16;
/** The dotted line of an approximate leg: a dot (dash 1, round caps) every DOT_PERIOD units. */
const DOT_PERIOD = 6;
/** Samples per piece of a curve (a Bézier segment): the label placement and the land check of the sea legs walk them. */
const CURVE_STEPS = 24;
/** The land path is simplified further while it is longer than this (characters): a story page keeps its map near 10 KB of SVG. */
const LAND_MAX = 8000;
/** A map whose points span no more than this many degrees (the longer side) is a map of a region: it gets the land at 1:10m, so that an estuary can be seen. */
export const FINE_MAX_DEG = 8;
/** The dashes of a ferry leg (a longer stroke than the dots of an approximate leg). */
/** The land path of a map of a region may be longer (characters): the estuaries need the vertices. */
const LAND_MAX_FINE = 14000;
/** Stops closer than this (units, about px) have smaller dots. */
const CROWDED = 15;
const FERRY_DASH = '5 5';

type XY = [number, number];

export interface RouteRun {
  d: string;
  /** stroke-dasharray of an approximate (dotted) run, fitted so that the last dot sits on the end of the run. */
  dash?: string;
  /** A ferry run: dashed (the same line, another stroke). */
  ferry?: true;
}
export interface RouteLabel {
  x: number;
  anchor: 'start' | 'middle' | 'end';
  lines: { text: string; y: number }[];
}
export interface RouteMapModel {
  w: number;
  h: number;
  land: string;
  /** All runs in one path (the line is drawn by revealing it through a mask). */
  mask: string;
  runs: RouteRun[];
  dots: { x: number; y: number; r: number }[];
  labels: RouteLabel[];
  stops: { name: string; when?: string }[];
  /** The stops for the caption of the map: all of them when there are up to CAPTION_STOPS, else the first and the last with an ellipsis between. */
  path: string;
  years: string;
  /** The sea legs as drawn, in degrees, one entry per piece of the curve between two neighbouring points; `section` is the index of the stop-to-stop section (check:data walks it over the land). */
  seaTrack: { section: number; pts: [number, number][] }[];
  approx: boolean;
  /** Some leg is a ferry (the note under the map explains the dashes). */
  ferry: boolean;
}

const rad = (deg: number) => (deg * Math.PI) / 180;
const deg = (radians: number) => (radians * 180) / Math.PI;
const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + rad(Math.max(-85, Math.min(85, lat))) / 2));
const r1 = (n: number) => Math.round(n * 10) / 10;
const fmt = (p: XY) => `${r1(p[0])} ${r1(p[1])}`;
const dist = (a: XY, b: XY) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** The stops, in order: the points that are not `via`. */
export const stopsOf = (route: MapRoute): MapPoint[] => route.points.filter((p) => !p.via);

/** The caption names every stop up to this many; a longer route shows the first and the last with an ellipsis between. */
export const CAPTION_STOPS = 4;

/** "1514", or "1515–1516" from the earliest to the latest year of the stops when they differ; `route.years` replaces it; empty when no stop has a year. */
export function routeYears(route: MapRoute): string {
  if (route.years) return route.years;
  const years = stopsOf(route).flatMap((p) => (p.year === undefined ? [] : [p.year]));
  if (years.length === 0) return '';
  const a = Math.min(...years);
  const b = Math.max(...years);
  return a === b ? String(a) : `${a}–${b}`;
}

/** "A → B → C" for up to CAPTION_STOPS names, else "A → … → Z". */
export function routePath(names: string[]): string {
  return (names.length <= CAPTION_STOPS ? names : [names[0]!, '…', names[names.length - 1]!]).join(' → ');
}

/** A leg is approximate when the point it arrives at says so, else by the default of the route. */
const legApprox = (route: MapRoute, p: MapPoint) => p.approx ?? route.approx ?? false;

/** The land the map of this route is drawn on and checked against: 1:10m for a region (the points span up to FINE_MAX_DEG degrees), else 1:50m. */
export function landOf(route: MapRoute, geo: RouteGeo): Ring[] {
  const lons = route.points.map((p) => p.lng);
  const lats = route.points.map((p) => p.lat);
  const span = Math.max(Math.max(...lons) - Math.min(...lons), Math.max(...lats) - Math.min(...lats));
  return span <= FINE_MAX_DEG && geo.fine ? geo.fine : geo.land;
}

/** Douglas-Peucker; a closed ring (first point = last) is measured from the first point. */
function simplify(pts: XY[], tol: number): XY[] {
  if (pts.length < 3) return pts;
  const a = pts[0]!;
  const b = pts[pts.length - 1]!;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  let max = 0;
  let at = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i]!;
    const d = len < 1e-6 ? dist(p, a) : Math.abs(dy * (p[0] - a[0]) - dx * (p[1] - a[1])) / len;
    if (d > max) {
      max = d;
      at = i;
    }
  }
  if (max <= tol) return [a, b];
  return [...simplify(pts.slice(0, at + 1), tol).slice(0, -1), ...simplify(pts.slice(at), tol)];
}

const area = (ring: XY[]) => ring.reduce((sum, p, i) => sum + (ring[(i + 1) % ring.length]![0] - p[0]) * (ring[(i + 1) % ring.length]![1] + p[1]), 0) / 2;

/** Sutherland-Hodgman: a ring cut to the rectangle. */
function clipRing(ring: XY[], x0: number, y0: number, x1: number, y1: number): XY[] {
  const edges: { inside: (p: XY) => boolean; cut: (a: XY, b: XY) => XY }[] = [
    { inside: (p) => p[0] >= x0, cut: (a, b) => [x0, a[1] + ((b[1] - a[1]) * (x0 - a[0])) / (b[0] - a[0])] },
    { inside: (p) => p[0] <= x1, cut: (a, b) => [x1, a[1] + ((b[1] - a[1]) * (x1 - a[0])) / (b[0] - a[0])] },
    { inside: (p) => p[1] >= y0, cut: (a, b) => [a[0] + ((b[0] - a[0]) * (y0 - a[1])) / (b[1] - a[1]), y0] },
    { inside: (p) => p[1] <= y1, cut: (a, b) => [a[0] + ((b[0] - a[0]) * (y1 - a[1])) / (b[1] - a[1]), y1] },
  ];
  let out = ring;
  for (const edge of edges) {
    const input = out;
    out = [];
    input.forEach((cur, i) => {
      const prev = input[(i + input.length - 1) % input.length]!;
      if (edge.inside(cur)) {
        if (!edge.inside(prev)) out.push(edge.cut(prev, cur));
        out.push(cur);
      } else if (edge.inside(prev)) out.push(edge.cut(prev, cur));
    });
    if (out.length === 0) break;
  }
  return out;
}

/** A ring with its longitudes made continuous (a coast that crosses the antimeridian runs on past 180 instead of jumping to -180). */
function unwrap(ring: Ring): Ring {
  let shift = 0;
  return ring.map(([lon, lat], i) => {
    if (i > 0) {
      const jump = lon - ring[i - 1]![0];
      if (jump > 180) shift -= 360;
      else if (jump < -180) shift += 360;
    }
    return [lon + shift, lat];
  });
}

/** The land as one path: every ring that reaches the frame, cut a little outside it, simplified, tiny islands left out; a wide map is simplified more until the path is small. */
interface FlatRing {
  ring: Ring;
  lo: number;
  hi: number;
  minLat: number;
  maxLat: number;
}
const flatCache = new WeakMap<Ring[], FlatRing[]>();
/** The rings with continuous longitudes and their boxes, made once per set of rings (the fine land has about a million points). */
function flatOf(rings: Ring[]): FlatRing[] {
  let flat = flatCache.get(rings);
  if (!flat) {
    flat = rings.map((r) => {
      const ring = unwrap(r);
      let lo = Infinity;
      let hi = -Infinity;
      let minLat = Infinity;
      let maxLat = -Infinity;
      for (const [lon, lat] of ring) {
        if (lon < lo) lo = lon;
        if (lon > hi) hi = lon;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
      return { ring, lo, hi, minLat, maxLat };
    });
    flatCache.set(rings, flat);
  }
  return flat;
}

function landPath(rings: Ring[], project: (lon: number, lat: number) => XY, w: number, h: number, lonWindow: [number, number], latWindow: [number, number], fine: boolean): string {
  const flat = flatOf(rings);
  let d = '';
  for (const tolerance of fine ? [0.3, 0.5, 0.8, 1.2, 1.8] : [0.5, 0.8, 1.2, 1.8]) {
    d = landPathAt(flat, project, w, h, lonWindow, latWindow, tolerance);
    if (d.length <= (fine ? LAND_MAX_FINE : LAND_MAX)) break;
  }
  return d;
}

function landPathAt(rings: FlatRing[], project: (lon: number, lat: number) => XY, w: number, h: number, lonWindow: [number, number], latWindow: [number, number], tolerance: number): string {
  const margin = 20;
  let d = '';
  for (const { ring, lo, hi, minLat, maxLat } of rings) {
    if (maxLat < latWindow[0] || minLat > latWindow[1]) continue;
    // The world repeats every 360 degrees: a ring (shifted by a turn) can reach the frame from either side.
    for (const turn of [-360, 0, 360]) {
      if (hi + turn < lonWindow[0] || lo + turn > lonWindow[1]) continue;
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      const pts: XY[] = ring.map(([lon, lat]) => {
        const p = project(lon + turn, lat);
        if (p[0] < minX) minX = p[0];
        if (p[0] > maxX) maxX = p[0];
        if (p[1] < minY) minY = p[1];
        if (p[1] > maxY) maxY = p[1];
        return p;
      });
      if (maxX < -margin || minX > w + margin || maxY < -margin || minY > h + margin) continue;
      if (maxX - minX < 4 && maxY - minY < 4) continue;
      const cut = pts.every((p) => p[0] >= -margin && p[0] <= w + margin && p[1] >= -margin && p[1] <= h + margin) ? pts : clipRing(pts, -margin, -margin, w + margin, h + margin);
      const q = simplify(cut, tolerance);
      // A ring that the cut left as a sliver (a coast that only runs along the edge of the frame) has no area and would draw as a line.
      if (q.length < 3 || Math.abs(area(q)) < 2) continue;
      d += `M${q.map(fmt).join('L')}Z`;
    }
  }
  return d;
}

/** A smooth curve through the points (Catmull-Rom as cubic Béziers); two points make a gentle arc that bows to the north. Returns the path and the points sampled along it. */
function curve(pts: XY[]): { d: string; samples: XY[] } {
  const first = pts[0]!;
  let d = `M${fmt(first)}`;
  const samples: XY[] = [first];
  if (pts.length === 2) {
    const [a, b] = [pts[0]!, pts[1]!];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    let nx = -dy;
    let ny = dx;
    if (ny > 0) {
      nx = -nx;
      ny = -ny;
    }
    const len = Math.hypot(nx, ny) || 1;
    const bow = 0.16 * Math.hypot(dx, dy);
    const c: XY = [(a[0] + b[0]) / 2 + (nx / len) * bow, (a[1] + b[1]) / 2 + (ny / len) * bow];
    d += `Q${fmt(c)} ${fmt(b)}`;
    for (let i = 1; i <= CURVE_STEPS; i++) {
      const t = i / CURVE_STEPS;
      samples.push([(1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]]);
    }
    return { d, samples };
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p0 = pts[i - 1] ?? p1;
    const p3 = pts[i + 2] ?? p2;
    const c1: XY = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: XY = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${fmt(c1)} ${fmt(c2)} ${fmt(p2)}`;
    for (let k = 1; k <= CURVE_STEPS; k++) {
      const t = k / CURVE_STEPS;
      const u = 1 - t;
      samples.push([u ** 3 * p1[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t ** 3 * p2[0], u ** 3 * p1[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t ** 3 * p2[1]]);
    }
  }
  return { d, samples };
}

const polyline = (pts: XY[]) => ({ d: `M${fmt(pts[0]!)}${pts.slice(1).map((p) => `L${fmt(p)}`).join('')}`, samples: pts });
const lengthOf = (pts: XY[]) => pts.slice(1).reduce((sum, p, i) => sum + dist(p, pts[i]!), 0);

/** The vertices of a river between two points: the line leaves the first point, follows the course, and ends exactly on the second. */
function riverBetween(course: [number, number][], from: [number, number], to: [number, number]): [number, number][] {
  const nearest = (p: [number, number]) => course.reduce((best, c, i) => (Math.hypot(c[0] - p[0], c[1] - p[1]) < Math.hypot(course[best]![0] - p[0], course[best]![1] - p[1]) ? i : best), 0);
  const a = nearest(from);
  const b = nearest(to);
  const part = a <= b ? course.slice(a, b + 1) : course.slice(b, a + 1).reverse();
  return [from, ...part, to];
}

/** A name in lines of at most WRAP_AT characters, broken at spaces. */
export function wrapLabel(name: string, max = WRAP_AT): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of name.split(' ')) {
    if (line && `${line} ${word}`.length > max) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  lines.push(line);
  return lines;
}

interface Box {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}
const overlap = (a: Box, b: Box) => !(a.x2 < b.x1 || a.x1 > b.x2 || a.y2 < b.y1 || a.y1 > b.y2);

export function buildRouteMap(route: MapRoute, lang: Lang, geo: RouteGeo): RouteMapModel {
  const { w, h, padX, padY, font, minSpanDeg } = ROUTE_FRAME;
  const pts = route.points;
  const land = landOf(route, geo);

  // The legs: the geometry each one needs, in degrees (a river leg follows the course of the river).
  const legs = pts.slice(1).map((p, i) => {
    const prev = pts[i]!;
    const from: [number, number] = [prev.lng, prev.lat];
    const to: [number, number] = [p.lng, p.lat];
    const course = p.mode === 'river' ? geo.rivers[p.river ?? ''] : undefined;
    if (p.mode === 'river' && !course) throw new Error(`route: unknown river "${p.river}"`);
    return { mode: p.mode!, approx: legApprox(route, p), ferry: p.leg === 'ferry', geometry: course ? riverBetween(course, from, to) : [from, to], to: p };
  });

  // The frame: the box of every point (and every river vertex) with room for the labels; Mercator.
  const all: [number, number][] = [...pts.map((p): [number, number] => [p.lng, p.lat]), ...legs.flatMap((l) => (l.mode === 'river' ? l.geometry : []))];
  const xs = all.map(([lon]) => rad(lon));
  const ys = all.map(([, lat]) => mercY(lat));
  const minSpan = rad(minSpanDeg);
  const bw = Math.max(Math.max(...xs) - Math.min(...xs), minSpan);
  const bh = Math.max(Math.max(...ys) - Math.min(...ys), minSpan);
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
  const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  const scale = Math.min((w - 2 * padX) / bw, (h - 2 * padY) / bh);
  const project = (lon: number, lat: number): XY => [w / 2 + (rad(lon) - cx) * scale, h / 2 - (mercY(lat) - cy) * scale];

  // Runs: neighbouring legs of one kind (same mode, same approx, both ferry or both not) are drawn as one line; a river leg is a run of its own.
  const runs: { mode: RouteMode; approx: boolean; ferry: boolean; pts: XY[]; legs: number[] }[] = [];
  for (const [index, leg] of legs.entries()) {
    const line = leg.geometry.map(([lon, lat]) => project(lon, lat));
    const last = runs[runs.length - 1];
    if (last && last.mode === leg.mode && last.approx === leg.approx && last.ferry === leg.ferry && leg.mode !== 'river') {
      last.pts.push(...line.slice(1));
      last.legs.push(index);
    } else runs.push({ mode: leg.mode, approx: leg.approx, ferry: leg.ferry, pts: leg.mode === 'river' ? simplify(line, 0.35) : line, legs: [index] });
  }

  // The section of a leg: how many stops lie behind its start (the first point is a stop), less one.
  const sectionOf = legs.map((_, i) => pts.slice(0, i + 1).filter((p) => !p.via).length - 1);
  const unproject = ([x, y]: XY): [number, number] => [deg(cx + (x - w / 2) / scale), deg(2 * Math.atan(Math.exp(cy - (y - h / 2) / scale)) - Math.PI / 2)];
  const seaTrack: RouteMapModel['seaTrack'] = [];
  const samples: XY[] = [];
  const drawn: RouteRun[] = runs.map((run) => {
    const { d, samples: s } = run.mode === 'sea' || run.mode === 'air' ? curve(run.pts) : polyline(run.pts);
    // A curve of n points has n - 1 pieces of CURVE_STEPS samples each (the first sample is the start of the run).
    if (run.mode === 'sea') run.legs.forEach((leg, k) => seaTrack.push({ section: sectionOf[leg]!, pts: s.slice(k * CURVE_STEPS, (k + 1) * CURVE_STEPS + 1).map(unproject) }));
    samples.push(...s);
    if (run.ferry) return { d, dash: FERRY_DASH, ferry: true };
    if (!run.approx) return { d };
    const total = lengthOf(s);
    const n = Math.max(1, Math.round((total - 1) / DOT_PERIOD));
    return { d, dash: `1 ${r1((total - 1) / n - 1)}` };
  });

  // Dots and labels of the stops. A label goes to the first of eight places beside the dot where it covers no other label, no other dot, little of the line, and stays in the frame.
  const stopPoints = pts.map((p) => ({ p, xy: project(p.lng, p.lat) })).filter(({ p }) => !p.via);
  // Two stops closer than CROWDED px would run into each other (the rim of a dot is 1 unit outside its radius): their dots shrink to leave a gap of 2 units, down to 2.
  const dots = stopPoints.map(({ xy }, i) => {
    const near = Math.min(Infinity, ...stopPoints.filter((_, j) => j !== i).map((q) => dist(xy, q.xy)));
    const r = i === stopPoints.length - 1 ? 5 : 4;
    return { x: r1(xy[0]), y: r1(xy[1]), r: near < CROWDED ? r1(Math.max(2, Math.min(r, near / 2 - 2))) : r };
  });
  const placed: Box[] = [];
  const gap = 9;
  const labels: RouteLabel[] = stopPoints.map(({ p, xy }) => {
    const lines = wrapLabel(p.name![lang]);
    const width = Math.max(...lines.map((l) => l.length)) * font * CHAR_W;
    const height = lines.length * (font + 1);
    const places: ['start' | 'middle' | 'end', number, 'mid' | 'above' | 'below'][] = [['start', gap, 'mid'], ['end', -gap, 'mid'], ['middle', 0, 'above'], ['middle', 0, 'below'], ['start', gap, 'above'], ['end', -gap, 'above'], ['start', gap, 'below'], ['end', -gap, 'below']];
    let best: { cost: number; anchor: 'start' | 'middle' | 'end'; box: Box; x: number } | undefined;
    for (const [anchor, dx, v] of places) {
      const ax = xy[0] + dx;
      let x1 = anchor === 'start' ? ax : anchor === 'end' ? ax - width : ax - width / 2;
      let shift = 0;
      if (x1 < 4) shift = 4 - x1;
      else if (x1 + width > w - 4) shift = w - 4 - (x1 + width);
      x1 += shift;
      const y1 = Math.max(4, Math.min(h - 4 - height, v === 'mid' ? xy[1] - height / 2 : v === 'above' ? xy[1] - gap - height : xy[1] + gap));
      const box = { x1, y1, x2: x1 + width, y2: y1 + height };
      let cost = Math.abs(shift) * 10;
      for (const other of placed) if (overlap(box, other)) cost += 500;
      for (const s of samples) if (s[0] > box.x1 - 2 && s[0] < box.x2 + 2 && s[1] > box.y1 - 2 && s[1] < box.y2 + 2) cost += 3;
      for (const q of stopPoints) if (q.p !== p && q.xy[0] > box.x1 - 4 && q.xy[0] < box.x2 + 4 && q.xy[1] > box.y1 - 4 && q.xy[1] < box.y2 + 4) cost += 500;
      if (!best || cost < best.cost) best = { cost, anchor, box, x: anchor === 'start' ? box.x1 : anchor === 'end' ? box.x2 : (box.x1 + box.x2) / 2 };
    }
    placed.push(best!.box);
    return { x: r1(best!.x), anchor: best!.anchor, lines: lines.map((text, i) => ({ text, y: r1(best!.box.y1 + font - 2 + i * (font + 1)) })) };
  });

  const stops = stopsOf(route).map((p) => ({ name: p.name![lang], ...(p.date ? { when: p.date[lang] } : p.year !== undefined ? { when: String(p.year) } : {}) }));
  return {
    w,
    h,
    land: landPath(land, project, w, h, [deg(cx + (-20 - w / 2) / scale), deg(cx + (w + 20 - w / 2) / scale)], [unproject([0, h + 20])[1], unproject([0, -20])[1]], land !== geo.land),
    mask: drawn.map((r) => r.d).join(''),
    runs: drawn,
    dots,
    labels,
    stops,
    path: routePath(stops.map((p) => p.name)),
    years: routeYears(route),
    seaTrack,
    approx: legs.some((l) => l.approx && !l.ferry),
    ferry: legs.some((l) => l.ferry),
  };
}

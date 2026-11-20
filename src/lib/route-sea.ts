// The land checks of a route map (docs/spec.md 5.3a): the drawn line of every `mode: sea` leg is walked in steps of about STEP_KM and must stay on the water
// of the same Natural Earth coast the map draws; the line of every `mode: land` leg is walked in steps of LAND_STEP_KM and must stay on land (a ferry leg
// is let off, up to FERRY_MAX_KM). Pure functions, no Astro imports; check:data and the tests call it.
import type { Ring, RouteGeo } from './route-geo';
import { buildRouteMap, landOf, stopsOf, type MapRoute } from './route-map';

/** The step of the walk along the line. */
export const STEP_KM = 10;
/** Around every stop (a port) the line may be on land: the coast of the map is simplified and a port can lie up a river. */
export const PORT_KM = 30;
/** Inside the coast the line may go this far: the coast of the map is simplified. */
export const COAST_KM = 15;

/** The land legs: the step of the walk, how far inside the water the line may go (the coast of the map is simplified; a river mouth, a quay), and the longest ferry. */
export const LAND_STEP_KM = 3;
export const LAND_WATER_KM = 2;
export const FERRY_MAX_KM = 30;

const EARTH_KM = 6371;
const rad = (d: number) => (d * Math.PI) / 180;
type LL = [number, number];

/** Great-circle distance in km (haversine). */
export function distanceKm(a: LL, b: LL): number {
  const dLat = rad(b[1] - a[1]);
  const dLon = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

interface IndexedRing {
  ring: Ring;
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
}

const indexed = new WeakMap<Ring[], IndexedRing[]>();
function indexOf(land: Ring[]): IndexedRing[] {
  let list = indexed.get(land);
  if (!list) {
    list = land.map((ring) => {
      const lons = ring.map((p) => p[0]);
      const lats = ring.map((p) => p[1]);
      return { ring, minLon: Math.min(...lons), maxLon: Math.max(...lons), minLat: Math.min(...lats), maxLat: Math.max(...lats) };
    });
    indexed.set(land, list);
  }
  return list;
}

/** Ray casting. Coast rings are outer shells; a lake inside a continent is a ring of its own, so a point in the lake counts as land twice and is ignored (even-odd over all rings). */
function onLand(rings: IndexedRing[], p: LL): boolean {
  let inside = false;
  for (const r of rings) {
    if (p[0] < r.minLon || p[0] > r.maxLon || p[1] < r.minLat || p[1] > r.maxLat) continue;
    const ring = r.ring;
    let hit = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i]!;
      const [xj, yj] = ring[j]!;
      if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) hit = !hit;
    }
    if (hit) inside = !inside;
  }
  return inside;
}

/** The distance in km from a point to the nearest coast (the nearest edge of any ring within a degree or so). */
function coastKm(rings: IndexedRing[], p: LL): number {
  const kx = Math.cos(rad(p[1]));
  let best = Infinity;
  for (const r of rings) {
    if (p[0] < r.minLon - 2 || p[0] > r.maxLon + 2 || p[1] < r.minLat - 2 || p[1] > r.maxLat + 2) continue;
    const ring = r.ring;
    for (let i = 1; i < ring.length; i++) {
      const [ax, ay] = ring[i - 1]!;
      const [bx, by] = ring[i]!;
      // Local flat plane in degrees (longitude shortened by cos latitude), then km.
      const dx = (bx - ax) * kx;
      const dy = by - ay;
      const len2 = dx * dx + dy * dy;
      const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (((p[0] - ax) * kx) * dx + (p[1] - ay) * dy) / len2));
      const d = Math.hypot((p[0] - ax) * kx - t * dx, p[1] - ay - t * dy) * ((Math.PI / 180) * EARTH_KM);
      if (d < best) best = d;
    }
  }
  return best;
}

export interface SeaProblem {
  /** "Lisbon → La Spezia": the stops the section runs between. */
  section: string;
  /** How far inside the coast the line goes at the worst place, km. */
  depthKm: number;
  at: LL;
}

/** The places where the drawn line of a sea leg runs over land, worst one per section of the route (between two stops). Empty: the line keeps to the water. */
export function seaProblems(route: MapRoute, geo: RouteGeo): SeaProblem[] {
  const model = buildRouteMap(route, 'en', geo);
  const rings = indexOf(landOf(route, geo));
  const stops = stopsOf(route).map((p): LL => [p.lng, p.lat]);
  const names = stopsOf(route).map((p) => p.name!.en);
  const worst = new Map<number, SeaProblem>();
  for (const piece of model.seaTrack) {
    for (let i = 1; i < piece.pts.length; i++) {
      const a = piece.pts[i - 1]!;
      const b = piece.pts[i]!;
      const steps = Math.max(1, Math.ceil(distanceKm(a, b) / STEP_KM));
      for (let k = 0; k <= steps; k++) {
        const p: LL = [a[0] + ((b[0] - a[0]) * k) / steps, a[1] + ((b[1] - a[1]) * k) / steps];
        if (stops.some((s) => distanceKm(s, p) <= PORT_KM) || !onLand(rings, p)) continue;
        const depth = coastKm(rings, p);
        if (depth <= COAST_KM) continue;
        const known = worst.get(piece.section);
        if (!known || depth > known.depthKm) worst.set(piece.section, { section: `${names[piece.section]} → ${names[piece.section + 1]}`, depthKm: depth, at: p });
      }
    }
  }
  return [...worst.values()];
}

export interface LandProblem {
  /** "Lisbon → Palmela" (the stops the section runs between), or "ferry" with the length when a ferry leg is too long. */
  section: string;
  /** What is wrong: the line goes over water (how far from the coast it is, km) or a ferry is longer than FERRY_MAX_KM. */
  kind: 'water' | 'ferry';
  /** Km: how far into the water the line goes (kind water) or the length of the ferry leg (kind ferry). */
  km: number;
  at: LL;
}

const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + rad(Math.max(-85, Math.min(85, lat))) / 2));
const unMercY = (y: number) => (2 * Math.atan(Math.exp(y)) - Math.PI / 2) * (180 / Math.PI);

/** The places where the drawn line of a land leg runs over water, worst one per section; a ferry leg is skipped, but a ferry longer than FERRY_MAX_KM is an error. A land leg is a straight line on the map (Mercator), so it is walked in the same projection. */
export function landProblems(route: MapRoute, geo: RouteGeo): LandProblem[] {
  const rings = indexOf(landOf(route, geo));
  const stops = stopsOf(route);
  const out: LandProblem[] = [];
  const worst = new Map<number, LandProblem>();
  route.points.forEach((p, i) => {
    if (i === 0 || p.mode !== 'land') return;
    const prev = route.points[i - 1]!;
    const a: LL = [prev.lng, prev.lat];
    const b: LL = [p.lng, p.lat];
    const section = route.points.slice(0, i).filter((q) => !q.via).length - 1;
    const label = `${stops[section]!.name!.en} → ${stops[section + 1]!.name!.en}`;
    const length = distanceKm(a, b);
    if (p.leg === 'ferry') {
      if (length > FERRY_MAX_KM) out.push({ section: label, kind: 'ferry', km: length, at: b });
      return;
    }
    const steps = Math.max(1, Math.ceil(length / LAND_STEP_KM));
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      const q: LL = [a[0] + (b[0] - a[0]) * t, unMercY(mercY(a[1]) + (mercY(b[1]) - mercY(a[1])) * t)];
      if (route.points.some((s) => distanceKm([s.lng, s.lat], q) <= LAND_WATER_KM) || onLand(rings, q)) continue;
      const depth = coastKm(rings, q);
      if (depth <= LAND_WATER_KM) continue;
      const known = worst.get(section);
      if (!known || depth > known.km) worst.set(section, { section: label, kind: 'water', km: depth, at: q });
    }
  });
  return [...out, ...worst.values()];
}

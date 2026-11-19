// The land check of the sea legs of a route map (docs/spec.md 5.3a): the drawn line of every `mode: sea` leg is walked in steps of about STEP_KM and
// must stay on the water of the same Natural Earth coast the map draws. Pure functions, no Astro imports; check:data and the tests call it.
import type { Ring, RouteGeo } from './route-geo';
import { buildRouteMap, stopsOf, type MapRoute } from './route-map';

/** The step of the walk along the line. */
export const STEP_KM = 10;
/** Around every stop (a port) the line may be on land: the coast of the map is simplified and a port can lie up a river. */
export const PORT_KM = 30;
/** Inside the coast the line may go this far: the coast of the map is simplified. */
export const COAST_KM = 15;

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
  const rings = indexOf(geo.land);
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

// The geodata of the route maps (src/data/geo/): the land of the world (Natural Earth 1:50m for maps of a sea or an ocean, 1:10m for maps of a region,
// TopoJSON) and the courses of the rivers a leg can follow. Read once per build, the fine one only when a map of a region asks for it.
// Pure data, no Astro imports (the route maps are drawn by src/lib/route-map.ts, which takes this as an argument).
import landTopology from '../data/geo/land-50m.json';
import fineTopology from '../data/geo/land-10m.json';
import riverData from '../data/geo/rivers.json';

/** A ring of [lon, lat] pairs (a coast, an island, a lake in a continent). */
export type Ring = [number, number][];

export interface RouteGeo {
  land: Ring[];
  /** The land at 1:10m (the estuaries of the Tagus and the Sado are there), for a map that covers a region; absent: `land` serves every map. */
  fine?: Ring[];
  /** The course of a river from upstream to the mouth, by id (`river: douro` in the data of a story). */
  rivers: Record<string, [number, number][]>;
}

interface Topology {
  transform: { scale: [number, number]; translate: [number, number] };
  arcs: [number, number][][];
  objects: Record<string, { geometries: { type: string; arcs: number[][][] }[] }>;
}

/** TopoJSON rings of every polygon of the `land` object, in degrees. */
export function decodeLand(topology: Topology): Ring[] {
  const { scale, translate } = topology.transform;
  const arcs: Ring[] = topology.arcs.map((arc) => {
    let x = 0;
    let y = 0;
    return arc.map(([dx, dy]) => {
      x += dx;
      y += dy;
      return [x * scale[0] + translate[0], y * scale[1] + translate[1]] as [number, number];
    });
  });
  const ring = (indexes: number[]): Ring => {
    const out: Ring = [];
    for (const i of indexes) {
      const arc = i >= 0 ? arcs[i]! : [...arcs[~i]!].reverse();
      out.push(...(out.length > 0 ? arc.slice(1) : arc));
    }
    return out;
  };
  return topology.objects['land']!.geometries.flatMap((g) => {
    const polygons: number[][][] = g.type === 'MultiPolygon' ? g.arcs : [g.arcs as unknown as number[][]];
    return polygons.flatMap((polygon) => polygon.map(ring));
  });
}

let cached: RouteGeo | undefined;

export function routeGeo(): RouteGeo {
  if (!cached) {
    let fine: Ring[] | undefined;
    cached = {
      land: decodeLand(landTopology as unknown as Topology),
      get fine() {
        return (fine ??= decodeLand(fineTopology as unknown as Topology));
      },
      rivers: riverData as unknown as Record<string, [number, number][]>,
    };
  }
  return cached;
}

# Geodata of the route maps

Built into the pages at build time (`src/lib/route-map.ts`); nothing here is sent to the browser except the small SVG made from it.

- `land-50m.json`: land of the world, 1:50m, TopoJSON from the npm package `world-atlas` (Natural Earth, public domain).
- `rivers.json`: the course of the Douro (Duero) from Natural Earth `ne_10m_rivers_lake_centerlines` (public domain), the part west of 6.4° W, from upstream to the mouth. A story names a river leg with `river: douro`.

Natural Earth: https://www.naturalearthdata.com/ (public domain, no attribution required).

// "How to get there": a plain Google Maps directions link to the bridge place (no API, no script, no data sent until the reader follows
// the link; opens in a new tab). Used by the card page (BridgeBlock) and the marker preview of the map page (src/scripts/map-island.ts).

/** Five decimals are about a metre: enough, and no 15-digit floats in an address. */
const c = (n: number): string => String(Number(n.toFixed(5)));

/** "How to get there" for a bridge: the link of the place on Google Maps when the data has one (maps_url), else directions to its coordinates. */
export function bridgeDirectionsLink(bridge: { lat: number; lon: number; maps_url?: string | undefined }): string {
  return bridge.maps_url ?? googleDirectionsLink(bridge.lat, bridge.lon);
}

/** Google Maps directions to the point, from wherever the reader is: https://developers.google.com/maps/documentation/urls/get-started (a link, not the API). */
export function googleDirectionsLink(lat: number, lon: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${c(lat)},${c(lon)}`;
}

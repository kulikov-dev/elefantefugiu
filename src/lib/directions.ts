// "How to get there" links for a bridge place. Pure functions, no DOM.
// Everyone gets an openstreetmap.org link with a marker (works without JavaScript, no third-party service). On Android only,
// a small script swaps it for a geo: link, which opens the phone's own map application. iOS and desktops keep the OSM link.

/** Five decimals are about a metre: enough, and no 15-digit floats in an address. */
const c = (n: number): string => String(Number(n.toFixed(5)));

/** openstreetmap.org centred on the point, with a marker on it. */
export function osmLink(lat: number, lon: number): string {
  return `https://www.openstreetmap.org/?mlat=${c(lat)}&mlon=${c(lon)}#map=17/${c(lat)}/${c(lon)}`;
}

/** geo: URI with a labelled pin (RFC 5870 plus the q= convention that Android map applications read). */
export function geoLink(lat: number, lon: number, label: string): string {
  // Parentheses delimit the label in q=lat,lon(label), so they are dropped from the text itself.
  const text = encodeURIComponent(label.replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim());
  return `geo:${c(lat)},${c(lon)}?q=${c(lat)},${c(lon)}(${text})`;
}

/** Android phones and tablets; never iOS, Windows Phone or a desktop (an Android browser asking for the desktop site does not say "Android"). */
export function isAndroid(userAgent: string): boolean {
  return /\bAndroid\b/i.test(userAgent) && !/\b(iPhone|iPad|iPod|Windows Phone)\b/i.test(userAgent);
}

/** The address "Como chegar" points at for this device. */
export function directionsHref(lat: number, lon: number, label: string, userAgent: string): string {
  return isAndroid(userAgent) ? geoLink(lat, lon, label) : osmLink(lat, lon);
}

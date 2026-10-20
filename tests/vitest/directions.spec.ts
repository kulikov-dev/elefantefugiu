import { describe, expect, it } from 'vitest';
import { directionsHref, geoLink, isAndroid, osmLink } from '../../src/lib/directions';

const UA = {
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  androidTablet: 'Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  androidDesktopSite: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  ipad: 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  ipadDesktop: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  linux: 'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0',
  windowsPhone: 'Mozilla/5.0 (Windows Phone 10.0; Android 6.0.1; Microsoft; Lumia 950) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/52.0.2743.116 Mobile Safari/537.36 Edge/15.15254',
  empty: '',
};

describe('OpenStreetMap link', () => {
  it('centres on the point and puts a marker on it', () => {
    expect(osmLink(38.6999, -9.204)).toBe('https://www.openstreetmap.org/?mlat=38.6999&mlon=-9.204#map=17/38.6999/-9.204');
  });
  it('rounds to five decimals', () => {
    expect(osmLink(38.123456789, -9.987654321)).toBe('https://www.openstreetmap.org/?mlat=38.12346&mlon=-9.98765#map=17/38.12346/-9.98765');
  });
  it('is on openstreetmap.org and nowhere else', () => {
    expect(new URL(osmLink(1, 2)).hostname).toBe('www.openstreetmap.org');
  });
});

describe('geo: link', () => {
  it('has the point and a labelled pin', () => {
    expect(geoLink(38.6999, -9.204, 'Mosteiro dos Jerónimos')).toBe('geo:38.6999,-9.204?q=38.6999,-9.204(Mosteiro%20dos%20Jer%C3%B3nimos)');
  });
  it('keeps parentheses out of the label (they delimit it) and encodes the rest', () => {
    expect(geoLink(1, 2, 'Torre (Belém) & Cia')).toBe('geo:1,2?q=1,2(Torre%20Bel%C3%A9m%20%26%20Cia)');
  });
});

describe('who gets geo:', () => {
  it('Android phones and tablets do', () => {
    expect(isAndroid(UA.androidChrome)).toBe(true);
    expect(isAndroid(UA.androidTablet)).toBe(true);
  });
  it('iOS does not (iPhone, iPad, iPad in desktop mode)', () => {
    expect(isAndroid(UA.iphone)).toBe(false);
    expect(isAndroid(UA.ipad)).toBe(false);
    expect(isAndroid(UA.ipadDesktop)).toBe(false);
  });
  it('desktops do not (Windows, macOS, Linux, Android asking for the desktop site)', () => {
    for (const ua of [UA.windows, UA.mac, UA.linux, UA.androidDesktopSite, UA.empty]) expect(isAndroid(ua)).toBe(false);
  });
  it('Windows Phone does not, although its agent says Android', () => {
    expect(isAndroid(UA.windowsPhone)).toBe(false);
  });
});

describe('the address of "Como chegar"', () => {
  const point = [38.6999, -9.204] as const;
  it('is geo: on Android', () => {
    expect(directionsHref(...point, 'Local', UA.androidChrome)).toMatch(/^geo:38\.6999,-9\.204\?q=/);
  });
  it('is the OpenStreetMap link everywhere else', () => {
    for (const ua of [UA.iphone, UA.ipad, UA.windows, UA.mac, UA.linux, UA.empty]) expect(directionsHref(...point, 'Local', ua)).toMatch(/^https:\/\/www\.openstreetmap\.org\//);
  });
  it('never mentions Google or another service', () => {
    for (const ua of Object.values(UA)) expect(directionsHref(...point, 'Local', ua)).not.toMatch(/google|apple|bing|waze|here\.com|mapbox/i);
  });
});

// ---- the inline script of the card page does what the library does ----
import { runInNewContext } from 'node:vm';
import { directionsScript } from '../../src/lib/directions-script';

function runScript(userAgent: string, link = { lat: '38.6999', lon: '-9.204', label: 'Torre (Belém) & Cia' }) {
  const a = { dataset: link, href: 'https://www.openstreetmap.org/?x' };
  runInNewContext(directionsScript(), { navigator: { userAgent }, document: { querySelectorAll: () => [a] }, String, Number, encodeURIComponent });
  return a.href;
}

describe('the inline Android script', () => {
  it('writes the same geo: link as geoLink on Android', () => {
    expect(runScript(UA.androidChrome)).toBe(geoLink(38.6999, -9.204, 'Torre (Belém) & Cia'));
  });
  it('leaves the OpenStreetMap link alone on iOS, desktops and Windows Phone', () => {
    for (const ua of [UA.iphone, UA.ipad, UA.ipadDesktop, UA.windows, UA.mac, UA.linux, UA.androidDesktopSite, UA.windowsPhone, UA.empty]) expect(runScript(ua)).toBe('https://www.openstreetmap.org/?x');
  });
  it('agrees with isAndroid for every agent string', () => {
    for (const ua of Object.values(UA)) expect(runScript(ua).startsWith('geo:')).toBe(isAndroid(ua));
  });
  it('rounds like the library', () => {
    expect(runScript(UA.androidChrome, { lat: '38.123456789', lon: '-9.987654321', label: 'x' })).toBe(geoLink(38.123456789, -9.987654321, 'x'));
  });
  it('is short', () => {
    expect(directionsScript().length).toBeLessThan(600);
  });
});

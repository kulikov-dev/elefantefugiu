// Page-visit counting with GoatCounter (https://www.goatcounter.com): no cookies, no personal data, only page views.
// The script (count.js, ISC licence) is a copy in public/vendor/goatcounter/, so no other site serves code to our pages;
// the counter itself is only told that a page was viewed. The copy gets no updates: look at https://gc.zgo.at/count.js now and then.

export const GOATCOUNTER_ENDPOINT = 'https://elefantefugiu.goatcounter.com/count';
export const GOATCOUNTER_SCRIPT = 'vendor/goatcounter/count.js';

/** The counter is not put on a build for a local address (development and the builds the checks run on). */
export function analyticsEnabled(site: string): boolean {
  let host: string;
  try {
    host = new URL(site).hostname;
  } catch {
    return false;
  }
  return !/(^localhost$|\.localhost$|^127\.|^10\.|^172\.(1[6-9]|2[0-9]|3[01])\.|^192\.168\.|^0\.0\.0\.0$|^\[?::1\]?$)/.test(host);
}

/**
 * Runs before count.js. Only page views are counted (no click events). When the address has ?src=qr (or ig, reddit, ...) that
 * name is sent as the referrer, so it appears in the "Referrers" list of the dashboard; without it the real referrer is sent.
 * GoatCounter itself reads src only together with a campaign name (utm_campaign), which our addresses do not have.
 * The path is sent without the query, so /story/?src=qr and /story/ are one page (the query still goes along as it is).
 */
export const ANALYTICS_CONFIG_SCRIPT =
  'window.goatcounter={no_events:true,path:function(p){return p.replace(/[?#].*$/,"")},referrer:function(r){var m=/[?&]src=([A-Za-z0-9_-]{1,32})(?:&|$)/.exec(location.search);return m?m[1]:r}};';

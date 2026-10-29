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

/** The address the site had before the move (GitHub Pages of the owner): the visits that still come from it are told as one name. */
export const OLD_DOMAIN = 'kulikov-dev.github.io';

/**
 * Runs before count.js. Only page views are counted (no click events). The referrer (count.js sends it as `r`) is told in two cases only:
 * the address has ?src=qr (or ig, reddit, ...) or ?utm_source=... as a synonym (src wins when both are there), and that name is sent;
 * or the reader came from another site, and then the referrer as it is. A visit with no source and a move inside the site send no referrer,
 * so the site does not show up as its own source; the old address of the site (kulikov-dev.github.io) is told as the one name "old-domain".
 * A campaign of its own is not made here: GoatCounter fills Campaigns from `campaign` / `utm_campaign` in the query, which count.js sends as `q`
 * as it is, so a link with &campaign=<name> is enough. The path is sent without the query, so /story/?src=qr and /story/ are one page.
 * The root page and /p/{id} keep the query when they redirect to a language page (src/lib/lang-choice.ts).
 */
export const ANALYTICS_CONFIG_SCRIPT =
  '(function(){var q=location.search,m=/[?&]src=([A-Za-z0-9_.-]{1,32})(?:&|$)/.exec(q)||/[?&]utm_source=([A-Za-z0-9_.-]{1,32})(?:&|$)/.exec(q);' +
  'window.goatcounter={no_events:true,path:function(p){return p.replace(/[?#].*$/,"")},referrer:function(r){if(m)return m[1];' +
  'var h=/^[a-z][a-z0-9+.-]*:\\/\\/([^\\/?#:]*)/i.exec(r||"");if(!h)return"";h=h[1].toLowerCase().replace(/^www[.]/,"");' +
  `return h===location.hostname.toLowerCase().replace(/^www[.]/,"")?"":h==="${OLD_DOMAIN}"?"old-domain":r}};` +
  '})();';

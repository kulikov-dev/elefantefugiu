// Which language the root "/" leads to: the saved choice (localStorage "lang") first, then the browser language
// (ru* -> ru, en* -> en, anything else -> the default pt). Pure function plus the inline script that does the same
// in the browser (written as a string so a unit test can run both and compare).
import { DEFAULT_LANG, LANGS, type Lang } from '../i18n/routes';

/** Browser-language prefixes and the language they lead to. Order does not matter; the default is everything else. */
const BROWSER_PREFIX: Record<string, Lang> = { ru: 'ru', en: 'en' };

export const isLang = (v: unknown): v is Lang => typeof v === 'string' && (LANGS as readonly string[]).includes(v);

export function chooseLang(saved: string | null | undefined, browser: string | null | undefined): Lang {
  if (isLang(saved)) return saved;
  const prefix = String(browser ?? '').toLowerCase().split(/[-_]/)[0] ?? '';
  return BROWSER_PREFIX[prefix] ?? DEFAULT_LANG;
}

/** The inline script of the root page: `hrefs` are the (base-aware) home addresses per language. */
export function rootScript(hrefs: Record<Lang, string>): string {
  const H = JSON.stringify(hrefs).replace(/</g, '\u003c');
  return (
    '(function(){var H=' +
    H +
    ',D=' +
    JSON.stringify(DEFAULT_LANG) +
    ',P=' +
    JSON.stringify(BROWSER_PREFIX) +
    ",l=null;try{l=localStorage.getItem('lang')}catch(x){}" +
    "if(!l||!Object.prototype.hasOwnProperty.call(H,l)){var b=String(navigator.language||'').toLowerCase().split(/[-_]/)[0];l=Object.prototype.hasOwnProperty.call(P,b)?P[b]:D}" +
    // The query string and the hash of the address the reader came with go on to the language page (?src=ig, ?utm_source=...); on a key that the target
    // address has too (/p/{id} puts ?src=qr), the reader's one wins.
    "var u=H[l],i=u.indexOf('?'),p=i<0?u:u.slice(0,i),a=i<0?'':u.slice(i+1),s=String(location.search||'').replace(/^\\?/,''),h=String(location.hash||'');" +
    "if(s){var k={};s.split('&').forEach(function(x){k[x.split('=')[0]]=1});a=a.split('&').filter(function(x){return x&&!k[x.split('=')[0]]}).concat(s.split('&').filter(Boolean)).join('&')}" +
    "location.replace(p+(a?'?'+a:'')+h)})();"
  );
}

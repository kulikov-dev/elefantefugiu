// The small inline script in <head>. It runs before the first paint and puts on <html>:
//   data-js      JavaScript is on (the toggles and other script-only parts are shown by CSS, no flash)
//   data-family  the family mode from localStorage ("off" when it is empty, blocked or unknown)
//   data-theme   the theme choice from localStorage: light, dark or system (the CSS reads it, see tokens.css)
//   data-vista   "grelha" when the address has ?vista=grelha
//   data-fio     a thread id from ?fio=, only when it is one of the known threads
//   data-festa   the id of the holiday that is on now (the 3 days before it and its day, by the date in Lisbon; ?hoje=YYYY-MM-DD sets the date,
//                ?festa=<id> turns a holiday on whatever the date; an explicit ?hoje=YYYY-MM-DD is kept in sessionStorage for the pages that follow in the tab, ?hoje=off or an empty ?hoje= clears it); the same rule as festaNow() in festas.ts, which a test compares
// With an explicit light or dark theme it also sets the browser UI colour (<meta name="theme-color">) to that theme.
// CSS then shows the right state straight away; the page scripts take over later and keep these attributes in step.
// One script, one storage reader, so family mode and theme do not duplicate each other. Written as one string so a unit test can run it.
import { THEME_COLORS } from './theme';

/** The days of the enabled holidays (festas.ts festaDays) and the ids that ?festa= may name. */
export interface HeadFestas {
  days: readonly (readonly [string, string])[];
  ids: readonly string[];
  /** The icon of the tab (addresses of the SVG, the PNG 32 and the touch icon 180) of each holiday that has one. */
  icons?: Record<string, { svg: string; png: string; apple: string }>;
  /** The page was built in the window of a holiday, so its icon links are the holiday's; out of the window the script puts the usual ones back (data-fn). */
  built?: boolean;
}

/** Same rules as normalizeFamilyMode in family.ts, normalizeTheme in theme.ts and festaNow in festas.ts; tests compare them. */
export function headScript(threadIds: readonly string[], colors: { light: string; dark: string } = THEME_COLORS, festas: HeadFestas = { days: [], ids: [] }): string {
  const ids = JSON.stringify([...threadIds]).replace(/</g, '\\u003c');
  const cols = JSON.stringify(colors);
  const days = JSON.stringify(festas.days).replace(/</g, '\\u003c');
  const known = JSON.stringify(festas.ids).replace(/</g, '\\u003c');
  const icons = JSON.stringify(festas.icons ?? {}).replace(/</g, '\\u003c');
  return (
    "(function(){var d=document,e=d.documentElement,m='off',t='system',F=" +
    ids +
    ',C=' +
    cols +
    ";e.setAttribute('data-js','');" +
    "var g=function(k){try{return String(localStorage.getItem(k)||'').trim().toLowerCase()}catch(x){return ''}};" +
    "var v=g('family');if(v==='all')m='all';else if(v==='12'||v==='12+')m='12';" +
    "e.setAttribute('data-family',m);" +
    "v=g('theme');if(v==='light'||v==='dark')t=v;e.setAttribute('data-theme',t);" +
    "if(t!=='system'){var s=d.querySelectorAll('meta[name=theme-color]');for(var i=0;i<s.length;i++)s[i].setAttribute('content',C[t])}" +
    "try{var q=new URLSearchParams(location.search),f=q.get('fio');if(f&&F.indexOf(f)>-1)e.setAttribute('data-fio',f);" +
    "if(q.get('vista')==='grelha')e.setAttribute('data-vista','grelha');" +
    "var D=" +
    days +
    ",K=" +
    known +
    ",I=" +
    icons +
    ",G=" +
    String(festas.built === true) +
    ",N=function(s){return Date.parse(s+'T00:00:00Z')/864e5},y='',b=null,o=q.get('festa');" +
    "try{if(q.has('hoje')){y=q.get('hoje')||'';if(/^\\d{4}-\\d{2}-\\d{2}$/.test(y))sessionStorage.setItem('hoje',y);else sessionStorage.removeItem('hoje')}else y=sessionStorage.getItem('hoje')||''}catch(x){}" +
    "if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(y)||isNaN(N(y)))y=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Lisbon',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());" +
    "for(var j=0;j<D.length;j++){var k=N(D[j][1])-N(y);if(k>=0&&k<=3&&(!b||k<b[0]))b=[k,D[j][0]]}" +
    "var w=o&&K.indexOf(o)>-1?o:b?b[1]:'',u=w&&I[w];if(w)e.setAttribute('data-festa',w);" +
    "if(u||G){var L=d.querySelectorAll('link[data-fi]');for(var z=0;z<L.length;z++){var n=L[z],r=n.getAttribute('data-fi');if(u&&r==='ico')n.remove();else{n.setAttribute('href',u?u[r]:n.getAttribute('data-fn'));if(r==='png')n.setAttribute('sizes',u?'32x32':'96x96')}}}}catch(x){}})();"
  );
}

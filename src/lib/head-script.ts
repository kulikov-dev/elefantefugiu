// The small inline script in <head>. It runs before the first paint and puts on <html>:
//   data-js      JavaScript is on (the toggles and other script-only parts are shown by CSS, no flash)
//   data-family  the family mode from localStorage ("off" when it is empty, blocked or unknown)
//   data-theme   the theme choice from localStorage: light, dark or system (the CSS reads it, see tokens.css)
//   data-vista   "grelha" when the address has ?vista=grelha
//   data-fio     a thread id from ?fio=, only when it is one of the known threads
// With an explicit light or dark theme it also sets the browser UI colour (<meta name="theme-color">) to that theme.
// CSS then shows the right state straight away; the page scripts take over later and keep these attributes in step.
// One script, one storage reader, so family mode and theme do not duplicate each other. Written as one string so a unit test can run it.
import { THEME_COLORS } from './theme';

/** Same rules as normalizeFamilyMode in family.ts and normalizeTheme in theme.ts; tests compare them. */
export function headScript(threadIds: readonly string[], colors: { light: string; dark: string } = THEME_COLORS): string {
  const ids = JSON.stringify([...threadIds]).replace(/</g, '\\u003c');
  const cols = JSON.stringify(colors);
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
    "if(q.get('vista')==='grelha')e.setAttribute('data-vista','grelha')}catch(x){}})();"
  );
}

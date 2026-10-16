// The small inline script in <head>. It runs before the first paint and puts three things on <html>:
//   data-js      JavaScript is on (the toggle and other script-only parts are shown by CSS, no flash)
//   data-family  the family mode from localStorage ("off" when it is empty, blocked or unknown)
//   data-vista   "grelha" when the address has ?vista=grelha
//   data-fio     a thread id from ?fio=, only when it is one of the known threads
// CSS then shows the right state straight away (src/styles/family.css and the epoch page); the page scripts
// take over later and keep these attributes in step. Written as one string so a unit test can run it.

/** Same rules as normalizeFamilyMode in family.ts; a test compares them. */
export function headScript(threadIds: readonly string[]): string {
  const ids = JSON.stringify([...threadIds]).replace(/</g, '\\u003c');
  return (
    "(function(){var e=document.documentElement,m='off',F=" +
    ids +
    ";e.setAttribute('data-js','');" +
    "try{var v=String(localStorage.getItem('family')||'').trim().toLowerCase();if(v==='all')m='all';else if(v==='12'||v==='12+')m='12'}catch(x){}" +
    "e.setAttribute('data-family',m);" +
    "try{var q=new URLSearchParams(location.search),f=q.get('fio');if(f&&F.indexOf(f)>-1)e.setAttribute('data-fio',f);" +
    "if(q.get('vista')==='grelha')e.setAttribute('data-vista','grelha')}catch(x){}})();"
  );
}

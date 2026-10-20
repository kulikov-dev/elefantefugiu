// The Android script of "Como chegar", as a string for an inline <script>. Inline on purpose: a module script that imports
// src/lib/directions.ts would cost every card page two extra requests (the script and a shared chunk the map also uses).
// The rules are the same as isAndroid and geoLink in directions.ts; tests/vitest/directions.spec.ts runs this string
// against those functions, so the two cannot drift apart.

export const directionsScript = (): string =>
  '(function(){var u=navigator.userAgent;if(!/\\bAndroid\\b/i.test(u)||/\\b(iPhone|iPad|iPod|Windows Phone)\\b/i.test(u))return;' +
  'var c=function(n){return String(Number(Number(n).toFixed(5)))};' +
  "var a=document.querySelectorAll('a[data-directions]');" +
  'for(var i=0;i<a.length;i++){var d=a[i].dataset,p=c(d.lat)+","+c(d.lon),' +
  "t=encodeURIComponent((d.label||'').replace(/[()]/g,' ').replace(/\\s+/g,' ').trim());" +
  "a[i].href='geo:'+p+'?q='+p+'('+t+')'}})();";

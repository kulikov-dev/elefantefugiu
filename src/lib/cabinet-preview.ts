// The inline script of the preview of the owner (docs/spec.md "Кабинет редкостей"): while the cabinet is closed, ?kabinet=preview puts a flag in this browser (localStorage
// `cabinet.preview`), ?kabinet=off takes it away; with the flag the page gets html[data-cabinet="preview"] and src/scripts/cabinet.ts works as if the cabinet were open.
// The parameter is taken out of the address. Written as one string so a unit test can run it; the key is PREVIEW_KEY of src/lib/cabinet.ts.
import { PREVIEW_KEY } from './cabinet';

export const CABINET_PREVIEW_SCRIPT =
  `(function(){try{var m=/[?&]kabinet=(preview|off)(?:&|$)/.exec(location.search);` +
  `if(m){if(m[1]==="preview")localStorage.setItem("${PREVIEW_KEY}","1");else localStorage.removeItem("${PREVIEW_KEY}");` +
  `history.replaceState(null,"",location.pathname+location.search.replace(/([?&])kabinet=(preview|off)(&|$)/,function(x,a,b,c){return c?a:""}).replace(/[?]$/,"")+location.hash)}` +
  `if(localStorage.getItem("${PREVIEW_KEY}")==="1")document.documentElement.setAttribute("data-cabinet","preview")}catch(e){}})();`;

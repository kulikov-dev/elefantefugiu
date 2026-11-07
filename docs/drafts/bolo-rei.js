/* Bolo-rei «Отрежь кусочек»: reference implementation for the site (v2).
   BoloRei.draw(svg, state) draws the cake into an <svg viewBox="0 0 400 240">.
   state = { gone: Set of eaten slice indexes, out: index of the slice just cut or -1 }
   BoloRei.anchor(i) gives the point above the cut slice for the speech bubble with the result (HTML, not SVG).
   The cake is a puffy ring: flat bottom, rounded top, no straight walls.
   Colours come from CSS tokens: --ink (cobalt), --warm (crust), --wash, --shell. */
(function (g) {
  var NS = 'http://www.w3.org/2000/svg';
  var CX = 200, CY = 128, R = 152, r = 50, K = 0.44, D = 30, N = 8, STEP = 360 / N;
  var CRUMB = 'color-mix(in srgb, var(--warm) 30%, var(--shell))';
  var CRUST = 'color-mix(in srgb, var(--warm) 80%, #7A3A0E)'; // golden-brown glaze
  var SHADE = 'color-mix(in srgb, var(--warm) 64%, #5A2A08)';
  /* candied fruit is the one place where colour is the point: red and green cherries, orange peel.
     Tokens with fallbacks; the site adds --cherry, --angelica, --peel (light and dark). */
  var CHERRY = 'var(--cherry, #C8372D)', GREEN = 'var(--angelica, #4E8F45)', PEEL = 'var(--peel, #E58A2B)';
  var rad = function (d) { return d * Math.PI / 180; };
  function pt(rr, deg, dy) { return [CX + rr * Math.cos(rad(deg)), CY + rr * Math.sin(rad(deg)) * K + (dy || 0)]; }
  function hgt(t) { return D * Math.pow(Math.sin(Math.PI * t), 0.75); } // rounded loaf profile
  /* the ring is hand-made: radius and height wobble a little round the circle */
  function wob(deg) { return 1 + 0.022 * Math.sin(rad(deg * 6 + 20)) + 0.012 * Math.sin(rad(deg * 11)); }
  function hwob(deg) { return 1 + 0.13 * Math.sin(rad(deg * 5 + 40)) + 0.07 * Math.sin(rad(deg * 13 + 10)); }
  function surf(t, deg, lift) { var p = pt((r + (R - r) * t) * wob(deg), deg); p[1] -= hgt(t) * hwob(deg) * (lift == null ? 1 : lift); return p; }
  function P(q) { return q[0].toFixed(1) + ' ' + q[1].toFixed(1); }
  function poly(pts) { return 'M' + pts.map(P).join(' L') + ' Z'; }
  function polyline(pts) { return 'M' + pts.map(P).join(' L'); }
  function el(name, attrs, parent) { var e = document.createElementNS(NS, name); for (var k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  function clip(a, b, lo, hi) { // parts of [a,b] that fall inside [lo,hi], angles in degrees
    var out = [];
    for (var s = -360; s <= 360; s += 360) { var x = Math.max(a, lo + s), y = Math.min(b, hi + s); if (y > x) out.push([x, y]); }
    return out;
  }
  function center(i) { return 90 + i * STEP; } // slice 0 faces the viewer, the rest go round
  function seed(i, j) { var x = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453; return x - Math.floor(x); }

  /* outline of the slice body seen from above: for each angle, the highest and lowest point of the cross-section */
  function outline(a, b) {
    var up = [], lo = [], n = 16;
    for (var i = 0; i <= n; i++) {
      var d = a + (b - a) * i / n, mn = null, mx = null;
      for (var j = 0; j <= 20; j++) { var q = surf(j / 20, d); if (!mn || q[1] < mn[1]) mn = q; if (!mx || q[1] > mx[1]) mx = q; }
      up.push(mn); lo.push(mx);
    }
    return { up: up, lo: lo };
  }

  function slice(i, parent, item, open) {
    var c = center(i), a = c - STEP / 2, b = c + STEP / 2;
    var gp = el('g', { 'class': 'slice', 'data-i': i }, parent);
    var ink = { stroke: 'var(--ink)', 'stroke-width': 1.8, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' };

    function face(d) { // cut surface: crumb under a thin crust, with bits of fruit
      var f = el('g', {});
      var top = []; for (var j = 0; j <= 20; j++) top.push(surf(j / 20, d));
      el('path', Object.assign({ d: poly(top), fill: CRUMB }, ink), f);
      var crust = []; for (j = 1; j <= 19; j++) crust.push(surf(j / 20, d, 0.86));
      el('path', { d: polyline(crust), fill: 'none', stroke: CRUST, 'stroke-width': 2.6, 'stroke-linecap': 'round' }, f);
      for (var m = 0; m < 6; m++) { // air holes and fruit bits
        var t = 0.18 + 0.64 * seed(i * 7 + m, d), q = surf(t, d, 0.25 + 0.45 * seed(m, i + d));
        if (m < 3) el('rect', { x: (q[0] - 2.5).toFixed(1), y: (q[1] - 2).toFixed(1), width: 5, height: 4, rx: 1, fill: [CHERRY, GREEN, PEEL][m], stroke: 'var(--ink)', 'stroke-width': 0.6 }, f);
        else el('ellipse', { cx: q[0].toFixed(1), cy: q[1].toFixed(1), rx: 1.6, ry: 1.1, fill: 'var(--ink)', opacity: 0.45 }, f);
      }
      return f;
    }
    var openA = open.has((i + N - 1) % N), openB = open.has((i + 1) % N);
    var showA = Math.cos(rad(a)) < 0, showB = Math.cos(rad(b)) > 0; // faces turned towards the viewer
    var fa = openA ? face(a) : null, fb = openB ? face(b) : null;
    if (fa && !showA) gp.appendChild(fa);
    if (fb && !showB) gp.appendChild(fb);

    // body: the cross-section swept round the ring, filled without outline so slices join without seams
    var prev = null, ea = openA ? a : a - 0.8, eb = openB ? b : b + 0.8; // overlap closed joints a little: no seams
    for (var st = 0; st <= 24; st++) {
      var dd = ea + (eb - ea) * st / 24, arch = []; for (var j2 = 0; j2 <= 16; j2++) arch.push(surf(j2 / 16, dd));
      el('path', { d: poly(arch), fill: CRUST, stroke: CRUST, 'stroke-width': 1 }, gp);
      if (prev) el('path', { d: poly(prev.concat(arch.slice().reverse())), fill: CRUST, stroke: CRUST, 'stroke-width': 1 }, gp);
      prev = arch;
    }
    // shade the lower slope that faces us, as an opaque tone so overlapping joints leave no lines
    var pa = null;
    for (st = 0; st <= 24; st++) {
      dd = ea + (eb - ea) * st / 24;
      var front = Math.sin(rad(dd)) > 0, sl = []; for (j2 = 0; j2 <= 4; j2++) sl.push(surf(front ? 0.8 + 0.05 * j2 : 0.2 - 0.05 * j2, dd));
      if (pa && pa.front === front) el('path', { d: poly(pa.pts.concat(sl.slice().reverse())), fill: SHADE, stroke: SHADE, 'stroke-width': 1 }, gp);
      pa = { pts: sl, front: front };
    }
    function range(lo, hi) { var res = []; clip(a, b, lo, hi).forEach(function (s) { res.push(s); }); return res; }
    function band(t0, t1, s) { var p1 = [], p2 = []; for (var k = 0; k <= 12; k++) { var d = s[0] + (s[1] - s[0]) * k / 12; p1.push(surf(t0, d)); p2.push(surf(t1, d)); } return poly(p1.concat(p2.reverse())); }
    function arcAt(t, s) { var p = []; for (var k = 0; k <= 12; k++) p.push(surf(t, s[0] + (s[1] - s[0]) * k / 12)); return polyline(p); }
    // outline the base where it meets the plate
    range(0, 180).forEach(function (s) { el('path', Object.assign({ d: arcAt(1, s), fill: 'none' }, ink), gp); });
    range(180, 360).forEach(function (s) { el('path', Object.assign({ d: arcAt(0, s), fill: 'none' }, ink), gp); });
    // top silhouette: the highest point of each cross-section
    var o = outline(a, b);
    el('path', Object.assign({ d: polyline(o.up), fill: 'none' }, ink), gp);
    // side silhouettes at the far left and right of the ring
    [0, 180].forEach(function (e) { clip(a, b, e - 0.01, e + 0.01).forEach(function () { var p = []; for (var k = 8; k <= 16; k++) p.push(surf(k / 16, e)); el('path', Object.assign({ d: polyline(p), fill: 'none' }, ink), gp); }); });
    // glaze shine along the top
    var hl = []; for (k = 0; k <= 8; k++) hl.push(surf(0.5, a + STEP * (0.1 + 0.8 * k / 8), 1.04));
    el('path', { d: polyline(hl), fill: 'none', stroke: 'var(--shell)', 'stroke-width': 2.4, 'stroke-linecap': 'round', opacity: 0.7 }, gp);

    // toppings: cobalt candied cherries (the "jewels"), candied orange slices, long candied strips, pine nuts, sugar
    var tops = [];
    for (var j = 0; j < 4; j++) tops.push({ d: a + STEP * (0.14 + 0.24 * j) + (seed(i, j) - 0.5) * 5, t: 0.3 + 0.4 * seed(j + 1, i), kind: (i + j) % 4 });
    tops.sort(function (x, y) { return surf(x.t, x.d)[1] - surf(y.t, y.d)[1]; });
    tops.forEach(function (tp, j) {
      var p = surf(tp.t, tp.d), tr = 'translate(' + P(p) + ') rotate(' + (seed(i, j + 5) * 50 - 25).toFixed(0) + ')';
      if (tp.kind === 0) {
        el('circle', { cx: p[0].toFixed(1), cy: (p[1] - 3).toFixed(1), r: 6.5, fill: (i + j) % 3 ? CHERRY : GREEN, stroke: 'var(--ink)', 'stroke-width': 1.3 }, gp);
        el('circle', { cx: (p[0] - 2.2).toFixed(1), cy: (p[1] - 5.4).toFixed(1), r: 1.8, fill: 'var(--shell)' }, gp);
      } else if (tp.kind === 1) {
        el('path', { d: 'M-11 2 A11 7 0 0 1 11 2 Z', fill: PEEL, stroke: 'var(--ink)', 'stroke-width': 1.4, 'stroke-linejoin': 'round', transform: tr }, gp);
        el('path', { d: 'M0 2 L-7 -2 M0 2 L0 -4 M0 2 L7 -2', stroke: 'var(--ink)', 'stroke-width': 1, transform: tr }, gp);
      } else if (tp.kind === 2) {
        el('rect', { x: -9, y: -3, width: 18, height: 6, rx: 2.5, fill: (i + j) % 2 ? GREEN : CHERRY, stroke: 'var(--ink)', 'stroke-width': 1.3, transform: tr }, gp);
        el('path', { d: 'M-5 -1 L5 -1', stroke: 'var(--ink)', 'stroke-width': 0.9, opacity: 0.6, transform: tr }, gp);
      } else {
        el('ellipse', { cx: 0, cy: 0, rx: 4.6, ry: 2.4, fill: 'var(--shell)', stroke: 'var(--ink)', 'stroke-width': 1.1, transform: tr }, gp);
        el('ellipse', { cx: 6, cy: 3, rx: 4.6, ry: 2.4, fill: 'var(--shell)', stroke: 'var(--ink)', 'stroke-width': 1.1, transform: tr }, gp);
      }
    });
    for (var m = 0; m < 6; m++) {
      var q = surf(0.2 + 0.6 * seed(i + 3, m), a + STEP * (0.08 + 0.84 * seed(m, i + 7)));
      el('rect', { x: (q[0] - 2.2).toFixed(1), y: (q[1] - 1.4).toFixed(1), width: 4.4, height: 2.8, rx: 1, fill: 'var(--shell)', stroke: 'var(--ink)', 'stroke-width': 0.6 }, gp);
    }

    if (fa && showA) gp.appendChild(fa);
    if (fb && showB) gp.appendChild(fb);

    return gp;
  }

  function drawBolo(svg, st) {
    st = st || {};
    var gone = st.gone || new Set(), out = st.out == null ? -1 : st.out, items = st.items || {};
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    // plate with a dotted rim
    el('ellipse', { cx: CX, cy: CY + 16, rx: 192, ry: 88, fill: 'var(--wash)', stroke: 'var(--ink)', 'stroke-width': 2 }, svg);
    el('ellipse', { cx: CX, cy: CY + 13, rx: 170, ry: 74, fill: 'none', stroke: 'var(--ink)', 'stroke-width': 1.2 }, svg);
    for (var k = 0; k < 30; k++) { var p = [CX + 181 * Math.cos(rad(k * 12)), CY + 16 + 81 * Math.sin(rad(k * 12))]; el('circle', { cx: p[0].toFixed(1), cy: p[1].toFixed(1), r: 1.8, fill: 'var(--ink)' }, svg); }
    // crumbs where slices were eaten
    gone.forEach(function (i) {
      for (var m = 0; m < 4; m++) { var q = pt(r + (R - r) * (0.2 + 0.6 * seed(i, m + 11)), center(i) + (seed(m, i + 2) - 0.5) * STEP * 0.8); el('circle', { cx: q[0].toFixed(1), cy: q[1].toFixed(1), r: (1.4 + 1.2 * seed(i, m)).toFixed(1), fill: 'var(--warm)', stroke: 'var(--ink)', 'stroke-width': 0.8 }, svg); }
    });
    var open = new Set(gone); if (out >= 0) open.add(out);
    // back to front; a slice that was just cut is drawn last so it sits on top
    var order = []; for (var i = 0; i < N; i++) if (!gone.has(i)) order.push(i);
    order.sort(function (x, y) { return Math.sin(rad(center(x))) - Math.sin(rad(center(y))); });
    var all = new Set(); for (i = 0; i < N; i++) all.add(i);
    var moved = [];
    order.forEach(function (i) {
      if (i !== out) { slice(i, svg, null, open); return; }
      var item = items.fava === out ? 'fava' : items.brinde === out ? 'brinde' : null;
      var gp = slice(out, svg, item, all); moved.push(gp);
    });
    if (out >= 0) {
      var sh = shift(out), dx = sh[0], dy = sh[1];
      moved.forEach(function (gp) {
        gp.classList.add('cut');
        gp.style.transform = 'translate(0px,0px)';
        requestAnimationFrame(function () { requestAnimationFrame(function () { gp.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px)'; }); });
      });
    }
  }

  function shift(i) { var c = rad(center(i)); return [Math.cos(c) * 34, Math.sin(c) * 34 * K + 10]; } // slides out and a little towards us
  /* where to point the speech bubble: top of the cut slice after it slid out, in viewBox units (400 x 240) */
  function anchor(i) { var p = surf(0.5, center(i)), sh = shift(i); return [p[0] + sh[0], p[1] + sh[1] - 8]; }

  /* random slices for the fava and the brinde, never the same one; the page stores them with the year */
  function randomItems() { var f = Math.floor(Math.random() * N), b = (f + 1 + Math.floor(Math.random() * (N - 1))) % N; return { fava: f, brinde: b }; }

  g.BoloRei = { draw: drawBolo, randomItems: randomItems, anchor: anchor, N: N, W: 400, H: 240 };
})(window);

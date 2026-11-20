/* «Спаси Лузиады»: runner in the spirit of the offline dino game.
   Camões swims to the shore holding the manuscript. Tap/Space/↑ = leap, hold = higher leap.
   Waves (low and tall), floating barrels, gulls. Speed grows. Three hits soak the manuscript.
   No score, no sound. window.Lusiadas.mount(el, texts) */
(function () {
  const W = 800, H = 300, SEA = 212, SX = 170;      // logical size, water line, swimmer x
  const GOAL = 20000;                                // distance to the shore, px
  const V0 = 420, V1 = 760;                          // start / max speed, px/s
  const BASE = SEA - 12, K = 1.2;
  const G = 2600, JUMP = -660, HOLD_G = 0.5, HOLD_T = 0.2, CEIL = 80;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function mount(root, T) {
    root.classList.add('lus'); root.innerHTML = '';
    const stage = document.createElement('div'); stage.className = 'lus-stage'; root.appendChild(stage);
    const cv = document.createElement('canvas'); cv.className = 'lus-cv'; stage.appendChild(cv);
    const panel = document.createElement('div'); panel.className = 'lus-panel'; stage.appendChild(panel);
    const status = document.createElement('p'); status.className = 'lus-status'; status.setAttribute('role', 'status'); root.appendChild(status);
    const hint = document.createElement('p'); hint.className = 'lus-hint'; hint.textContent = T.hint; root.appendChild(hint);
    const ctx = cv.getContext('2d');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

    let C = {};
    function colors() {
      const cs = getComputedStyle(root);
      const v = n => cs.getPropertyValue(n).trim();
      C = { ink: v('--ink') || '#1F4E9C', warm: v('--warm') || '#D9A441', wash: v('--wash') || '#E4ECF8', shell: v('--shell') || '#FFFDF7', paper: v('--paper') || '#FBF8F1' };
    }
    function size() {
      const r = stage.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
      cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.width * H / W * dpr);
      cv.style.height = (r.width * H / W) + 'px';
      ctx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
    }

    // ---------- state ----------
    let S;
    function reset() {
      S = {
        st: 'idle', t: 0, dist: 0, speed: V0,
        y: BASE, vy: 0, air: false, holdT: 0, holding: false,
        lives: 3, inv: 0, shake: 0, obs: [], nextAt: 900, parts: [], blots: [],
        clouds: [0, 1, 2, 3].map(i => ({ x: i * 230 + rnd(0, 80), y: rnd(30, 90), s: rnd(.8, 1.3) })),
        isles: [{ x: 620, k: 1 }], wreck: 360, endT: 0, finale: 0, px: SX, walk: false,
      };
    }

    // ---------- obstacles ----------
    function spawn() {
      const p = S.dist / GOAL;
      const roll = Math.random();
      let o;
      // a gull never arrives while you are still in the air after the previous obstacle
      const since = (S.dist - (S.lastAt || -1e9)) / S.speed;
      if (p > .2 && roll < .24 && since > 1.0) o = { k: 'gull', x: W + 40, y: rnd(76, 96), ph: rnd(0, 6) };
      else if (p > .08 && roll < .46) o = { k: 'barrel', x: W + 40, rot: rnd(0, 6) };
      else if (roll < .72 || p < .12) o = { k: 'wave', x: W + 80, h: rnd(62, 74), w: 34 };
      else o = { k: 'wave', x: W + 90, h: rnd(112, 120), w: 40, tall: true };
      S.obs.push(o);
      S.lastAt = S.dist;
      // gap in seconds: tighter as we go; more room after tall waves and gulls
      let gap = rnd(.8, 1.3) - p * .3;
      if (o.tall || o.k === 'gull') gap += .25;
      if (Math.random() < .25 && p > .15 && o.k === 'wave' && !o.tall) gap = .5; // quick double
      S.nextAt = S.dist + gap * S.speed;
    }
    function waveTop(x) {
      let y = SEA + Math.sin(x / 31 + S.t * 3) * 2.4 + Math.sin(x / 13 - S.t * 4.4) * 1.2;
      for (const o of S.obs) if (o.k === 'wave') {
        const d = (x - o.x) / o.w;
        if (d > -3 && d < 3) y -= o.h * Math.exp(-d * d);
      }
      return y;
    }

    // ---------- swimmer geometry ----------
    // hitbox a bit smaller than the drawing: forgiving, like the dino
    const bookBox = () => ({ x: SX + 6, y: S.y - 73, w: 60, h: 26 });
    const headC = () => ({ x: SX, y: S.y, r: 17 });

    function hit(kind) {
      if (S.inv > 0 || S.st !== 'play') return;
      S.lives--; S.inv = 1.0; S.stop = reduce ? 0 : .09; S.shake = reduce ? 0 : .28;
      const b = bookBox();
      for (let i = 0; i < 16; i++) S.parts.push({ x: b.x + b.w / 2 + rnd(-16, 16), y: b.y + rnd(0, 18), vx: rnd(-160, 160), vy: rnd(-320, -80), r: rnd(2, 4.5), life: rnd(.4, .8), k: 'drop' });
      S.blots.push({ x: rnd(-22, 22), y: rnd(-8, 6), r: rnd(5, 7) });
      if (S.lives <= 0) over(false);
    }
    function over(won) {
      S.st = won ? 'won' : 'lost'; S.endT = S.t; S.holding = false;
      status.textContent = won ? T.won : T.lost;
      setTimeout(() => showPanel(T.again, won), won ? 1600 : 500);
      if (won && T.onWin) T.onWin();
    }

    // ---------- update ----------
    function update(dt) {
      if (S.stop > 0) { S.stop -= dt; return; }
      S.t += dt;
      if (S.shake > 0) S.shake -= dt;
      if (S.inv > 0) S.inv -= dt;
      const playing = S.st === 'play';
      if (playing) {
        S.speed = V0 + (V1 - V0) * clamp(S.dist / GOAL, 0, 1);
        S.dist += S.speed * dt;
        if (S.dist >= S.nextAt && S.dist < GOAL - 1700) spawn();
      }
      const fin = S.st === 'finale' || S.st === 'won';
      const sp = playing ? S.speed : S.st === 'idle' ? 120 : fin ? S.speed * Math.max(0, 1 - S.finale / .5) : 0;
      if (fin) S.dist += sp * dt;
      for (const o of S.obs) { o.x -= sp * dt; if (o.k === 'gull') o.x -= 110 * dt; if (o.k === 'barrel') o.rot += dt * 1.6; }
      S.obs = S.obs.filter(o => o.x > -160);
      for (const c of S.clouds) { c.x -= sp * .08 * dt + 6 * dt; if (c.x < -140) { c.x = W + rnd(20, 120); c.y = rnd(30, 90); } }
      for (const i of S.isles) { i.x -= sp * .22 * dt; if (i.x < -260) { i.x = W + rnd(200, 600); i.k = rnd(.7, 1.2); } }
      S.wreck -= sp * .3 * dt;

      // swimmer
      if (S.air) {
        const g = S.holding && S.holdT < HOLD_T && S.vy < 0 ? G * HOLD_G : G;
        if (S.holding) S.holdT += dt;
        S.vy += g * dt; S.y += S.vy * dt;
        if (S.y < CEIL) { S.y = CEIL; if (S.vy < 0) S.vy = 0; }
        if (S.y >= BASE) {
          S.y = BASE; S.vy = 0; S.air = false;
          for (let i = 0; i < 10; i++) S.parts.push({ x: SX + rnd(-24, 24), y: SEA - 2, vx: rnd(-140, 140), vy: rnd(-260, -80), r: rnd(2, 4), life: rnd(.3, .6), k: 'drop' });
        }
      } else {
        S.y = BASE + Math.sin(S.t * 6) * 2;
      }
      // kick foam
      if (playing && !S.air && Math.random() < dt * 22) S.parts.push({ x: SX - 34 + rnd(-6, 6), y: SEA + rnd(-2, 4), vx: -sp * .6 + rnd(-30, 30), vy: rnd(-90, -20), r: rnd(1.6, 3.2), life: rnd(.25, .5), k: 'foam' });
      for (const p of S.parts) { p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
      S.parts = S.parts.filter(p => p.life > 0);

      // collisions
      if (playing) {
        const b = bookBox(), h = headC();
        let crest = 1e9;
        for (let x = b.x + 6; x <= b.x + b.w - 6; x += 6) crest = Math.min(crest, waveTop(x));
        if (crest < b.y + b.h - 4) hit('wave');
        for (const o of S.obs) {
          if (o.k === 'barrel' && Math.abs(o.x - h.x) < 30 && h.y + h.r > SEA - 30) hit('barrel');
          if (o.k === 'gull' && o.x > b.x - 14 && o.x < b.x + b.w + 14 && o.y > b.y - 14 && o.y < b.y + b.h + 10) hit('gull');
        }
        if (S.dist >= GOAL) { S.st = 'finale'; S.finale = 0; }
      }
      if (fin) {
        S.finale += dt;
        const left = shoreLeft();
        if (!S.walk && S.finale > .45) {
          S.walk = true; S.air = false;
          for (let i = 0; i < 14; i++) S.parts.push({ x: SX + rnd(-20, 30), y: SEA - 4, vx: rnd(-160, 160), vy: rnd(-300, -100), r: rnd(2, 4), life: rnd(.4, .7), k: 'drop' });
        }
        if (S.walk) S.px = Math.min(S.px + 150 * dt, left + 200);
        if (S.st === 'finale' && S.finale > 1.9) over(true);
      }
    }

    // ---------- drawing helpers ----------
    function stroke(w) { ctx.lineWidth = w || 2.4; ctx.strokeStyle = C.ink; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; }
    function cloud(x, y, s) {
      ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
      ctx.beginPath();
      ctx.moveTo(-50, 10); ctx.bezierCurveTo(-60, -6, -36, -18, -22, -8); ctx.bezierCurveTo(-18, -26, 14, -28, 18, -10);
      ctx.bezierCurveTo(34, -18, 56, -6, 48, 10); ctx.closePath();
      ctx.fillStyle = C.wash; ctx.fill(); stroke(2); ctx.stroke();
      ctx.beginPath(); ctx.arc(-18, -2, 5, Math.PI * .1, Math.PI * 1.6); ctx.stroke();
      ctx.restore();
    }
    function isle(x, k) {
      ctx.save(); ctx.translate(x, SEA - 30); ctx.scale(k, k);
      ctx.globalAlpha = .55;
      ctx.beginPath(); ctx.moveTo(-90, 30); ctx.bezierCurveTo(-60, -6, 40, -10, 90, 30); ctx.closePath();
      ctx.fillStyle = C.wash; ctx.fill(); stroke(1.8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-6, 4); ctx.quadraticCurveTo(-4, -18, 2, -30); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(2, -30); ctx.quadraticCurveTo(-14, -36, -22, -26); ctx.moveTo(2, -30); ctx.quadraticCurveTo(18, -38, 26, -26); ctx.moveTo(2, -30); ctx.quadraticCurveTo(-4, -44, -16, -44); ctx.stroke();
      ctx.restore();
    }
    function wreck(x) {
      if (x < -200) return;
      ctx.save(); ctx.translate(x, SEA - 8); ctx.globalAlpha = .6; ctx.rotate(-.18);
      ctx.beginPath(); ctx.moveTo(-70, -10); ctx.lineTo(60, -18); ctx.lineTo(44, 10); ctx.lineTo(-58, 14); ctx.closePath();
      ctx.fillStyle = C.wash; ctx.fill(); stroke(2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-4, -14); ctx.lineTo(10, -70); ctx.moveTo(10, -70); ctx.lineTo(30, -52); ctx.moveTo(-40, -12); ctx.lineTo(-50, -44); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(12, -64); ctx.quadraticCurveTo(34, -60, 30, -36); ctx.lineTo(10, -40); ctx.closePath(); ctx.fillStyle = C.shell; ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    function waterPath(off, dy) {
      ctx.beginPath(); ctx.moveTo(-10, H);
      for (let x = -10; x <= W + 10; x += 5) ctx.lineTo(x, waveTop(x + off) + dy);
      ctx.lineTo(W + 10, H); ctx.closePath();
    }
    function curls() {
      stroke(2);
      for (const o of S.obs) if (o.k === 'wave' && o.x > -60 && o.x < W + 60) {
        const y = waveTop(o.x);
        ctx.beginPath(); ctx.moveTo(o.x + 10, y + 4);
        ctx.bezierCurveTo(o.x - 6, y - 10, o.x - 26, y + 2, o.x - 18, y + 12);
        ctx.bezierCurveTo(o.x - 12, y + 18, o.x - 4, y + 10, o.x - 10, y + 6);
        ctx.stroke();
        ctx.fillStyle = C.shell;
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(o.x - 30 + i * 14, y + 10 + (i % 2) * 6, 2.2, 0, 7); ctx.fill(); }
      }
    }
    function barrel(o) {
      const y = waveTop(o.x) - 6;
      ctx.save(); ctx.translate(o.x, y); ctx.rotate(Math.sin(o.rot) * .35);
      ctx.beginPath(); ctx.ellipse(0, 0, 20, 16, 0, 0, 7); ctx.fillStyle = C.warm; ctx.fill(); stroke(2.2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-9, -15); ctx.quadraticCurveTo(-13, 0, -9, 15); ctx.moveTo(9, -15); ctx.quadraticCurveTo(13, 0, 9, 15); ctx.stroke();
      ctx.restore();
    }
    function gull(o) {
      const f = Math.sin(S.t * 14 + o.ph) * 9;
      ctx.save(); ctx.translate(o.x, o.y); stroke(2.6);
      ctx.beginPath(); ctx.moveTo(-22, -f); ctx.quadraticCurveTo(-10, -6 - f * .3, 0, 0); ctx.quadraticCurveTo(10, -6 - f * .3, 22, -f); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(-2, 1, 7, 3.5, 0, 0, 7); ctx.fillStyle = C.shell; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-9, 1); ctx.lineTo(-14, 3); ctx.strokeStyle = C.warm; ctx.stroke();
      ctx.restore();
    }
    function limb(x0, y0, x1, y1, w, fill) {
      stroke(w); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.strokeStyle = fill || C.wash; ctx.lineWidth = w * .62; ctx.stroke();
    }
    function limb2(x0, y0, xm, ym, x1, y1, w) {
      stroke(w); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(xm, ym); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.strokeStyle = C.wash; ctx.lineWidth = w * .62; ctx.stroke();
    }
    function hand(x, y) { ctx.beginPath(); ctx.arc(x, y, 4.6, 0, 7); ctx.fillStyle = C.shell; ctx.fill(); stroke(2); ctx.stroke(); }
    function head(alpha) {
      ctx.beginPath(); ctx.arc(0, 0, 14, 0, 7); ctx.fillStyle = C.shell; ctx.fill(); stroke(2.2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-14, 0); ctx.bezierCurveTo(-15, -12, -4, -17, 6, -14); ctx.bezierCurveTo(2, -9, -6, -6, -12, 4); ctx.closePath(); ctx.fillStyle = C.ink; ctx.fill();
      ctx.beginPath(); ctx.moveTo(-2, 8); ctx.bezierCurveTo(2, 18, 12, 16, 14, 6); ctx.bezierCurveTo(8, 9, 3, 9, -2, 8); ctx.fill();
      stroke(2); ctx.beginPath(); ctx.moveTo(5, -2); ctx.lineTo(10, -2); ctx.stroke(); // the eye he lost, closed
      // laurel wreath
      ctx.fillStyle = C.warm; ctx.lineWidth = 1.2;
      for (const [lx, ly, la] of [[-12, -6, -2.2], [-9, -11, -1.8], [-3, -14, -1.4], [3, -15, -1.1]]) { ctx.save(); ctx.translate(lx, ly); ctx.rotate(la); ctx.beginPath(); ctx.ellipse(0, -4, 2.6, 5, 0, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore(); }
    }
    // torso: dark doublet, white ruff at the neck, warm sash
    function torso(x0, y0, x1, y1) {
      stroke(20); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      const a = Math.atan2(y1 - y0, x1 - x0), mx = x0 + (x1 - x0) * .78, my = y0 + (y1 - y0) * .78;
      ctx.save(); ctx.translate(mx, my); ctx.rotate(a); ctx.fillStyle = C.warm; ctx.fillRect(-2.5, -10, 5, 20); ctx.restore();
      ctx.save(); ctx.translate(x0, y0); ctx.rotate(a + Math.PI / 2);
      ctx.beginPath(); ctx.ellipse(0, 0, 11, 4.6, 0, 0, 7); ctx.fillStyle = C.shell; ctx.fill(); stroke(1.8); ctx.stroke();
      ctx.restore();
    }
    function book(rot, alpha) {
      ctx.save(); ctx.rotate(rot);
      ctx.beginPath(); ctx.moveTo(0, 12); ctx.bezierCurveTo(-10, 8, -22, 8, -29, 11); ctx.lineTo(-27, -11); ctx.bezierCurveTo(-18, -14, -8, -13, 0, -9); ctx.closePath();
      ctx.moveTo(0, 12); ctx.bezierCurveTo(10, 8, 22, 8, 29, 11); ctx.lineTo(27, -11); ctx.bezierCurveTo(18, -14, 8, -13, 0, -9); ctx.closePath();
      ctx.fillStyle = C.shell; ctx.fill(); stroke(2.2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-29, 11); ctx.lineTo(-31, 15); ctx.bezierCurveTo(-18, 12, -8, 12, 0, 16); ctx.bezierCurveTo(8, 12, 18, 12, 31, 15); ctx.lineTo(29, 11);
      ctx.fillStyle = C.warm; ctx.fill(); ctx.stroke();
      ctx.lineWidth = 1.1; ctx.globalAlpha = alpha * .6;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-23, -5 + i * 6); ctx.lineTo(-5, -4 + i * 6); ctx.moveTo(5, -4 + i * 6); ctx.lineTo(23, -5 + i * 6); ctx.stroke(); }
      ctx.fillStyle = C.ink;
      for (const b of S.blots) { ctx.globalAlpha = .55 * alpha; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(b.x + b.r * .8, b.y + b.r * .6, b.r * .5, 0, 7); ctx.fill(); }
      ctx.globalAlpha = alpha;
      ctx.restore();
    }
    function swimmer() {
      if (S.walk) return walker();
      const blink = S.inv > 0 && Math.floor(S.t * 14) % 2 === 0, al = blink ? .35 : 1;
      ctx.globalAlpha = al;
      const x = SX, y = S.y, tilt = S.air ? clamp(S.vy / 1500, -.4, .4) : 0;
      ctx.save(); ctx.translate(x, y); ctx.rotate(tilt); ctx.scale(K, K);
      // body and legs: drawn always, the front water hides them while swimming
      const k = Math.sin(S.t * (S.air ? 22 : 10)) * 7;
      limb2(-40, 16, -56, 12 + k, -72, 16 + k * 1.3, 9);
      limb2(-40, 16, -56, 20 - k, -71, 26 - k * 1.3, 9);
      torso(-8, 10, -40, 16);
      // stroking arm (crawl): rotates around the shoulder
      const a = S.t * (S.st === 'play' ? 9 : 4);
      const hx = -4 + Math.cos(a) * 26, hy = 10 + Math.sin(a) * 22;
      if (S.air || hy < 14) { limb(-6, 10, hx, hy, 10); hand(hx, hy); }
      // raised arm with the book
      stroke(10); ctx.beginPath(); ctx.moveTo(4, 6); ctx.quadraticCurveTo(16, -14, 24, -32); ctx.stroke();
      ctx.strokeStyle = C.wash; ctx.lineWidth = 6.4; ctx.stroke();
      hand(24, -34);
      ctx.save(); ctx.translate(31, -50); book(-tilt * .6 + Math.sin(S.t * 6) * .03, al); ctx.restore();
      head(al);
      ctx.restore();
      ctx.globalAlpha = 1;
    }
    // finale: wades out, then hops with joy, book held high in both hands
    function walker() {
      const f = S.finale, left = shoreLeft(), gy = ground(S.px - left);
      const arrived = S.px >= left + 199, ct = arrived ? S.t : 0;
      const hop = arrived ? Math.abs(Math.sin(ct * 6.5)) * 18 : 0;
      const sw = arrived ? 0 : Math.sin(f * 13) * 10;
      const bend = arrived ? (1 - Math.abs(Math.sin(ct * 6.5))) * 6 : 0;
      ctx.save(); ctx.translate(S.px, gy - hop); ctx.scale(K, K);
      limb2(-4, -30, -6 + sw * .5 - bend, -15, -4 + sw, 0, 9);
      limb2(4, -30, 6 - sw * .5 + bend, -15, 4 - sw, 0, 9);
      ctx.fillStyle = C.ink;
      ctx.beginPath(); ctx.ellipse(-1 + sw, 1, 7, 3.4, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(7 - sw, 1, 7, 3.4, 0, 0, 7); ctx.fill();
      torso(0, -58, 0, -30);
      const pump = arrived ? Math.sin(ct * 13) * 4 : 0;
      limb(-8, -56, -14, -92 - pump, 10); limb(8, -56, 14, -92 - pump, 10);
      hand(-14, -93 - pump); hand(14, -93 - pump);
      ctx.save(); ctx.translate(0, -106 - pump); book(arrived ? Math.sin(ct * 6.5) * .08 : 0, 1); ctx.restore();
      ctx.save(); ctx.translate(0, -74); head(1); ctx.restore();
      // sparkles around the saved book
      if (arrived) {
        ctx.fillStyle = C.warm; stroke(1.4);
        for (let i = 0; i < 7; i++) {
          const a = i * 0.9 + 3.6, r = 52 + (i % 3) * 8, s = Math.max(0, Math.sin(ct * 5 + i * 1.7)) * 6;
          if (s < .5) continue;
          const sx = Math.cos(a) * r, sy = -106 + Math.sin(a) * r * .7;
          ctx.beginPath(); ctx.moveTo(sx, sy - s); ctx.lineTo(sx + s * .3, sy - s * .3); ctx.lineTo(sx + s, sy); ctx.lineTo(sx + s * .3, sy + s * .3); ctx.lineTo(sx, sy + s); ctx.lineTo(sx - s * .3, sy + s * .3); ctx.lineTo(sx - s, sy); ctx.lineTo(sx - s * .3, sy - s * .3); ctx.closePath(); ctx.fill(); ctx.stroke();
        }
      }
      ctx.restore();
    }
    function hud() {
      // three little books = lives
      for (let i = 0; i < 3; i++) {
        const x = 22 + i * 30, y = 22, wet = i >= S.lives;
        ctx.beginPath(); ctx.moveTo(x, y + 8); ctx.lineTo(x - 11, y + 10); ctx.lineTo(x - 10, y - 6); ctx.lineTo(x, y - 4); ctx.lineTo(x + 10, y - 6); ctx.lineTo(x + 11, y + 10); ctx.closePath();
        ctx.fillStyle = wet ? C.wash : C.shell; ctx.fill(); stroke(1.8); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x, y + 8); ctx.stroke();
        if (wet) { ctx.fillStyle = C.ink; ctx.globalAlpha = .6; ctx.beginPath(); ctx.arc(x - 4, y + 1, 4, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
      }
      // route to the shore
      const x0 = W - 230, x1 = W - 26, p = clamp(S.dist / GOAL, 0, 1);
      stroke(2); ctx.setLineDash([2, 6]); ctx.beginPath(); ctx.moveTo(x0, 22); ctx.lineTo(x1, 22); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(x1 - 10, 28); ctx.quadraticCurveTo(x1, 12, x1 + 12, 28); ctx.closePath(); ctx.fillStyle = C.wash; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(x0 + (x1 - x0 - 12) * p, 22, 5.5, 0, 7); ctx.fillStyle = C.warm; ctx.fill(); ctx.stroke();
    }
    const shoreLeft = () => SX + 60 + (GOAL - S.dist);
    function ground(r) {
      if (r < 0) return SEA + 14;
      if (r < 120) { const k = r / 120; return SEA + 14 - 40 * k * k * (3 - 2 * k); }
      return SEA - 26;
    }
    function palm(x, y, s, sway) {
      ctx.save(); ctx.translate(x, y); ctx.scale(s, s); stroke(3);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(6, -36, 2 + sway, -70); ctx.stroke();
      ctx.lineWidth = 2.4;
      for (const [dx, dy] of [[-30, 8], [30, 6], [-22, -16], [24, -18], [0, -24]]) { ctx.beginPath(); ctx.moveTo(2 + sway, -70); ctx.quadraticCurveTo(dx * .5 + sway, -70 + dy - 14, dx + sway * 1.6, -70 + dy); ctx.stroke(); }
      ctx.restore();
    }
    function sun(x, f) {
      const k = clamp((f - .7) / 1.4, 0, 1), y = SEA - 20 - 100 * k * (2 - k);
      ctx.save(); ctx.translate(x, y);
      ctx.rotate(f * .5); ctx.strokeStyle = C.warm; ctx.lineWidth = 3.2; ctx.lineCap = 'round';
      for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6, r0 = 36, r1 = 48 + (i % 2) * 8 + Math.sin(f * 4 + i) * 3; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); ctx.stroke(); }
      ctx.beginPath(); ctx.arc(0, 0, 27, 0, 7); ctx.fillStyle = C.warm; ctx.fill(); stroke(2.4); ctx.stroke();
      ctx.restore();
    }
    function shore() {
      const left = shoreLeft();
      if (left > W + 40) return;
      const f = S.finale;
      if (S.st === 'finale' || S.st === 'won') sun(left + 590, f);
      ctx.beginPath(); ctx.moveTo(left, H);
      for (let r = 0; left + r <= W + 12; r += 6) ctx.lineTo(left + r, ground(r));
      ctx.lineTo(W + 12, H); ctx.closePath();
      ctx.fillStyle = C.wash; ctx.fill(); stroke(2.4); ctx.stroke();
      // a few pebbles on the sand
      ctx.fillStyle = C.ink; ctx.globalAlpha = .5;
      for (const r of [150, 172, 290, 360, 420, 520]) { ctx.beginPath(); ctx.ellipse(left + r, ground(r) + 9 + (r % 3) * 4, 2.6, 1.6, 0, 0, 7); ctx.fill(); }
      ctx.globalAlpha = 1;
      const sway = Math.sin(S.t * 1.6) * 3;
      for (const [r, sc] of [[300, 1], [370, 1.25], [500, 1.05]]) palm(left + r, ground(r) + 2, sc, sway * sc);
    }
    function draw() {
      ctx.save();
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, H);
      if (S.shake > 0) ctx.translate(rnd(-5, 5), rnd(-4, 4));
      for (const c of S.clouds) cloud(c.x, c.y, c.s);
      for (const i of S.isles) isle(i.x, i.k);
      wreck(S.wreck);
      // back water (lighter, offset)
      waterPath(40, -8); ctx.fillStyle = C.wash; ctx.fill(); stroke(2); ctx.stroke();
      shore();
      for (const o of S.obs) if (o.k === 'barrel') barrel(o);
      swimmer();
      // front water hides the body
      waterPath(0, 0); ctx.fillStyle = C.paper; ctx.fill();
      ctx.globalAlpha = .34; ctx.fillStyle = C.ink; ctx.fill(); ctx.globalAlpha = 1; stroke(2.4); ctx.stroke();
      // fast lines on the water for speed
      ctx.strokeStyle = C.paper; ctx.lineWidth = 2; ctx.globalAlpha = .7;
      const off = (S.dist * 1.0) % 120;
      for (let i = 0; i < 9; i++) { const x = i * 120 - off, y = SEA + 26 + (i % 3) * 18; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 34 + (i % 2) * 20, y); ctx.stroke(); }
      ctx.globalAlpha = 1;
      curls();
      for (const o of S.obs) if (o.k === 'gull') gull(o);
      if (S.walk) { const L = shoreLeft(), f = S.finale; gull({ x: L + 420 + Math.cos(f * 1.3) * 70, y: 70 + Math.sin(f * 2.6) * 12, ph: 0 }); gull({ x: L + 420 + Math.cos(f * 1.3 + 3) * 70, y: 84 + Math.sin(f * 2.6 + 3) * 12, ph: 2 }); }
      for (const p of S.parts) { ctx.globalAlpha = clamp(p.life * 2, 0, 1); ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fillStyle = p.k === 'foam' ? C.shell : C.wash; ctx.fill(); stroke(1.2); ctx.stroke(); }
      ctx.globalAlpha = 1;
      if (S.st !== 'idle') hud();
      ctx.restore();
    }

    // ---------- loop and input ----------
    let raf = 0, last = 0;
    function frame(ts) {
      const dt = Math.min(.033, (ts - last) / 1000 || 0); last = ts;
      update(dt); draw();
      if (S.st === 'won' && S.t - S.endT > 7) return; // celebrate a while, then stop
      if (S.st === 'lost' && S.t - S.endT > 1) return;
      raf = requestAnimationFrame(frame);
    }
    function run() { cancelAnimationFrame(raf); last = performance.now(); raf = requestAnimationFrame(frame); }
    function start() {
      reset(); colors(); S.st = 'play'; status.textContent = ''; panel.hidden = true;
      stage.focus({ preventScroll: true });
      if (T.onStart) T.onStart();
      run();
    }
    function press() {
      if (S.st === 'idle' || ((S.st === 'lost' || S.st === 'won') && S.t - S.endT > .5)) { start(); return; }
      if (S.st !== 'play') return;
      S.holding = true;
      if (!S.air) {
        S.air = true; S.vy = JUMP; S.holdT = 0;
        for (let i = 0; i < 8; i++) S.parts.push({ x: SX + rnd(-20, 20), y: SEA - 2, vx: rnd(-120, 60), vy: rnd(-220, -60), r: rnd(2, 3.6), life: rnd(.3, .5), k: 'drop' });
      }
    }
    function release() { if (S) S.holding = false; }
    function showPanel(label, corner) {
      panel.hidden = false; panel.innerHTML = '';
      panel.classList.toggle('lus-panel--end', !!corner);
      const b = document.createElement('button'); b.type = 'button'; b.className = 'lus-go'; b.textContent = label;
      b.addEventListener('pointerdown', e => e.stopPropagation());
      b.addEventListener('click', e => { e.stopPropagation(); start(); });
      panel.appendChild(b);
    }
    stage.tabIndex = 0; stage.setAttribute('role', 'button'); stage.setAttribute('aria-label', T.aria);
    stage.addEventListener('pointerdown', e => { if (e.target.closest('.lus-go')) return; e.preventDefault(); press(); });
    addEventListener('pointerup', release); stage.addEventListener('pointercancel', release);
    stage.addEventListener('contextmenu', e => e.preventDefault());
    stage.addEventListener('keydown', e => { if ([' ', 'Enter', 'ArrowUp'].includes(e.key)) { e.preventDefault(); if (!e.repeat) press(); } });
    stage.addEventListener('keyup', e => { if ([' ', 'Enter', 'ArrowUp'].includes(e.key)) release(); });
    new ResizeObserver(() => { size(); if (S) draw(); }).observe(stage);
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { colors(); draw(); });

    reset(); colors(); size(); showPanel(T.start);
    if (reduce) draw(); else run();
    // idle loop stops after a few seconds to save battery
    setTimeout(() => { if (S.st === 'idle') cancelAnimationFrame(raf), draw(); }, 8000);
    if (T.debug) T.debug(() => S);
  }
  window.Lusiadas = { mount };
})();

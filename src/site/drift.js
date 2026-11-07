// The drift field: the Hushd ring drawn in dots. Move fast through it and the dots scatter, the way attention does;
// hold still (or leave) and every dot springs back home. Come back gently, as something you can touch.
//
// It costs nothing at rest: the simulation and the drawing run only while some dot is away from home, and stop
// with the page. Dots are drawn by the shared WebGL renderer in halftone.js (one draw call per frame).
import { dots, rgbOf } from "./halftone.js";
import { scope } from "./scope.js";

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const K = Math.pow((2 * Math.PI) / 1.1, 2); // spring home: response 1.1 s
const C = (4 * Math.PI * 0.55) / 1.1; //       damping 0.55, a soft wobble on the way back
const REACH = 120; // px around the pointer that a fast move disturbs

export function driftField(canvas) {
  const s = scope();
  const ctx = canvas.getContext("2d");
  const color = rgbOf(getComputedStyle(canvas).color || "#1d6b47");
  let W = 0, H = 0, dpr = 1, n = 0;
  let hx, hy, x, y, vx, vy, base, xyr;
  let raf = 0, last = 0, visible = false, dead = false;
  const ptr = { x: -1e4, y: -1e4, vx: 0, vy: 0, t: 0 };

  // Lay the ring out on a hex lattice; dots are biggest along the middle of the band, like a halftone stroke.
  function layout() {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    const cx = W * (W > 900 ? 0.5 : 0.5), cy = H * 0.52;
    const R = Math.min(W * 0.46, H * 0.5), band = R * 0.2, mid = R - band;
    const cell = W > 900 ? 9 : 7;
    const pts = [];
    for (let j = 0, yy = cy - R - cell; yy < cy + R + cell; j++, yy += cell * 0.866) {
      for (let xx = cx - R - cell + (j & 1 ? cell / 2 : 0); xx < cx + R + cell; xx += cell) {
        const d = Math.abs(Math.hypot(xx - cx, yy - cy) - mid) / band; // 0 at the middle of the band, 1 at its edge
        if (d < 1) pts.push(xx, yy, Math.pow(1 - d * d, 0.8));
        // A faint scatter of dust outside the ring, so the field reads as a field.
        else if (d < 3.2 && ((xx * 7 + yy * 13) % 11) < 1.2) pts.push(xx, yy, 0.18 * (1 - (d - 1) / 2.2));
      }
    }
    n = pts.length / 3;
    hx = new Float32Array(n); hy = new Float32Array(n); base = new Float32Array(n);
    x = new Float32Array(n); y = new Float32Array(n); vx = new Float32Array(n); vy = new Float32Array(n);
    xyr = new Float32Array(n * 3);
    const maxR = cell * 0.36;
    for (let i = 0; i < n; i++) {
      x[i] = hx[i] = pts[i * 3]; y[i] = hy[i] = pts[i * 3 + 1];
      base[i] = (0.25 + 0.75 * pts[i * 3 + 2]) * maxR;
    }
    return true;
  }

  function draw() {
    for (let i = 0; i < n; i++) {
      xyr[i * 3] = x[i] * dpr; xyr[i * 3 + 1] = y[i] * dpr;
      // A dot away from home grows a touch, so the scatter reads as energy, not damage.
      const off = Math.min(1, Math.hypot(x[i] - hx[i], y[i] - hy[i]) / 60);
      xyr[i * 3 + 2] = base[i] * (1 + 0.35 * off) * dpr;
    }
    if (dots.ok) dots.draw(ctx, canvas.width, canvas.height, xyr, n, color);
    else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = `rgb(${color.map((c) => Math.round(c * 255)).join(",")})`;
      ctx.beginPath();
      for (let i = 0; i < n; i++) { const r = xyr[i * 3 + 2]; ctx.moveTo(xyr[i * 3] + r, xyr[i * 3 + 1]); ctx.arc(xyr[i * 3], xyr[i * 3 + 1], r, 0, 6.283); }
      ctx.fill();
    }
  }

  function step(now) {
    raf = 0;
    if (dead) return;
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    let moving = false;
    const h = dt / 2; // two substeps keep the soft spring stable on slow frames
    for (let k = 0; k < 2; k++) {
      for (let i = 0; i < n; i++) {
        const ax = -K * (x[i] - hx[i]) - C * vx[i], ay = -K * (y[i] - hy[i]) - C * vy[i];
        vx[i] += ax * h; vy[i] += ay * h;
        x[i] += vx[i] * h; y[i] += vy[i] * h;
      }
    }
    for (let i = 0; i < n; i++) {
      if (Math.abs(x[i] - hx[i]) > 0.15 || Math.abs(y[i] - hy[i]) > 0.15 || Math.abs(vx[i]) > 0.5 || Math.abs(vy[i]) > 0.5) { moving = true; break; }
    }
    draw();
    if (moving && visible) kick();
    else if (!moving) for (let i = 0; i < n; i++) { x[i] = hx[i]; y[i] = hy[i]; vx[i] = vy[i] = 0; }
  }
  const kick = () => { if (!raf && !dead) { if (!last || performance.now() - last > 100) last = performance.now(); raf = requestAnimationFrame(step); } };

  // Push dots near the pointer along its motion, harder the faster it moves. A slow, deliberate pointer barely
  // stirs them; a flick sends them flying.
  function disturb(px, py, mvx, mvy, strength) {
    const speed = Math.hypot(mvx, mvy);
    if (speed < 0.25 && strength < 1) return;
    const r2 = REACH * REACH;
    for (let i = 0; i < n; i++) {
      const dx = x[i] - px, dy = y[i] - py, d2 = dx * dx + dy * dy;
      if (d2 > r2) continue;
      const f = (1 - d2 / r2) * strength;
      const d = Math.sqrt(d2) || 1;
      vx[i] += (mvx * 900 + (dx / d) * speed * 260) * f;
      vy[i] += (mvy * 900 + (dy / d) * speed * 260) * f;
    }
    kick();
  }

  const host = canvas.closest("section") || canvas.parentElement;
  const on = (t, type, fn) => (s ? s.on(t, type, fn, { passive: true }) : t.addEventListener(type, fn, { passive: true }));
  if (!reduceMotion) {
    on(host, "pointermove", (e) => {
      const r = canvas.getBoundingClientRect();
      const px = e.clientX - r.left, py = e.clientY - r.top, t = e.timeStamp;
      const dt = Math.max(8, t - ptr.t);
      if (ptr.t && t - ptr.t < 120) disturb(px, py, (px - ptr.x) / dt, (py - ptr.y) / dt, 1);
      ptr.x = px; ptr.y = py; ptr.t = t;
    });
    on(host, "pointerleave", () => { ptr.t = 0; });
    // A tap scatters the dots around it outward, then they come home.
    on(host, "pointerdown", (e) => {
      if (e.target.closest?.("a, button")) return;
      const r = canvas.getBoundingClientRect();
      disturb(e.clientX - r.left, e.clientY - r.top, 0, 0, 2.2);
      const px = e.clientX - r.left, py = e.clientY - r.top;
      for (let i = 0; i < n; i++) {
        const dx = x[i] - px, dy = y[i] - py, d2 = dx * dx + dy * dy;
        if (d2 > 40000) continue;
        const d = Math.sqrt(d2) || 1, f = 1 - d2 / 40000;
        vx[i] += (dx / d) * 520 * f; vy[i] += (dy / d) * 520 * f;
      }
      kick();
    });
  }

  const ro = new ResizeObserver(() => { const r = canvas.getBoundingClientRect(); if (Math.abs(r.width - W) > 0.5 || Math.abs(r.height - H) > 0.5) { if (layout()) draw(); } });
  ro.observe(canvas);
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && n) kick(); }, { rootMargin: "100px" });
  io.observe(canvas);
  s?.add(() => { dead = true; ro.disconnect(); io.disconnect(); cancelAnimationFrame(raf); });
}

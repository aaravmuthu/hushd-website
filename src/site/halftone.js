// Halftone: draws public-domain art as a field of dots, the way Droppy draws its renaissance hands.
// Each layer samples an image into a grid of values (0..1); a dot's area follows its value. Dots ripple in from an
// origin the first time the canvas is seen, and swell softly under the pointer. Nothing redraws while nothing moves.

import { scope } from "./scope.js";

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;

const loaded = new Map();
export function loadImage(src) {
  if (!loaded.has(src)) {
    // One retry: a dropped request should cost a moment, not the art.
    const attempt = (tries) => new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => resolve(img);
      img.onerror = () => (tries > 0 ? setTimeout(() => attempt(tries - 1).then(resolve, reject), 400) : reject(new Error(`Could not load ${src}`)));
      img.src = tries < 1 ? `${src}?retry` : src;
    });
    loaded.set(src, attempt(1));
  }
  return loaded.get(src);
}

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const fields = new Map();
const PULSE_MS = 1300, PULSE_SPEED = 0.75;
const idle = window.requestIdleCallback ? (f) => requestIdleCallback(f, { timeout: 600 }) : (f) => setTimeout(() => { const end = performance.now() + 6; f({ timeRemaining: () => end - performance.now() }); }, 16);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
export const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

// Pre-rendered dots, one per radius step, so a frame is a few thousand drawImage calls instead of arc paths.
function makeSprites(color, maxR, steps, dpr) {
  const size = Math.ceil(maxR * 2 * dpr) + 2;
  const sheet = document.createElement("canvas");
  sheet.width = size * steps;
  sheet.height = size;
  const g = sheet.getContext("2d");
  g.fillStyle = color;
  for (let i = 0; i < steps; i++) {
    const r = ((i + 1) / steps) * maxR * dpr;
    g.beginPath();
    g.arc(i * size + size / 2, size / 2, r, 0, Math.PI * 2);
    g.fill();
  }
  return { sheet, size };
}

// One WebGL context draws every dot field on the site: a frame is a single draw call of point sprites (round,
// anti-aliased in the shader), copied into the page's 2D canvas. Thousands of drawImage calls per frame were the
// slowest thing on the site. Without WebGL the sprite path below still works.
export const dots = (() => {
  let gl = null, glc = null, buf = null, loc = null, failed = false, color = new Float32Array(3);
  const VS = `attribute vec3 a; uniform vec2 res; varying float r;
    void main() { r = a.z; gl_Position = vec4(a.x / res.x * 2.0 - 1.0, 1.0 - a.y / res.y * 2.0, 0.0, 1.0); gl_PointSize = a.z * 2.0 + 2.0; }`;
  const FS = `precision mediump float; uniform vec3 col; varying float r;
    void main() { float d = length(gl_PointCoord - 0.5) * (r * 2.0 + 2.0); float k = clamp(r - d + 0.5, 0.0, 1.0); if (k <= 0.0) discard; gl_FragColor = vec4(col * k, k); }`;
  function init() {
    glc = document.createElement("canvas");
    gl = glc.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false });
    if (!gl) return false;
    const sh = (type, src) => { const x = gl.createShader(type); gl.shaderSource(x, src); gl.compileShader(x); return x; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
    gl.useProgram(prog);
    buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    const a = gl.getAttribLocation(prog, "a");
    gl.enableVertexAttribArray(a);
    gl.vertexAttribPointer(a, 3, gl.FLOAT, false, 0, 0);
    loc = { res: gl.getUniformLocation(prog, "res"), col: gl.getUniformLocation(prog, "col") };
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
    glc.addEventListener("webglcontextlost", (e) => { e.preventDefault(); failed = true; });
    return true;
  }
  return {
    get ok() { if (!gl && !failed) failed = !init(); return !failed; },
    // xyr: x, y, radius per dot in device pixels. Draws into ctx (the target 2D canvas, w×h device pixels).
    draw(ctx, w, h, xyr, n, rgb) {
      if (glc.width < w || glc.height < h) { glc.width = Math.max(glc.width, w); glc.height = Math.max(glc.height, h); }
      gl.viewport(0, glc.height - h, w, h);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(loc.res, w, h);
      color.set(rgb);
      gl.uniform3fv(loc.col, color);
      gl.bufferData(gl.ARRAY_BUFFER, xyr.subarray(0, n * 3), gl.STREAM_DRAW);
      gl.drawArrays(gl.POINTS, 0, n);
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(glc, 0, 0, w, h, 0, 0, w, h);
    },
  };
})();

// "#d9f6e6" or any CSS color → [r, g, b] in 0..1.
export function rgbOf(css) {
  const c = document.createElement("canvas").getContext("2d");
  c.fillStyle = css;
  const hex = c.fillStyle;
  if (hex[0] !== "#") return [0.85, 0.96, 0.9];
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
}

export class Halftone {
  /**
   * canvas: the target canvas (sized by CSS).
   * layers: [{ img, place(W, H) -> {x, y, w, h}, value(r, g, b, u, v, x, y, W, H) -> 0..1 }], u/v are 0..1 inside
   * the image and x/y are canvas coordinates, for masks that belong to the layout rather than the picture.
   * opts: { cell, color, maxRatio, origin(W, H) -> {x, y}, pointer, ripple, gamma }
   */
  constructor(canvas, layers, opts = {}) {
    this.canvas = canvas;
    this.layers = layers;
    this.o = Object.assign({ cell: 6, color: "#d9f6e6", maxRatio: 0.62, pointer: finePointer, pulse: true, ripple: 1100, steps: 20 }, opts);
    this.pulses = [];
    this.ctx = canvas.getContext("2d");
    this.pointer = { x: -1e4, y: -1e4, sx: -1e4, sy: -1e4, inside: false, power: 0 };
    this.start = 0;
    this.started = false;
    this.raf = 0;
    this.visible = false;
    this.resize();
    // The observer reports the size it starts with too; only a real change needs a new sample.
    this.ro = new ResizeObserver(() => {
      const r = canvas.getBoundingClientRect();
      if (Math.abs(r.width - this.W) < 0.5 && Math.abs(r.height - this.H) < 0.5) return;
      this.resize();
      this.paint(performance.now());
    });
    this.ro.observe(canvas);
    this.io = new IntersectionObserver(([e]) => {
      this.visible = e.isIntersecting;
      if (this.visible && !this.started) this.play();
      if (this.visible) this.kick();
    }, { rootMargin: "120px" });
    this.io.observe(canvas);
    if (this.o.pointer) this.bindPointer();
    if (this.o.pulse && !reduceMotion) this.bindPulse();
    // Stops with the page that drew it.
    scope()?.add(() => this.destroy());
  }

  destroy() {
    this.dead = true;
    this.visible = false;
    this.ro.disconnect();
    this.io.disconnect();
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.dpr = dpr;
    this.W = r.width;
    this.H = r.height;
    this.canvas.width = Math.round(r.width * dpr);
    this.canvas.height = Math.round(r.height * dpr);
    const cell = typeof this.o.cell === "function" ? this.o.cell(r.width) : this.o.cell;
    this.cell = cell;
    this.cols = Math.ceil(r.width / cell) + 1;
    this.rows = Math.ceil(r.height / cell) + 1;
    this.maxR = cell * this.o.maxRatio;
    this.sprites = makeSprites(this.o.color, this.maxR, this.o.steps, dpr);
    // Reading the art back is the costly part, so it is cached per page and size, and otherwise done when the
    // browser is idle: never in the frames where a page is arriving under the notch.
    const key = `${location.pathname}|${this.o.key || this.canvas.className + JSON.stringify(this.canvas.parentElement?.dataset || {})}|${this.W}x${this.H}|${cell}|${dpr}`;
    this.key = key;
    if (fields.has(key)) { Object.assign(this, fields.get(key)); this.xyr = this.xyr.slice(); this.sizes = this.sizes.slice(); return; }
    this.field = null;
    const job = ++this.job || (this.job = 1);
    this.sampleIdle(() => {
      if (this.dead || this.job !== job) return;
      const { field, n, px, py, pv, pd, xyr, origin, farthest, sizes, rgb } = this;
      fields.set(key, { field, n, px, py, pv, pd, xyr, origin, farthest, sizes, rgb });
      if (this.wantPlay) { this.wantPlay = false; this.play(); }
      else this.paint(performance.now());
    });
  }

  // Draw each layer at grid resolution and read its pixels back once. The grid keeps the strongest layer per cell.
  *sampling() {
    const { cols, rows, cell } = this;
    const field = new Float32Array(cols * rows);
    const off = document.createElement("canvas");
    off.width = cols;
    off.height = rows;
    const g = off.getContext("2d", { willReadFrequently: true });
    for (const layer of this.layers) {
      const p = layer.place(this.W, this.H);
      g.clearRect(0, 0, cols, rows);
      g.drawImage(layer.img, p.x / cell, p.y / cell, p.w / cell, p.h / cell);
      const data = g.getImageData(0, 0, cols, rows).data;
      for (let j = 0; j < rows; j++) {
        if ((j & 3) === 3) yield;
        for (let i = 0; i < cols; i++) {
          const k = j * cols + i;
          if (data[k * 4 + 3] < 8) continue;
          const u = (i * cell - p.x) / p.w;
          const v = (j * cell - p.y) / p.h;
          const val = layer.value(data[k * 4], data[k * 4 + 1], data[k * 4 + 2], u, v, i * cell, j * cell, this.W, this.H);
          if (val > field[k]) field[k] = val;
        }
      }
    }
    this.field = field;
    // Only the cells that have a dot, with what a frame needs precomputed: position, strength, ripple distance.
    let n = 0;
    for (let k = 0; k < field.length; k++) if (field[k] >= 0.02) n++;
    this.n = n;
    this.px = new Float32Array(n); this.py = new Float32Array(n); this.pv = new Float32Array(n); this.pd = new Float32Array(n);
    this.xyr = new Float32Array(n * 3);
    this.sizes = new Int16Array(n);
    const origin = this.o.origin ? this.o.origin(this.W, this.H) : { x: this.W / 2, y: this.H / 2 };
    this.origin = origin;
    this.farthest = Math.hypot(Math.max(origin.x, this.W - origin.x), Math.max(origin.y, this.H - origin.y));
    for (let j = 0, m = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const v = field[j * cols + i];
        if (v < 0.02) continue;
        const x = i * cell, y = j * cell;
        this.px[m] = x; this.py[m] = y; this.pv[m] = Math.sqrt(v);
        this.pd[m] = Math.hypot(x - origin.x, y - origin.y) / this.farthest;
        this.xyr[m * 3] = x * this.dpr; this.xyr[m * 3 + 1] = y * this.dpr;
        m++;
      }
    }
    this.rgb = rgbOf(this.o.color);
  }

  // The sampling runs a few rows at a time inside idle slices, so no frame waits on it.
  sample() { for (const _ of this.sampling()); }
  sampleIdle(done) {
    const steps = this.sampling();
    const run = (deadline) => {
      if (this.dead) return;
      for (;;) {
        if (steps.next().done) { done(); return; }
        if (deadline.timeRemaining() < 3) break;
      }
      idle(run);
    };
    idle(run);
  }

  play() {
    if (!this.field) { this.wantPlay = true; return; }
    // Arriving from another page of the site, the dots grow in quicker: a settle, not the first-visit show.
    const quick = document.documentElement.classList.contains("from-site");
    this.grow = quick ? 420 : 700;
    this.rippleMs = quick ? this.o.ripple * 0.5 : this.o.ripple;
    this.started = true;
    this.start = performance.now();
    this.kick();
  }

  bindPointer() {
    const host = this.o.pointerHost || this.canvas.parentElement;
    host.addEventListener("pointermove", (e) => {
      const r = this.canvas.getBoundingClientRect();
      this.pointer.x = e.clientX - r.left;
      this.pointer.y = e.clientY - r.top;
      if (!this.pointer.inside) { this.pointer.sx = this.pointer.x; this.pointer.sy = this.pointer.y; }
      this.pointer.inside = true;
      this.kick();
    });
    host.addEventListener("pointerleave", () => { this.pointer.inside = false; this.kick(); });
  }

  kick() {
    if (!this.raf && this.visible && !this.dead) this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  // A tap or click on the art sends a ring of swelling dots out from that spot.
  bindPulse() {
    const host = this.o.pointerHost || this.canvas.parentElement;
    host.addEventListener("pointerdown", (e) => {
      if (e.button > 0 || e.target.closest?.("a, button, input, label, select, textarea, [role=tab]")) return;
      const r = this.canvas.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      if (x < 0 || y < 0 || x > r.width || y > r.height) return;
      if (this.pulses.length > 2) this.pulses.shift();
      this.pulses.push({ x, y, t0: performance.now() });
      this.kick();
    });
  }

  frame(now) {
    this.raf = 0;
    const p = this.pointer;
    // The swell follows the pointer through a soft spring, so it trails like something with weight.
    p.sx += (p.x - p.sx) * 0.16;
    p.sy += (p.y - p.sy) * 0.16;
    p.power += ((p.inside ? 1 : 0) - p.power) * 0.1;
    const rippling = !reduceMotion && now - this.start < (this.rippleMs ?? this.o.ripple) + (this.grow ?? 700) + 200;
    const settling = p.power > 0.004 || (p.inside && Math.hypot(p.x - p.sx, p.y - p.sy) > 0.5);
    if (this.pulses.length) this.pulses = this.pulses.filter((q) => now - q.t0 < PULSE_MS);
    const pulsing = this.pulses.length > 0;
    this.paint(now);
    if (this.visible && (rippling || settling || pulsing)) this.kick();
  }

  paint(now) {
    if (!this.field || this.dead) return;
    const { ctx, n, px, py, pv, pd, xyr, dpr, maxR } = this;
    const steps = this.o.steps;
    const p = this.pointer;
    const sigma2 = 2 * Math.pow(this.o.reach || 110, 2);
    const elapsed = reduceMotion || !this.started ? (this.started ? 1e9 : 0) : now - this.start;
    const ripple = this.rippleMs ?? this.o.ripple, grow = this.grow ?? 700;
    const swell = p.power > 0.004, pw = 0.75 * p.power, sx = p.sx, sy = p.sy;
    const pulses = this.pulses.map((q) => { const age = now - q.t0; return { x: q.x, y: q.y, front: age * PULSE_SPEED, amp: 0.9 * (1 - age / PULSE_MS) }; });
    const np = pulses.length;
    // Dot radius in device pixels; the same steps the sprites had, so both paths look alike.
    const unit = (maxR * dpr) / steps;
    for (let m = 0; m < n; m++) {
      // The ripple: each dot waits for a wave that leaves the origin, then grows in.
      const t = (elapsed - pd[m] * ripple) / grow;
      let r = 0;
      if (t > 0) {
        let s = pv[m] * (t >= 1 ? 1 : easeOut(t));
        if (swell) {
          const dx = px[m] - sx, dy = py[m] - sy;
          s *= 1 + pw * Math.exp(-(dx * dx + dy * dy) / sigma2);
        }
        for (let q = 0; q < np; q++) {
          // A ring front travelling outward at PULSE_SPEED px/ms, fading as it goes.
          const P = pulses[q], dx = px[m] - P.x, dy = py[m] - P.y;
          const off = Math.sqrt(dx * dx + dy * dy) - P.front;
          if (off > -60 && off < 60) s *= 1 + P.amp * Math.exp(-(off * off) / 900);
        }
        // The sprites stop at full size; the GPU path lets a swell or a pulse push a dot a little past it.
        this.sizes[m] = Math.min(steps - 1, Math.round(s * (steps - 1)));
        r = (Math.min(1.25, s) * (steps - 1) + 1) * unit;
      } else this.sizes[m] = -1;
      xyr[m * 3 + 2] = r;
    }
    const W = this.canvas.width, H = this.canvas.height;
    if (dots.ok) { dots.draw(ctx, W, H, xyr, n, this.rgb); return; }
    // Fallback without WebGL: one sprite blit per dot.
    const { sheet, size } = this.sprites;
    ctx.clearRect(0, 0, W, H);
    for (let m = 0; m < n; m++) {
      const idx = this.sizes[m];
      if (idx < 0) continue;
      ctx.drawImage(sheet, idx * size, 0, size, size, xyr[m * 3] - size / 2, xyr[m * 3 + 1] - size / 2, size, size);
    }
  }
}

// Shared value functions --------------------------------------------------------------------------------------------

export const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

// Rodin's Thinker, photographed against sky: drop sky and cloud, keep the bronze as a bright dot body.
export function thinkerValue(r, g, b, u, v) {
  if (u < 0.17 || u > 0.83 || v < 0.06 || v > 0.95) return 0;
  const L = lum(r, g, b);
  const chroma = Math.max(r, g, b) - Math.min(r, g, b);
  const sky = (b > g + 12 && b > r + 26) || (L > 160 && chroma < 46);
  if (sky) return 0;
  // A tree sits behind the left knee and a building at the right foot; the crop above and these edges keep them out.
  if (u < 0.26 && v > 0.74) return 0;
  const body = 0.16 + 0.84 * Math.pow(clamp((L - 22) / 125), 1.15);
  const fadeBottom = 1 - smooth(0.8, 0.95, v);
  return body * fadeBottom;
}

// Friedrich's sea of fog: bright fog becomes dots, the wanderer and his rocks stay as dark silhouette.
export function fogValue(r, g, b, u, v) {
  const L = lum(r, g, b);
  return Math.pow(clamp((L - 95) / 140), 1.35);
}

// Dürer's engraving: lit paper becomes dots, the cut lines stay as gaps.
export function engravingValue(r, g, b) {
  const L = lum(r, g, b);
  return Math.pow(clamp((L - 105) / 135), 1.9);
}

// Fit helpers: cover or contain an image into a box, anchored by ax/ay (0..1).
export function fit(img, box, mode = "cover", ax = 0.5, ay = 0.5) {
  const s = mode === "cover"
    ? Math.max(box.w / img.naturalWidth, box.h / img.naturalHeight)
    : Math.min(box.w / img.naturalWidth, box.h / img.naturalHeight);
  const w = img.naturalWidth * s;
  const h = img.naturalHeight * s;
  return { x: box.x + (box.w - w) * ax, y: box.y + (box.h - h) * ay, w, h };
}

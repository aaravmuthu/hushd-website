// Liquid glass: real refraction for every glass surface on the site.
// Technique from kube.io/blog/liquid-glass-css-svg: a displacement map, computed with Snell's law over a
// convex-squircle bezel, bends the backdrop through an SVG filter; a second map adds a rim highlight.
// Only Chromium can use an SVG filter as backdrop-filter, so other browsers keep the CSS blur they already have.

const SVG_NS = "http://www.w3.org/2000/svg";
const N = 1.5; // index of refraction of the glass
const STEPS = 128; // samples along one bezel radius (the map is 8-bit, so more would not show)
const MAX_MAP_PX = 200_000; // larger elements get a downscaled map; it is smooth, so the stretch does not show
const LIGHT = [Math.cos((-60 * Math.PI) / 180), Math.sin((-60 * Math.PI) / 180)]; // rim light from the upper right

export const supported = (() => {
  try {
    const brands = navigator.userAgentData?.brands || [];
    if (!brands.some((b) => /Chromium/i.test(b.brand))) return false;
    if (matchMedia("(prefers-reduced-transparency: reduce)").matches) return false;
    return true;
  } catch { return false; }
})();

// Height of a convex squircle bezel at t (0 = outer edge, 1 = where the flat top starts), and its slope.
const height = (t) => Math.pow(1 - Math.pow(1 - t, 4), 0.25);
const slope = (t) => { const d = 0.001; return (height(Math.min(1, t + d)) - height(Math.max(0, t - d))) / (Math.min(1, t + d) - Math.max(0, t - d)); };

// How far a vertical ray landing at t on the bezel is pushed inward, in units of the bezel width.
// thickness: glass height relative to the bezel width.
function profile(thickness) {
  const out = new Float32Array(STEPS);
  for (let i = 0; i < STEPS; i++) {
    const t = (i + 0.5) / STEPS;
    const theta1 = Math.atan(thickness * slope(t));
    const theta2 = Math.asin(Math.sin(theta1) / N);
    out[i] = thickness * height(t) * Math.tan(theta1 - theta2);
  }
  return out;
}

// Signed distance to a rounded box (negative inside) and the outward normal there.
function roundedBox(px, py, w, h, r) {
  const sx = px < w / 2 ? -1 : 1, sy = py < h / 2 ? -1 : 1;
  const qx = Math.abs(px - w / 2) - (w / 2 - r), qy = Math.abs(py - h / 2) - (h / 2 - r);
  if (qx > 0 && qy > 0) {
    const l = Math.hypot(qx, qy) || 1;
    return [l - r, (qx / l) * sx, (qy / l) * sy];
  }
  return qx > qy ? [qx - r, sx, 0] : [qy - r, 0, sy];
}

// A ring (annulus) of outer radius R and inner radius r centred in the box: glass is the band between them.
function ringShape(px, py, w, h, R, r) {
  const dx = px - w / 2, dy = py - h / 2, l = Math.hypot(dx, dy) || 1;
  const mid = (R + r) / 2, half = (R - r) / 2;
  const sd = Math.abs(l - mid) - half;
  const s = l > mid ? 1 : -1; // outward from the band: away from the centre on the outer edge, toward it on the inner one
  return [sd, (dx / l) * s, (dy / l) * s];
}

const cache = new Map();
function profileFor(thickness) {
  const k = thickness.toFixed(2);
  if (!cache.has(k)) {
    const p = profile(thickness);
    let max = 0; for (const v of p) max = Math.max(max, v);
    cache.set(k, { p, max });
  }
  return cache.get(k);
}

// Builds the displacement and specular maps for a w×h element. Returns data URLs and the filter scale in px.
function buildMaps(w, h, o) {
  const s = Math.min(1, Math.sqrt(MAX_MAP_PX / (w * h)));
  const mw = Math.max(2, Math.round(w * s)), mh = Math.max(2, Math.round(h * s));
  const { p, max } = profileFor(o.thickness);
  const bezel = o.bezel;
  const disp = new ImageData(mw, mh), spec = new ImageData(mw, mh);
  const dd = disp.data, sd = spec.data;
  const shape = o.shape === "ring"
    ? (x, y) => ringShape(x, y, w, h, o.outer, o.inner)
    : (x, y) => roundedBox(x, y, w, h, o.radius);
  for (let j = 0; j < mh; j++) {
    const y = ((j + 0.5) / mh) * h;
    for (let i = 0; i < mw; i++) {
      const x = ((i + 0.5) / mw) * w;
      const k = (j * mw + i) * 4;
      let r = 128, g = 128, a = 0;
      const [sdist, nx, ny] = shape(x, y);
      const d = -sdist; // distance inside from the edge
      if (d >= 0 && d < bezel) {
        const t = d / bezel;
        const m = p[Math.min(STEPS - 1, (t * STEPS) | 0)] / max; // 0..1
        // Rays bend inward: the pixel shows what lies further inside, against the outward normal.
        r = 128 - nx * m * 127;
        g = 128 - ny * m * 127;
        // Rim light: a bright hairline at the edge plus a soft sheen, strongest where the normal faces the light.
        const facing = Math.abs(nx * LIGHT[0] + ny * LIGHT[1]);
        const line = Math.exp(-d / 1.4);
        const sheen = 0.32 * Math.pow(1 - t, 2.2);
        a = Math.min(1, (0.25 + 0.75 * facing * facing) * (line + sheen)) * 255;
      }
      dd[k] = r; dd[k + 1] = g; dd[k + 2] = 128; dd[k + 3] = 255;
      sd[k] = 255; sd[k + 1] = 255; sd[k + 2] = 255; sd[k + 3] = a;
    }
  }
  const c = document.createElement("canvas"); c.width = mw; c.height = mh;
  const ctx = c.getContext("2d");
  ctx.putImageData(disp, 0, 0); const dispUrl = c.toDataURL();
  ctx.putImageData(spec, 0, 0); const specUrl = c.toDataURL();
  return { dispUrl, specUrl, scale: max * bezel };
}

let defs, uid = 0;
function host() {
  if (defs?.isConnected) return defs;
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("width", "0"); svg.setAttribute("height", "0");
  svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none";
  defs = document.createElementNS(SVG_NS, "defs");
  svg.appendChild(defs);
  document.body.appendChild(svg);
  return defs;
}
const node = (tag, attrs) => { const n = document.createElementNS(SVG_NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); return n; };

const px = (v, ref) => (String(v).endsWith("%") ? (parseFloat(v) / 100) * ref : parseFloat(v) || 0);
const num = (el, name, fallback) => { const v = el.dataset[name]; return v == null || v === "" ? fallback : +v; };

// The element's own CSS blur and saturation, so the glass keeps its look and only gains refraction.
function ownLook(el) {
  const f = getComputedStyle(el).backdropFilter || "";
  const blur = /blur\(([\d.]+)px\)/.exec(f), sat = /saturate\(([\d.]+)(%?)\)/.exec(f);
  return {
    blur: blur ? +blur[1] : 0,
    sat: sat ? (sat[2] ? +sat[1] / 100 : +sat[1]) : 1,
  };
}

const glasses = new Map(); // element → state

function render(el) {
  const st = glasses.get(el);
  if (!st) return;
  const w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight);
  if (w < 12 || h < 12) return;
  if (st.w === w && st.h === h && st.filter) return;
  st.w = w; st.h = h;
  const cs = getComputedStyle(el);
  const minSide = Math.min(w, h);
  const radius = Math.min(minSide / 2, px(cs.borderTopLeftRadius, w));
  const ring = el.dataset.lgShape === "ring";
  const o = {
    shape: ring ? "ring" : "box",
    radius,
    outer: minSide / 2,
    inner: minSide / 2 * num(el, "lgInner", 0.5),
    bezel: Math.max(4, Math.min(ring ? minSide * (1 - num(el, "lgInner", 0.5)) / 4 : minSide / 2,
      num(el, "lgBezel", Math.min(40, Math.max(9, minSide * 0.3))))),
    thickness: num(el, "lgThickness", 1),
  };
  const { dispUrl, specUrl, scale } = buildMaps(w, h, o);
  const id = st.id || (st.id = `lg-${++uid}`);
  const look = st.look;
  const blur = num(el, "lgBlur", Math.min(look.blur, Math.max(2, look.blur * 0.3)));
  const sat = num(el, "lgSat", Math.max(look.sat, 1.4));
  const refract = num(el, "lgRefract", 1);
  const shine = num(el, "lgShine", 0.6);
  const filter = node("filter", { id, x: 0, y: 0, width: w, height: h, filterUnits: "userSpaceOnUse", "color-interpolation-filters": "sRGB" });
  filter.append(
    node("feGaussianBlur", { in: "SourceGraphic", stdDeviation: blur, edgeMode: "duplicate", result: "soft" }),
    node("feImage", { href: dispUrl, x: 0, y: 0, width: w, height: h, preserveAspectRatio: "none", result: "map" }),
    node("feDisplacementMap", { in: "soft", in2: "map", scale: (scale * refract).toFixed(2), xChannelSelector: "R", yChannelSelector: "G", result: "bent" }),
    node("feColorMatrix", { in: "bent", type: "saturate", values: sat, result: "rich" }),
    node("feImage", { href: specUrl, x: 0, y: 0, width: w, height: h, preserveAspectRatio: "none", result: "rim" }),
    node("feComponentTransfer", { in: "rim", result: "rimA" }),
    node("feComposite", { in: "rimA", in2: "rich", operator: "over" }),
  );
  filter.querySelector("feComponentTransfer").append(node("feFuncA", { type: "linear", slope: shine }));
  if (st.filter) st.filter.replaceWith(filter); else host().appendChild(filter);
  st.filter = filter;
  el.style.setProperty("--lg-filter", `url(#${id})`);
  el.classList.add("lg-on");
}

let ro, io;
// A one-off size change (a label swap) rebuilds at once, so the map never lags it. A size that keeps changing
// (a thumb gliding to a wider button) rebuilds once more after it rests, not every frame.
function schedule(el) {
  const st = glasses.get(el);
  const now = performance.now();
  if (now - (st.lastBuild || 0) > 250) { st.lastBuild = now; render(el); }
  clearTimeout(st.timer);
  st.timer = setTimeout(() => { st.lastBuild = performance.now(); render(el); }, 140);
}

// Turns an element into liquid glass. Safe to call more than once; does nothing outside Chromium.
export function liquify(el) {
  if (!supported || !el || glasses.has(el) || el.dataset.lg === "off") return;
  glasses.set(el, { look: ownLook(el) });
  ro ||= new ResizeObserver((entries) => { for (const e of entries) if (glasses.get(e.target)?.seen) schedule(e.target); });
  io ||= new IntersectionObserver((entries) => {
    for (const e of entries) {
      const st = glasses.get(e.target);
      if (e.isIntersecting && st && !st.seen) { st.seen = true; render(e.target); }
    }
  }, { rootMargin: "300px 0px" });
  ro.observe(el); io.observe(el);
}

// Every element on the page that already has a backdrop blur becomes liquid glass, plus anything marked data-lg.
// Notches whose size springs every frame (the nav, and the replicas in the page demos) are left alone: a map can
// only be built for one size, and they are black on top, so there is little to bend anyway.
const SKIP = ".nav, .nav *, .notch, [data-pn], [data-sn], .nudgecard, .places__nudge, .trayplay__shelf, [data-lg=off]";
function liquifyCandidate(el) {
  if (glasses.has(el) || el.matches(SKIP)) return;
  if (el.hasAttribute("data-lg")) { liquify(el); return; }
  const f = getComputedStyle(el).backdropFilter;
  if (f && f !== "none") liquify(el);
}
export function liquifyAll(root = document) {
  if (!supported) return;
  for (const el of root.querySelectorAll(".hushd-site *, [data-lg]")) liquifyCandidate(el);
}

if (supported) {
  document.documentElement.classList.add("lg");
  const start = () => {
    liquifyAll();
    // Pages build some of their glass from script after load; pick it up as it arrives.
    // Only new subtrees are scanned, so text swaps and animations cost nothing here.
    const added = new Set();
    let t = 0;
    new MutationObserver((records) => {
      for (const r of records) for (const n of r.addedNodes) if (n.nodeType === 1) added.add(n);
      if (!added.size) return;
      clearTimeout(t);
      t = setTimeout(() => {
        for (const n of added) {
          if (!n.isConnected) continue;
          if (n.matches(".hushd-site *, [data-lg]")) liquifyCandidate(n);
          liquifyAll(n);
        }
        added.clear();
      }, 200);
    }).observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", start, { once: true }); else requestAnimationFrame(start);
}

// Shared by every page: reveals, the notch nav, glass light, halftone art, explanations one click away.
import { Halftone, loadImage, fit, smooth, thinkerValue, fogValue, engravingValue } from "./halftone.js";

// The inline head script hides reveals only while this flag shows up in time; see the failsafe there.
import "./liquid-glass.js";

window.__hushd = true;

export const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
export const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const root = document.documentElement;

/* Springs ---------------------------------------------------------------------------------------------------------- */
// Apple's two-parameter spring (response, damping ratio). The app's Motion tokens: open 0.38/0.8, close 0.32/0.86.
export const OPEN = { response: 0.38, damping: 0.8 };
export const CLOSE = { response: 0.32, damping: 0.86 };
export const PEEK = { response: 0.24, damping: 0.78 };
export const SETTLE = { response: 0.4, damping: 1 };

export class Spring {
  constructor(value, config = OPEN, epsilon = 0.05) {
    this.x = value; this.v = 0; this.target = value; this.eps = epsilon;
    this.config(config);
  }
  config({ response, damping }) {
    this.k = Math.pow((2 * Math.PI) / response, 2);
    this.c = (4 * Math.PI * damping) / response;
  }
  set(target, config) { this.target = target; if (config) this.config(config); }
  step(dt) {
    const h = 1 / 240;
    for (let t = 0; t < dt; t += h) {
      const a = -this.k * (this.x - this.target) - this.c * this.v;
      this.v += a * h;
      this.x += this.v * h;
    }
    return Math.abs(this.x - this.target) > this.eps || Math.abs(this.v) > this.eps;
  }
  jump(v) { this.x = this.target = v; this.v = 0; }
}

// Runs a set of springs on the display clock until they all rest, painting each frame.
export function springLoop(springs, paint, onRest) {
  let raf = 0;
  let last = 0;
  const tick = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    let moving = false;
    for (const s of springs) moving = s.step(dt) || moving;
    paint();
    if (moving) raf = requestAnimationFrame(tick);
    else { raf = 0; onRest?.(); }
  };
  return {
    kick() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } },
    get running() { return raf !== 0; },
  };
}

// Calls back with true/false as an element enters or leaves the screen, and false while the tab is hidden.
export function watchVisible(el, cb, threshold = 0.25) {
  if (!el) return;
  let seen = false;
  new IntersectionObserver(([e]) => { seen = e.isIntersecting; cb(seen && !document.hidden); }, { threshold }).observe(el);
  document.addEventListener("visibilitychange", () => cb(seen && !document.hidden));
}

/* Reveal ----------------------------------------------------------------------------------------------------------- */
// Hero copy plays once on load; everything else plays once as it scrolls in.
requestAnimationFrame(() => requestAnimationFrame(() => $$("[data-reveal-load]").forEach((el) => el.classList.add("is-in"))));
const revealer = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { e.target.classList.add("is-in"); revealer.unobserve(e.target); }
}, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
$$(".reveal:not([data-reveal-load])").forEach((el) => revealer.observe(el));

// Ambient loops stop while off screen.
$$("[data-loop]").forEach((el) => watchVisible(el, (on) => el.classList.toggle("is-paused", !on), 0));

/* Nav: the notch --------------------------------------------------------------------------------------------------- */
const pill = $(".nav__pill");
if (pill) {
  const menu = $(".nav__menu");
  const links = $$(".nav__link", pill);
  const thumb = $(".nav__thumb", pill);
  const current = links.find((a) => a.getAttribute("aria-current") === "page") || null;

  menu?.addEventListener("click", () => {
    const open = !pill.classList.contains("is-open");
    pill.classList.toggle("is-open", open);
    menu.setAttribute("aria-expanded", String(open));
  });

  // A glass lozenge sits under the current page and glides to whichever link the pointer is on.
  const placeThumb = (a) => {
    if (!thumb) return;
    if (!a) { thumb.style.opacity = "0"; return; }
    thumb.style.width = `${a.offsetWidth}px`;
    thumb.style.transform = `translateX(${a.offsetLeft}px)`;
    thumb.style.opacity = "1";
  };
  if (thumb) {
    thumb.classList.add("is-instant");
    placeThumb(current);
    requestAnimationFrame(() => requestAnimationFrame(() => thumb.classList.remove("is-instant")));
    if (finePointer) {
      links.forEach((a) => a.addEventListener("pointerenter", () => placeThumb(a)));
      $(".nav__links", pill)?.addEventListener("pointerleave", () => placeThumb(current));
    }
    addEventListener("resize", () => placeThumb(current));
    document.fonts?.ready.then(() => placeThumb(current));
  }

  // Droppy's hover: after a short wait the notch swells a little, as if it noticed you.
  if (finePointer && !reduceMotion) {
    let hoverTimer = 0;
    pill.addEventListener("pointerenter", () => { hoverTimer = setTimeout(() => pill.classList.add("is-hover"), 160); });
    pill.addEventListener("pointerleave", () => { clearTimeout(hoverTimer); pill.classList.remove("is-hover", "is-pressing"); });
  }
  pill.addEventListener("pointerdown", (e) => { if (e.target.closest("a")) pill.classList.add("is-pressing"); });
  addEventListener("pointerup", () => pill.classList.remove("is-pressing"));

  // Preload other pages as soon as the pointer or finger heads toward a link, so the switch has nothing to wait on.
  const prefetched = new Set([location.pathname]);
  const prefetch = (e) => {
    const a = e.target.closest?.("a[href]");
    if (!a) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || prefetched.has(url.pathname)) return;
    prefetched.add(url.pathname);
    const l = document.createElement("link");
    l.rel = "prefetch"; l.href = url.pathname; l.as = "document";
    document.head.appendChild(l);
  };
  document.addEventListener("pointerover", prefetch, { passive: true });
  document.addEventListener("touchstart", prefetch, { passive: true });
  document.addEventListener("focusin", prefetch);
  if (HTMLScriptElement.supports?.("speculationrules")) {
    const s = document.createElement("script");
    s.type = "speculationrules";
    s.textContent = JSON.stringify({ prerender: [{ where: { href_matches: "/*" }, eagerness: "moderate" }] });
    document.head.appendChild(s);
  }

  // Leaving for another page: note it, so the next page can arrive out of the notch. Navigation is never held back.
  document.addEventListener("click", (e) => {
    const a = e.target.closest?.("a[href]");
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === "_blank") return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || url.pathname === location.pathname) return;
    try { sessionStorage.setItem("hushd-nav", String(Date.now())); } catch {}
    pill.classList.remove("is-open");
  });

  // Arriving from another page: the notch starts open on this page's name (set by the head script before first paint),
  // holds a beat, then tucks back to its resting size on the close spring while the nav fades up out of a blur.
  const tuck = () => {
    if (!root.classList.contains("notch-arrive")) return;
    const open = pill.getBoundingClientRect();
    // The first-visit drop must not replay once the arrival styles come off.
    root.classList.add("notch-arrived");
    root.classList.remove("notch-arrive");
    const rest = pill.getBoundingClientRect();
    const r0 = parseFloat(getComputedStyle(pill).getPropertyValue("--open-radius")) || 34;
    const r1 = parseFloat(getComputedStyle(pill).borderBottomLeftRadius) || 24;
    const w = new Spring(open.width, CLOSE);
    const h = new Spring(open.height, CLOSE);
    const r = new Spring(r0, CLOSE);
    pill.dataset.notch = "closing";
    const paint = () => {
      pill.style.width = `${w.x.toFixed(2)}px`;
      pill.style.height = `${h.x.toFixed(2)}px`;
      pill.style.borderBottomLeftRadius = pill.style.borderBottomRightRadius = `${r.x.toFixed(2)}px`;
    };
    paint();
    w.set(rest.width); h.set(rest.height); r.set(r1);
    springLoop([w, h, r], paint, () => {
      pill.style.width = pill.style.height = pill.style.borderBottomLeftRadius = pill.style.borderBottomRightRadius = "";
      setTimeout(() => delete pill.dataset.notch, 400);
      if (thumb) placeThumb(current);
    }).kick();
  };
  if (root.classList.contains("notch-arrive")) {
    // With a cross-document view transition the notch is still morphing from the last page; the head script's promise
    // settles once it has landed, then the notch holds a beat and tucks.
    (window.__hushdShown || Promise.resolve()).then(() => setTimeout(tuck, 160));
  }
  // Back/forward cache restores the page as it was left; never leave the notch stuck open.
  addEventListener("pageshow", (e) => {
    if (!e.persisted) return;
    root.classList.remove("notch-arrive");
    pill.style.width = pill.style.height = pill.style.borderBottomLeftRadius = pill.style.borderBottomRightRadius = "";
    delete pill.dataset.notch;
    pill.classList.remove("is-open", "is-pressing", "is-hover");
  });
}

/* Glass: light follows the pointer across the material ------------------------------------------------------------ */
if (finePointer && !reduceMotion) {
  let lit = null;
  addEventListener("pointermove", (e) => {
    const g = e.target.closest?.(".glass");
    if (g !== lit) { lit?.style.setProperty("--lit", "0"); lit = g; g?.style.setProperty("--lit", "1"); }
    if (!g) return;
    const r = g.getBoundingClientRect();
    g.style.setProperty("--mx", `${(e.clientX - r.left).toFixed(0)}px`);
    g.style.setProperty("--my", `${(e.clientY - r.top).toFixed(0)}px`);
  }, { passive: true });
}

/* Halftone art ----------------------------------------------------------------------------------------------------- */
export const ART = { thinker: "/media/art/thinker.jpg", jerome: "/media/art/jerome.jpg", wanderer: "/media/art/wanderer.jpg" };
export const VALUE = { thinker: thinkerValue, jerome: engravingValue, wanderer: fogValue };
export { Halftone, loadImage, fit, smooth, thinkerValue, fogValue, engravingValue };
export const quiet = () => {};

async function footerArt() {
  const canvas = $(".footer__art");
  if (!canvas) return;
  const wanderer = await loadImage(ART.wanderer);
  new Halftone(canvas, [{
    img: wanderer,
    // Only the fog bank left of the wanderer: the painting is drawn wide and anchored left so he stays out of frame.
    place: (W, H) => fit(wanderer, { x: 0, y: -H * 0.3, w: Math.max(W * 2.2, 1400), h: H * 1.4 }, "cover", 0, 0.45),
    value: (r, g, b, u, v, x, y, W, H) => fogValue(r, g, b) * (1 - smooth(0.34, 0.4, u)) * smooth(40, 210, y) * (1 - smooth(H * 0.52, H * 0.72, y)),
  }], { cell: 5, origin: (W) => ({ x: W / 2, y: 0 }), pointer: false, ripple: 1600 });
}

async function boxArt(box) {
  const name = box.dataset.art;
  const img = await loadImage(ART[name]);
  const canvas = document.createElement("canvas");
  canvas.className = "art__canvas";
  canvas.setAttribute("aria-hidden", "true");
  box.prepend(canvas);
  const ax = parseFloat(box.dataset.ax || "0.5");
  const ay = parseFloat(box.dataset.ay || "0.5");
  // Cards show a crop of the art, so draw the picture larger than the card and anchor the interesting part.
  const contain = box.dataset.fit === "contain";
  const strength = parseFloat(box.dataset.strength || (name === "wanderer" ? "0.62" : "0.85"));
  const opts = { cell: parseFloat(box.dataset.cell || "5.5"), origin: (W, H) => ({ x: W * 0.5, y: H }), ripple: 900, reach: 80 };
  // Glass sits over some art boxes; a still field keeps the blur from recomputing every frame.
  if (box.dataset.still !== undefined) opts.pointer = false;
  new Halftone(canvas, [{
    img,
    place: (W, H) => contain
      ? fit(img, { x: 0, y: H * 0.06, w: W, h: H * 1.05 }, "contain", ax, ay)
      : fit(img, { x: -W * 0.15, y: -H * 0.15, w: W * 1.3, h: H * 1.3 }, "cover", ax, ay),
    value: (r, g, b, u, v) => VALUE[name](r, g, b, u, v) * strength,
  }], opts);
}

// Subpage heroes: one painting in the sky, rippling out from where the headline sits.
export async function skyArt(canvas, name, { place, mask, origin, strength = 1 } = {}) {
  if (!canvas) return;
  const img = await loadImage(ART[name]);
  new Halftone(canvas, [{
    img,
    place: (W, H) => place(img, W, H),
    value: (r, g, b, u, v, x, y, W, H) => VALUE[name](r, g, b, u, v) * strength * (mask ? mask(x, y, W, H, u, v) : 1),
  }], {
    cell: (w) => (w > 900 ? 6 : 4.5),
    origin: origin || ((W, H) => ({ x: W * 0.5, y: H * 0.4 })),
    pointerHost: canvas.parentElement,
    ripple: 1300,
  });
}

// If art fails to load, the section keeps its plain green ground.
footerArt().catch(quiet);
$$(".art[data-art]").forEach((box) => boxArt(box).catch(quiet));

/* Explanations one click away: promise cards and FAQ -------------------------------------------------------------- */
$$(".pcard").forEach((card) => {
  const btn = $(".pcard__more", card);
  const detail = $(".pcard__detail", card);
  if (!btn || !detail) return;
  detail.setAttribute("aria-hidden", "true");
  btn.addEventListener("click", () => {
    const open = !card.classList.contains("is-open");
    card.classList.toggle("is-open", open);
    btn.setAttribute("aria-expanded", String(open));
    detail.setAttribute("aria-hidden", String(!open));
  });
});
$$(".q").forEach((q) => {
  const btn = $("button", q);
  btn?.addEventListener("click", () => {
    const open = !q.classList.contains("is-open");
    q.classList.toggle("is-open", open);
    btn.setAttribute("aria-expanded", String(open));
  });
});

// Text swaps cross-fade through a little blur, so two states never sit on top of each other.
export function swapText(el, text) {
  if (!el || el.textContent === text) return;
  if (reduceMotion) { el.textContent = text; return; }
  el.classList.add("is-swapping");
  setTimeout(() => { el.textContent = text; el.classList.remove("is-swapping"); }, 60);
}

// While a thumb slides it lifts into clear liquid glass and bends the labels it passes, then settles back to mint.
export const LENS_THUMB = { lg: "", lgBlur: "0", lgThickness: "1.6", lgRefract: "1.5", lgShine: "0.9" };
export function glide(thumb) {
  if (reduceMotion) return;
  thumb.classList.add("is-gliding");
  clearTimeout(thumb._glide);
  thumb._glide = setTimeout(() => thumb.classList.remove("is-gliding"), 260);
}

/* Glass ring ------------------------------------------------------------------------------------------------------ */
// A ring of liquid glass, the app's own mark, rests on the halftone art of a hero and trails the pointer through it,
// bending the dots and the headline beneath. Rest spot: data-rx / data-ry, fractions of the hero's art box
// (data-mrx / data-mry below 700 px wide).
const RING = { response: 0.62, damping: 0.78 };
function glassRing(ring) {
  const hero = ring.closest("section"), art = hero && $("canvas", hero);
  if (!art) return;
  const d = ring.dataset;
  const rest = () => {
    const W = art.clientWidth, H = art.clientHeight, narrow = W < 700;
    return { x: W * +(narrow && d.mrx ? d.mrx : d.rx), y: H * +(narrow && d.mry ? d.mry : d.ry) };
  };
  let r = rest();
  const sx = new Spring(r.x, SETTLE, 0.2), sy = new Spring(r.y, SETTLE, 0.2);
  const paint = () => {
    // A little stretch along the way it moves, like a drop of water.
    const sp = Math.min(1, Math.hypot(sx.v, sy.v) / 2600), a = Math.atan2(sy.v, sx.v);
    ring.style.transform = `translate3d(${sx.x.toFixed(1)}px, ${sy.x.toFixed(1)}px, 0) rotate(${a}rad) scale(${1 + sp * 0.07}, ${1 - sp * 0.05}) rotate(${-a}rad)`;
  };
  const loop = springLoop([sx, sy], paint);
  const home = () => { r = rest(); sx.set(r.x, SETTLE); sy.set(r.y, SETTLE); loop.kick(); };
  addEventListener("resize", () => { r = rest(); sx.jump(r.x); sy.jump(r.y); paint(); });
  paint();
  if (reduceMotion || !finePointer) return;
  hero.addEventListener("pointermove", (e) => {
    const b = hero.getBoundingClientRect();
    const x = e.clientX - b.left, y = e.clientY - b.top;
    if (y > Math.min(b.height, art.clientHeight + 120) - 30) return home();
    sx.set(x, RING); sy.set(y, RING); loop.kick();
  });
  hero.addEventListener("pointerleave", home);
}
$$(".glassring").forEach(glassRing);

// Segmented controls with a sliding thumb (used on several pages). Returns a setter.
export function segmented(list, onPick) {
  const btns = $$("button", list);
  const thumb = document.createElement("span");
  thumb.className = "seg__thumb";
  thumb.setAttribute("aria-hidden", "true");
  Object.assign(thumb.dataset, LENS_THUMB);
  list.prepend(thumb);
  const place = (b) => {
    const t = `translateX(${b.offsetLeft - 5}px)`;
    if (thumb.style.transform && thumb.style.transform !== t) glide(thumb);
    thumb.style.width = `${b.offsetWidth}px`;
    thumb.style.transform = t;
  };
  let i = 0;
  const pick = (n, fromUser) => {
    i = n;
    btns.forEach((b, j) => { b.setAttribute("aria-selected", String(j === n)); b.tabIndex = j === n ? 0 : -1; });
    place(btns[n]);
    onPick(n, fromUser);
  };
  btns.forEach((b, n) => {
    b.addEventListener("click", () => pick(n, true));
    b.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const m = (n + (e.key === "ArrowRight" ? 1 : -1) + btns.length) % btns.length;
      pick(m, true);
      btns[m].focus();
    });
  });
  addEventListener("resize", () => place(btns[i]));
  return { pick, get index() { return i; }, count: btns.length };
}

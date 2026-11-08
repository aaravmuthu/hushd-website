// Shared by every page: reveals, the notch nav, glass light, halftone art, explanations one click away.
import { Halftone, loadImage, fit, smooth, thinkerValue, fogValue, engravingValue } from "./halftone.js";
import { Scope, scope } from "./scope.js";
import { CARDS } from "./nav.js";

// The inline head script hides reveals only while this flag shows up in time; see the failsafe there.
import { prune as pruneGlass } from "./liquid-glass.js";

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
// Belongs to the page that called it, and stops when that page leaves.
export function watchVisible(el, cb, threshold = 0.25) {
  if (!el) return;
  const s = scope();
  let seen = false;
  const io = new IntersectionObserver(([e]) => { seen = e.isIntersecting; cb(seen && !document.hidden); }, { threshold });
  io.observe(el);
  s?.track(io);
  const vis = () => cb(seen && !document.hidden);
  if (s) s.on(document, "visibilitychange", vis); else document.addEventListener("visibilitychange", vis);
}

/* Pages ------------------------------------------------------------------------------------------------------------ */
// Pages swap in place under the nav. A route calls mountPage once its markup is in the document: the shared parts
// (reveals, art, explanations) and the page's own script start in a fresh scope, and all of it stops when the page
// leaves. The returned function is the route's effect cleanup.
export function mountPage(load, el, html) {
  const s = new Scope();
  if (root.classList.contains("spa")) el.classList.add("page-in");
  load().then((m) => {
    if (!s.alive) return;
    s.enter();
    mountShared(el, s);
    m.mount?.(s);
    arrived?.(location.pathname);
  }).catch(quiet);
  return () => {
    s.dispose();
    pruneGlass();
    // React keeps this element when an effect re-runs in place (dev Strict Mode): start the next mount from clean markup.
    if (html != null && el.isConnected) el.innerHTML = html;
  };
}

function mountShared(el, s) {
  // Hero copy plays once on arrival; everything else plays once as it scrolls in.
  s.api.requestAnimationFrame(() => s.api.requestAnimationFrame(() => $$("[data-reveal-load]", el).forEach((r) => r.classList.add("is-in"))));
  const revealer = s.track(new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add("is-in"); revealer.unobserve(e.target); }
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }));
  $$(".reveal:not([data-reveal-load])", el).forEach((r) => revealer.observe(r));
  // Ambient loops stop while off screen.
  $$("[data-loop]", el).forEach((r) => watchVisible(r, (on) => r.classList.toggle("is-paused", !on), 0));
  // If art fails to load, the section keeps its plain green ground.
  footerArt(el).catch(quiet);
  $$(".art[data-art]", el).forEach((box) => boxArt(box).catch(quiet));
  // Loaded only on pages that have one, and only once it is near the screen.
  const drifts = $$(".drift", el);
  if (drifts.length) {
    const io = s.track(new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      import("./drift.js").then(({ driftField }) => { if (s.alive) { s.enter(); driftField(e.target); } });
    }), { rootMargin: "600px 0px" }));
    drifts.forEach((c) => io.observe(c));
  }
  explanations(el);
}
let arrived = null;

// Each page's large images and art, decoded ahead when the pointer heads for its link.
const HEAVY = {
  "/": ["/media/app/workspace-today.jpg", "/media/art/thinker.jpg", "/media/art/wanderer.jpg", "/media/art/jerome.jpg"],
  "/features": ["/media/app/workspace-today.jpg", "/media/art/thinker.jpg"],
  "/how-it-works": ["/media/art/wanderer.jpg", "/media/art/jerome.jpg"],
  "/privacy": ["/media/art/jerome.jpg"],
  "/download": ["/media/art/thinker.jpg"],
  "/beta": ["/media/art/wanderer.jpg"],
};

/* Nav: the notch --------------------------------------------------------------------------------------------------- */
const pill = $(".nav__pill");
if (pill) {
  const menu = $(".nav__menu");
  const links = $$(".nav__link", pill);
  const thumb = $(".nav__thumb", pill);
  let current = links.find((a) => a.getAttribute("aria-current") === "page") || null;

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

  // Load the next page's code as soon as the pointer or finger heads toward a link, so the switch waits on nothing.
  const preloaded = new Set([location.pathname]);
  const preload = (e) => {
    const a = e.target.closest?.("a[href]");
    if (!a) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || preloaded.has(url.pathname)) return;
    preloaded.add(url.pathname);
    window.__hushdPreload?.(url.pathname);
    // Decode the next page's big pictures now, so its first frame does not stop to decode them.
    for (const src of HEAVY[url.pathname] || []) { const i = new Image(); i.src = src; i.decode?.().catch(quiet); }
  };
  document.addEventListener("pointerover", preload, { passive: true });
  document.addEventListener("touchstart", preload, { passive: true });
  document.addEventListener("focusin", preload);

  // The notch's size runs on springs between its resting shape and the open card. Each move starts from wherever
  // the notch is right now, so a press mid-motion just retargets it, like the Dynamic Island.
  const LEAVE = { response: 0.34, damping: 0.78 };
  const TUCK = { response: 0.3, damping: 0.88 };
  let springs = null, loop = null, onRest = null;
  const clearSize = () => { pill.style.width = pill.style.height = pill.style.borderBottomLeftRadius = pill.style.borderBottomRightRadius = ""; };
  const radius = () => parseFloat(getComputedStyle(pill).borderBottomLeftRadius) || 24;
  const paintNotch = () => {
    const [w, h, r] = springs;
    pill.style.width = `${w.x.toFixed(2)}px`;
    pill.style.height = `${h.x.toFixed(2)}px`;
    pill.style.borderBottomLeftRadius = pill.style.borderBottomRightRadius = `${r.x.toFixed(2)}px`;
  };
  // Sizes are known ahead, never measured during a press: a measurement right after the class change forced a
  // layout of the whole page (about 60 ms) before the notch could move. The resting size is read when idle.
  const idle = window.requestIdleCallback ? (f) => requestIdleCallback(f, { timeout: 400 }) : (f) => setTimeout(f, 120);
  let restBox = null, state = "rest";
  const readRest = () => {
    if (loop?.running || pill.style.width || root.classList.contains("notch-arrive") || root.classList.contains("notch-leave")) return false;
    const b = pill.getBoundingClientRect();
    restBox = [b.width, b.height, radius()];
    return true;
  };
  const openBox = () => [Math.min(500, innerWidth - 24), 128, 34];
  idle(readRest);
  addEventListener("resize", () => { restBox = null; idle(readRest); });
  addEventListener("hushd:tucked", () => idle(readRest));
  function morph(change, to, cfg, done) {
    if (!restBox && !readRest()) restBox = [pill.offsetWidth || 560, 58, 24];
    const from = loop?.running ? springs.map((sp) => sp.x) : state === "open" ? openBox() : restBox;
    const target = to === "open" ? openBox() : restBox;
    state = to;
    change();
    if (!loop?.running) {
      springs = from.map((v) => new Spring(v, cfg));
      loop = springLoop(springs, paintNotch, () => { clearSize(); const f = onRest; onRest = null; f?.(); });
    }
    onRest = done;
    springs.forEach((sp, i) => sp.set(target[i], cfg));
    paintNotch();
    loop.kick();
  }

  // Each page's card (nav.js), so the notch can open on where you are going before that page is there.

  const cardName = $(".nav__card strong", pill), cardLine = $(".nav__card div span", pill);
  let own = [cardName?.textContent, cardLine?.textContent];
  const setCard = ([n, l]) => { if (cardName) cardName.textContent = n; if (cardLine) cardLine.textContent = l; };

  // Pressing a link to another page opens the notch on that page at once; the page loads underneath and arrives
  // with the notch already open, then it tucks. Navigation itself is never held back.
  let leaving = null;
  const leave = (path) => {
    if (leaving === path) return;
    leaving = path;
    setCard(CARDS[path] || own);
    pill.classList.remove("is-open", "is-hover", "is-pressing");
    pill.dataset.notch = "opening";
    if (reduceMotion) { root.classList.add("notch-leave"); return; }
    morph(() => { root.classList.remove("notch-arrive"); root.classList.add("notch-leave"); }, "open", LEAVE);
  };
  // Pressed but never clicked (dragged off the link): settle back.
  const stay = () => {
    if (!leaving) return;
    leaving = null;
    const back = () => { setCard(own); delete pill.dataset.notch; };
    if (reduceMotion) { root.classList.remove("notch-leave"); back(); return; }
    morph(() => root.classList.remove("notch-leave"), "rest", TUCK, back);
  };
  const internal = (e) => {
    const a = e.target.closest?.("a[href]");
    if (!a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === "_blank" || a.hasAttribute("download")) return null;
    const url = new URL(a.href, location.href);
    return url.origin === location.origin && url.pathname !== location.pathname ? url : null;
  };
  const note = () => { try { sessionStorage.setItem("hushd-nav", String(Date.now())); } catch {} };
  // Mouse and pen respond on press. Opening the notch moves the links, so the release would no longer land on the
  // one that was pressed: the press itself carries the navigation, sent on release unless the pointer was dragged
  // away. A finger might be starting a scroll, so touch (and the keyboard) go through the normal click.
  let press = null, swallow = 0;
  document.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch") return;
    const u = internal(e);
    if (!u) return;
    press = { u, x: e.clientX, y: e.clientY };
    leave(u.pathname);
  });
  addEventListener("pointerup", (e) => {
    if (!press) return;
    const { u, x, y } = press;
    press = null;
    if (Math.hypot(e.clientX - x, e.clientY - y) > 14) { stay(); return; }
    swallow = performance.now();
    go(u);
  });
  addEventListener("pointercancel", () => { if (press) { press = null; stay(); } });
  document.addEventListener("click", (e) => {
    // The click that follows a press already handled above.
    if (performance.now() - swallow < 600) { if (e.target.closest?.("a[href]")) e.preventDefault(); return; }
    const u = !e.defaultPrevented && internal(e);
    if (!u) return;
    e.preventDefault();
    leave(u.pathname);
    go(u);
  });

  // The page swaps in place: the router renders the next page under the open notch, then the notch tucks. Without
  // the router (it failed to start) it is an ordinary page load, which arrives out of the notch the old way.
  const go = (u) => {
    if (!window.__hushdGo) { note(); location.assign(u.href); return; }
    root.classList.add("spa", "from-site");
    window.__hushdGo(u.pathname, u.hash.slice(1));
  };
  const setCurrent = (path) => {
    for (const a of [...links, $(".btn--nav", pill)]) {
      if (!a) continue;
      if (a.getAttribute("href") === path) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    }
    current = links.find((a) => a.getAttribute("aria-current") === "page") || null;
    own = CARDS[path] || CARDS["/"];
  };
  // Called once the new page is mounted.
  arrived = (path) => {
    setCurrent(path);
    if (!leaving) { setCard(own); placeThumb(current); return; }
    leaving = null;
    // Two frames: the new page has painted before the notch starts to close over it.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (leaving) return; // already heading somewhere else
      pill.dataset.notch = "closing";
      const done = () => { setCard(own); placeThumb(current); setTimeout(() => { if (pill.dataset.notch === "closing") delete pill.dataset.notch; }, 300); };
      if (reduceMotion) { root.classList.remove("notch-leave"); done(); return; }
      morph(() => root.classList.remove("notch-leave"), "rest", TUCK, done);
    }));
  };

  // Arriving from another page, the head script tucks the notch as soon as the page is on screen (see head.ts).
  addEventListener("hushd:tucked", () => { if (thumb) placeThumb(current); });
  // Back/forward cache restores the page as it was left; never leave the notch stuck open.
  addEventListener("pageshow", (e) => {
    if (!e.persisted) return;
    leaving = null;
    root.classList.remove("notch-arrive", "notch-leave");
    clearSize();
    setCard(own);
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

async function footerArt(el = document) {
  const canvas = $(".footer__art", el);
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
  if (box.dataset.still !== undefined) { opts.pointer = false; opts.pulse = false; }
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

/* Explanations one click away: promise cards and FAQ -------------------------------------------------------------- */
function explanations(el) {
$$(".pcard", el).forEach((card) => {
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
$$(".q", el).forEach((q) => {
  const btn = $("button", q);
  btn?.addEventListener("click", () => {
    const open = !q.classList.contains("is-open");
    q.classList.toggle("is-open", open);
    btn.setAttribute("aria-expanded", String(open));
  });
});
}

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
  const onResize = () => place(btns[i]);
  const sc = scope();
  if (sc) sc.on(window, "resize", onResize); else addEventListener("resize", onResize);
  return { pick, get index() { return i; }, count: btns.length };
}

// Features: each feature is a small working piece of the app. The notch you can hover and open, a project that types
// itself, Back to task, a tray you throw files into, a real keyboard shortcut, screen reading, and the iPhone shield.
import { $, $$, clamp, reduceMotion, finePointer, Spring, springLoop, watchVisible, skyArt, smooth, quiet, fit } from "./site.js";

// Runs when the page is on screen; everything it starts stops when the page leaves (see scope.js).
export function mount(page) {
  const { setTimeout, setInterval, requestAnimationFrame, addEventListener } = page.api;

  /* Hero art and the tilting app window ---------------------------------------------------------------------------- */
  skyArt($(".subhero__art"), "thinker", {
    place: (img, W, H) => {
      const h = Math.min(H * 1.05, W * 1.1);
      const w = h * (img.naturalWidth / img.naturalHeight);
      return { x: W < 700 ? -w * 0.42 : W * 0.04 - w * 0.3, y: -H * 0.02, w, h };
    },
    // Keep the middle clear for the headline: the Thinker stays on the left edge, fading out before the text.
    mask: (x, y, W, H) => (1 - smooth(H * 0.5, H * 0.85, y)) * smooth(30, 120, y) * (W < 700 ? 0 : 1 - smooth(W * 0.2, W * 0.32, x)),
    origin: (W, H) => ({ x: W * 0.5, y: H * 0.25 }),
  }).catch(quiet);

  // The window leans toward the pointer on two independent springs, and settles flat when it leaves.
  const tilt = $("[data-tilt]");
  const tiltHost = $(".subhero--stack");
  if (tilt && finePointer && !reduceMotion) {
    const T = { response: 0.5, damping: 0.9 };
    const rx = new Spring(0, T, 0.005);
    const ry = new Spring(0, T, 0.005);
    const loop = springLoop([rx, ry], () => {
      tilt.style.setProperty("--rx", `${rx.x.toFixed(3)}deg`);
      tilt.style.setProperty("--ry", `${ry.x.toFixed(3)}deg`);
    });
    tiltHost.addEventListener("pointermove", (e) => {
      const r = tilt.getBoundingClientRect();
      const u = clamp((e.clientX - r.left) / r.width);
      const v = clamp((e.clientY - r.top) / r.height);
      rx.set((0.5 - v) * 5);
      ry.set((u - 0.5) * 7);
      loop.kick();
    });
    tiltHost.addEventListener("pointerleave", () => { rx.set(0); ry.set(0); loop.kick(); });
  }

  /* Clocks ---------------------------------------------------------------------------------------------------------- */
  // The session clocks tick only while something showing them is on screen.
  const clocks = $$("[data-pn-clock], [data-phone-clock]");
  let clockSecs = 24 * 60 + 10;
  const clocksSeen = new Set();
  $$("#notch, #iphone").forEach((el) => watchVisible(el, (on) => { if (on) clocksSeen.add(el); else clocksSeen.delete(el); }, 0));
  setInterval(() => {
    if (!clocksSeen.size || document.hidden) return;
    clockSecs++;
    const t = `${Math.floor(clockSecs / 60)}:${String(clockSecs % 60).padStart(2, "0")}`;
    clocks.forEach((c) => { c.textContent = t; });
  }, 1000);

  /* The notch -------------------------------------------------------------------------------------------------------- */
  // Droppy 16.0.1, measured from its window: rest 259x32 (shoulders 6, corners 8.5), hover 285x35 (7, 9), open 485x196
  // (27.5, 35). Hover waits about 0.2 s, then swells in about 0.1 s with a tiny overshoot. A click squeezes the notch about
  // 14 percent narrower, then springs it open with about 1 percent overshoot in about 0.35 s. Leaving closes after 0.25 s.
  const desk = $("[data-desk]");
  const pn = $("[data-pn]");
  const tabs = $("[data-pn-tabs]");
  const tabBtns = $$("[data-pn-tab]", tabs);
  const SIZE = {
    rest: { w: 259, h: 32, r: 8.5, sh: 6 },
    hover: { w: 285, h: 35, r: 9, sh: 7 },
    open: { w: 485, h: 196, r: 35, sh: 27.5 },
  };
  const SPRING = {
    hover: { response: 0.16, damping: 0.72 },
    squeeze: { response: 0.12, damping: 1 },
    open: { response: 0.35, damping: 0.83 },
    close: { response: 0.35, damping: 0.95 },
  };
  const pw = new Spring(SIZE.rest.w, SPRING.open);
  const ph = new Spring(SIZE.rest.h, SPRING.open);
  const pr = new Spring(SIZE.rest.r, SPRING.open);
  const psh = new Spring(SIZE.rest.sh, SPRING.open, 0.01);
  const pnLoop = springLoop([pw, ph, pr, psh], () => {
    pn.style.width = `${pw.x.toFixed(2)}px`;
    pn.style.height = `${ph.x.toFixed(2)}px`;
    pn.style.borderRadius = `0 0 ${pr.x.toFixed(2)}px ${pr.x.toFixed(2)}px`;
    pn.style.setProperty("--sh", `${Math.max(0, psh.x).toFixed(2)}px`);
  });
  function sized(mode) {
    const s = SIZE[mode];
    const k = Math.min(1, (desk.clientWidth - 24) / SIZE.open.w);
    if (mode === "open") return { w: s.w * k, h: Math.max(176, s.h * k), r: s.r, sh: s.sh * Math.max(0.6, k) };
    return { w: Math.min(s.w, desk.clientWidth * 0.62), h: s.h, r: s.r, sh: s.sh };
  }
  function toSize(mode, cfg) {
    const s = sized(mode);
    if (reduceMotion) { pw.jump(s.w); ph.jump(s.h); pr.jump(s.r); psh.jump(s.sh); }
    else { pw.set(s.w, cfg); ph.set(s.h, cfg); pr.set(s.r, cfg); psh.set(s.sh, cfg); }
    pnLoop.kick();
    return s;
  }
  let mode = "rest";
  let hoverTimer = 0;
  let closeTimer = 0;
  let squeezeTimer = 0;
  function setMode(next) {
    if (next === mode) return;
    const was = mode;
    mode = next;
    pn.dataset.mode = next;
    const open = next === "open";
    pn.setAttribute("aria-expanded", String(open));
    pn.setAttribute("aria-label", open ? "Hushd notch, open. Click to close." : "Hushd notch: Calc homework, on task. Click to open.");
    tabBtns.forEach((b) => { b.tabIndex = open ? 0 : -1; });
    tabs.setAttribute("aria-hidden", String(!open));
    clearTimeout(squeezeTimer);
    if (open) {
      // The squeeze: a quick pinch narrower, then the open spring takes over from wherever the squeeze got to.
      if (!reduceMotion) {
        pw.set(pw.x * 0.86, SPRING.squeeze);
        pnLoop.kick();
        squeezeTimer = setTimeout(() => placeTabs(toSize("open", SPRING.open)), 90);
      } else placeTabs(toSize("open", SPRING.open));
      tabs.classList.add("is-on");
    } else {
      tabs.classList.remove("is-on");
      toSize(next, next === "hover" ? SPRING.hover : was === "open" ? SPRING.close : SPRING.hover);
    }
  }
  function placeTabs(s) { tabs.style.top = `${s.h + 12.5}px`; }
  function setPage(page) {
    pn.dataset.page = page;
    tabBtns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.pnTab === page)));
  }
  setPage("home");
  pn.dataset.mode = "rest";

  pn.addEventListener("click", () => setMode(mode === "open" ? (finePointer ? "hover" : "rest") : "open"));
  tabBtns.forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); setPage(b.dataset.pnTab); }));
  const zone = [pn, tabs];
  zone.forEach((el) => {
    el.addEventListener("pointerenter", () => {
      clearTimeout(closeTimer);
      if (mode === "rest" && finePointer) hoverTimer = setTimeout(() => setMode("hover"), 200);
    });
    el.addEventListener("pointerleave", (e) => {
      clearTimeout(hoverTimer);
      if (zone.includes(e.relatedTarget) || zone.some((z) => z.contains(e.relatedTarget))) return;
      if (!finePointer) return;
      closeTimer = setTimeout(() => setMode("rest"), mode === "open" ? 250 : 60);
    });
  });
  page.on(document, "pointerdown", (e) => { if (mode === "open" && !zone.some((z) => z.contains(e.target))) setMode("rest"); });
  page.on(document, "keydown", (e) => { if (e.key === "Escape" && mode === "open") { setMode("rest"); pn.focus(); } });
  addEventListener("resize", () => { const s = toSize(mode, SPRING.close); if (mode === "open") placeTabs(s); });
  toSize("rest");

  /* Projects: the sentence types itself, then Ask Hushd answers ----------------------------------------------------- */
  const project = $("[data-project]");
  const typed = $("[data-type]", project);
  const ask = $("[data-ask]", project);
  const full = typed.dataset.type;
  if (reduceMotion) ask.classList.add("is-answered");
  else {
    typed.textContent = "";
    let started = false;
    watchVisible(project, (on) => {
      if (!on || started) return;
      started = true;
      let i = 0;
      const step = () => {
        i++;
        typed.textContent = full.slice(0, i);
        if (i < full.length) setTimeout(step, full[i - 1] === "." ? 260 : 22 + Math.random() * 34);
        else setTimeout(() => ask.classList.add("is-answered"), 700);
      };
      setTimeout(step, 500);
    }, 0.5);
  }

  /* Back to the right place ------------------------------------------------------------------------------------------ */
  const places = $("[data-places]");
  const goBack = $("[data-places-go]", places);
  let placesTimer = 0;
  goBack.addEventListener("click", () => {
    places.dataset.state = "back";
    clearTimeout(placesTimer);
    // Wander off again after a while, so it can be tried more than once.
    placesTimer = setTimeout(() => { places.dataset.state = "away"; }, 4200);
  });

  /* The tray: drag and throw files into the notch -------------------------------------------------------------------- */
  // Apple's fluid-interface rules: the file stays under the finger from where it was grabbed, the release velocity carries
  // into the spring, the landing spot is projected from that velocity, and edges resist instead of stopping hard.
  const play = $("[data-trayplay]");
  const shelf = $("[data-shelf]", play);
  const files = $$("[data-dfile]", play).map((el) => ({
    el, inTray: false,
    x: new Spring(0, { response: 0.4, damping: 0.8 }, 0.1), y: new Spring(0, { response: 0.4, damping: 0.8 }, 0.1),
    s: new Spring(1, { response: 0.3, damping: 0.8 }, 0.002),
  }));
  files.forEach((f) => {
    f.loop = springLoop([f.x, f.y, f.s], () => { f.el.style.transform = `translate3d(${f.x.x.toFixed(2)}px, ${f.y.x.toFixed(2)}px, 0) scale(${f.s.x.toFixed(4)})`; });
  });
  const project_ = (v, d = 0.99) => (v / 1000) * d / (1 - d);
  const rubber = (over, dim, c = 0.55) => (over * dim * c) / (dim + c * Math.abs(over));
  function home(f) {
    // The file's resting box with no transform.
    const r = f.el.getBoundingClientRect();
    return { cx: r.left + r.width / 2 - f.x.x, cy: r.top + r.height / 2 - f.y.x, w: r.width / f.s.x, h: r.height / f.s.x };
  }
  function trayTargets() {
    const inTray = files.filter((f) => f.inTray);
    const sr = shelf.getBoundingClientRect();
    const n = inTray.length;
    inTray.forEach((f, i) => {
      const h = home(f);
      const slotW = (sr.width - 24) / Math.max(n, 1);
      const scale = Math.min(0.88, (slotW - 8) / h.w);
      f.target = { x: sr.left + 12 + slotW * (i + 0.5) - h.cx, y: sr.bottom - 30 - h.cy, s: scale };
    });
    files.filter((f) => !f.inTray).forEach((f) => { f.target = { x: 0, y: 0, s: 1 }; });
    play.classList.toggle("has-files", n > 0);
  }
  function settle(f, vx = 0, vy = 0) {
    const t = f.target;
    if (reduceMotion) { f.x.jump(t.x); f.y.jump(t.y); f.s.jump(t.s); }
    else {
      f.x.set(t.x); f.y.set(t.y); f.s.set(t.s);
      f.x.v = vx; f.y.v = vy;
    }
    f.loop.kick();
  }
  function reflow(except) { trayTargets(); files.forEach((f) => { if (f !== except) settle(f); }); }
  function overShelf(px, py, pad = 24) {
    const r = shelf.getBoundingClientRect();
    return px > r.left - pad && px < r.right + pad && py > r.top - pad && py < r.bottom + pad;
  }
  files.forEach((f) => {
    let drag = null;
    f.el.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      f.el.setPointerCapture(e.pointerId);
      const h = home(f);
      drag = { id: e.pointerId, gx: e.clientX - (h.cx + f.x.x), gy: e.clientY - (h.cy + f.y.x), h, hist: [], moved: false, sx: e.clientX, sy: e.clientY };
      f.el.classList.add("is-grabbed");
      // Feedback on press, not release: the file lifts toward you.
      f.s.set((f.inTray ? f.target.s : 1) * 1.06);
      f.loop.kick();
    });
    f.el.addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6) return;
      drag.moved = true;
      const pr = play.getBoundingClientRect();
      // 1:1 tracking from the grab point, rubber-banded past the panel's edges.
      let cx = e.clientX - drag.gx;
      let cy = e.clientY - drag.gy;
      if (cx < pr.left) cx = pr.left - rubber(pr.left - cx, pr.width); else if (cx > pr.right) cx = pr.right + rubber(cx - pr.right, pr.width);
      if (cy < pr.top) cy = pr.top - rubber(pr.top - cy, pr.height); else if (cy > pr.bottom) cy = pr.bottom + rubber(cy - pr.bottom, pr.height);
      f.x.jump(cx - drag.h.cx); f.y.jump(cy - drag.h.cy);
      f.loop.kick();
      drag.hist.push({ x: e.clientX, y: e.clientY, t: e.timeStamp });
      if (drag.hist.length > 6) drag.hist.shift();
      shelf.classList.toggle("is-target", overShelf(cx, cy));
    });
    const end = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      f.el.classList.remove("is-grabbed");
      shelf.classList.remove("is-target");
      let vx = 0, vy = 0;
      const hist = drag.hist.filter((p) => e.timeStamp - p.t < 100);
      if (hist.length > 1) {
        const a = hist[0], b = hist[hist.length - 1];
        const dt = Math.max(1, b.t - a.t) / 1000;
        vx = (b.x - a.x) / dt; vy = (b.y - a.y) / dt;
      }
      const wasTap = !drag.moved;
      const cx = drag.h.cx + f.x.x;
      const cy = drag.h.cy + f.y.x;
      drag = null;
      // A tap (or Enter) moves the file across; a throw lands wherever its momentum was taking it.
      f.inTray = wasTap ? !f.inTray : overShelf(cx + project_(vx), cy + project_(vy), 40);
      trayTargets();
      settle(f, wasTap ? 0 : vx, wasTap ? 0 : vy);
      reflow(f);
    };
    f.el.addEventListener("pointerup", end);
    f.el.addEventListener("pointercancel", end);
    f.el.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      f.inTray = !f.inTray;
      reflow();
    });
    f.el.setAttribute("aria-label", `${f.el.textContent.trim()}. Press to move it into the notch tray.`);
  });
  addEventListener("resize", () => { trayTargets(); files.forEach((f) => { f.x.jump(f.target.x); f.y.jump(f.target.y); f.s.jump(f.target.s); f.loop.kick(); }); });
  trayTargets();

  /* One keypress: the real shortcut works here ---------------------------------------------------------------------- */
  const keys = $("[data-keys]");
  const keyResult = $("[data-keys-result]");
  const kbd = { Control: $('[data-key="Control"]', keys), Alt: $('[data-key="Alt"]', keys), f: $('[data-key="f"]', keys) };
  const CODE = { ControlLeft: "Control", ControlRight: "Control", AltLeft: "Alt", AltRight: "Alt", KeyF: "f" };
  const down = new Set();
  let keysVisible = false;
  let running = false;
  watchVisible(keys, (on) => { keysVisible = on; }, 0.3);
  function fire() {
    running = !running;
    keyResult.lastElementChild.textContent = running ? "Session started" : "Session paused";
    keyResult.classList.remove("is-on");
    void keyResult.offsetWidth;
    keyResult.classList.add("is-on");
  }
  addEventListener("keydown", (e) => {
    const k = CODE[e.code];
    if (!k || !keysVisible || e.repeat) return;
    down.add(k);
    kbd[k].classList.add("is-down");
    if (down.has("Control") && down.has("Alt") && down.has("f")) fire();
  });
  addEventListener("keyup", (e) => {
    const k = CODE[e.code];
    if (!k) return;
    down.delete(k);
    kbd[k].classList.remove("is-down");
  });
  addEventListener("blur", () => { down.clear(); Object.values(kbd).forEach((k) => k.classList.remove("is-down")); });
  // Clicking the keys plays the chord: each key goes down in turn, then all come up together.
  keys.addEventListener("click", () => {
    const order = [kbd.Control, kbd.Alt, kbd.f];
    order.forEach((k, i) => setTimeout(() => k.classList.add("is-down"), i * 90));
    setTimeout(() => { fire(); }, 230);
    setTimeout(() => order.forEach((k) => k.classList.remove("is-down")), 420);
  });

  /* Screen reading -------------------------------------------------------------------------------------------------- */
  const ocr = $("[data-ocr]");
  $("[data-ocr-switch]").addEventListener("change", (e) => { ocr.dataset.on = String(e.target.checked); });

  /* iPhone shield --------------------------------------------------------------------------------------------------- */
  const phone = $("[data-phone]");
  const tryBtn = $("[data-phone-try]");
  tryBtn.addEventListener("click", () => { phone.dataset.shield = "true"; $("[data-phone-lift]", phone).focus({ preventScroll: true }); });
  $("[data-phone-lift]", phone).addEventListener("click", () => { phone.dataset.shield = "false"; tryBtn.focus({ preventScroll: true }); });
}

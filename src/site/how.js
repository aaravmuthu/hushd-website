// How it works: the live reading panel, one drift told on a sticky stage, the ring's shapes, how firm it gets, review.
import { $, $$, clamp, reduceMotion, Spring, OPEN, CLOSE, PEEK, springLoop, watchVisible, segmented, swapText, skyArt, smooth, quiet, ART, loadImage, Halftone, fit, engravingValue } from "./site.js";

// Runs when the page is on screen; everything it starts stops when the page leaves (see scope.js).
export function mount(page) {
  const { setTimeout, setInterval, requestAnimationFrame, addEventListener } = page.api;

  /* Hero art: Friedrich's fog bank behind the reading panel ---------------------------------------------------------- */
  skyArt($(".subhero__art"), "wanderer", {
    place: (img, W, H) => fit(img, { x: W * 0.3, y: -H * 0.1, w: W * 0.8, h: H * 1.2 }, "cover", 0.4, 0.45),
    // Quiet behind the headline on wide screens, faint all over on phones.
    // On narrow screens the copy stacks on top, so the art only fills in behind the panel below it.
    mask: (x, y, W, H) => (W < 980 ? 0.7 * smooth(H * 0.46, H * 0.6, y) : smooth(W * 0.36, W * 0.56, x) * smooth(40, 140, y)) * (1 - smooth(H * 0.82, H, y)),
    origin: (W, H) => ({ x: W * 0.75, y: H * 0.5 }),
    strength: 0.9,
  }).catch(quiet);

  /* Reading panel: three windows, three calls ----------------------------------------------------------------------- */
  const reader = $("[data-reader]");
  const R = {
    app: $("[data-r-app]", reader), call: $("[data-r-call]", reader), why: $("[data-r-why]", reader),
    win: $("[data-r-win]", reader), agree: $("[data-r-agree]", reader), checks: $$(".reader__checks li", reader),
  };
  const READS = [
    { state: "on", app: "Notes", win: "Notes, “Calc homework”", call: "On task", why: "Shares words with your task", agree: "Two checks agree" },
    { state: "unsure", app: "Mail", win: "Mail, “Inbox”", call: "Not sure", why: "Could go either way, so nothing happens", agree: "Checks disagree" },
    { state: "drift", app: "Browser", win: "Browser, “Watch later”", call: "Drifting", why: "Away from Calc homework", agree: "Two checks agree" },
  ];
  let readIdx = 0;
  let readTimers = [];
  let readerOn = false;
  function playRead() {
    readTimers.forEach(clearTimeout);
    readTimers = [];
    const r = READS[readIdx];
    const at = (ms, fn) => readTimers.push(setTimeout(fn, reduceMotion ? 0 : ms));
    // Read: the dots light; then each check ticks in; then the call lands and the ring changes shape.
    reader.dataset.phase = "";
    void reader.offsetWidth;
    reader.dataset.phase = "read";
    R.checks.forEach((li) => li.classList.remove("is-on"));
    swapText(R.app, r.app);
    swapText(R.win, r.win);
    R.checks.forEach((li, i) => at(700 + i * 260, () => li.classList.add("is-on")));
    at(700, () => swapText(R.agree, r.agree));
    at(1500, () => { reader.dataset.state = r.state; swapText(R.call, r.call); swapText(R.why, r.why); });
    if (readerOn && !reduceMotion) at(4600, () => { readIdx = (readIdx + 1) % READS.length; playRead(); });
  }
  watchVisible(reader, (on) => {
    if (on === readerOn) return;
    readerOn = on;
    if (on) playRead(); else readTimers.forEach(clearTimeout);
  }, 0.3);
  if (reduceMotion) { R.checks.forEach((li) => li.classList.add("is-on")); }

  /* One drift: the stage follows whichever beat sits in the middle of the screen ---------------------------------- */
  const stage = $("[data-stage]");
  const beats = $$(".beat");
  const sn = $("[data-sn]", stage);
  const progress = $("[data-loop-progress]");
  const screen = $(".stage__screen", stage);

  const snW = new Spring(220, OPEN);
  const snH = new Spring(30, OPEN);
  const snR = new Spring(12, OPEN);
  const snLoop = springLoop([snW, snH, snR], () => {
    sn.style.width = `${snW.x.toFixed(2)}px`;
    sn.style.height = `${snH.x.toFixed(2)}px`;
    sn.style.borderRadius = `0 0 ${snR.x.toFixed(2)}px ${snR.x.toFixed(2)}px`;
  });
  function sizeNotch(beat) {
    const W = screen.clientWidth;
    const rest = Math.min(220, W * 0.5);
    const s = beat === 4 ? { w: Math.min(W - 20, 440), h: 150, r: 28, c: OPEN }
      : beat === 3 ? { w: Math.min(W - 20, rest + 80), h: 34, r: 14, c: PEEK }
      : { w: rest, h: 30, r: 12, c: CLOSE };
    if (reduceMotion) { snW.jump(s.w); snH.jump(s.h); snR.jump(s.r); }
    else { snW.set(s.w, s.c); snH.set(s.h, s.c); snR.set(s.r, s.c); }
    snLoop.kick();
  }
  let beat = -1;
  function setBeat(i) {
    if (i === beat) return;
    beat = i;
    stage.dataset.beat = String(i);
    beats.forEach((b, j) => b.classList.toggle("is-current", j === i));
    sizeNotch(i);
  }
  const beatIO = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) setBeat(Number(e.target.dataset.beat));
  }, { rootMargin: "-48% 0px -48% 0px" });
  page.track(beatIO);
  beats.forEach((b) => beatIO.observe(b));
  setBeat(0);
  addEventListener("resize", () => sizeNotch(beat));

  // The thin bar under the stage shows how far through the story you are.
  const beatList = $(".loop__beats");
  let progQueued = false;
  addEventListener("scroll", () => {
    if (progQueued) return;
    progQueued = true;
    requestAnimationFrame(() => {
      progQueued = false;
      const r = beatList.getBoundingClientRect();
      const p = clamp((innerHeight * 0.5 - r.top) / r.height);
      progress.style.setProperty("--p", p.toFixed(3));
    });
  }, { passive: true });

  /* The ring in shapes ----------------------------------------------------------------------------------------------- */
  const ringStage = $("[data-ring-stage]");
  const ringLabel = $("[data-ring-label]");
  const ringCaption = $("[data-ring-caption]");
  const RINGS = [
    { ring: "on", label: "On task", caption: "Closed. You are on task, so Hushd says nothing." },
    { ring: "unsure", label: "Not sure", caption: "Dashed. Not sure does nothing, and no nudge comes." },
    { ring: "drift", label: "Drifting", caption: "A gap opens and the color drains slowly. Hushd waits to see if it lasts." },
    { ring: "paused", label: "Paused", caption: "Faded, with a pause mark. Hushd is not reading anything." },
  ];
  let ringAuto = !reduceMotion;
  let ringVisible = false;
  let ringTimer = 0;
  const ringSeg = segmented($("[data-ring-seg]"), (i, fromUser) => {
    if (fromUser) ringAuto = false;
    ringStage.dataset.ring = RINGS[i].ring;
    swapText(ringLabel, RINGS[i].label);
    swapText(ringCaption, RINGS[i].caption);
    scheduleRing();
  });
  function scheduleRing() {
    clearTimeout(ringTimer);
    if (ringAuto && ringVisible) ringTimer = setTimeout(() => ringSeg.pick((ringSeg.index + 1) % ringSeg.count, false), 3200);
  }
  watchVisible(ringStage, (on) => { ringVisible = on; scheduleRing(); }, 0.4);
  ringSeg.pick(0, false);

  /* How firm it gets: each style replays as a timeline -------------------------------------------------------------- */
  const ICON = {
    drift: '<path d="M6 12a6 6 0 1 1 6 6"/>',
    notch: '<path d="M5 7h14v3a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z"/>',
    wait: '<circle cx="12" cy="12" r="6"/><path d="M12 9v3l2 1.5"/>',
    again: '<path d="M7 9a6 6 0 1 1-1 6"/><path d="M6 5v4h4"/>',
    pause: '<path d="M9 7v10M15 7v10"/>',
    hide: '<path d="M4 4l16 16M10 6.5A9 9 0 0 1 20 12a11 11 0 0 1-2.5 3.2M6.7 7.7A11 11 0 0 0 4 12s3 6 8 6a7.6 7.6 0 0 0 3-.6"/>',
  };
  const LEVELS = [
    [["drift", "You drift"], ["wait", "The drift lasts"], ["notch", "A nudge in the notch"], ["wait", "Then it waits"]],
    [["drift", "You drift"], ["notch", "A nudge in the notch"], ["again", "Asks once more"], ["pause", "A pause screen", true]],
    [["drift", "You drift"], ["notch", "A nudge, sooner"], ["hide", "Hides the app you drifted into", true]],
  ];
  const track = $("[data-track]");
  const fill = $("[data-track-fill]");
  const evList = $("[data-track-events]");
  let fillAnim = null;
  let trackTimers = [];
  let trackSeen = false;
  function playLevel(n) {
    trackTimers.forEach(clearTimeout);
    trackTimers = [];
    const evs = LEVELS[n];
    evList.style.setProperty("--n", evs.length);
    evList.innerHTML = evs.map(([icon, label, firm]) =>
      `<li class="tev${firm ? " is-firm" : ""}"><span class="tev__dot"><svg viewBox="0 0 24 24" aria-hidden="true">${ICON[icon]}</svg></span><b>${label}</b></li>`).join("");
    const items = $$(".tev", evList);
    if (reduceMotion || !trackSeen) {
      items.forEach((li) => li.classList.add("is-on"));
      fill.style.transform = "scaleX(1)";
      return;
    }
    // The line draws left to right; each event lights as the line reaches it.
    const total = 1900;
    fillAnim?.cancel();
    fillAnim = fill.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], { duration: total, easing: "cubic-bezier(0.65, 0, 0.35, 1)", fill: "forwards" });
    items.forEach((li, i) => trackTimers.push(setTimeout(() => li.classList.add("is-on"), (i / Math.max(1, items.length - 1)) * total * 0.92 + 40)));
  }
  const strictSeg = segmented($("[data-strict-seg]"), (n) => playLevel(n));
  strictSeg.pick(0, false);
  watchVisible(track, (on) => { if (on && !trackSeen) { trackSeen = true; playLevel(strictSeg.index); } }, 0.5);

  async function strictArt() {
    const canvas = $(".strict__art");
    const jerome = await loadImage(ART.jerome);
    new Halftone(canvas, [{
      img: jerome,
      place: (W, H) => {
        const h = H * 1.04;
        const w = h * (jerome.naturalWidth / jerome.naturalHeight);
        return W < 760 ? fit(jerome, { x: 0, y: 0, w: W, h: H }, "cover", 0.5, 0.5) : { x: W - w * 0.98, y: -H * 0.02, w, h };
      },
      value: (r, g, b, u, v, x, y, W) => engravingValue(r, g, b) * smooth(0.02, 0.2, u) * (W < 760 ? 0.16 : smooth(W * 0.5, W * 0.72, x)),
    }], { cell: (w) => (w > 900 ? 6 : 4.5), origin: (W, H) => ({ x: W * 0.8, y: H * 0.45 }), pointerHost: $(".strict"), ripple: 1400 });
  }
  strictArt().catch(quiet);

  /* Review: answering a moment ------------------------------------------------------------------------------------- */
  $$("[data-rv]").forEach((row) => {
    const done = $(".rvx__done", row);
    const answer = (text) => {
      done.innerHTML = `<svg class="ring" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/></svg>${text}`;
      row.classList.add("is-done");
      // The buttons go away, so keep keyboard focus on the answer instead of dropping it to the page.
      done.tabIndex = -1;
      done.focus({ preventScroll: true });
    };
    $("[data-fine]", row).addEventListener("click", () => answer("Noted. That teaches Hushd."));
    $("[data-right]", row).addEventListener("click", () => answer("Thanks. Kept as a right call."));
  });
}

// Home page: the hero art, the interactive notch story and the word scroll. Shared pieces live in site.js.
import { $, $$, clamp, reduceMotion, Spring, OPEN, CLOSE, PEEK, LENS_THUMB, glide, ART, Halftone, loadImage, fit, smooth, thinkerValue, fogValue, engravingValue, quiet } from "./site.js";

// Runs when the page is on screen; everything it starts stops when the page leaves (see scope.js).
export function mount(page) {
  const { setTimeout, setInterval, requestAnimationFrame, addEventListener } = page.api;

  /* Halftone art ----------------------------------------------------------------------------------------------------- */
  async function heroArt() {
    const canvas = $(".hero__art");
    const icon = $(".hero__icon");
    const [thinker, wanderer] = await Promise.all([loadImage(ART.thinker), loadImage(ART.wanderer)]);
    const iconCenter = () => {
      const c = canvas.getBoundingClientRect();
      const r = icon.getBoundingClientRect();
      return { x: r.left - c.left + r.width / 2, y: r.top - c.top + r.height / 2 };
    };
    // Keep the bottom of the art quiet where the headline sits.
    const textFade = (y, H) => (1 - smooth(H * 0.42, H * 0.74, y)) * smooth(10, 90, y);
    new Halftone(canvas, [
      {
        // The Thinker sits left of the icon, looking down at it.
        img: thinker,
        place: (W, H) => {
          const h = Math.min(H * 1.02, W * 1.2);
          const w = h * (thinker.naturalWidth / thinker.naturalHeight);
          const head = W < 700 ? W * 0.5 - W * 0.18 : W * 0.5 - Math.min(290, W * 0.2);
          return { x: head - 0.66 * w, y: -H * 0.02, w, h };
        },
        value: (r, g, b, u, v, x, y, W, H) => thinkerValue(r, g, b, u, v) * textFade(y, H) * (W < 700 ? 0.7 : 1),
      },
      {
        // Friedrich's fog drifts in from the right; the wanderer stays a dark figure inside it.
        img: wanderer,
        place: (W, H) => fit(wanderer, { x: W * 0.5, y: -H * 0.12, w: W * 0.62, h: H * 1.2 }, "cover", 0.4, 0.4),
        value: (r, g, b, u, v, x, y, W, H) =>
          fogValue(r, g, b) * 0.9 * smooth(W * 0.56, W * 0.74, x) * textFade(y, H) * (1 - smooth(0.9, 1, u)),
      },
    ], {
      cell: (w) => (w > 900 ? 6 : 4.5),
      origin: iconCenter,
      pointerHost: $(".hero"),
      ripple: 1300,
    });
  }

  async function roomArt() {
    const canvas = $(".room__art");
    const jerome = await loadImage(ART.jerome);
    new Halftone(canvas, [{
      img: jerome,
      place: (W, H) => {
        const h = H * 1.04;
        const w = h * (jerome.naturalWidth / jerome.naturalHeight);
        return W < 760 ? fit(jerome, { x: 0, y: 0, w: W, h: H }, "cover", 0.5, 0.5) : { x: W - w * 0.98, y: -H * 0.02, w, h };
      },
      value: (r, g, b, u, v, x, y, W) => engravingValue(r, g, b) * smooth(0.02, 0.2, u) * (W < 760 ? 0.18 : smooth(W * 0.42, W * 0.66, x)),
    }], { cell: (w) => (w > 900 ? 6 : 4.5), origin: (W, H) => ({ x: W * 0.8, y: H * 0.45 }), pointerHost: $(".room"), ripple: 1400 });
  }

  heroArt().catch(quiet);

  roomArt().catch(quiet);

  /* Island: the notch demo ------------------------------------------------------------------------------------------- */
  // The notch springs use the app's own Motion tokens (Tokens.swift): open = response 0.38, damping 0.8.
  const island = $("#island");
  const mac = $(".mac", island);
  const notch = $(".notch", island);
  const winBody = $("[data-win-body]", island);
  const winTitle = $("[data-win-title]", island);
  const readText = $("[data-read]", island);
  const callEl = $("[data-call]", island);
  const caption = $("[data-caption]", island);
  const stepBtns = $$(".steps button", island);
  const islandPlay = $(".island .playpause");

  winBody.innerHTML = `
    <div class="win-view" data-view="notes">
      <h4>Calc homework</h4>
      <p class="win-math">∫ x·eˣ dx = x·eˣ − eˣ + C</p>
      <div class="win-line" style="width:92%"></div><div class="win-line" style="width:78%"></div><div class="win-line" style="width:85%"></div><div class="win-line" style="width:40%"></div>
    </div>
    <div class="win-view" data-view="mail">
      <h4>Inbox</h4>
      <div class="win-mail">${Array.from({ length: 4 }, (_, i) => `<div><b></b><div style="flex:1"><div class="win-line" style="width:${50 + i * 9}%;margin-bottom:6px"></div><div class="win-line" style="width:${80 - i * 7}%;margin:0;opacity:.6"></div></div></div>`).join("")}</div>
    </div>
    <div class="win-view" data-view="video">
      <h4>Watch</h4>
      <div class="win-grid win-grid--thumbs"><span style="--h:150"><b>Lecture recap in 60 seconds</b></span><span style="--h:28"><b>Speedrun, part 3</b></span><span style="--h:200"><b>Desk setup tour</b></span><span style="--h:340"><b>Five-minute pasta</b></span><span style="--h:95"><b>Mountain bike, POV</b></span><span style="--h:260"><b>Why cats sit in boxes</b></span></div>
    </div>`;
  const views = Object.fromEntries($$(".win-view", winBody).map((v) => [v.dataset.view, v]));

  const STEPS = [
    { view: "notes", title: "Calc homework", ring: "on", notch: "rest", read: "Notes, “Calc homework”. Shares words with your task.", call: "On task", tone: "on",
      caption: "The ring is closed. You are on task, so Hushd says nothing.", hold: 3800 },
    { view: "mail", title: "Inbox", ring: "unsure", notch: "rest", read: "Mail, “Inbox”. Could go either way.", call: "Not sure", tone: "unsure",
      caption: "A dashed ring means not sure. Not sure does nothing.", hold: 3800 },
    { view: "video", title: "Watch", ring: "drift", notch: "peek", read: "Two checks agree this is away from your task.", call: "Drifting", tone: "drift",
      caption: "The ring opens a gap and the color drains slowly. Hushd waits to see if the drift lasts.", hold: 4200 },
    { view: "video", title: "Watch", ring: "drift", notch: "open", read: "The drift lasted. Time for a nudge.", call: "Drifting", tone: "drift",
      caption: "Still away, so the notch opens. It asks about your task, never about where you went.", hold: 4800 },
    { view: "notes", title: "Calc homework", ring: "on", notch: "rest", read: "Notes, “Calc homework”. Back on your task.", call: "On task", tone: "on",
      caption: "Back on task. The notch tucks away and the ring closes.", hold: 3600 },
  ];

  const springW = new Spring(300, OPEN);
  const springH = new Spring(34, OPEN);
  const springR = new Spring(14, OPEN);
  let springRaf = 0;
  let last = 0;

  function notchSize(mode) {
    const stageW = mac.clientWidth;
    const small = stageW < 620;
    const rest = Math.min(300, stageW * 0.56);
    if (mode === "open") return { w: Math.min(stageW - 24, 580), h: small ? 128 : 136, r: 30 };
    if (mode === "peek") return { w: Math.min(stageW - 24, rest + 96), h: 38, r: 16 };
    return { w: rest, h: 34, r: 14 };
  }

  function animateNotch(mode) {
    const s = notchSize(mode);
    const cfg = mode === "open" ? OPEN : mode === "peek" ? PEEK : CLOSE;
    if (reduceMotion) {
      springW.jump(s.w); springH.jump(s.h); springR.jump(s.r);
      paintNotch();
      return;
    }
    springW.set(s.w, cfg); springH.set(s.h, cfg); springR.set(s.r, cfg);
    if (!springRaf) { last = performance.now(); springRaf = requestAnimationFrame(tickNotch); }
  }
  function paintNotch() {
    notch.style.width = `${springW.x.toFixed(2)}px`;
    notch.style.height = `${springH.x.toFixed(2)}px`;
    notch.style.borderRadius = `0 0 ${springR.x.toFixed(2)}px ${springR.x.toFixed(2)}px`;
  }
  function tickNotch(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const moving = [springW.step(dt), springH.step(dt), springR.step(dt)].some(Boolean);
    paintNotch();
    springRaf = moving ? requestAnimationFrame(tickNotch) : 0;
  }

  // Text swaps cross-fade through a little blur, so two states never sit on top of each other.
  function swapText(el, text) {
    if (el.textContent === text) return;
    if (reduceMotion) { el.textContent = text; return; }
    el.classList.add("is-swapping");
    setTimeout(() => { el.textContent = text; el.classList.remove("is-swapping"); }, 60);
  }

  const thumb = document.createElement("span");
  thumb.className = "steps__thumb";
  thumb.setAttribute("aria-hidden", "true");
  Object.assign(thumb.dataset, LENS_THUMB);
  $(".steps", island).prepend(thumb);
  function placeThumb(btn) {
    const li = btn.parentElement;
    const t = `translateX(${li.offsetLeft}px)`;
    if (thumb.style.transform && thumb.style.transform !== t) glide(thumb);
    thumb.style.width = `${btn.offsetWidth}px`;
    thumb.style.transform = t;
  }

  let step = 0;
  function go(i) {
    step = i;
    const s = STEPS[i];
    mac.dataset.step = String(i);
    mac.dataset.ring = s.ring;
    notch.dataset.open = String(s.notch === "open");
    notch.dataset.peek = String(s.notch === "peek");
    notch.dataset.ring = s.ring;
    for (const [k, v] of Object.entries(views)) v.classList.toggle("is-on", k === s.view);
    swapText(winTitle, s.title);
    swapText(readText, s.read);
    swapText(callEl, s.call);
    callEl.dataset.tone = s.tone;
    swapText(caption, s.caption);
    stepBtns.forEach((b, j) => { b.setAttribute("aria-selected", String(j === i)); b.tabIndex = j === i ? 0 : -1; });
    placeThumb(stepBtns[i]);
    animateNotch(s.notch);
    schedule();
  }

  let playing = !reduceMotion;
  let islandVisible = false;
  let timer = 0;
  function schedule() {
    clearTimeout(timer);
    if (playing && islandVisible) timer = setTimeout(() => go((step + 1) % STEPS.length), STEPS[step].hold);
  }
  function setPlaying(p) {
    playing = p;
    islandPlay.dataset.playing = String(p);
    islandPlay.setAttribute("aria-label", p ? "Pause the story" : "Play the story");
    schedule();
  }
  islandPlay.addEventListener("click", () => setPlaying(!playing));
  islandPlay.dataset.playing = String(playing);
  stepBtns.forEach((b, i) => {
    b.addEventListener("click", () => { setPlaying(false); go(i); });
    b.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const n = (i + (e.key === "ArrowRight" ? 1 : -1) + STEPS.length) % STEPS.length;
      setPlaying(false); go(n); stepBtns[n].focus();
    });
  });
  $(".notch__back", island).addEventListener("click", () => go(4));

  page.track(new IntersectionObserver(([e]) => { islandVisible = e.isIntersecting; schedule(); }, { threshold: 0.35 })).observe(mac);
  addEventListener("resize", () => { animateNotch(STEPS[step].notch); placeThumb(stepBtns[step]); });
  go(0);

  // The clock ticks only while the demo is on screen.
  const clock = $("[data-clock]", island);
  let seconds = 24 * 60 + 10;
  setInterval(() => {
    if (!islandVisible || document.hidden) return;
    seconds++;
    clock.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  }, 1000);

  /* Word scroll: the sentence lights up word by word as you scroll through it ---------------------------------------- */
  const ws = $(".wordscroll");
  const words = [];
  $$("[data-wordsplit]", ws).forEach((p) => {
    const parts = p.textContent.trim().split(/\s+/);
    p.textContent = "";
    parts.forEach((w, i) => {
      const span = document.createElement("span");
      span.className = "ws-word";
      span.textContent = w;
      p.append(span);
      if (i < parts.length - 1) p.append(" ");
      words.push(span);
    });
  });
  if (reduceMotion) ws.classList.add("ws-static");
  else {
    let wsQueued = false;
    const lit = new Array(words.length).fill(-1);
    const paintWords = () => {
      wsQueued = false;
      const r = ws.getBoundingClientRect();
      const p = clamp(-r.top / (r.height - innerHeight));
      const t = p * (words.length + 3) - 1;
      words.forEach((w, i) => {
        // Words not yet reached start at 55% ink (3.3:1 on the paper, enough for large text); they were 16% (1.3:1) and could not be read.
        const o = Math.round((0.55 + 0.45 * clamp(t - i)) * 100) / 100;
        if (o !== lit[i]) { lit[i] = o; w.style.setProperty("--o", o); }
      });
    };
    addEventListener("scroll", () => { if (!wsQueued) { wsQueued = true; requestAnimationFrame(paintWords); } }, { passive: true });
    paintWords();
  }
}

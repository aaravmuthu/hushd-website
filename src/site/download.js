// Download: the Thinker behind the glass download card, and five install steps acted out one at a time.
import { $, $$, reduceMotion, watchVisible, skyArt, smooth, quiet, fit, segmented, swapText } from "./site.js";

// Runs when the page is on screen; everything it starts stops when the page leaves (see scope.js).
export function mount(page) {
  const { setTimeout, setInterval, requestAnimationFrame, addEventListener } = page.api;

  skyArt($(".subhero__art"), "thinker", {
    place: (img, W, H) => (W < 980
      ? fit(img, { x: 0, y: H * 0.1, w: W, h: H }, "contain", 0.5, 1)
      : fit(img, { x: W * 0.42, y: H * 0.02, w: W * 0.6, h: H * 1.04 }, "contain", 0.5, 1)),
    mask: (x, y, W, H) => (W < 980 ? 0.4 : 1) * smooth(30, 120, y),
    origin: (W, H) => ({ x: W * 0.72, y: H * 0.55 }),
  }).catch(quiet);

  /* Feedback: pick a kind, get its form -------------------------------------------------------------------------- */
  const FB = [
    { text: "A crash, a hang, or a screen that looks wrong.", href: "beta-bug.yml", icon: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.5"/>' },
    { text: "Describe the kind of window, not what was in it.", href: "beta-wrong-call.yml", icon: '<circle cx="12" cy="12" r="8" stroke-dasharray="4 3"/>' },
    { text: "Something you wish Hushd did.", href: "beta-idea.yml", icon: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z"/>' },
  ];
  const fb = $("[data-fb]");
  const fbIcon = $("[data-fb-icon]", fb);
  const fbLink = $("[data-fb-link]", fb);
  segmented($("[data-fb-seg]", fb), (i) => {
    fbIcon.innerHTML = FB[i].icon;
    swapText($("[data-fb-text]", fb), FB[i].text);
    fbLink.href = `https://github.com/Aryan61056/focus-app/issues/new?template=${FB[i].href}`;
  }).pick(0, false);

  /* Install steps --------------------------------------------------------------------------------------------------- */
  const wrap = $("[data-install]");
  const scene = $(".scene", wrap);
  const btns = $$('[role="tab"]', wrap);
  const STEP_MS = 4200;
  wrap.style.setProperty("--step-ms", `${STEP_MS}ms`);
  let step = 0;
  let auto = !reduceMotion;
  let visible = false;
  let timer = 0;
  function show(i) {
    step = i;
    // Re-setting the scene replays its CSS animations from the start.
    scene.dataset.scene = "";
    void scene.offsetWidth;
    scene.dataset.scene = String(i);
    btns.forEach((b, j) => {
      b.setAttribute("aria-selected", String(j === i));
      b.tabIndex = j === i ? 0 : -1;
      const fillEl = $(".steps5__fill", b);
      fillEl.style.animation = "none";
      void fillEl.offsetWidth;
      fillEl.style.animation = "";
    });
    schedule();
  }
  function schedule() {
    clearTimeout(timer);
    wrap.classList.toggle("is-paused-auto", !auto);
    if (auto && visible) timer = setTimeout(() => show((step + 1) % btns.length), STEP_MS);
  }
  btns.forEach((b, i) => {
    b.addEventListener("click", () => { auto = false; show(i); });
    b.addEventListener("keydown", (e) => {
      const d = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      const n = (i + d + btns.length) % btns.length;
      auto = false;
      show(n);
      btns[n].focus();
    });
  });
  watchVisible(scene, (on) => { visible = on; if (on) show(step); else clearTimeout(timer); }, 0.4);
  show(0);
}

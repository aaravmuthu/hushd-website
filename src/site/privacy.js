// Privacy: what is read, lit up one part at a time; the never-read list being skipped; screen words living for seconds.
import { $, $$, reduceMotion, watchVisible, skyArt, smooth, quiet, fit, swapText } from "./site.js";

/* Hero ------------------------------------------------------------------------------------------------------------ */
skyArt($(".subhero__art"), "jerome", {
  place: (img, W, H) => {
    const h = H * 1.04;
    const w = h * (img.naturalWidth / img.naturalHeight);
    return W < 980 ? fit(img, { x: 0, y: 0, w: W, h: H }, "cover", 0.5, 0.5) : { x: W - w * 0.92, y: -H * 0.02, w, h };
  },
  mask: (x, y, W, H, u) => smooth(0.02, 0.2, u) * (W < 980 ? 0.5 * smooth(H * 0.5, H * 0.64, y) : smooth(W * 0.4, W * 0.62, x)),
  origin: (W, H) => ({ x: W * 0.78, y: H * 0.45 }),
}).catch(quiet);

// The lens reads the app, then the title, then the address; the page itself stays frosted.
const lens = $("[data-lens]");
const lensParts = [0, 1, 2].map((i) => $(`[data-f="${i}"]`, lens));
const lensTags = $$(".lens__tags span", lens);
let lensTimer = 0;
let lensStep = 0;
function lensTick() {
  lensParts.forEach((p, i) => p.classList.toggle("is-lit", i <= lensStep && lensStep < 3));
  lensTags.forEach((t, i) => t.classList.toggle("is-lit", i <= lensStep && lensStep < 3));
  lensStep = (lensStep + 1) % 5;
  lensTimer = setTimeout(lensTick, lensStep === 0 ? 1400 : 900);
}
if (reduceMotion) { lensParts.forEach((p) => p.classList.add("is-lit")); lensTags.forEach((t) => t.classList.add("is-lit")); }
else watchVisible(lens, (on) => { clearTimeout(lensTimer); if (on) lensTick(); }, 0.3);

/* Anatomy ---------------------------------------------------------------------------------------------------------- */
const anat = $("[data-anat]");
$$(".ow", anat).forEach((w, i) => w.style.setProperty("--i", i));
$("[data-anat-switch]", anat).addEventListener("change", (e) => { anat.dataset.ocr = String(e.target.checked); });
// Pointing at a part, or at its line in the key, lights just that pair.
const pairs = $$("[data-key-part]", anat).map((li) => [li, $(`[data-part="${li.dataset.keyPart}"]`, anat)]);
pairs.forEach(([li, part]) => {
  const on = () => { anat.classList.add("is-hovering"); li.classList.add("is-lit"); part.classList.add("is-lit"); };
  const off = () => { anat.classList.remove("is-hovering"); li.classList.remove("is-lit"); part.classList.remove("is-lit"); };
  [li, part].forEach((el) => { el.addEventListener("pointerenter", on); el.addEventListener("pointerleave", off); });
});

/* Never read: a reading beam passes over the list and skips every one --------------------------------------------- */
const never = $("[data-never]");
const chips = $$(".nchip", never);
const field = $(".never__field", never);
let neverTimers = [];
function scanNever() {
  neverTimers.forEach(clearTimeout);
  neverTimers = [];
  chips.forEach((c) => c.classList.remove("is-skipped"));
  if (reduceMotion) { chips.forEach((c) => c.classList.add("is-skipped")); return; }
  never.classList.remove("is-scanning");
  void never.offsetWidth;
  never.classList.add("is-scanning");
  const fr = field.getBoundingClientRect();
  chips.forEach((c) => {
    const r = c.getBoundingClientRect();
    const t = ((r.left + r.width / 2 - fr.left) / fr.width) * 1700 + 300;
    neverTimers.push(setTimeout(() => c.classList.add("is-skipped"), t));
  });
}
let neverSeen = false;
watchVisible(field, (on) => { if (on && !neverSeen) { neverSeen = true; scanNever(); } }, 0.6);

/* Memory, for seconds --------------------------------------------------------------------------------------------- */
const mem = $("[data-mem]");
const M = { app: $("[data-mem-app]", mem), title: $("[data-mem-title]", mem), words: $("[data-mem-words]", mem), life: $("[data-mem-life]", mem), note: $("[data-mem-note]", mem), count: $("[data-mem-count]", mem) };
const WINDOWS = [
  { app: "Notes", title: "Calc homework", words: ["integral", "by parts", "u = x", "dv"], onTask: true },
  { app: "Preview", title: "textbook-ch3.pdf", words: ["chapter 3", "example", "eˣ", "substitution"], onTask: true },
  { app: "Browser", title: "Watch later", words: ["up next", "playlist", "autoplay"], onTask: false },
];
let memIdx = 0;
let memTimers = [];
let minutes = 0;
let lifeAnim = null;
function playMem() {
  memTimers.forEach(clearTimeout);
  memTimers = [];
  const w = WINDOWS[memIdx];
  swapText(M.app, w.app);
  swapText(M.title, w.title);
  M.note.textContent = "In memory";
  M.words.innerHTML = "";
  w.words.forEach((word, i) => memTimers.push(setTimeout(() => {
    const s = document.createElement("span");
    s.className = "w";
    s.textContent = word;
    M.words.append(s);
  }, 300 + i * 160)));
  if (reduceMotion) return;
  // The words live while the window does. When it changes they go, and only a count is kept.
  const life = 3600;
  lifeAnim?.cancel();
  lifeAnim = M.life.animate([{ transform: "scaleX(1)" }, { transform: "scaleX(0)" }], { duration: life, delay: 400, easing: "linear", fill: "both" });
  memTimers.push(setTimeout(() => {
    M.note.textContent = "Window changed. Dropped.";
    $$(".w", M.words).forEach((s, i) => { s.style.animationDelay = `${i * 50}ms`; s.classList.add("is-gone"); });
    if (w.onTask) { minutes += 4; M.count.textContent = String(minutes); }
  }, life + 400));
  memTimers.push(setTimeout(() => { memIdx = (memIdx + 1) % WINDOWS.length; playMem(); }, life + 1500));
}
watchVisible(mem, (on) => { if (on) playMem(); else { memTimers.forEach(clearTimeout); lifeAnim?.pause(); } }, 0.4);

/* Names: a fog bank under the two nudges ------------------------------------------------------------------------- */
skyArt($(".names__art"), "wanderer", {
  place: (img, W, H) => fit(img, { x: -W * 0.1, y: -H * 0.2, w: W * 1.2, h: H * 1.4 }, "cover", 0.5, 0.5),
  mask: (x, y, W, H) => smooth(H * 0.52, H * 0.95, y) * 0.75,
  origin: (W, H) => ({ x: W * 0.5, y: H }),
}).catch(quiet);

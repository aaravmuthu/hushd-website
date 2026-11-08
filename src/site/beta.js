// Beta: type an invite code, and a glass printer prints a beta pass with the license key on it.
//
// Motion, in order: the code is checked (spinner, at least ~0.9 s so it reads), the ring turns into a check and a
// burst of halftone dots and a ring ring out from it, the slot lights, and the pass feeds out line by line with the
// printer humming, then it tears off and settles with a small tilt. All of it is transform and opacity.
import { applyRelease } from "./release.js";
import { $, reduceMotion, skyArt, smooth, quiet, fit, swapText } from "./site.js";

const STORE = "hushd.betaPass";
const MIN_CHECK_MS = 900;

const loadPass = () => {
  try {
    const p = JSON.parse(localStorage.getItem(STORE) || "null");
    return p && typeof p.key === "string" ? p : null;
  } catch {
    return null;
  }
};
const savePass = (p) => {
  try { localStorage.setItem(STORE, JSON.stringify(p)); } catch { /* private mode: the pass still shows now */ }
};

// "HUSHD-ABCDE-…" with a soft break after each dash, so a narrow pass wraps the key between groups.
const keyHtml = (key) => key.replace(/[&<]/g, "").split("-").join("-<wbr>");

const fmtDate = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const day = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${day} · ${time}`;
};

// A barcode drawn from the key itself: every character becomes a run of thin and thick bars.
function barcode(svg, key) {
  const bars = [];
  let x = 4;
  const add = (w) => { bars.push(`<rect x="${x.toFixed(2)}" y="0" width="${w.toFixed(2)}" height="38"/>`); };
  const chars = key.replace(/-/g, "");
  for (let i = 0; i < chars.length && x < 194; i++) {
    const c = chars.charCodeAt(i);
    for (let b = 0; b < 3 && x < 194; b++) {
      const w = 0.9 + ((c >> b) & 1) * 1.5 + ((c >> (b + 3)) & 1) * 0.6;
      add(w);
      x += w + 1 + ((c >> (b + 1)) & 1) * 1.2;
    }
  }
  svg.innerHTML = bars.join("");
}

export function mount(page) {
  const { setTimeout } = page.api;
  applyRelease(document);

  skyArt($(".subhero__art"), "wanderer", {
    place: (img, W, H) => fit(img, { x: 0, y: -H * 0.06, w: W, h: H * 1.12 }, "cover", 0.42, 0.4),
    // Keep the middle calm, where the headline, the printer and the pass sit. Phones are all middle, so softer still.
    mask: (x, y, W, H) => {
      const mid = Math.abs(x - W / 2) / (W / 2);
      return (W < 700 ? 0.32 : 1) * (0.22 + 0.78 * smooth(0.28, 0.86, mid));
    },
    origin: (W, H) => ({ x: W * 0.5, y: H * 0.55 }),
  }).catch(quiet);

  const printer = $("[data-printer]");
  const body = $(".printer__body", printer);
  const form = $("[data-form]", printer);
  const input = $("[data-code]", printer);
  const go = $("[data-go]", printer);
  const statusText = $("[data-status-text]", printer);
  const hint = $("[data-hint-line]", printer);
  const burst = $("[data-burst]", printer);
  const receipt = $("[data-receipt]", printer);
  const again = $("[data-again]", printer);
  const copyBtn = $("[data-copy]", printer);
  const copyLabel = $("[data-copy-label]", printer);
  const title = $("[data-beta-title]");
  const sub = $("[data-beta-sub]");
  const HINT = hint.textContent;

  let pass = null;
  let busy = false;
  const running = new Set();
  const play = (el, frames, opts) => {
    const a = el.animate(frames, opts);
    running.add(a);
    a.finished.catch(quiet).finally(() => running.delete(a));
    return a;
  };
  page.add(() => running.forEach((a) => a.cancel()));

  const setState = (s) => { printer.dataset.state = s; };
  const setHint = (text, error = false) => {
    hint.classList.toggle("is-error", error);
    swapText(hint, text);
  };

  function fill(p) {
    $("[data-key]", receipt).innerHTML = keyHtml(p.key);
    $("[data-hint]", receipt).textContent = `#${p.key_hint}`;
    $("[data-date]", receipt).textContent = fmtDate(p.issued_at);
    barcode($("[data-barcode]", receipt), p.key);
  }

  function unlockedCopy() {
    swapText(title, "You’re in.");
    swapText(sub, "Your beta pass is below. Keep the key somewhere safe, Hushd asks for it.");
  }

  /* The moment: check, burst, print, tear ------------------------------------------------------------------------- */
  function ringOut() {
    const icon = $(".printer__icon", printer).getBoundingClientRect();
    const box = body.getBoundingClientRect();
    burst.style.left = `${icon.left - box.left + icon.width / 2}px`;
    burst.style.top = `${icon.top - box.top + icon.height / 2}px`;
    burst.innerHTML = "<b></b>" + "<i></i>".repeat(16);
    play(burst.firstChild, [
      { opacity: 0.9, transform: "scale(0.5)" },
      { opacity: 0, transform: "scale(3.2)" },
    ], { duration: 820, easing: "cubic-bezier(0.23, 1, 0.32, 1)", fill: "forwards" });
    [...burst.querySelectorAll("i")].forEach((dot, i) => {
      const a = (i / 16) * Math.PI * 2 + (i % 2) * 0.2;
      const r = 34 + (i % 3) * 16;
      const s = 0.6 + (i % 4) * 0.25;
      play(dot, [
        { opacity: 0, transform: "translate(0,0) scale(0.4)" },
        { opacity: 1, transform: `translate(${Math.cos(a) * r * 0.55}px, ${Math.sin(a) * r * 0.55}px) scale(${s})`, offset: 0.35 },
        { opacity: 0, transform: `translate(${Math.cos(a) * r}px, ${Math.sin(a) * r + 6}px) scale(0.2)` },
      ], { duration: 760 + (i % 5) * 60, delay: (i % 4) * 18, easing: "cubic-bezier(0.23, 1, 0.32, 1)", fill: "forwards" });
    });
    // A small thunk: the printer takes the job.
    play(body, [
      { transform: "scale(1)" },
      { transform: "scale(1.018)", offset: 0.3 },
      { transform: "scale(0.996)", offset: 0.65 },
      { transform: "scale(1)" },
    ], { duration: 520, easing: "ease-out" });
  }

  function print({ scroll = true } = {}) {
    printer.classList.add("has-pass");
    printer.classList.remove("is-out", "is-still");
    receipt.style.transform = "";
    again.hidden = true;
    if (reduceMotion) {
      printer.classList.add("is-still", "is-out");
      again.hidden = false;
      return Promise.resolve();
    }
    if (scroll) {
      const r = printer.getBoundingClientRect();
      if (r.bottom + 420 > innerHeight) scrollBy({ top: Math.min(r.bottom + 460 - innerHeight, r.top - 90), behavior: "smooth" });
    }
    printer.classList.add("is-printing");
    // The feed: a thermal printer pushes paper in short runs with tiny stops between lines.
    const feed = play(receipt, [
      { transform: "translateY(-101%)", offset: 0 },
      { transform: "translateY(-90%)", offset: 0.1 },
      { transform: "translateY(-88.5%)", offset: 0.15 },
      { transform: "translateY(-70%)", offset: 0.31 },
      { transform: "translateY(-68.5%)", offset: 0.36 },
      { transform: "translateY(-46%)", offset: 0.54 },
      { transform: "translateY(-44.5%)", offset: 0.59 },
      { transform: "translateY(-20%)", offset: 0.79 },
      { transform: "translateY(-18.5%)", offset: 0.84 },
      { transform: "translateY(0%)", offset: 1 },
    ], { duration: 2500, easing: "cubic-bezier(0.45, 0, 0.3, 1)", fill: "forwards" });
    // The printer hums while it feeds: a sub-pixel shiver, nothing you'd call a shake.
    const hum = play(body, [
      { transform: "translateY(0)" }, { transform: "translateY(0.6px)" }, { transform: "translateY(-0.4px)" }, { transform: "translateY(0)" },
    ], { duration: 120, iterations: Math.round(2500 / 120) });
    return feed.finished.then(() => {
      hum.cancel();
      printer.classList.remove("is-printing");
      printer.classList.add("is-out");
      // Torn off: it drops a touch and tilts, on the site's small-overshoot curve.
      const tear = play(receipt, [
        { transform: "translateY(0) rotate(0deg)" },
        { transform: "translateY(12px) rotate(-2deg)", offset: 0.55 },
        { transform: "translateY(8px) rotate(-1.2deg)" },
      ], { duration: 700, easing: "cubic-bezier(0.32, 1.22, 0.36, 1)", fill: "forwards" });
      return tear.finished.then(() => { again.hidden = false; });
    }).catch(quiet);
  }

  function shake() {
    if (reduceMotion) return;
    play(body, [
      { transform: "translateX(0)" }, { transform: "translateX(-9px)" }, { transform: "translateX(7px)" },
      { transform: "translateX(-4px)" }, { transform: "translateX(2px)" }, { transform: "translateX(0)" },
    ], { duration: 440, easing: "cubic-bezier(0.23, 1, 0.32, 1)" });
  }

  /* Redeem ---------------------------------------------------------------------------------------------------------- */
  async function redeem(code) {
    const started = performance.now();
    let res;
    let data = null;
    try {
      res = await fetch("/api/beta/redeem", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      data = await res.json().catch(() => null);
    } catch {
      data = { ok: false, message: "Couldn't reach Hushd. Check your connection and try again." };
    }
    const wait = MIN_CHECK_MS - (performance.now() - started);
    if (wait > 0 && !reduceMotion) await new Promise((r) => setTimeout(r, wait));
    return data || { ok: false, message: "Couldn't check codes right now. Try again in a minute." };
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy) return;
    const code = input.value.trim();
    if (!code) {
      setHint("Type the code you were given.", true);
      shake();
      input.focus();
      return;
    }
    busy = true;
    go.disabled = true;
    statusText.textContent = "Checking your code";
    setState("checking");
    setHint(HINT);

    const data = await redeem(code);
    if (!page.alive) return;

    if (!data.ok || !data.license) {
      busy = false;
      go.disabled = false;
      setState("error");
      setHint(data.message || "That code didn't work.", true);
      shake();
      input.select();
      input.focus();
      return;
    }

    pass = data.license;
    savePass(pass);
    fill(pass);
    statusText.textContent = "Beta unlocked";
    setState("done");
    setHint(`Pass #${pass.key_hint} is printing…`);
    unlockedCopy();
    if (!reduceMotion) ringOut();
    setTimeout(() => {
      print().then(() => {
        if (!page.alive) return;
        setHint(`Printed pass #${pass.key_hint}. This browser keeps a copy.`);
        receipt.focus({ preventScroll: true });
        busy = false;
      });
    }, reduceMotion ? 0 : 420);
  });

  input.addEventListener("input", () => {
    if (printer.dataset.state === "error") { setState("idle"); setHint(HINT); }
  });

  copyBtn.addEventListener("click", async () => {
    if (!pass) return;
    try {
      await navigator.clipboard.writeText(pass.key);
      copyLabel.textContent = "Copied";
    } catch {
      // Clipboard blocked: select the key so ⌘C works.
      const range = document.createRange();
      range.selectNodeContents($("[data-key]", receipt));
      getSelection()?.removeAllRanges();
      getSelection()?.addRange(range);
      copyLabel.textContent = "Press ⌘C";
    }
    setTimeout(() => { copyLabel.textContent = "Copy key"; }, 1800);
  });

  again.addEventListener("click", () => {
    if (!pass || busy) return;
    busy = true;
    if (!reduceMotion) ringOut();
    print({ scroll: false }).then(() => { busy = false; });
  });

  /* Back again: the pass this browser already printed is waiting, already torn off. ------------------------------ */
  const saved = loadPass();
  if (saved) {
    pass = saved;
    fill(pass);
    statusText.textContent = "Beta unlocked";
    setState("done");
    title.textContent = "You’re in.";
    sub.textContent = "Your beta pass is below. Keep the key somewhere safe, Hushd asks for it.";
    hint.textContent = `Pass #${pass.key_hint}. This browser kept your copy.`;
    printer.classList.add("has-pass", "is-out", "is-still");
    receipt.style.transform = "translateY(8px) rotate(-1.2deg)";
    again.hidden = false;
  }
}

// Head shared by every Hushd page: metadata, the two stylesheets, and the script that runs before first paint.
import hushdCss from "./hushd.css?url";
import pagesCss from "./pages.css?url";

const ICON = "https://focus-mac.lovable.app/media/app/icon.png";

// Before first paint: hide reveals for JS, and if we came here from another page of this site, start the notch open.
// If the page script never runs (a load error), the failsafe shows everything after 3 s.
const PRE_PAINT = `// Before first paint: hide reveals for JS, and if we came here from another page of this site, start the notch open.
// If site.js never runs (a load error), the failsafe shows everything after 3 s.
(function () {
  var d = document.documentElement;
  d.classList.add("js");
  // A prerendered page runs this while the pointer is still hovering the link on the last page, before the click
  // has left its note, so it waits until the page is actually shown.
  function arrive() {
    try {
      var t = +sessionStorage.getItem("hushd-nav");
      sessionStorage.removeItem("hushd-nav");
      var n = performance.getEntriesByType("navigation")[0];
      if (t && Date.now() - t < 5000 && (!n || n.type === "navigate") && !matchMedia("(prefers-reduced-motion: reduce)").matches) d.classList.add("notch-arrive", "from-site");
    } catch (e) {}
  }
  if (document.prerendering) document.addEventListener("prerenderingchange", arrive, { once: true }); else arrive();
  // Settles once the page is on screen and any view transition into it has finished; the notch tucks after that.
  window.__hushdShown = new Promise(function (done) {
    if (!("onpagereveal" in window)) return done();
    addEventListener("pagereveal", function (e) { e.viewTransition ? e.viewTransition.finished.then(done, done) : done(); }, { once: true });
    setTimeout(done, 1500);
  });
  // The tuck runs from here rather than from the page scripts, which load only after hydration and would leave the
  // notch hanging open for most of a second. A small spring (response 0.3, damping 0.88) closes it.
  window.__hushdShown.then(function () {
    setTimeout(function tuck() {
      if (!d.classList.contains("notch-arrive")) return;
      var pill = document.querySelector(".nav__pill");
      if (!pill) return setTimeout(tuck, 16);
      var a = pill.getBoundingClientRect(), ar = parseFloat(getComputedStyle(pill).borderBottomLeftRadius) || 34;
      d.classList.add("notch-arrived");
      d.classList.remove("notch-arrive");
      var b = pill.getBoundingClientRect(), br = parseFloat(getComputedStyle(pill).borderBottomLeftRadius) || 24;
      pill.dataset.notch = "closing";
      var k = Math.pow((2 * Math.PI) / 0.3, 2), c = (4 * Math.PI * 0.88) / 0.3, h = 1 / 240;
      var s = [[a.width, b.width, 0], [a.height, b.height, 0], [ar, br, 0]], last = performance.now();
      var paint = function () {
        pill.style.width = s[0][0].toFixed(2) + "px";
        pill.style.height = s[1][0].toFixed(2) + "px";
        pill.style.borderBottomLeftRadius = pill.style.borderBottomRightRadius = s[2][0].toFixed(2) + "px";
      };
      paint();
      requestAnimationFrame(function step(now) {
        if (d.classList.contains("notch-leave")) return; // a press on another link took over
        var dt = Math.min(0.05, (now - last) / 1000), moving = false;
        last = now;
        for (var i = 0; i < 3; i++) {
          var p = s[i];
          for (var t = 0; t < dt; t += h) { p[2] += (-k * (p[0] - p[1]) - c * p[2]) * h; p[0] += p[2] * h; }
          if (Math.abs(p[0] - p[1]) > 0.05 || Math.abs(p[2]) > 0.05) moving = true;
        }
        if (moving) { paint(); requestAnimationFrame(step); return; }
        pill.style.width = pill.style.height = pill.style.borderBottomLeftRadius = pill.style.borderBottomRightRadius = "";
        dispatchEvent(new Event("hushd:tucked"));
        setTimeout(function () { if (pill.dataset.notch === "closing") delete pill.dataset.notch; }, 300);
      });
    }, 30);
  });
  setTimeout(function () { if (!window.__hushd) d.classList.remove("js", "notch-arrive"); }, 3000);
})();`;

export function pageHead({ title, description }: { title: string; description: string }) {
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { name: "theme-color", content: "#135e3d" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:image", content: ICON },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:image", content: ICON },
    ],
    links: [
      { rel: "icon", href: "/media/app/icon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" as const },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" },
      { rel: "stylesheet", href: hushdCss },
      { rel: "stylesheet", href: pagesCss },
    ],
    scripts: [{ children: PRE_PAINT }],
  };
}

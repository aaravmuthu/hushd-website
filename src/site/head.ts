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
  try {
    var t = +sessionStorage.getItem("hushd-nav");
    sessionStorage.removeItem("hushd-nav");
    var n = performance.getEntriesByType("navigation")[0];
    if (t && Date.now() - t < 5000 && (!n || n.type === "navigate") && !matchMedia("(prefers-reduced-motion: reduce)").matches) d.classList.add("notch-arrive");
  } catch (e) {}
  // Settles once the page is on screen and any view transition into it has finished; the notch tucks after that.
  window.__hushdShown = new Promise(function (done) {
    if (!("onpagereveal" in window)) return done();
    addEventListener("pagereveal", function (e) { e.viewTransition ? e.viewTransition.finished.then(done, done) : done(); }, { once: true });
    setTimeout(done, 1500);
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

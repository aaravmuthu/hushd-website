// The nav is the notch: black at the screen edge, glass at the bottom. It lives in the root layout, so it stays on
// screen while pages swap underneath it, and it opens on the page name when you go somewhere.

// Each page's card: the name and line the notch shows when you arrive there (or are heading there).
export const CARDS = {
  "/": ["Hushd", "Notice the drift. Come back gently."],
  "/how-it-works": ["How it works", "Five steps, and it leans quiet."],
  "/features": ["Features", "Everything it does, quietly."],
  "/privacy": ["Privacy", "What it reads, and what it leaves alone."],
  "/download": ["Download", "The beta for Mac."],
  "/beta": ["Beta", "Unlock it with your invite code."],
  "/terms": ["Terms", "The plain rules of the beta."],
};

const LINKS = [
  ["/how-it-works", "How it works"],
  ["/features", "Features"],
  ["/privacy", "Privacy"],
  ["/download#faq", "FAQ"],
];

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const cur = (path, href) => (href === path ? ' aria-current="page"' : "");

// Rendered on the server for the first page, so the card is right before the first paint.
export function navHtml(path) {
  const [name, line] = CARDS[path] || CARDS["/"];
  return `<a class="skip" href="#main">Skip to content</a>
<header class="nav">
  <span class="nav__edge" aria-hidden="true"></span>
  <nav class="nav__pill" aria-label="Main">
    <a class="nav__logo" href="/" aria-label="Hushd home" style="--i:0">
      <img src="/media/app/icon.png" alt="" width="26" height="26">
      <span>Hushd</span>
    </a>
    <div class="nav__links" id="nav-links" style="--i:1">
      <span class="nav__thumb" aria-hidden="true"></span>
      ${LINKS.map(([href, label]) => `<a class="nav__link" href="${href}"${cur(path, href)}>${label}</a>`).join("\n      ")}
    </div>
    <a class="btn btn--nav" href="/download"${cur(path, "/download")} style="--i:2">Download</a>
    <button class="nav__menu" type="button" aria-label="Menu" aria-expanded="false" aria-controls="nav-links" style="--i:2"><span></span><span></span></button>
    <div class="nav__card" aria-hidden="true">
      <svg class="ring ring--big" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></svg>
      <div><strong>${esc(name)}</strong><span>${esc(line)}</span></div>
    </div>
  </nav>
</header>`;
}

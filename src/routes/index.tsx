import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

import bodyHtml from "../site/body.html?raw";
import focusCss from "../site/focus.css?url";

const title = "Focus. Gentle focus for your Mac";
const description =
  "Tell Focus what you are working on. An on-device AI compares the window in front with it, and nudges you gently when you drift. No account, no cloud.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { name: "theme-color", content: "#135e3d" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "/media/app/icon.png" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" },
      { rel: "stylesheet", href: focusCss },
    ],
    // Reveal styles hide content only once this class is set, so the page still reads without JavaScript.
    scripts: [{ children: 'document.documentElement.classList.add("js")' }],
  }),
  component: Index,
});

function Index() {
  // The page's motion (halftone art, notch demo, carousel, word scroll) is plain DOM code that runs in the browser only.
  useEffect(() => {
    void import("../site/main.js");
  }, []);

  return <div className="focus-site" dangerouslySetInnerHTML={{ __html: bodyHtml }} />;
}

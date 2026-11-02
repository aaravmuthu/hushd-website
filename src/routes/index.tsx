import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

import body from "../site/home.body.html?raw";
import { pageHead } from "../site/head";

export const Route = createFileRoute("/")({
  head: () =>
    pageHead({
      title: "Hushd. Gentle focus for your Mac",
      description: "Tell Hushd what you are working on. An on-device AI compares the window in front with it, and nudges you gently when you drift. No account, no cloud.",
    }),
  component: HomePage,
});

function HomePage() {
  // The page's motion is plain DOM code that runs in the browser only, after the markup is in the document.
  useEffect(() => {
    void import("../site/home.js");
  }, []);

  return <div className="hushd-site" dangerouslySetInnerHTML={{ __html: body }} />;
}

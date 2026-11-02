import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

import body from "../site/how.body.html?raw";
import { pageHead } from "../site/head";

export const Route = createFileRoute("/how-it-works")({
  head: () =>
    pageHead({
      title: "How Hushd decides",
      description: "Hushd reads the window in front, compares it with your task, waits for two checks to agree and the drift to last, then nudges gently. Not sure does nothing.",
    }),
  component: HowPage,
});

function HowPage() {
  // The page's motion is plain DOM code that runs in the browser only, after the markup is in the document.
  useEffect(() => {
    void import("../site/how.js");
  }, []);

  return <div className="hushd-site" dangerouslySetInnerHTML={{ __html: body }} />;
}

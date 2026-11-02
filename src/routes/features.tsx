import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

import body from "../site/features.body.html?raw";
import { pageHead } from "../site/head";

export const Route = createFileRoute("/features")({
  head: () =>
    pageHead({
      title: "Hushd features",
      description: "A ring in the notch, projects that remember, a tray for your files, one keypress to start, and screen reading if you want it.",
    }),
  component: FeaturesPage,
});

function FeaturesPage() {
  // The page's motion is plain DOM code that runs in the browser only, after the markup is in the document.
  useEffect(() => {
    void import("../site/features.js");
  }, []);

  return <div className="hushd-site" dangerouslySetInnerHTML={{ __html: body }} />;
}

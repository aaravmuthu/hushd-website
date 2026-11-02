import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

import body from "../site/privacy.body.html?raw";
import { pageHead } from "../site/head";

export const Route = createFileRoute("/privacy")({
  head: () =>
    pageHead({
      title: "Hushd and your privacy",
      description: "What Hushd reads, and what it leaves alone. No account, no cloud model, no analytics. Screen words stay in memory for seconds.",
    }),
  component: PrivacyPage,
});

function PrivacyPage() {
  // The page's motion is plain DOM code that runs in the browser only, after the markup is in the document.
  useEffect(() => {
    void import("../site/privacy.js");
  }, []);

  return <div className="hushd-site" dangerouslySetInnerHTML={{ __html: body }} />;
}

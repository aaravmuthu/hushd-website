import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

import body from "../site/download.body.html?raw";
import { pageHead } from "../site/head";

export const Route = createFileRoute("/download")({
  head: () =>
    pageHead({
      title: "Download the Hushd beta",
      description: "Hushd for Mac is in public beta. Needs Apple silicon and Apple Intelligence. Install in five steps, then tell us what it got wrong.",
    }),
  component: DownloadPage,
});

function DownloadPage() {
  // The page's motion is plain DOM code that runs in the browser only, after the markup is in the document.
  useEffect(() => {
    void import("../site/download.js");
  }, []);

  return <div className="hushd-site" dangerouslySetInnerHTML={{ __html: body }} />;
}

import { createFileRoute } from "@tanstack/react-router";

import body from "../site/download.body.html?raw";
import { pageHead } from "../site/head";
import { usePage } from "../site/use-page";

export const Route = createFileRoute("/download")({
  head: () =>
    pageHead({
      title: "Download the Hushd beta",
      description: "Hushd for Mac is in public beta. Needs Apple silicon and Apple Intelligence. Install in five steps, then tell us what it got wrong.",
    }),
  component: DownloadPage,
});

function DownloadPage() {
  // The page's motion is plain DOM code; it runs in the browser once the markup is in, and stops when the page leaves.
  const ref = usePage("/download", body);

  return <div ref={ref} className="hushd-site" dangerouslySetInnerHTML={{ __html: body }} />;
}

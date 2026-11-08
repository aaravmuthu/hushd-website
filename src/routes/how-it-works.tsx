import { createFileRoute } from "@tanstack/react-router";

import body from "../site/how.body.html?raw";
import { pageHead } from "../site/head";
import { usePage } from "../site/use-page";

export const Route = createFileRoute("/how-it-works")({
  head: () =>
    pageHead({
      title: "How Hushd decides",
      description: "Hushd reads the window in front, compares it with your task, waits for two checks to agree and the drift to last, then nudges gently. Not sure does nothing.",
    }),
  component: HowPage,
});

function HowPage() {
  // The page's motion is plain DOM code; it runs in the browser once the markup is in, and stops when the page leaves.
  const ref = usePage("/how-it-works", body);

  return <div ref={ref} className="hushd-site" dangerouslySetInnerHTML={{ __html: body }} />;
}

import { createFileRoute } from "@tanstack/react-router";

import body from "../site/home.body.html?raw";
import { pageHead } from "../site/head";
import { usePage } from "../site/use-page";

export const Route = createFileRoute("/")({
  head: () =>
    pageHead({
      title: "Hushd. Gentle focus for your Mac",
      description: "Tell Hushd what you are working on. An on-device AI compares the window in front with it, and nudges you gently when you drift. No account, no cloud.",
    }),
  component: HomePage,
});

function HomePage() {
  // The page's motion is plain DOM code; it runs in the browser once the markup is in, and stops when the page leaves.
  const ref = usePage("/", body);

  return <div ref={ref} className="hushd-site" dangerouslySetInnerHTML={{ __html: body }} />;
}

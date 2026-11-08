import { createFileRoute } from "@tanstack/react-router";

import body from "../site/privacy.body.html?raw";
import { pageHead } from "../site/head";
import { usePage } from "../site/use-page";

export const Route = createFileRoute("/privacy")({
  head: () =>
    pageHead({
      title: "Hushd and your privacy",
      description: "What Hushd reads, and what it leaves alone. No account, no cloud model, no analytics. Screen words stay in memory for seconds.",
    }),
  component: PrivacyPage,
});

function PrivacyPage() {
  // The page's motion is plain DOM code; it runs in the browser once the markup is in, and stops when the page leaves.
  const ref = usePage("/privacy", body);

  return <div ref={ref} className="hushd-site" dangerouslySetInnerHTML={{ __html: body }} />;
}

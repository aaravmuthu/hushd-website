import { createFileRoute } from "@tanstack/react-router";

import body from "../site/beta.body.html?raw";
import { pageHead } from "../site/head";
import { usePage } from "../site/use-page";

export const Route = createFileRoute("/beta")({
  head: () =>
    pageHead({
      title: "Unlock the Hushd beta",
      description: "Hushd for Mac is invite only while it's in beta. Type your invite code and your beta pass, with your license key, prints right on the page.",
    }),
  component: BetaPage,
});

function BetaPage() {
  // The printer and its pass are plain DOM code; they run in the browser once the markup is in, and stop when the page leaves.
  const ref = usePage("/beta", body);

  return <div ref={ref} className="hushd-site" dangerouslySetInnerHTML={{ __html: body }} />;
}

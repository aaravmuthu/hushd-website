import { createFileRoute } from "@tanstack/react-router";

import body from "../site/features.body.html?raw";
import { pageHead } from "../site/head";
import { usePage } from "../site/use-page";

export const Route = createFileRoute("/features")({
  head: () =>
    pageHead({
      title: "Hushd features",
      description: "A ring in the notch, projects that remember, a tray for your files, one keypress to start, and screen reading if you want it.",
    }),
  component: FeaturesPage,
});

function FeaturesPage() {
  // The page's motion is plain DOM code; it runs in the browser once the markup is in, and stops when the page leaves.
  const ref = usePage("/features", body);

  return <div ref={ref} className="hushd-site" dangerouslySetInnerHTML={{ __html: body }} />;
}

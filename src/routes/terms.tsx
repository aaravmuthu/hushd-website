import { createFileRoute } from "@tanstack/react-router";

import body from "../site/terms.body.html?raw";
import { pageHead } from "../site/head";
import { fillOwner } from "../site/owner";
import { usePage } from "../site/use-page";

const html = fillOwner(body);

export const Route = createFileRoute("/terms")({
  head: () =>
    pageHead({
      title: "Hushd beta terms",
      description: "The plain rules for the free Hushd beta for Mac: what a key allows, what we keep, and how to leave.",
    }),
  component: TermsPage,
});

function TermsPage() {
  const ref = usePage("/terms", html);

  return <div ref={ref} className="hushd-site" dangerouslySetInnerHTML={{ __html: html }} />;
}

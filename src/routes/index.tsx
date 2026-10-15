import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Focus" },
      { name: "description", content: "Focus — a minimal blank project." },
      { property: "og:title", content: "Focus" },
      { property: "og:description", content: "Focus — a minimal blank project." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="focus-page">
      <h1>Focus</h1>
    </main>
  );
}

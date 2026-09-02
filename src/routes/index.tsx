import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Gestión de Bobinas (CQ)" },
      { name: "description", content: "Sistema de gestión de bobinas." },
      { property: "og:title", content: "Gestión de Bobinas (CQ)" },
      { property: "og:description", content: "Sistema de gestión de bobinas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function Index() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
        Gestión de Bobinas (CQ)
      </h1>
      <p className="max-w-md text-lg text-muted-foreground">
        Sistema en construcción para el control y administración de bobinas.
      </p>
    </main>
  );
}

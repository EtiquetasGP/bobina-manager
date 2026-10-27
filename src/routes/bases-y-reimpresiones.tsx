import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/bases-y-reimpresiones")({
  component: BasesYReimpresiones,
  head: () => ({ meta: [{ title: "Bases y reimpresiones | Coquimbito" }] }),
});

function BasesYReimpresiones() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Menú principal
      </Link>
      <h1 className="mt-6 text-3xl font-bold tracking-tight">Bases y reimpresiones</h1>
    </main>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { PackagePlus, Undo2, Search, ClipboardList, Boxes } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Gestión de Bobinas - Coquimbito" },
      {
        name: "description",
        content:
          "Menú operativo de gestión de bobinas en planta Coquimbito: recepción, devolución, consulta, inventario y picking.",
      },
      { property: "og:title", content: "Gestión de Bobinas - Coquimbito" },
      {
        property: "og:description",
        content: "Menú operativo de gestión de bobinas en planta Coquimbito.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const acciones = [
  { label: "RECEPCIÓN", icon: PackagePlus, to: "/recepcion" as const, activo: true },
  { label: "DEVOLUCIÓN", icon: Undo2, to: "/devolucion" as const, activo: true },
  { label: "CONSULTAR BOBINA", icon: Search, to: "/consultar-bobina" as const, activo: true },
  { label: "INVENTARIO", icon: ClipboardList, to: "/inventario" as const, activo: true },
  { label: "PICKING", icon: Boxes, activo: false },
];

function Index() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-10">
      <header className="mb-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Gestión de Bobinas — Coquimbito
        </h1>
        <p className="mt-2 text-base text-muted-foreground">Seleccione una operación</p>
      </header>

      <div className="grid gap-5 sm:grid-cols-2">
        {acciones.map(({ label, icon: Icon, to, activo }) => {
          const contenido = (
            <>
              <Icon className="size-9 shrink-0" aria-hidden="true" />
              <span className="flex-1 text-left text-2xl font-semibold">{label}</span>
              {!activo && (
                <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium uppercase text-muted-foreground">
                  Próximamente
                </span>
              )}
            </>
          );

          return activo && to ? (
            <Link
              key={label}
              to={to}
              className="flex items-center gap-4 rounded-xl bg-primary px-6 py-8 text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 sm:col-span-2"
            >
              {contenido}
            </Link>
          ) : (
            <div
              key={label}
              aria-disabled="true"
              className="flex cursor-not-allowed items-center gap-4 rounded-xl border border-border bg-card px-6 py-8 text-muted-foreground"
            >
              {contenido}
            </div>
          );
        })}
      </div>
    </main>
  );
}

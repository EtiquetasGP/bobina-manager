import { createFileRoute, Link } from "@tanstack/react-router";
import {
  PackagePlus,
  Undo2,
  Search,
  ClipboardList,
  Boxes,
  Printer,
  ArrowUpRight,
  Layers3,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "ALMACÉN DE ETIQUETAS | Coquimbito" },
      { name: "description", content: "Sistema interno del Almacén de Etiquetas en Coquimbito." },
    ],
  }),
});

const acciones = [
  { label: "Recepción", icon: PackagePlus, to: "/recepcion" as const, color: "sky" },
  { label: "Devolución", icon: Undo2, to: "/devolucion" as const, color: "teal" },
  { label: "Consultar bobina", icon: Search, to: "/consultar-bobina" as const, color: "indigo" },
  { label: "Inventario", icon: ClipboardList, to: "/inventario" as const, color: "amber" },
  { label: "Picking", icon: Boxes, to: "/picking" as const, color: "violet" },
  {
    label: "Bases y reimpresiones",
    icon: Printer,
    to: "/bases-y-reimpresiones" as const,
    color: "slate",
  },
];

function Index() {
  return (
    <main className="home-screen mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <header className="home-heading">
        <div className="home-brand-icon">
          <Layers3 size={25} aria-hidden="true" />
        </div>
        <div>
          <p className="home-eyebrow">Coquimbito</p>
          <h1>ALMACÉN DE ETIQUETAS</h1>
        </div>
      </header>

      <div className="home-section-heading">
        <h2>Operaciones</h2>
      </div>

      <div className="home-grid">
        {acciones.map(({ label, icon: Icon, to, color }) => (
          <Link key={label} to={to} className="home-card">
            <span className={"home-card-icon home-card-icon--" + color}>
              <Icon size={26} aria-hidden="true" />
            </span>
            <span className="home-card-title">{label}</span>
            <ArrowUpRight className="home-card-arrow" size={20} aria-hidden="true" />
          </Link>
        ))}
      </div>
    </main>
  );
}

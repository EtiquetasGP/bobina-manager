import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Plus, Search, Package, Truck, Clock, X } from "lucide-react";

export const Route = createFileRoute("/bases-y-reimpresiones")({
  component: BasesYReimpresiones,
  head: () => ({ meta: [{ title: "Bases y reimpresiones | Coquimbito" }] }),
});

type Pedido = {
  id: string;
  base: string;
  descripcion: string;
  final: string;
  proveedor: string; planta: string; cantidad: number; enviada: number;
  fecha: string; prioridad: string; observaciones: string;
};
const ejemplos: Pedido[] = [
  { id: "DEMO-001", base: "BASE-EJEMPLO-01", descripcion: "Contraetiqueta genérica Malbec", final: "FINAL-EJEMPLO-01", proveedor: "Stampa", planta: "Coquimbito", cantidad: 6000, enviada: 0, fecha: "2026-11-05", prioridad: "Normal", observaciones: "Agregar los datos de la reimpresión solicitada." },
  { id: "DEMO-002", base: "BASE-EJEMPLO-02", descripcion: "Frente genérico", final: "FINAL-EJEMPLO-02", proveedor: "Etiprint", planta: "Coquimbito", cantidad: 10000, enviada: 4000, fecha: "2026-11-06", prioridad: "Urgente", observaciones: "Ejemplo de un pedido con envío parcial." },
  { id: "DEMO-003", base: "BASE-EJEMPLO-03", descripcion: "Contraetiqueta genérica", final: "", proveedor: "Grupo Impresores", planta: "Coquimbito", cantidad: 5000, enviada: 5000, fecha: "2026-11-09", prioridad: "Normal", observaciones: "" },
];
const numero = (n: number) => n.toLocaleString("es-AR");
const estado = (p: Pedido) => p.enviada >= p.cantidad ? "Enviado" : p.enviada > 0 ? "Envío parcial" : "Pendiente";
const fechaVisible = (fecha: string) => fecha.split("-").reverse().join("/");
const campo = "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500";
const boton = "rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium hover:bg-slate-50";

function BasesYReimpresiones() {
  const [pedidos, setPedidos] = useState<Pedido[]>(ejemplos);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState("Todos");
  const [proveedor, setProveedor] = useState("Todos");
  const [nuevo, setNuevo] = useState(false);
  const [detalle, setDetalle] = useState<Pedido | null>(null);
  const visibles = pedidos.filter(p => {
    const texto = [p.id, p.base, p.descripcion, p.final, p.proveedor].join(" ").toLowerCase();
    return texto.includes(busqueda.toLowerCase()) && (filtro === "Todos" || estado(p) === filtro) && (proveedor === "Todos" || p.proveedor === proveedor);
  });
  function agregar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const valor = (nombre: string) => String(form.get(nombre) ?? "").trim();
    const cantidad = Number(valor("cantidad"));
    if (!valor("base") || !valor("proveedor") || !valor("planta") || !Number.isSafeInteger(cantidad) || cantidad <= 0) return;
    setPedidos(prev => [{
      id: "DEMO-" + String(prev.length + 1).padStart(3, "0"),
      base: valor("base"), descripcion: valor("descripcion"), final: valor("final"),
      proveedor: valor("proveedor"), planta: valor("planta"), cantidad, enviada: 0,
      fecha: valor("fecha"), prioridad: valor("prioridad"), observaciones: valor("observaciones"),
    }, ...prev]);
    setNuevo(false);
    setBusqueda(""); setFiltro("Todos"); setProveedor("Todos");
  }
  return (
    <main className="module-screen mx-auto max-w-7xl px-4 py-8 sm:px-8">
      <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden="true" />Menú principal</Link>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Bases y reimpresiones</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Pedidos de bases</h1></div>
        <button type="button" onClick={() => { setNuevo(true); setDetalle(null); }} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800"><Plus className="size-4" aria-hidden="true" />Nuevo pedido</button>
      </div>
      <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><strong>Boceto · Datos de ejemplo.</strong> Podés probar la pantalla. Los pedidos no se guardan y se reinician al salir o recargar.</p>
      <div className="my-6 grid gap-3 sm:grid-cols-3">
        {[{ titulo: "Pendientes de envío", valor: pedidos.filter(p => estado(p) === "Pendiente").length, Icono: Clock }, { titulo: "Con envío parcial", valor: pedidos.filter(p => estado(p) === "Envío parcial").length, Icono: Package }, { titulo: "Enviados", valor: pedidos.filter(p => estado(p) === "Enviado").length, Icono: Truck }].map(({ titulo, valor, Icono }) => <div key={titulo} className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5"><span className="rounded-lg bg-blue-50 p-3 text-blue-700"><Icono className="size-5" aria-hidden="true" /></span><div><p className="text-sm text-slate-500">{titulo}</p><p className="mt-1 text-2xl font-bold text-slate-900">{valor}</p></div></div>)}
      </div>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap gap-3 border-b border-slate-200 p-4">
          <label className="relative min-w-56 flex-1"><span className="sr-only">Buscar pedido, código o descripción</span><Search className="absolute left-3 top-3 size-4 text-slate-400" aria-hidden="true" /><input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar pedido, código o descripción" className={campo + " mt-0 pl-9"} /></label>
          <label><span className="sr-only">Proveedor de reimpresión</span><select className={campo + " mt-0"} value={proveedor} onChange={e => setProveedor(e.target.value)}><option value="Todos">Todos los proveedores</option>{Array.from(new Set(pedidos.map(p => p.proveedor))).sort().map(p => <option key={p}>{p}</option>)}</select></label>
          <label><span className="sr-only">Estado</span><select className={campo + " mt-0"} value={filtro} onChange={e => setFiltro(e.target.value)}><option value="Todos">Todos los estados</option>{["Pendiente", "Envío parcial", "Enviado"].map(e => <option key={e}>{e}</option>)}</select></label>
        </div>
        <div className="overflow-x-auto"><table className="w-full min-w-[950px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{["Pedido / fecha requerida", "Base a preparar", "Reimpresión", "Enviar a", "Solicitada / pendiente", "Estado", ""].map(t => <th key={t} scope="col" className="px-4 py-4">{t || <span className="sr-only">Acciones</span>}</th>)}</tr></thead>
          <tbody>{visibles.map(p => <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
            <td className="px-4 py-5"><p className="font-semibold text-slate-900">{p.id}</p><p className="mt-1 text-slate-500">{fechaVisible(p.fecha)}</p>{p.prioridad === "Urgente" && <span className="mt-2 inline-block rounded bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">Urgente</span>}</td>
            <td className="px-4 py-5"><p className="font-medium text-slate-900">{p.base}</p><p className="mt-1 max-w-56 text-slate-500">{p.descripcion || "Sin descripción"}</p></td>
            <td className="px-4 py-5 text-slate-700">{p.final || "A definir"}</td>
            <td className="px-4 py-5"><p className="font-medium text-slate-900">{p.proveedor}</p><p className="mt-1 text-slate-500">{p.planta}</p></td>
            <td className="px-4 py-5"><p className="font-semibold text-slate-900">{numero(p.cantidad)}</p><p className="mt-1 text-slate-500">{numero(Math.max(0, p.cantidad - p.enviada))} pendientes</p></td>
            <td className="px-4 py-5"><span className={"whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold " + (estado(p) === "Enviado" ? "bg-emerald-50 text-emerald-700" : estado(p) === "Envío parcial" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-800")}>{estado(p)}</span></td>
            <td className="px-4 py-5"><button type="button" className="whitespace-nowrap font-semibold text-blue-700 hover:underline" aria-label={"Ver detalle de " + p.id} onClick={() => { setDetalle(p); setNuevo(false); }}>Ver detalle</button></td>
          </tr>)}</tbody>
        </table></div>
        {visibles.length === 0 && <p className="p-10 text-center text-sm text-slate-500">No hay pedidos con esos filtros.</p>}
        <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">{visibles.length} pedidos · Cantidades expresadas en etiquetas</p>
      </section>
      {detalle && <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-7" aria-labelledby="detalle-titulo">
        <div className="flex items-center justify-between gap-4"><h2 id="detalle-titulo" className="text-xl font-bold">Detalle · {detalle.id}</h2><button type="button" className={boton} onClick={() => setDetalle(null)} aria-label="Cerrar detalle"><X className="size-4" /></button></div>
        <dl className="mt-5 grid gap-5 sm:grid-cols-3">{[["Base a preparar", detalle.base], ["Descripción de la base", detalle.descripcion || "Sin descripción"], ["Etiqueta final", detalle.final || "A definir"], ["Proveedor de reimpresión", detalle.proveedor], ["Planta solicitante", detalle.planta], ["Fecha requerida", fechaVisible(detalle.fecha)], ["Cantidad solicitada", numero(detalle.cantidad)], ["Cantidad enviada", numero(detalle.enviada)], ["Cantidad pendiente", numero(Math.max(0, detalle.cantidad - detalle.enviada))]].map(([titulo, valor]) => <div key={titulo}><dt className="text-sm text-slate-500">{titulo}</dt><dd className="mt-1 font-medium text-slate-900">{valor}</dd></div>)}</dl>
        <div className="mt-6 border-t border-slate-100 pt-4"><p className="text-sm text-slate-500">Observaciones</p><p className="mt-1 text-sm text-slate-900">{detalle.observaciones || "Sin observaciones"}</p></div>
      </section>}
      {nuevo && <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-7" aria-labelledby="nuevo-titulo">
        <div className="flex items-center justify-between gap-4"><h2 id="nuevo-titulo" className="text-xl font-bold">Nuevo pedido de ejemplo</h2><button type="button" className={boton} onClick={() => setNuevo(false)} aria-label="Cerrar formulario"><X className="size-4" /></button></div>
        <form onSubmit={agregar} className="mt-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-sm font-medium">Código de base<input name="base" required maxLength={100} className={campo} /></label>
            <label className="text-sm font-medium">Descripción de la base<input name="descripcion" maxLength={250} className={campo} /></label>
            <label className="text-sm font-medium">Cantidad solicitada<input name="cantidad" type="number" min="1" step="1" max="9007199254740991" required className={campo} /></label>
            <label className="text-sm font-medium">Código de etiqueta final (opcional)<input name="final" maxLength={100} className={campo} /></label>
            <label className="text-sm font-medium">Proveedor de reimpresión<input name="proveedor" required maxLength={120} className={campo} /></label>
            <label className="text-sm font-medium">Planta solicitante<input name="planta" required maxLength={120} className={campo} /></label>
            <label className="text-sm font-medium">Fecha requerida<input name="fecha" type="date" required className={campo} /></label>
            <label className="text-sm font-medium">Prioridad<select name="prioridad" className={campo}><option>Normal</option><option>Urgente</option></select></label>
          </div>
          <label className="mt-4 block text-sm font-medium">Observaciones<textarea name="observaciones" rows={2} maxLength={1000} className={campo} /></label>
          <div className="mt-5 flex flex-wrap justify-end gap-3"><button type="button" className={boton} onClick={() => setNuevo(false)}>Cancelar</button><button type="submit" className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800">Agregar al boceto</button></div>
        </form>
      </section>}
    </main>
  );
}

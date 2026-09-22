import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronRight,
  CircleCheck,
  Clock3,
  Loader2,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  detallePickingWo,
  listarFechasPicking,
  listarPickingFecha,
  obtenerEstadoSyncPicking,
  type EstadoSyncPicking,
  type FechaPicking,
  type ItemPicking,
  type OrdenPicking,
} from "@/lib/picking.functions";

export const Route = createFileRoute("/picking")({
  component: Picking,
  head: () => ({
    meta: [
      { title: "Picking | Coquimbito" },
      {
        name: "description",
        content: "Preparación de órdenes de Picking para etiquetas en Coquimbito.",
      },
    ],
  }),
});

const nf = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

function formatearFecha(fecha: string | null | undefined) {
  if (!fecha) return "—";
  const [y, m, d] = fecha.slice(0, 10).split("-");
  if (!y || !m || !d) return fecha;
  return `${d}/${m}/${y}`;
}

function formatearFechaHora(fecha: string | null | undefined) {
  if (!fecha) return "Sin sincronización";
  const date = new Date(fecha);
  if (Number.isNaN(date.getTime())) return fecha;
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Argentina/Mendoza",
  }).format(date);
}

function normalizarEstado(value: string | null | undefined) {
  return String(value ?? "").trim().toUpperCase();
}

function EstadoBadge({ estado }: { estado: string }) {
  const e = normalizarEstado(estado);
  if (e === "PREPARADA" || e === "COMPLETO") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-600/25 bg-emerald-600/10 px-3 py-1 text-xs font-bold text-emerald-700">
        <CircleCheck className="size-4" /> {e}
      </span>
    );
  }
  if (e === "EN PREPARACION") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-600/25 bg-amber-600/10 px-3 py-1 text-xs font-bold text-amber-700">
        <Clock3 className="size-4" /> EN PREPARACIÓN
      </span>
    );
  }
  if (e === "CANCELADA" || e === "REQUIERE_REVISION") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-destructive/25 bg-destructive/10 px-3 py-1 text-xs font-bold text-destructive">
        <TriangleAlert className="size-4" /> {e.replace("_", " ")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-muted px-3 py-1 text-xs font-bold text-foreground">
      PENDIENTE
    </span>
  );
}

function seleccionarFechaInicial(fechas: FechaPicking[]) {
  if (fechas.length === 0) return "";
  const hoy = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Mendoza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  return fechas.find((x) => x.fecha_programada >= hoy)?.fecha_programada ??
    fechas[fechas.length - 1]?.fecha_programada ??
    "";
}

function Picking() {
  const cargarFechasFn = useServerFn(listarFechasPicking);
  const cargarOrdenesFn = useServerFn(listarPickingFecha);
  const cargarDetalleFn = useServerFn(detallePickingWo);
  const cargarSyncFn = useServerFn(obtenerEstadoSyncPicking);

  const [fechas, setFechas] = useState<FechaPicking[]>([]);
  const [fecha, setFecha] = useState("");
  const [ordenes, setOrdenes] = useState<OrdenPicking[]>([]);
  const [seleccionada, setSeleccionada] = useState<OrdenPicking | null>(null);
  const [items, setItems] = useState<ItemPicking[]>([]);
  const [sync, setSync] = useState<EstadoSyncPicking | null>(null);
  const [cargando, setCargando] = useState(true);
  const [cargandoOrdenes, setCargandoOrdenes] = useState(false);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargarInicio = async () => {
    setCargando(true);
    setError(null);
    try {
      const [fechasRes, syncRes] = await Promise.all([
        cargarFechasFn(),
        cargarSyncFn(),
      ]);
      setFechas(fechasRes);
      setSync(syncRes);
      const inicial = seleccionarFechaInicial(fechasRes);
      setFecha(inicial);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar Picking.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    void cargarInicio();
  }, []);

  useEffect(() => {
    if (!fecha) {
      setOrdenes([]);
      return;
    }

    let activo = true;
    setCargandoOrdenes(true);
    setError(null);
    setSeleccionada(null);
    setItems([]);

    void cargarOrdenesFn({ data: { fecha } })
      .then((rows) => {
        if (activo) setOrdenes(rows);
      })
      .catch((e: unknown) => {
        if (activo) {
          setError(
            e instanceof Error
              ? e.message
              : "No se pudieron cargar las órdenes de Picking.",
          );
        }
      })
      .finally(() => {
        if (activo) setCargandoOrdenes(false);
      });

    return () => {
      activo = false;
    };
  }, [fecha]);

  const abrirWo = async (orden: OrdenPicking) => {
    setSeleccionada(orden);
    setItems([]);
    setCargandoDetalle(true);
    setError(null);
    try {
      const rows = await cargarDetalleFn({
        data: { wo: orden.wo, fecha: orden.fecha_programada },
      });
      setItems(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el detalle de la WO.");
    } finally {
      setCargandoDetalle(false);
    }
  };

  const fechaTieneDatos = useMemo(
    () => fechas.find((x) => x.fecha_programada === fecha),
    [fechas, fecha],
  );

  if (cargando) {
    return (
      <main className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6 py-10">
        <p className="flex items-center gap-3 text-lg text-muted-foreground">
          <Loader2 className="size-6 animate-spin" /> Cargando Picking…
        </p>
      </main>
    );
  }

  if (seleccionada) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <button
          type="button"
          onClick={() => {
            setSeleccionada(null);
            setItems([]);
          }}
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Volver a órdenes
        </button>

        <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Orden de trabajo
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">WO {seleccionada.wo}</h1>
          </div>
          <EstadoBadge estado={seleccionada.estado_preparacion} />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Dato titulo="Fecha programada" valor={formatearFecha(seleccionada.fecha_programada)} />
          <Dato titulo="Línea" valor={seleccionada.linea || "—"} />
          <Dato
            titulo="Orden de Picking"
            valor={seleccionada.orden_picking === null ? "—" : String(seleccionada.orden_picking)}
          />
        </div>

        {error && (
          <p role="alert" className="mt-5 rounded-lg bg-destructive/10 p-4 font-semibold text-destructive">
            {error}
          </p>
        )}

        <section className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-lg font-bold">Insumos a preparar</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              La cantidad requerida ya incluye el scrap definido para el Picking.
            </p>
          </div>

          {cargandoDetalle ? (
            <p className="flex items-center gap-2 p-6 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" /> Cargando insumos…
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] text-sm">
                <thead className="bg-muted/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Familia</th>
                    <th className="px-4 py-3">Código</th>
                    <th className="px-4 py-3">Descripción</th>
                    <th className="px-4 py-3">Año</th>
                    <th className="px-4 py-3">Alcohol</th>
                    <th className="px-4 py-3">VX / Producto</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3 text-right">Requerido</th>
                    <th className="px-4 py-3 text-right">Entregado</th>
                    <th className="px-4 py-3">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id_item_picking} className="border-t border-border align-top">
                      <td className="px-4 py-4 font-medium">{item.familia || "—"}</td>
                      <td className="px-4 py-4 font-bold">{item.codigo_etiqueta}</td>
                      <td className="max-w-[360px] whitespace-normal px-4 py-4">{item.descripcion || "—"}</td>
                      <td className="px-4 py-4">{item.año || "—"}</td>
                      <td className="px-4 py-4">{item.alcohol || "—"}</td>
                      <td className="max-w-[220px] whitespace-normal px-4 py-4">
                        <div className="font-semibold">{item.vx || "—"}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{item.producto || "—"}</div>
                      </td>
                      <td className="px-4 py-4">{item.cliente || "—"}</td>
                      <td className="px-4 py-4 text-right text-base font-bold">{nf.format(item.cantidad_requerida)}</td>
                      <td className="px-4 py-4 text-right text-base font-semibold">{nf.format(item.cantidad_entregada)}</td>
                      <td className="px-4 py-4"><EstadoBadge estado={item.estado_item} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="mt-5 rounded-2xl border border-border bg-card p-5">
          <details>
            <summary className="cursor-pointer font-bold">Más información de control</summary>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {items.map((item) => (
                <div key={`control-${item.id_item_picking}`} className="rounded-xl bg-muted/50 p-4">
                  <p className="font-bold">{item.codigo_etiqueta}</p>
                  <dl className="mt-3 space-y-2 text-sm">
                    <MiniDato titulo="Cantidad JDE" valor={item.cantidad_jde} />
                    <MiniDato titulo="Botellas programadas" valor={item.botellas_programadas} />
                    <MiniDato titulo="Scrap" valor={item.scrap} />
                    <MiniDato titulo="Stock 1030" valor={item.stock_1030} />
                    <MiniDato titulo="Ubicación 1030" valor={item.ubicacion_1030} />
                    <MiniDato titulo="Proveedor" valor={item.proveedor} />
                    <MiniDato titulo="Fecha ingreso TGE" valor={formatearFecha(item.fecha_ingreso_tge)} />
                  </dl>
                </div>
              ))}
            </div>
          </details>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Menú principal
      </Link>

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">PICKING</h1>
          <p className="mt-1 text-muted-foreground">
            Seleccione la fecha para ver las WO que deben prepararse.
          </p>
        </div>
        <Button variant="outline" onClick={() => void cargarInicio()}>
          <RefreshCw className="mr-2 size-4" /> Recargar
        </Button>
      </div>

      <div className="mt-6 grid gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:grid-cols-[minmax(220px,320px)_1fr] sm:items-end">
        <label className="space-y-2">
          <span className="text-sm font-bold">Fecha programada</span>
          <Input
            type="date"
            value={fecha}
            min={fechas[0]?.fecha_programada}
            max={fechas[fechas.length - 1]?.fecha_programada}
            onChange={(e) => setFecha(e.target.value)}
            className="h-12 text-base"
          />
        </label>

        <div className="rounded-xl bg-muted/60 px-4 py-3 text-sm">
          <p className="font-semibold">
            {fechaTieneDatos
              ? `${fechaTieneDatos.cantidad_wo} WO programadas para ${formatearFecha(fecha)}`
              : "No hay WO sincronizadas para la fecha seleccionada."}
          </p>
          <p className="mt-1 text-muted-foreground">
            Plan actualizado: {formatearFechaHora(sync?.ultima_actualizacion)} · {sync?.cantidad_items ?? 0} ítems · {sync?.cantidad_wo ?? 0} WO
          </p>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-5 rounded-lg bg-destructive/10 p-4 font-semibold text-destructive">
          {error}
        </p>
      )}

      <section className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-lg font-bold">Órdenes a preparar</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            El orden es recomendado. Puede abrir cualquier WO activa.
          </p>
        </div>

        {cargandoOrdenes ? (
          <p className="flex items-center gap-2 p-6 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" /> Cargando órdenes…
          </p>
        ) : ordenes.length === 0 ? (
          <p className="p-6 text-muted-foreground">No hay órdenes para esta fecha.</p>
        ) : (
          <div className="divide-y divide-border">
            {ordenes.map((orden) => (
              <button
                key={`${orden.fecha_programada}-${orden.wo}-${orden.linea ?? ""}`}
                type="button"
                disabled={normalizarEstado(orden.estado_plan) === "CANCELADA"}
                onClick={() => void abrirWo(orden)}
                className="grid w-full grid-cols-[72px_1fr_auto] items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50 sm:grid-cols-[90px_100px_1fr_170px_32px]"
              >
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Orden</p>
                  <p className="text-xl font-bold">{orden.orden_picking ?? "—"}</p>
                </div>
                <div className="hidden sm:block">
                  <p className="text-xs uppercase text-muted-foreground">Línea</p>
                  <p className="font-bold">{orden.linea || "—"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground sm:hidden">{orden.linea || "—"}</p>
                  <p className="text-lg font-bold">WO {orden.wo}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {orden.total_insumos} insumos · {orden.insumos_completos} completos
                  </p>
                </div>
                <div className="justify-self-end"><EstadoBadge estado={orden.estado_preparacion} /></div>
                <ChevronRight className="hidden size-5 text-muted-foreground sm:block" />
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function Dato({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{titulo}</p>
      <p className="mt-1 text-lg font-bold">{valor}</p>
    </div>
  );
}

function MiniDato({ titulo, valor }: { titulo: string; valor: unknown }) {
  const texto =
    valor === null || valor === undefined || valor === ""
      ? "—"
      : typeof valor === "number"
        ? nf.format(valor)
        : String(valor);
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{titulo}</dt>
      <dd className="text-right font-semibold">{texto}</dd>
    </div>
  );
}

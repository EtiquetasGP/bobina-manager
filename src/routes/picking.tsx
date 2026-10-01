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
  confirmarPicking,
  consultarBobinaPicking,
  detallePickingWo,
  listarBobinasPicking,
  listarFechasPicking,
  listarPickingFecha,
  obtenerEstadoSyncPicking,
  type BobinaPicking,
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

type EntregaPreparada = {
  idItemPicking: number;
  bobina: BobinaPicking;
  cantidad: number;
};

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

function normalizarCodigo(value: string | null | undefined) {
  return String(value ?? "").trim().toUpperCase();
}

function normalizarAnio(value: string | null | undefined) {
  const digitos = String(value ?? "").replace(/\D/g, "");
  if (!digitos) return "";
  return digitos.slice(-2);
}

function normalizarAlcohol(value: string | null | undefined) {
  let limpio = String(value ?? "")
    .trim()
    .replace(",", ".")
    .replace(/[^0-9.]/g, "");

  limpio = limpio.replace(/\.$/, "");

  if (!limpio) return null;

  const numeroInicial = Number(limpio);

  if (!Number.isFinite(numeroInicial)) return null;

  let numero = numeroInicial;

  if (numero > 0 && numero < 1) {
    numero = numero * 100;
  } else if (numero > 30 && numero <= 300) {
    numero = numero / 10;
  }

  if (numero <= 0 || numero > 30) {
    return null;
  }

  return Math.round(numero * 1000) / 1000;
}

function validarBobinaContraItem(bobina: BobinaPicking, item: ItemPicking) {
  if (normalizarEstado(bobina.estado) !== "ALMACEN") {
    return `La bobina ${bobina.id_bobina} no está disponible en ALMACEN.`;
  }

  if (normalizarCodigo(bobina.codigo_etiqueta) !== normalizarCodigo(item.codigo_etiqueta)) {
    return `Código incorrecto. Se requiere ${item.codigo_etiqueta} y la bobina contiene ${bobina.codigo_etiqueta}.`;
  }

  if (!normalizarAnio(bobina.año)) {
    return `La bobina ${bobina.id_bobina} no tiene añada cargada.`;
  }

  if (!normalizarAnio(item.año)) {
    return `El insumo ${item.codigo_etiqueta} no tiene añada definida.`;
  }

  if (normalizarAnio(bobina.año) !== normalizarAnio(item.año)) {
    return `Añada incorrecta. Se requiere ${item.año ?? "—"} y la bobina es ${bobina.año ?? "—"}.`;
  }

  const alcoholBobina = normalizarAlcohol(bobina.alcohol);
  const alcoholItem = normalizarAlcohol(item.alcohol);

  if (alcoholBobina === null) {
    return `La bobina ${bobina.id_bobina} no tiene alcohol cargado.`;
  }

  if (alcoholItem === null) {
    return `El insumo ${item.codigo_etiqueta} no tiene alcohol definido.`;
  }

  if (Math.abs(alcoholBobina - alcoholItem) > 0.0001) {
    return `Alcohol incorrecto. Se requiere ${item.alcohol ?? "—"} y la bobina tiene ${bobina.alcohol ?? "—"}.`;
  }

  if (!Number.isFinite(Number(bobina.cantidad_actual)) || Number(bobina.cantidad_actual) <= 0) {
    return `La bobina ${bobina.id_bobina} no tiene cantidad disponible.`;
  }

  return null;
}

function EstadoBadge({ estado }: { estado: string }) {
  const e = normalizarEstado(estado);
  if (e === "ENTREGADA" || e === "PREPARADA" || e === "COMPLETO") {
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
  const consultarBobinaFn = useServerFn(consultarBobinaPicking);
  const listarBobinasFn = useServerFn(listarBobinasPicking);
  const confirmarPickingFn = useServerFn(confirmarPicking);

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
  const [validacionesEscaneo, setValidacionesEscaneo] = useState<
    Record<number, { tipo: "ok" | "error"; mensaje: string }>
  >({});
  const [mensaje, setMensaje] = useState<string | null>(null);

  const [operario, setOperario] = useState("");
  const [entregas, setEntregas] = useState<EntregaPreparada[]>([]);
  const [escaneos, setEscaneos] = useState<Record<number, string>>({});
  const [bobinasActivas, setBobinasActivas] = useState<Record<number, BobinaPicking | undefined>>({});
  const [cantidades, setCantidades] = useState<Record<number, string>>({});
  const [cargandoBobinaItem, setCargandoBobinaItem] = useState<number | null>(null);
  const [selectorItem, setSelectorItem] = useState<number | null>(null);
  const [bobinasDisponibles, setBobinasDisponibles] = useState<BobinaPicking[]>([]);
  const [cargandoSelector, setCargandoSelector] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  useEffect(() => {
    const guardado = window.localStorage.getItem("picking_operario");
    if (guardado) setOperario(guardado);
  }, []);

  const limpiarPreparacion = () => {
    setEntregas([]);
    setEscaneos({});
    setBobinasActivas({});
    setCantidades({});
    setSelectorItem(null);
    setBobinasDisponibles([]);
    setValidacionesEscaneo({});
    setMensaje(null);
  };

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
    limpiarPreparacion();

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
    limpiarPreparacion();
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

  const preparadoPorItem = useMemo(() => {
    const mapa = new Map<number, number>();
    for (const entrega of entregas) {
      mapa.set(
        entrega.idItemPicking,
        (mapa.get(entrega.idItemPicking) ?? 0) + entrega.cantidad,
      );
    }
    return mapa;
  }, [entregas]);

  const todosCubiertos = useMemo(() => {
    if (items.length === 0) return false;
    return items.every((item) => {
      const preparado = preparadoPorItem.get(item.id_item_picking) ?? 0;
      return item.cantidad_entregada + preparado >= item.cantidad_requerida;
    });
  }, [items, preparadoPorItem]);

  const woYaEntregada = useMemo(() => {
    if (items.length === 0) return false;
    return items.every((item) => item.cantidad_entregada >= item.cantidad_requerida);
  }, [items]);

  const bobinasUsadas = useMemo(
    () => new Set(entregas.map((entrega) => entrega.bobina.id_bobina)),
    [entregas],
  );

  const seleccionarBobina = (item: ItemPicking, bobina: BobinaPicking) => {
    setError(null);
    setMensaje(null);

    if (bobinasUsadas.has(bobina.id_bobina)) {
      setError(`La bobina ${bobina.id_bobina} ya fue agregada a esta preparación.`);
      return;
    }

    const validacion = validarBobinaContraItem(bobina, item);
    if (validacion) {
      setError(validacion);
      return;
    }

    setBobinasActivas((actual) => ({
      ...actual,
      [item.id_item_picking]: bobina,
    }));
    setCantidades((actual) => ({
      ...actual,
      [item.id_item_picking]: "",
    }));
    setSelectorItem(null);
    setBobinasDisponibles([]);
  };

const consultarEscaneo = async (item: ItemPicking) => {
  const idBobina = String(escaneos[item.id_item_picking] ?? "")
    .trim()
    .toUpperCase();

  if (!idBobina) {
    setValidacionesEscaneo((actual) => ({
      ...actual,
      [item.id_item_picking]: {
        tipo: "error",
        mensaje: "Escanee o ingrese un ID de bobina.",
      },
    }));
    return;
  }

  setCargandoBobinaItem(item.id_item_picking);
  setError(null);
  setMensaje(null);

  setValidacionesEscaneo((actual) => {
    const nuevo = { ...actual };
    delete nuevo[item.id_item_picking];
    return nuevo;
  });

  try {
    const bobina = await consultarBobinaFn({
      data: { idBobina },
    });

    if (!bobina) {
      setValidacionesEscaneo((actual) => ({
        ...actual,
        [item.id_item_picking]: {
          tipo: "error",
          mensaje: `La bobina ${idBobina} no existe en el sistema.`,
        },
      }));
      return;
    }

    const validacion = validarBobinaContraItem(bobina, item);

    if (validacion) {
      setValidacionesEscaneo((actual) => ({
        ...actual,
        [item.id_item_picking]: {
          tipo: "error",
          mensaje: validacion,
        },
      }));
      return;
    }

    seleccionarBobina(item, bobina);

    setValidacionesEscaneo((actual) => ({
      ...actual,
      [item.id_item_picking]: {
        tipo: "ok",
        mensaje: `Bobina ${bobina.id_bobina} válida.`,
      },
    }));
  } catch (e) {
    setValidacionesEscaneo((actual) => ({
      ...actual,
      [item.id_item_picking]: {
        tipo: "error",
        mensaje:
          e instanceof Error
            ? e.message
            : "No se pudo consultar la bobina.",
      },
    }));
  } finally {
    setCargandoBobinaItem(null);
  }
};
  const abrirSelectorBobinas = async (item: ItemPicking) => {
    if (selectorItem === item.id_item_picking) {
      setSelectorItem(null);
      setBobinasDisponibles([]);
      return;
    }

    setSelectorItem(item.id_item_picking);
    setBobinasDisponibles([]);
    setCargandoSelector(true);
    setError(null);
    setMensaje(null);

    try {
      const rows = await listarBobinasFn({
        data: { codigoEtiqueta: item.codigo_etiqueta, limite: 50 },
      });
      setBobinasDisponibles(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron consultar las bobinas disponibles.");
    } finally {
      setCargandoSelector(false);
    }
  };

  const agregarEntrega = (item: ItemPicking) => {
    const bobina = bobinasActivas[item.id_item_picking];
    if (!bobina) {
      setError("Primero escanee o seleccione una bobina.");
      return;
    }

    const validacion = validarBobinaContraItem(bobina, item);
    if (validacion) {
      setError(validacion);
      return;
    }

    const cantidadTexto = String(cantidades[item.id_item_picking] ?? "").trim();
    const cantidad = Number(cantidadTexto);

    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      setError("La cantidad entregada debe ser un número entero mayor a cero.");
      return;
    }

    if (cantidad > bobina.cantidad_actual) {
      setError(
        `La bobina ${bobina.id_bobina} tiene ${nf.format(bobina.cantidad_actual)} disponibles y se intentan entregar ${nf.format(cantidad)}.`,
      );
      return;
    }

    if (bobinasUsadas.has(bobina.id_bobina)) {
      setError(`La bobina ${bobina.id_bobina} ya fue agregada a esta preparación.`);
      return;
    }

    setEntregas((actual) => [
      ...actual,
      {
        idItemPicking: item.id_item_picking,
        bobina,
        cantidad,
      },
    ]);

    setBobinasActivas((actual) => {
      const siguiente = { ...actual };
      delete siguiente[item.id_item_picking];
      return siguiente;
    });
    setCantidades((actual) => ({ ...actual, [item.id_item_picking]: "" }));
    setEscaneos((actual) => ({ ...actual, [item.id_item_picking]: "" }));
    setError(null);
  };

  const quitarEntrega = (idBobina: string) => {
    setEntregas((actual) => actual.filter((entrega) => entrega.bobina.id_bobina !== idBobina));
    setError(null);
    setMensaje(null);
  };

  const confirmarWo = async () => {
    if (!seleccionada) return;

    if (!operario.trim()) {
      setError("Ingrese el nombre del operario antes de confirmar el Picking.");
      return;
    }

    if (entregas.length === 0) {
      setError("No hay bobinas preparadas para confirmar.");
      return;
    }

    if (!todosCubiertos) {
      setError("No se puede confirmar: todavía hay insumos con cantidad faltante.");
      return;
    }

    setConfirmando(true);
    setError(null);
    setMensaje(null);

    try {
      const resultado = await confirmarPickingFn({
        data: {
          wo: seleccionada.wo,
          fecha: seleccionada.fecha_programada,
          operario: operario.trim(),
          entregas: entregas.map((entrega) => ({
            idBobina: entrega.bobina.id_bobina,
            idItemPicking: entrega.idItemPicking,
            cantidad: entrega.cantidad,
            sentidoBobinado: null,
          })),
        },
      });

      window.localStorage.setItem("picking_operario", operario.trim());

      const [detalleActualizado, ordenesActualizadas] = await Promise.all([
        cargarDetalleFn({
          data: { wo: seleccionada.wo, fecha: seleccionada.fecha_programada },
        }),
        cargarOrdenesFn({ data: { fecha: seleccionada.fecha_programada } }),
      ]);

      setItems(detalleActualizado);
      setOrdenes(ordenesActualizadas);

      const ordenActualizada = ordenesActualizadas.find(
        (orden) =>
          orden.wo === seleccionada.wo &&
          orden.fecha_programada === seleccionada.fecha_programada &&
          (orden.linea ?? "") === (seleccionada.linea ?? ""),
      );

      if (ordenActualizada) setSeleccionada(ordenActualizada);

      limpiarPreparacion();
      setMensaje(resultado.mensaje || "Picking confirmado correctamente.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo confirmar el Picking.");
    } finally {
      setConfirmando(false);
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
    const editable =
      normalizarEstado(seleccionada.estado_plan) === "ACTIVA" && !woYaEntregada;

    return (
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <button
          type="button"
          onClick={() => {
            setSeleccionada(null);
            setItems([]);
            limpiarPreparacion();
            setError(null);
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

        {mensaje && (
          <p className="mt-5 rounded-lg border border-emerald-600/25 bg-emerald-600/10 p-4 font-semibold text-emerald-700">
            {mensaje}
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

        {!cargandoDetalle && items.length > 0 && (
          <section className="mt-5 rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-bold">Preparación de bobinas</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Escanee el ID CQ o seleccione una bobina. La operación se registra recién al confirmar toda la WO.
                </p>
              </div>
              {woYaEntregada && <EstadoBadge estado="ENTREGADA" />}
            </div>

            <div className="mt-5 space-y-5">
              {items.map((item) => {
                const preparadoAhora = preparadoPorItem.get(item.id_item_picking) ?? 0;
                const totalAlConfirmar = item.cantidad_entregada + preparadoAhora;
                const faltante = Math.max(item.cantidad_requerida - totalAlConfirmar, 0);
                const bobinaActiva = bobinasActivas[item.id_item_picking];
                const entregasItem = entregas.filter(
                  (entrega) => entrega.idItemPicking === item.id_item_picking,
                );
                const completo = totalAlConfirmar >= item.cantidad_requerida;

                return (
                  <div key={`prep-${item.id_item_picking}`} className="rounded-xl border border-border p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-bold">{item.codigo_etiqueta}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{item.descripcion || "—"}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Añada {item.año || "—"} · Alcohol {item.alcohol || "—"}
                        </p>
                      </div>
                      <span
                        className={
                          completo
                            ? "inline-flex w-fit rounded-full bg-emerald-600/10 px-3 py-1 text-xs font-bold text-emerald-700"
                            : "inline-flex w-fit rounded-full bg-amber-600/10 px-3 py-1 text-xs font-bold text-amber-700"
                        }
                      >
                        {completo ? "CUBIERTO" : `FALTAN ${nf.format(faltante)}`}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-4">
                      <MiniResumen titulo="Requerido" valor={item.cantidad_requerida} />
                      <MiniResumen titulo="Entregado antes" valor={item.cantidad_entregada} />
                      <MiniResumen titulo="Preparado ahora" valor={preparadoAhora} />
                      <MiniResumen titulo="Total al confirmar" valor={totalAlConfirmar} />
                    </div>

                    {editable && (
                      <>
                        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(260px,1fr)_auto]">
                          <div className="flex gap-2">
                            <Input
                              value={escaneos[item.id_item_picking] ?? ""}
                              onChange={(e) => {
                                const valor = e.target.value.toUpperCase();

                                setEscaneos((actual) => ({
                                  ...actual,
                                  [item.id_item_picking]: valor,
                                }));

                                setValidacionesEscaneo((actual) => {
                                  const siguiente = { ...actual };
                                  delete siguiente[item.id_item_picking];
                                  return siguiente;
                                });
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  void consultarEscaneo(item);
                                }
                              }}
                              placeholder="Escanear CQ-XXXXXX"
                              autoComplete="off"
                              className="h-11 font-mono"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              disabled={cargandoBobinaItem === item.id_item_picking}
                              onClick={() => void consultarEscaneo(item)}
                            >
                              {cargandoBobinaItem === item.id_item_picking ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                "Validar"
                              )}
                            </Button>
                          </div>

                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => void abrirSelectorBobinas(item)}
                          >
                            {selectorItem === item.id_item_picking ? "Cerrar selección" : "Seleccionar bobina"}
                          </Button>
                        </div>

                        {validacionesEscaneo[item.id_item_picking] && (
                          <p
                            role="status"
                            className={
                              validacionesEscaneo[item.id_item_picking].tipo === "ok"
                                ? "mt-2 text-sm font-semibold text-emerald-700"
                                : "mt-2 text-sm font-semibold text-destructive"
                            }
                          >
                            {validacionesEscaneo[item.id_item_picking].mensaje}
                          </p>
                        )}

                        {selectorItem === item.id_item_picking && (
                          <div className="mt-3 rounded-xl bg-muted/40 p-3">
                            <p className="text-sm font-bold">Bobinas disponibles para este código</p>
                            {cargandoSelector ? (
                              <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="size-4 animate-spin" /> Buscando bobinas…
                              </p>
                            ) : bobinasDisponibles.length === 0 ? (
                              <p className="mt-3 text-sm text-muted-foreground">
                                No hay bobinas en ALMACEN para este código.
                              </p>
                            ) : (
                              <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                                {bobinasDisponibles.map((bobina) => {
                                  const incompatibilidad = validarBobinaContraItem(bobina, item);
                                  const yaUsada = bobinasUsadas.has(bobina.id_bobina);
                                  return (
                                    <div
                                      key={bobina.id_bobina}
                                      className="flex flex-col gap-2 rounded-lg border border-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
                                    >
                                      <div>
                                        <p className="font-mono font-bold">{bobina.id_bobina}</p>
                                        <p className="text-sm">
                                          {nf.format(bobina.cantidad_actual)} disponibles · Año {bobina.año || "—"} · Alcohol {bobina.alcohol || "—"}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {bobina.ubicacion || "Sin ubicación"} · Ingreso {formatearFecha(bobina.fecha_ingreso)}
                                        </p>
                                        {incompatibilidad && (
                                          <p className="mt-1 text-xs font-semibold text-destructive">{incompatibilidad}</p>
                                        )}
                                      </div>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        disabled={Boolean(incompatibilidad) || yaUsada}
                                        onClick={() => seleccionarBobina(item, bobina)}
                                      >
                                        {yaUsada ? "Ya agregada" : incompatibilidad ? "No compatible" : "Usar bobina"}
                                      </Button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}

                        {bobinaActiva && (
                          <div className="mt-4 rounded-xl border border-emerald-600/25 bg-emerald-600/5 p-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <p className="font-mono text-lg font-bold">{bobinaActiva.id_bobina}</p>
                                <p className="mt-1 text-sm">
                                  Disponible: <strong>{nf.format(bobinaActiva.cantidad_actual)}</strong> · Año {bobinaActiva.año || "—"} · Alcohol {bobinaActiva.alcohol || "—"}
                                </p>
                                <p className="mt-1 text-xs font-semibold text-emerald-700">
                                  Código, añada y alcohol correctos.
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  setBobinasActivas((actual) => {
                                    const siguiente = { ...actual };
                                    delete siguiente[item.id_item_picking];
                                    return siguiente;
                                  })
                                }
                                className="text-sm font-semibold text-muted-foreground hover:text-foreground"
                              >
                                Cambiar bobina
                              </button>
                            </div>

                            <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(180px,260px)_auto_1fr] sm:items-end">
                              <label className="space-y-2">
                                <span className="text-sm font-bold">Cantidad entregada</span>
                                <Input
                                  type="number"
                                  min={1}
                                  max={bobinaActiva.cantidad_actual}
                                  step={1}
                                  inputMode="numeric"
                                  value={cantidades[item.id_item_picking] ?? ""}
                                  onChange={(e) =>
                                    setCantidades((actual) => ({
                                      ...actual,
                                      [item.id_item_picking]: e.target.value,
                                    }))
                                  }
                                  className="h-11"
                                />
                              </label>
                              <Button type="button" onClick={() => agregarEntrega(item)}>
                                Agregar a preparación
                              </Button>
                              <p className="text-sm text-muted-foreground">
                                Si entrega menos que {nf.format(bobinaActiva.cantidad_actual)}, la bobina se parcializa y el remanente queda en ALMACEN. Si entrega todo, la bobina pasa a LINEA.
                              </p>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {entregasItem.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <p className="text-sm font-bold">Bobinas preparadas</p>
                        {entregasItem.map((entrega) => {
                          const parcial = entrega.cantidad < entrega.bobina.cantidad_actual;
                          return (
                            <div
                              key={entrega.bobina.id_bobina}
                              className="flex flex-col gap-2 rounded-lg bg-muted/50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div className="text-sm">
                                <span className="font-mono font-bold">{entrega.bobina.id_bobina}</span>
                                <span className="ml-3">Entregar {nf.format(entrega.cantidad)}</span>
                                <span className="ml-3 text-muted-foreground">
                                  {parcial
                                    ? `Parcial · quedan ${nf.format(entrega.bobina.cantidad_actual - entrega.cantidad)}`
                                    : "Bobina completa → LINEA"}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => quitarEntrega(entrega.bobina.id_bobina)}
                                className="text-sm font-semibold text-destructive hover:underline"
                              >
                                Quitar
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {!woYaEntregada && normalizarEstado(seleccionada.estado_plan) === "ACTIVA" && (
              <div className="mt-6 rounded-xl border border-border bg-muted/30 p-4">
                <div className="grid gap-4 sm:grid-cols-[minmax(220px,360px)_1fr_auto] sm:items-end">
                  <label className="space-y-2">
                    <span className="text-sm font-bold">Operario</span>
                    <Input
                      value={operario}
                      onChange={(e) => setOperario(e.target.value)}
                      placeholder="Nombre del operario"
                      className="h-11"
                    />
                  </label>

                  <div className="text-sm">
                    <p className="font-bold">
                      {todosCubiertos
                        ? "Todos los insumos están cubiertos."
                        : "Complete todos los insumos antes de confirmar."}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      La base se modifica únicamente al presionar Confirmar Picking.
                    </p>
                  </div>

                  <Button
                    type="button"
                    disabled={
                      confirmando ||
                      !todosCubiertos ||
                      entregas.length === 0 ||
                      !operario.trim()
                    }
                    onClick={() => void confirmarWo()}
                    className="h-11"
                  >
                    {confirmando ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="size-4 animate-spin" /> Confirmando…
                      </span>
                    ) : (
                      "Confirmar Picking"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </section>
        )}

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

function MiniResumen({ titulo, valor }: { titulo: string; valor: number }) {
  return (
    <div className="rounded-lg bg-muted/50 px-3 py-2">
      <p className="text-xs uppercase text-muted-foreground">{titulo}</p>
      <p className="mt-1 text-lg font-bold">{nf.format(valor)}</p>
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

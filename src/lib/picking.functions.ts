import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireOperario } from "@/lib/operario.middleware";

function extraerMensajeError(error: unknown) {
  if (!error || typeof error !== "object") return null;

  const candidato = error as {
    message?: unknown;
    details?: unknown;
    hint?: unknown;
  };

  for (const valor of [candidato.message, candidato.details, candidato.hint]) {
    if (typeof valor === "string" && valor.trim()) return valor.trim();
  }

  return null;
}

function lanzarErrorPicking(
  error: unknown,
  mensaje: string,
  usarDetalle = false,
): never {
  console.error(mensaje, error);
  const detalle = usarDetalle ? extraerMensajeError(error) : null;
  throw new Error(detalle || mensaje);
}

type RpcResponse = { data: unknown; error: unknown };
type RpcClient = {
  rpc: (nombre: string, args?: Record<string, unknown>) => Promise<RpcResponse>;
};

function rpcClient(cliente: unknown): RpcClient {
  return cliente as RpcClient;
}

export type FechaPicking = {
  fecha_programada: string;
  cantidad_wo: number;
};

export type OrdenPicking = {
  fecha_programada: string;
  linea: string | null;
  orden_picking: number | null;
  wo: string;
  estado_plan: string;
  estado_preparacion: string;
  total_insumos: number;
  insumos_completos: number;
};

export type ItemPicking = {
  id_item_picking: number;
  fecha_programada: string;
  linea: string | null;
  orden_picking: number | null;
  wo: string;
  familia: string | null;
  codigo_etiqueta: string;
  descripcion: string | null;
  año: string | null;
  alcohol: string | null;
  vx: string | null;
  producto: string | null;
  cliente: string | null;
  cantidad_requerida: number;
  cantidad_entregada: number;
  cantidad_faltante: number;
  estado_item: string;
  cantidad_jde: number | null;
  botellas_programadas: number | null;
  scrap: number | null;
  stock_1030: number | null;
  ubicacion_1030: string | null;
  estado_wo: string | null;
  estado_tge: string | null;
  proveedor: string | null;
  fecha_ingreso_tge: string | null;
  estado_plan: string;
};

export type EstadoSyncPicking = {
  ultima_actualizacion: string | null;
  cantidad_items: number;
  cantidad_wo: number;
};

export type BobinaPicking = {
  id_bobina: string;
  codigo_etiqueta: string;
  descripcion: string;
  cantidad_actual: number;
  fecha_ingreso: string;
  proveedor: string | null;
  ubicacion: string | null;
  estado: string | null;
  año: string | null;
  alcohol: string | null;
  vx: string | null;
  cliente: string | null;
};

export type ResultadoRegistrarPicking = {
  ok: boolean;
  wo: string;
  fecha_programada: string;
  movimientos_registrados: number;
  estado: string;
  mensaje: string;
};

export const listarFechasPicking = createServerFn({ method: "GET" }).middleware([requireOperario]).handler(
  async () => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data, error } = await rpcClient(supabaseAdmin).rpc(
      "listar_fechas_picking",
    );

    if (error) {
      lanzarErrorPicking(
        error,
        "No se pudieron consultar las fechas de Picking. Intente nuevamente.",
      );
    }

    return (data ?? []) as FechaPicking[];
  },
);

const fechaSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const listarPickingFecha = createServerFn({ method: "POST" })
  .middleware([requireOperario])
  .validator((data: unknown) => fechaSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data: rows, error } = await rpcClient(supabaseAdmin).rpc(
      "listar_picking_fecha",
      { p_fecha: data.fecha },
    );

    if (error) {
      lanzarErrorPicking(
        error,
        "No se pudieron consultar las órdenes de Picking. Intente nuevamente.",
      );
    }

    return (rows ?? []) as OrdenPicking[];
  });

const detalleSchema = z.object({
  wo: z.string().trim().min(1).max(100),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const detallePickingWo = createServerFn({ method: "POST" })
  .middleware([requireOperario])
  .validator((data: unknown) => detalleSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data: rows, error } = await rpcClient(supabaseAdmin).rpc(
      "detalle_picking_wo",
      {
        p_wo: data.wo,
        p_fecha: data.fecha,
      },
    );

    if (error) {
      lanzarErrorPicking(
        error,
        "No se pudo consultar el detalle de la WO. Intente nuevamente.",
      );
    }

    return (rows ?? []) as ItemPicking[];
  });

const bobinaSchema = z.object({
  idBobina: z.string().trim().min(1).max(100),
});

export const consultarBobinaPicking = createServerFn({ method: "POST" })
  .middleware([requireOperario])
  .validator((data: unknown) => bobinaSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data: rows, error } = await rpcClient(supabaseAdmin).rpc(
      "consultar_bobina_picking",
      { p_id_bobina: data.idBobina.trim().toUpperCase() },
    );

    if (error) {
      lanzarErrorPicking(
        error,
        "No se pudo consultar la bobina. Intente nuevamente.",
      );
    }

    const bobinas = (rows ?? []) as BobinaPicking[];
    return bobinas[0] ?? null;
  });

const listarBobinasSchema = z.object({
  codigoEtiqueta: z.string().trim().min(1).max(200),
  limite: z.number().int().min(1).max(100).optional(),
});

export const listarBobinasPicking = createServerFn({ method: "POST" })
  .middleware([requireOperario])
  .validator((data: unknown) => listarBobinasSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data: rows, error } = await rpcClient(supabaseAdmin).rpc(
      "listar_bobinas_picking",
      {
        p_codigo_etiqueta: data.codigoEtiqueta,
        p_limite: data.limite ?? 50,
      },
    );

    if (error) {
      lanzarErrorPicking(
        error,
        "No se pudieron consultar las bobinas disponibles. Intente nuevamente.",
      );
    }

    return (rows ?? []) as BobinaPicking[];
  });

const confirmarPickingSchema = z.object({
  wo: z.string().trim().min(1).max(100),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  operario: z.string().trim().max(200).optional(),
  entregas: z
    .array(
      z.object({
        idBobina: z.string().trim().min(1).max(100),
        idItemPicking: z.number().int().positive(),
        cantidad: z.number().int().positive(),
        sentidoBobinado: z.string().trim().max(100).nullable().optional(),
      }),
    )
    .min(1),
});

export const confirmarPicking = createServerFn({ method: "POST" })
  .middleware([requireOperario])
  .validator((data: unknown) => confirmarPickingSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data: resultado, error } = await rpcClient(supabaseAdmin).rpc(
      "registrar_picking",
      {
        p_wo: data.wo,
        p_fecha: data.fecha,
        p_operario: context.operario,
        p_entregas: data.entregas.map((entrega) => ({
          id_bobina: entrega.idBobina.trim().toUpperCase(),
          id_item_picking: entrega.idItemPicking,
          cantidad: entrega.cantidad,
          sentido_bobinado: entrega.sentidoBobinado ?? null,
        })),
      },
    );

    if (error) {
      lanzarErrorPicking(
        error,
        "No se pudo confirmar el Picking.",
        true,
      );
    }

    return resultado as ResultadoRegistrarPicking;
  });

export const obtenerEstadoSyncPicking = createServerFn({
  method: "GET",
}).middleware([requireOperario]).handler(async () => {
  const { supabaseAdmin } = await import(
    "@/integrations/supabase/client.server"
  );

  const { data, error } = await rpcClient(supabaseAdmin).rpc(
    "estado_sync_picking",
  );

  if (error) {
    lanzarErrorPicking(
      error,
      "No se pudo consultar la última actualización del Picking.",
    );
  }

  const rows = (data ?? []) as EstadoSyncPicking[];
  return rows[0] ?? null;
});

// Preparación persistida: las selecciones se guardan antes de entregar.
export type EstadoPreparacionPicking =
  | "PENDIENTE"
  | "PARCIAL"
  | "LISTA"
  | "ENTREGADA";

export type PreparacionPicking = {
  id_preparacion: string;
  wo: string;
  fecha_programada: string;
  linea: string;
  estado: EstadoPreparacionPicking;
  operario_creacion_id: string;
  operario_creacion_nombre: string;
  fecha_creacion: string;
  fecha_actualizacion: string;
  fecha_lista: string | null;
  operario_lista_id: string | null;
  operario_lista_nombre: string | null;
  fecha_entrega: string | null;
  operario_entrega_id: string | null;
  operario_entrega_nombre: string | null;
};

export type InsumoPreparacionPicking = Omit<
  ItemPicking,
  "cantidad_entregada" | "cantidad_faltante" | "estado_item"
> & {
  cantidad_preparada: number;
  cantidad_pendiente_preparar: number;
};

export type SeleccionPreparacionPicking = {
  id_detalle: string;
  id_preparacion: string;
  id_item_picking: number;
  id_bobina: string;
  cantidad: number;
  sentido_bobinado: string | null;
  insumo_snapshot: Record<string, unknown>;
  operario_seleccion_id: string;
  operario_seleccion_nombre: string;
  fecha_seleccion: string;
  fecha_liberacion: string | null;
};

export type BobinaPreparacionPicking = SeleccionPreparacionPicking & {
  bobina_actual: BobinaPicking | null;
  situacion_seleccion: "RESERVADA" | "ENTREGADA";
};

export type DetallePreparacionPicking = {
  ok: boolean;
  preparacion: PreparacionPicking;
  insumos: InsumoPreparacionPicking[];
  bobinas: BobinaPreparacionPicking[];
};

export type InicioPreparacionPicking = {
  ok: boolean;
  preparacion: PreparacionPicking;
  bobinas_reservadas: SeleccionPreparacionPicking[];
};

export type OrdenPickingPreparacion = OrdenPicking & {
  id_preparacion: string | null;
  fecha_creacion_preparacion: string | null;
  operario_creacion_nombre: string | null;
  fecha_lista: string | null;
  operario_lista_nombre: string | null;
  fecha_entrega: string | null;
  operario_entrega_nombre: string | null;
  bobinas_seleccionadas: number;
  insumos_preparados: number;
};

export type ResultadoPreparacionPicking = {
  ok: boolean;
  id_preparacion: string;
  estado: EstadoPreparacionPicking;
  mensaje: string;
  id_detalle?: string;
  duplicada?: boolean;
  ya_liberada?: boolean;
  ya_abierta?: boolean;
  ya_entregada?: boolean;
  bobinas_reservadas?: number;
  total_bobinas?: number;
  movimientos_registrados?: number;
  fecha_entrega?: string;
  operario_entrega?: string;
  wo?: string;
};

async function llamarRpcPreparacion<T>(
  nombre: string,
  argumentos: Record<string, unknown>,
  mensaje: string,
): Promise<T> {
  const { supabaseAdmin } = await import(
    "@/integrations/supabase/client.server"
  );
  const { data, error } = await rpcClient(supabaseAdmin).rpc(
    nombre,
    argumentos,
  );
  if (error) lanzarErrorPicking(error, mensaje, true);
  if (data === null || data === undefined) {
    throw new Error(mensaje);
  }
  return data as T;
}

export const listarPickingFechaPreparacion = createServerFn({ method: "POST" })
  .middleware([requireOperario])
  .validator((data: unknown) => fechaSchema.parse(data))
  .handler(async ({ data }) => {
    return llamarRpcPreparacion<OrdenPickingPreparacion[]>(
      "listar_picking_fecha_preparacion",
      { p_fecha: data.fecha },
      "No se pudieron consultar las preparaciones de Picking.",
    );
  });

const iniciarPreparacionSchema = detalleSchema.extend({
  linea: z.string().trim().min(1).max(100),
});

export const iniciarPreparacionPicking = createServerFn({ method: "POST" })
  .middleware([requireOperario])
  .validator((data: unknown) => iniciarPreparacionSchema.parse(data))
  .handler(async ({ data, context }) => {
    return llamarRpcPreparacion<InicioPreparacionPicking>(
      "iniciar_preparacion_picking",
      {
        p_wo: data.wo,
        p_fecha: data.fecha,
        p_linea: data.linea,
        p_operario_id: context.operarioId,
        p_operario_nombre: context.operario,
      },
      "No se pudo abrir la preparación de Picking.",
    );
  });

const preparacionSchema = z.object({
  idPreparacion: z.string().uuid(),
});

export const obtenerPreparacionPicking = createServerFn({ method: "POST" })
  .middleware([requireOperario])
  .validator((data: unknown) => preparacionSchema.parse(data))
  .handler(async ({ data }) => {
    return llamarRpcPreparacion<DetallePreparacionPicking>(
      "obtener_preparacion_picking",
      { p_id_preparacion: data.idPreparacion },
      "No se pudo recuperar la preparación de Picking.",
    );
  });

const agregarBobinaPreparacionSchema = preparacionSchema.extend({
  idItemPicking: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  idBobina: z.string().trim().min(1).max(100),
  cantidad: z.number().int().positive().max(1_000_000_000),
  sentidoBobinado: z.string().trim().max(100).nullable().optional(),
});

export const agregarBobinaPreparacionPicking = createServerFn({ method: "POST" })
  .middleware([requireOperario])
  .validator((data: unknown) => agregarBobinaPreparacionSchema.parse(data))
  .handler(async ({ data, context }) => {
    return llamarRpcPreparacion<ResultadoPreparacionPicking>(
      "agregar_bobina_preparacion_picking",
      {
        p_id_preparacion: data.idPreparacion,
        p_id_item_picking: data.idItemPicking,
        p_id_bobina: data.idBobina.toUpperCase(),
        p_cantidad: data.cantidad,
        p_sentido_bobinado: data.sentidoBobinado || null,
        p_operario_id: context.operarioId,
        p_operario_nombre: context.operario,
      },
      "No se pudo guardar y reservar la bobina.",
    );
  });

const quitarBobinaPreparacionSchema = preparacionSchema.extend({
  idDetalle: z.string().uuid(),
});

export const quitarBobinaPreparacionPicking = createServerFn({ method: "POST" })
  .middleware([requireOperario])
  .validator((data: unknown) => quitarBobinaPreparacionSchema.parse(data))
  .handler(async ({ data, context }) => {
    return llamarRpcPreparacion<ResultadoPreparacionPicking>(
      "quitar_bobina_preparacion_picking",
      {
        p_id_preparacion: data.idPreparacion,
        p_id_detalle: data.idDetalle,
        p_operario_id: context.operarioId,
        p_operario_nombre: context.operario,
      },
      "No se pudo quitar la bobina de la preparación.",
    );
  });

export const marcarPreparacionPickingLista = createServerFn({ method: "POST" })
  .middleware([requireOperario])
  .validator((data: unknown) => preparacionSchema.parse(data))
  .handler(async ({ data, context }) => {
    return llamarRpcPreparacion<ResultadoPreparacionPicking>(
      "marcar_preparacion_picking_lista",
      {
        p_id_preparacion: data.idPreparacion,
        p_operario_id: context.operarioId,
        p_operario_nombre: context.operario,
      },
      "No se pudo marcar la preparación como Lista.",
    );
  });

export const reabrirPreparacionPicking = createServerFn({ method: "POST" })
  .middleware([requireOperario])
  .validator((data: unknown) => preparacionSchema.parse(data))
  .handler(async ({ data, context }) => {
    return llamarRpcPreparacion<ResultadoPreparacionPicking>(
      "reabrir_preparacion_picking",
      {
        p_id_preparacion: data.idPreparacion,
        p_operario_id: context.operarioId,
        p_operario_nombre: context.operario,
      },
      "No se pudo reabrir la preparación.",
    );
  });

export const entregarPreparacionPicking = createServerFn({ method: "POST" })
  .middleware([requireOperario])
  .validator((data: unknown) => preparacionSchema.parse(data))
  .handler(async ({ data, context }) => {
    return llamarRpcPreparacion<ResultadoPreparacionPicking>(
      "entregar_preparacion_picking",
      {
        p_id_preparacion: data.idPreparacion,
        p_operario_id: context.operarioId,
        p_operario_nombre: context.operario,
      },
      "No se pudo registrar la entrega de Picking.",
    );
  });

// División de bobinas: la pantalla nueva utilizará estos puntos de entrada.
// Las funciones anteriores permanecen disponibles durante el cambio de pantalla.
export type DivisionBobinaPicking = {
  id_division: string;
  id_preparacion: string;
  id_detalle_preparacion: string;
  id_bobina_origen: string;
  id_bobina_remanente: string;
  id_bobina_salida: string;
  cantidad_antes: number;
  cantidad_remanente: number;
  cantidad_salida: number;
  fecha_ingreso_original: string;
  fecha_vencimiento_original: string;
  datos_bobina_origen: Record<string, unknown>;
  operario_id: string;
  operario_nombre: string;
  fecha_division: string;
};

export type DivisionBobinaPickingConsultada = DivisionBobinaPicking & {
  codigo_etiqueta: string | null;
  descripcion: string | null;
  anio: string | null;
  alcohol: string | null;
  bobina_remanente_actual: BobinaPicking | null;
  bobina_salida_actual: BobinaPicking | null;
};

export type ResultadoDivisionesPicking = {
  ok: boolean;
  id_preparacion: string;
  estado: EstadoPreparacionPicking;
  fecha_entrega: string | null;
  operario_entrega: string | null;
  divisiones: DivisionBobinaPickingConsultada[];
};

export type ResultadoEntregaPickingConDivision = ResultadoPreparacionPicking & {
  divisiones: DivisionBobinaPicking[];
};

export const entregarPreparacionPickingConDivision = createServerFn({ method: "POST" })
  .middleware([requireOperario])
  .validator((data: unknown) => preparacionSchema.parse(data))
  .handler(async ({ data, context }) => {
    return llamarRpcPreparacion<ResultadoEntregaPickingConDivision>(
      "entregar_preparacion_picking_con_division",
      {
        p_id_preparacion: data.idPreparacion,
        p_operario_id: context.operarioId,
        p_operario_nombre: context.operario,
      },
      "No se pudo registrar la entrega con división de bobinas.",
    );
  });

export const consultarDivisionesPreparacionPicking = createServerFn({ method: "POST" })
  .middleware([requireOperario])
  .validator((data: unknown) => preparacionSchema.parse(data))
  .handler(async ({ data }) => {
    return llamarRpcPreparacion<ResultadoDivisionesPicking>(
      "consultar_divisiones_preparacion_picking",
      { p_id_preparacion: data.idPreparacion },
      "No se pudieron consultar las divisiones de la preparación.",
    );
  });

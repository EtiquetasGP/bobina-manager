import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

function lanzarErrorPicking(error: unknown, mensaje: string): never {
  console.error(mensaje, error);
  throw new Error(mensaje);
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

export const listarFechasPicking = createServerFn({ method: "GET" }).handler(
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

export const obtenerEstadoSyncPicking = createServerFn({
  method: "GET",
}).handler(async () => {
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

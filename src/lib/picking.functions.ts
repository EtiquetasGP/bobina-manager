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

  for (const valor of [
    candidato.message,
    candidato.details,
    candidato.hint,
  ]) {
    if (typeof valor === "string" && valor.trim()) {
      return valor.trim();
    }
  }

  return null;
}

function lanzarErrorPicking(
  error: unknown,
  mensaje: string,
  usarDetalle = false,
): never {
  console.error(mensaje, error);

  const detalle = usarDetalle
    ? extraerMensajeError(error)
    : null;

  throw new Error(detalle || mensaje);
}

type RpcResponse = {
  data: unknown;
  error: unknown;
};

type RpcClient = {
  rpc: (
    nombre: string,
    args?: Record<string, unknown>,
  ) => Promise<RpcResponse>;
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

export const listarFechasPicking = createServerFn({
  method: "GET",
})
  .middleware([requireOperario])
  .handler(async () => {
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
  });

const fechaSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const listarPickingFecha = createServerFn({
  method: "POST",
})
  .middleware([requireOperario])
  .validator((data: unknown) => fechaSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data: rows, error } = await rpcClient(
      supabaseAdmin,
    ).rpc("listar_picking_fecha", {
      p_fecha: data.fecha,
    });

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

export const detallePickingWo = createServerFn({
  method: "POST",
})
  .middleware([requireOperario])
  .validator((data: unknown) => detalleSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data: rows, error } = await rpcClient(
      supabaseAdmin,
    ).rpc("detalle_picking_wo", {
      p_wo: data.wo,
      p_fecha: data.fecha,
    });

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

export const consultarBobinaPicking = createServerFn({
  method: "POST",
})
  .middleware([requireOperario])
  .validator((data: unknown) => bobinaSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data: rows, error } = await rpcClient(
      supabaseAdmin,
    ).rpc("consultar_bobina_picking", {
      p_id_bobina: data.idBobina.trim().toUpperCase(),
    });

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

export const listarBobinasPicking = createServerFn({
  method: "POST",
})
  .middleware([requireOperario])
  .validator((data: unknown) =>
    listarBobinasSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data: rows, error } = await rpcClient(
      supabaseAdmin,
    ).rpc("listar_bobinas_picking", {
      p_codigo_etiqueta: data.codigoEtiqueta,
      p_limite: data.limite ?? 50,
    });

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

  // Compatibilidad con la pantalla actual.
  // El nombre enviado no se utiliza en el movimiento.
  operario: z.string().trim().max(200).optional(),

  entregas: z
    .array(
      z.object({
        idBobina: z.string().trim().min(1).max(100),
        idItemPicking: z.number().int().positive(),
        cantidad: z.number().int().positive(),
        sentidoBobinado: z
          .string()
          .trim()
          .max(100)
          .nullable()
          .optional(),
      }),
    )
    .min(1),
});

export const confirmarPicking = createServerFn({
  method: "POST",
})
  .middleware([requireOperario])
  .validator((data: unknown) =>
    confirmarPickingSchema.parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data: resultado, error } = await rpcClient(
      supabaseAdmin,
    ).rpc("registrar_picking", {
      p_wo: data.wo,
      p_fecha: data.fecha,

      // Nombre y apellido de la cuenta verificada.
      p_operario: context.operario,

      p_entregas: data.entregas.map((entrega) => ({
        id_bobina: entrega.idBobina.trim().toUpperCase(),
        id_item_picking: entrega.idItemPicking,
        cantidad: entrega.cantidad,
        sentido_bobinado: entrega.sentidoBobinado ?? null,
      })),
    });

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
})
  .middleware([requireOperario])
  .handler(async () => {
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

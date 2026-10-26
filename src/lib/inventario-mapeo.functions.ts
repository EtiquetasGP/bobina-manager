import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireOperario } from "@/lib/operario.middleware";

export type InventarioMapeo = {
  id_inventario: string;
  sector: string;
  posicion: string | null;
  altura: string | null;
  estado: "EN_CURSO" | "FINALIZADO" | "CANCELADO";
  fecha_inicio: string;
  ubicacion_activa: string | null;
  total_escaneados: number;
};
export type FilaMapeo = {
  codigo: string;
  esperada: boolean;
  resultado:
    | "FALTANTE"
    | "NO_RECONOCIDA"
    | "NO_ESPERADA"
    | "DIFERENCIA_UBICACION"
    | "COINCIDE"
    | "ESTADO_DISTINTO_DE_ALMACEN";
  informacion_anterior: {
    codigo_etiqueta?: string;
    descripcion?: string;
    cantidad_actual?: number;
    estado?: string;
    año?: string;
    alcohol?: string;
    proveedor?: string;
    fecha_ingreso?: string;
    fecha_vencimiento?: string;
  } | null;
  ubicacion_anterior: string | null;
  ubicacion_encontrada: string | null;
  ubicacion_actual: string | null;
  fecha_escaneo: string | null;
};
export type ResultadoMapeo = Omit<InventarioMapeo, "estado"> & {
  estado: "FINALIZADO";
  operario_nombre: string;
  fecha_finalizacion: string;
  filas: FilaMapeo[];
  resumen: {
    esperadas: number;
    escaneadas: number;
    faltantes: number;
    no_esperadas: number;
    diferencias_ubicacion: number;
    no_reconocidas: number;
    otro_estado: number;
  };
};
export type RespuestaLecturaMapeo = {
  tipo: "UBICACION" | "BOBINA" | "CONFIRMAR";
  codigo: string;
  ubicacion_activa: string;
  ubicacion_anterior_lectura?: string;
  total_escaneados?: number;
  mensaje: string;
};
async function rpc<T>(nombre: string, argumentos: Record<string, unknown>): Promise<T> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc(nombre as never, argumentos as never);
  if (error) {
    console.error(nombre, error);
    throw new Error(error.message || "No se pudo completar el inventario.");
  }
  return data as T;
}
const idSchema = z.object({ id_inventario: z.string().uuid() });
export const obtenerMapeo = createServerFn({ method: "GET" })
  .middleware([requireOperario])
  .validator((data: unknown) =>
    z.object({ id_inventario: z.string().uuid().nullable() }).parse(data),
  )
  .handler(async ({ data, context }) =>
    rpc<InventarioMapeo | ResultadoMapeo | null>("obtener_inventario_mapeo", {
      p_operario_id: context.operarioId,
      p_id_inventario: data.id_inventario,
    }),
  );
export const iniciarMapeo = createServerFn({ method: "POST" })
  .middleware([requireOperario])
  .validator((data: unknown) =>
    idSchema
      .extend({
        sector: z
          .string()
          .trim()
          .toUpperCase()
          .regex(/^[A-Z]+$/)
          .max(30),
        posicion: z
          .string()
          .regex(/^[0-9]+$/)
          .max(10)
          .nullable(),
        altura: z
          .string()
          .regex(/^[0-9]+$/)
          .max(10)
          .nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) =>
    rpc<InventarioMapeo | ResultadoMapeo>("iniciar_inventario_mapeo", {
      p_id_inventario: data.id_inventario,
      p_sector: data.sector,
      p_posicion: data.posicion,
      p_altura: data.altura,
      p_operario_id: context.operarioId,
      p_operario_nombre: context.operario,
    }),
  );
export const escanearMapeo = createServerFn({ method: "POST" })
  .middleware([requireOperario])
  .validator((data: unknown) =>
    idSchema
      .extend({
        id_lectura: z.string().uuid(),
        codigo: z.string().trim().toUpperCase().min(1).max(100),
        ubicacion: z.string().trim().toUpperCase().max(100).nullable(),
        confirmar_traslado: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) =>
    rpc<RespuestaLecturaMapeo>("registrar_lectura_inventario_mapeo", {
      p_id_inventario: data.id_inventario,
      p_id_lectura: data.id_lectura,
      p_codigo: data.codigo,
      p_ubicacion: data.ubicacion,
      p_confirmar_traslado: data.confirmar_traslado,
      p_operario_id: context.operarioId,
    }),
  );
export const finalizarMapeo = createServerFn({ method: "POST" })
  .middleware([requireOperario])
  .validator((data: unknown) => idSchema.parse(data))
  .handler(async ({ data, context }) =>
    rpc<ResultadoMapeo>("finalizar_inventario_mapeo", {
      p_id_inventario: data.id_inventario,
      p_operario_id: context.operarioId,
    }),
  );
export const cancelarMapeo = createServerFn({ method: "POST" })
  .middleware([requireOperario])
  .validator((data: unknown) => idSchema.parse(data))
  .handler(async ({ data, context }) =>
    rpc<{ estado: "CANCELADO" }>("cancelar_inventario_mapeo", {
      p_id_inventario: data.id_inventario,
      p_operario_id: context.operarioId,
    }),
  );

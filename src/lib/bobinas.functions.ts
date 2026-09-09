import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

function lanzarErrorOperativo(error: unknown, mensaje: string): never {
  console.error(mensaje, error);
  throw new Error(mensaje);
}

const codigoSchema = z.object({
  codigo_etiqueta: z.string().trim().min(1).max(100),
});

const recepcionSchema = z.object({
  codigo_etiqueta: z.string().trim().min(1).max(100),
  descripcion: z.string().trim().max(500),
  cantidad: z.number().int().positive().max(1_000_000_000),
  proveedor: z.string().trim().max(200),
  ubicacion: z.string().trim().max(200),
  operario: z.string().trim().max(200),
});

export const buscarEtiqueta = createServerFn({ method: "POST" })
  .validator((data: unknown) => codigoSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data: row, error } = await supabaseAdmin
      .from("etiquetas")
      .select("codigo_etiqueta, descripcion")
      .eq("codigo_etiqueta", data.codigo_etiqueta)
      .maybeSingle();

    if (error) {
      lanzarErrorOperativo(
        error,
        "No se pudo consultar el código de etiqueta. Intente nuevamente.",
      );
    }

    return {
      existe: Boolean(row),
      descripcion: row?.descripcion ?? "",
    };
  });

export const registrarRecepcion = createServerFn({ method: "POST" })
  .validator((data: unknown) => recepcionSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data: idBobina, error } = await supabaseAdmin.rpc(
      "registrar_recepcion",
      {
        p_codigo_etiqueta: data.codigo_etiqueta,
        p_descripcion: data.descripcion,
        p_cantidad: data.cantidad,
        p_proveedor: data.proveedor || null,
        p_ubicacion: data.ubicacion || null,
        p_operario: data.operario || null,
      } as never,
    );

    if (error) {
      lanzarErrorOperativo(
        error,
        "No se pudo registrar la recepción. Intente nuevamente.",
      );
    }

    return {
      id_bobina: idBobina as unknown as string,
    };
  });

const idBobinaSchema = z.object({
  id_bobina: z.string().trim().min(1).max(100),
});

const devolucionSchema = z.object({
  id_bobina: z.string().trim().min(1).max(100),
  cantidad: z.number().int().positive().max(1_000_000_000),
  linea: z.string().trim().max(200),
  operario: z.string().trim().max(200),
  ubicacion: z.string().trim().max(200),
  observacion: z.string().trim().max(1000),
});

export type BobinaFicha = {
  id_bobina: string;
  codigo_etiqueta: string | null;
  descripcion: string | null;
  cantidad_actual: number | null;
  ubicacion: string | null;
  estado: string | null;
  vigencia: string | null;
  fecha_vencimiento: string | null;
  fecha_ingreso: string | null;
  proveedor: string | null;
  operario_ingreso: string | null;
  ultima_fecha_devolucion: string | null;
  ultima_linea: string | null;
  ultimo_operario_devolucion: string | null;
  origen_alta: string | null;
};

export const consultarBobina = createServerFn({ method: "POST" })
  .validator((data: unknown) => idBobinaSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data: rows, error } = await supabaseAdmin.rpc(
      "consultar_bobina",
      {
        p_id_bobina: data.id_bobina,
      } as never,
    );

    if (error) {
      lanzarErrorOperativo(
        error,
        "No se pudo consultar la bobina. Intente nuevamente.",
      );
    }

    const lista = (rows ?? []) as unknown as BobinaFicha[];
    const bobina: BobinaFicha | null = lista[0] ?? null;

    return { bobina };
  });

export const registrarDevolucion = createServerFn({ method: "POST" })
  .validator((data: unknown) => devolucionSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data: id, error } = await supabaseAdmin.rpc(
      "registrar_devolucion",
      {
        p_id_bobina: data.id_bobina,
        p_cantidad: data.cantidad,
        p_linea: data.linea || null,
        p_operario: data.operario || null,
        p_ubicacion: data.ubicacion || null,
        p_observacion: data.observacion || null,
      } as never,
    );

    if (error) {
      lanzarErrorOperativo(
        error,
        "No se pudo registrar la devolución. Intente nuevamente.",
      );
    }

    return {
      id_bobina: id as unknown as string,
    };
  });

const inventarioExistenteSchema = z.object({
  id_bobina: z.string().trim().min(1).max(100),
  cantidad: z.number().int().positive().max(1_000_000_000),
  ubicacion: z.string().trim().max(200),
  operario: z.string().trim().max(200),
  observacion: z.string().trim().max(1000),
});

const altaInventarioSchema = z.object({
  codigo_etiqueta: z.string().trim().min(1).max(100),
  descripcion: z.string().trim().min(1).max(500),
  cantidad: z.number().int().positive().max(1_000_000_000),
  fecha_ingreso: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/),
  proveedor: z.string().trim().max(200),
  ubicacion: z.string().trim().max(200),
  operario: z.string().trim().max(200),
  observacion: z.string().trim().max(1000),
});

export const registrarInventarioExistente = createServerFn({
  method: "POST",
})
  .validator((data: unknown) => inventarioExistenteSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data: id, error } = await supabaseAdmin.rpc(
      "registrar_inventario_existente",
      {
        p_id_bobina: data.id_bobina,
        p_cantidad: data.cantidad,
        p_ubicacion: data.ubicacion || null,
        p_operario: data.operario || null,
        p_observacion: data.observacion || null,
      } as never,
    );

    if (error) {
      lanzarErrorOperativo(
        error,
        "No se pudo registrar el inventario. Intente nuevamente.",
      );
    }

    return {
      id_bobina: id as unknown as string,
    };
  });

export const registrarAltaInventario = createServerFn({ method: "POST" })
  .validator((data: unknown) => altaInventarioSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data: id, error } = await supabaseAdmin.rpc(
      "registrar_alta_inventario",
      {
        p_codigo_etiqueta: data.codigo_etiqueta,
        p_descripcion: data.descripcion,
        p_cantidad: data.cantidad,
        p_fecha_ingreso: data.fecha_ingreso,
        p_proveedor: data.proveedor || null,
        p_ubicacion: data.ubicacion || null,
        p_operario: data.operario || null,
        p_observacion: data.observacion || null,
      } as never,
    );

    if (error) {
      lanzarErrorOperativo(
        error,
        "No se pudo dar de alta la bobina en inventario. Intente nuevamente.",
      );
    }

    return {
      id_bobina: id as unknown as string,
    };
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("etiquetas")
      .select("codigo_etiqueta, descripcion")
      .eq("codigo_etiqueta", data.codigo_etiqueta)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return { existe: Boolean(row), descripcion: row?.descripcion ?? "" };
  });

export const registrarRecepcion = createServerFn({ method: "POST" })
  .validator((data: unknown) => recepcionSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: idBobina, error } = await supabaseAdmin.rpc("registrar_recepcion", {
      p_codigo_etiqueta: data.codigo_etiqueta,
      p_descripcion: data.descripcion,
      p_cantidad: data.cantidad,
      p_proveedor: data.proveedor || null,
      p_ubicacion: data.ubicacion || null,
      p_operario: data.operario || null,
    } as never);

    if (error) throw new Error(error.message);
    return { id_bobina: idBobina as unknown as string };
  });

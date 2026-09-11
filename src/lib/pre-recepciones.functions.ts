import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

function lanzarErrorOperativo(
  error: unknown,
  mensaje: string,
): never {
  console.error(mensaje, error);
  throw new Error(mensaje);
}

const productoPreRecepcionSchema = z.object({
  codigo_etiqueta: z
    .string()
    .trim()
    .min(1)
    .max(100),

  descripcion: z
    .string()
    .trim()
    .max(500),

  cantidad_bobinas: z
    .number()
    .int()
    .min(1)
    .max(100),

  cantidad_por_bobina: z
    .number()
    .int()
    .positive()
    .max(1_000_000_000),
});

const registrarEnvioSchema = z.object({
  proveedor: z
    .string()
    .trim()
    .min(1)
    .max(200),

  numero_remito: z
    .string()
    .trim()
    .min(1)
    .max(200),

  fecha_despacho: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/),

  observacion: z
    .string()
    .trim()
    .max(1000),

  productos: z
    .array(productoPreRecepcionSchema)
    .min(1)
    .max(50),
});

export type ProductoPreRecepcion = {
  codigo_etiqueta: string;
  descripcion: string;
  cantidad_bobinas: number;
  cantidad_por_bobina: number;
};

export type PreRecepcionLinea = {
  id_pre_recepcion: number;
  id_envio: string;

  proveedor: string;
  numero_remito: string;
  fecha_despacho: string;

  codigo_etiqueta: string;
  descripcion: string;

  cantidad_bobinas: number;
  cantidad_por_bobina: number;

  observacion: string;

  estado:
    | "PENDIENTE"
    | "PARCIAL"
    | "RECIBIDA"
    | "CANCELADA";

  cantidad_bobinas_recibidas: number | null;
  ubicacion_recepcion: string | null;
  fecha_confirmacion: string | null;
  created_at: string;
};

export const registrarPreRecepcionEnvio =
  createServerFn({
    method: "POST",
  })
    .validator((data: unknown) =>
      registrarEnvioSchema.parse(data),
    )
    .handler(async ({ data }) => {
      const { supabaseAdmin } =
        await import(
          "@/integrations/supabase/client.server"
        );

      const { data: idEnvio, error } =
        await supabaseAdmin.rpc(
          "registrar_pre_recepcion_envio",
          {
            p_proveedor:
              data.proveedor,

            p_numero_remito:
              data.numero_remito,

            p_fecha_despacho:
              data.fecha_despacho,

            p_observacion:
              data.observacion || "",

            p_productos:
              data.productos,
          } as never,
        );

      if (error) {
        console.error(
          "Error registrando pre-recepción:",
          error,
        );

        /*
         * Si Supabase devuelve alguno de nuestros
         * mensajes operativos, intentamos conservarlo.
         */
        const mensajeSupabase =
          typeof error.message === "string"
            ? error.message
            : "";

        if (
          mensajeSupabase.includes(
            "Ya existe una pre-recepción",
          )
        ) {
          throw new Error(
            "Ya existe una pre-recepción para este proveedor y número de remito.",
          );
        }

        if (
          mensajeSupabase.includes(
            "es nuevo",
          )
        ) {
          throw new Error(
            mensajeSupabase,
          );
        }

        lanzarErrorOperativo(
          error,
          "No se pudo registrar el envío. Intente nuevamente.",
        );
      }

      return {
        id_envio:
          idEnvio as unknown as string,
      };
    });

export const listarPreRecepcionesPendientes =
  createServerFn({
    method: "GET",
  }).handler(async () => {
    const { supabaseAdmin } =
      await import(
        "@/integrations/supabase/client.server"
      );

    const { data, error } =
      await supabaseAdmin
        .from("pre_recepciones")
        .select(
          `
          id_pre_recepcion,
          id_envio,
          proveedor,
          numero_remito,
          fecha_despacho,
          codigo_etiqueta,
          descripcion,
          cantidad_bobinas,
          cantidad_por_bobina,
          observacion,
          estado,
          cantidad_bobinas_recibidas,
          ubicacion_recepcion,
          fecha_confirmacion,
          created_at
        `,
        )
        .in("estado", [
          "PENDIENTE",
          "PARCIAL",
        ])
        .order("fecha_despacho", {
          ascending: true,
        })
        .order("id_pre_recepcion", {
          ascending: true,
        });

    if (error) {
      lanzarErrorOperativo(
        error,
        "No se pudieron consultar las recepciones pendientes.",
      );
    }

    return {
      lineas:
        (data ??
          []) as unknown as PreRecepcionLinea[],
    };
  });

const envioSchema = z.object({
  id_envio: z
    .string()
    .uuid(),
});

export const consultarPreRecepcionEnvio =
  createServerFn({
    method: "POST",
  })
    .validator((data: unknown) =>
      envioSchema.parse(data),
    )
    .handler(async ({ data }) => {
      const { supabaseAdmin } =
        await import(
          "@/integrations/supabase/client.server"
        );

      const { data: rows, error } =
        await supabaseAdmin
          .from("pre_recepciones")
          .select(
            `
            id_pre_recepcion,
            id_envio,
            proveedor,
            numero_remito,
            fecha_despacho,
            codigo_etiqueta,
            descripcion,
            cantidad_bobinas,
            cantidad_por_bobina,
            observacion,
            estado,
            cantidad_bobinas_recibidas,
            ubicacion_recepcion,
            fecha_confirmacion,
            created_at
          `,
          )
          .eq(
            "id_envio",
            data.id_envio,
          )
          .order(
            "id_pre_recepcion",
            {
              ascending: true,
            },
          );

      if (error) {
        lanzarErrorOperativo(
          error,
          "No se pudo consultar el envío del proveedor.",
        );
      }

      return {
        lineas:
          (rows ??
            []) as unknown as PreRecepcionLinea[],
      };
    });

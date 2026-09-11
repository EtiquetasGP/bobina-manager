import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

function lanzarErrorOperativo(
  error: unknown,
  mensaje: string,
): never {
  console.error(mensaje, error);
  throw new Error(mensaje);
}

/*
 * =====================================================
 * PRE-RECEPCIÓN: NUEVO ENVÍO DEL PROVEEDOR
 * =====================================================
 */

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

        const mensajeSupabase =
          typeof error.message ===
          "string"
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

/*
 * =====================================================
 * LISTAR ENVÍOS PENDIENTES / PARCIALES
 * =====================================================
 */

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

/*
 * =====================================================
 * CONSULTAR UN ENVÍO
 * =====================================================
 */

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

/*
 * =====================================================
 * CONFIRMAR RECEPCIÓN PARCIAL / TOTAL DEL PROVEEDOR
 * =====================================================
 */

const lineaConfirmacionSchema = z.object({
  id_pre_recepcion: z
    .number()
    .int()
    .positive(),

  cantidad_recibida: z
    .number()
    .int()
    .min(0)
    .max(100),

  ubicacion: z
    .string()
    .trim()
    .max(200),
});

const confirmarRecepcionProveedorSchema =
  z.object({
    id_envio: z
      .string()
      .uuid(),

    operario: z
      .string()
      .trim()
      .max(200),

    lineas: z
      .array(
        lineaConfirmacionSchema,
      )
      .min(1)
      .max(50),
  });

export type LineaConfirmacionProveedor = {
  id_pre_recepcion: number;
  cantidad_recibida: number;
  ubicacion: string;
};

export type DetalleConfirmacionProveedor = {
  id_pre_recepcion: number;

  codigo_etiqueta: string;

  cantidad_declarada: number;

  cantidad_recibida_antes: number;
  cantidad_recibida_ahora: number;
  cantidad_recibida_total: number;

  cantidad_pendiente: number;

  ids_bobinas: string[];
};

export type ResultadoConfirmacionProveedor = {
  ok: boolean;

  id_envio: string;

  cantidad_creada: number;

  ids_bobinas: string[];

  detalles:
    DetalleConfirmacionProveedor[];
};

export const confirmarRecepcionProveedor =
  createServerFn({
    method: "POST",
  })
    .validator((data: unknown) =>
      confirmarRecepcionProveedorSchema.parse(
        data,
      ),
    )
    .handler(async ({ data }) => {
      const { supabaseAdmin } =
        await import(
          "@/integrations/supabase/client.server"
        );

      const { data: resultado, error } =
        await supabaseAdmin.rpc(
          "confirmar_recepcion_proveedor",
          {
            p_id_envio:
              data.id_envio,

            p_operario:
              data.operario ||
              null,

            p_lineas:
              data.lineas,
          } as never,
        );

      if (error) {
        console.error(
          "Error confirmando recepción de proveedor:",
          error,
        );

        const mensajeSupabase =
          typeof error.message ===
          "string"
            ? error.message
            : "";

        /*
         * Conservamos los mensajes operativos
         * generados por nuestra función SQL.
         */

        if (
          mensajeSupabase.includes(
            "quedan",
          ) &&
          mensajeSupabase.includes(
            "bobinas pendientes",
          )
        ) {
          throw new Error(
            mensajeSupabase,
          );
        }

        if (
          mensajeSupabase.includes(
            "ya fue recibido completamente",
          )
        ) {
          throw new Error(
            mensajeSupabase,
          );
        }

        if (
          mensajeSupabase.includes(
            "Debe indicar la ubicación",
          )
        ) {
          throw new Error(
            mensajeSupabase,
          );
        }

        if (
          mensajeSupabase.includes(
            "Debe registrar al menos una bobina recibida",
          )
        ) {
          throw new Error(
            "Debe registrar al menos una bobina recibida.",
          );
        }

        if (
          mensajeSupabase.includes(
            "No se encontró",
          )
        ) {
          throw new Error(
            mensajeSupabase,
          );
        }

        lanzarErrorOperativo(
          error,
          "No se pudo confirmar la recepción del proveedor. Intente nuevamente.",
        );
      }

      const datos =
        resultado as unknown as ResultadoConfirmacionProveedor;

      return {
        ok:
          datos.ok,

        id_envio:
          datos.id_envio,

        cantidad_creada:
          Number(
            datos.cantidad_creada,
          ),

        ids_bobinas:
          datos.ids_bobinas ??
          [],

        detalles:
          datos.detalles ??
          [],
      };
    });

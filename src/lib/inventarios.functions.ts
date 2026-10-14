import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireOperario } from "@/lib/operario.middleware";

/*
 * TIPOS
 */

export type UbicacionInventario = {
  sector: string;
  posicion: string;
  altura: string;
  ubicacion: string;
};

export type BobinaInventario = {
  id_bobina: string;
  codigo_etiqueta: string | null;
  descripcion: string | null;
  cantidad_actual: number | null;
  ubicacion: string | null;
  estado: string | null;
  fecha_ingreso: string | null;
  fecha_vencimiento: string | null;
  proveedor: string | null;
};

export type LecturaInventario = {
  codigo: string;
  fecha_escaneo: string;
  reconocida: boolean;
  bobina: BobinaInventario | null;
};

export type BobinaEncontradaInventario = {
  codigo: string;
  fecha_escaneo: string;
  bobina: BobinaInventario;
  informacion_al_inicio: BobinaInventario;
};

export type BobinaNoEsperadaInventario = {
  codigo: string;
  fecha_escaneo: string;
  bobina: BobinaInventario;
  motivo:
    | "UBICACION_SIN_FORMATO"
    | "OTRA_UBICACION"
    | "ESTADO_DISTINTO_DE_ALMACEN"
    | "NO_ESPERADA_AL_INICIO";
};

export type CodigoNoReconocidoInventario = {
  codigo: string;
  fecha_escaneo: string;
};

export type ResumenInventario = {
  total_esperadas: number;
  total_codigos_escaneados: number;
  total_encontradas: number;
  total_faltantes: number;
  total_bobinas_no_esperadas: number;
  total_codigos_no_reconocidos: number;
  total_etiquetas_faltantes: number;
};

export type InventarioIniciado = {
  id_inventario: string;
  sector: string;
  posicion: string | null;
  altura: string | null;
  fecha_inicio: string;
  estado: "EN_CURSO";
};

export type ResultadoEscaneoInventario = {
  ok: boolean;
  duplicado: boolean;
  codigo: string;
  reconocida?: boolean;
  total_escaneados: number;
  mensaje: string;
};

export type ResultadoInventario = {
  id_inventario: string;
  sector: string;
  posicion: string | null;
  altura: string | null;
  operario_nombre: string;
  fecha_inicio: string;
  fecha_finalizacion: string;
  estado: "FINALIZADO";

  bobinas_esperadas: BobinaInventario[];
  bobinas_escaneadas: LecturaInventario[];
  bobinas_encontradas: BobinaEncontradaInventario[];
  bobinas_faltantes: BobinaInventario[];
  bobinas_otra_ubicacion: BobinaNoEsperadaInventario[];
  codigos_no_reconocidos: CodigoNoReconocidoInventario[];

  resumen: ResumenInventario;
};

/*
 * MANEJO DE ERRORES
 */

function lanzarErrorInventario(
  error: unknown,
  mensaje: string,
): never {
  console.error(mensaje, error);

  if (error && typeof error === "object") {
    const detalle = (error as { message?: unknown }).message;

    if (
      typeof detalle === "string" &&
      detalle.trim() &&
      !detalle.includes("schema cache") &&
      !detalle.includes("permission denied")
    ) {
      throw new Error(detalle);
    }
  }

  throw new Error(mensaje);
}

/*
 * CONSULTAR UBICACIONES PARA LOS DESPLEGABLES
 */

export const listarUbicacionesInventario = createServerFn({
  method: "GET",
})
  .middleware([requireOperario])
  .handler(async () => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const ubicaciones = new Map<string, UbicacionInventario>();

    const tamanoPagina = 1000;
    let ultimoId: string | null = null;

    while (true) {
      let consulta = supabaseAdmin
        .from("bobinas")
        .select("id_bobina, ubicacion")
        .eq("estado", "ALMACEN")
        .like("ubicacion", "%.%.%")
        .order("id_bobina", { ascending: true })
        .limit(tamanoPagina);

      if (ultimoId !== null) {
        consulta = consulta.gt("id_bobina", ultimoId);
      }

      const { data, error } = await consulta;

      if (error) {
        lanzarErrorInventario(
          error,
          "No se pudieron consultar las ubicaciones.",
        );
      }

      const filas = (data ?? []) as unknown as {
        id_bobina: string;
        ubicacion: string | null;
      }[];

      if (filas.length === 0) break;

      for (const fila of filas) {
        const ubicacion = (fila.ubicacion ?? "")
          .trim()
          .toUpperCase();

        const partes = ubicacion.match(
          /^([A-Z]+)\.([0-9]+)\.([0-9]+)$/,
        );

        if (!partes) continue;

        ubicaciones.set(ubicacion, {
          sector: partes[1],
          posicion: partes[2],
          altura: partes[3],
          ubicacion,
        });
      }

      ultimoId = filas[filas.length - 1].id_bobina;
    }

    return {
      ubicaciones: Array.from(ubicaciones.values()).sort(
        (a, b) =>
          a.sector.localeCompare(b.sector) ||
          a.posicion.localeCompare(b.posicion, undefined, {
            numeric: true,
          }) ||
          a.altura.localeCompare(b.altura, undefined, {
            numeric: true,
          }),
      ),
    };
  });

/*
 * INICIAR INVENTARIO
 */

const iniciarSchema = z
  .object({
    id_inventario: z.string().uuid(),

    sector: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]+$/, "Debe seleccionar un sector válido."),

    posicion: z
      .string()
      .trim()
      .regex(/^[0-9]+$/)
      .nullable(),

    altura: z
      .string()
      .trim()
      .regex(/^[0-9]+$/)
      .nullable(),
  })
  .superRefine((datos, ctx) => {
    if (datos.altura !== null && datos.posicion === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["altura"],
        message: "Seleccione una posición antes de elegir la altura.",
      });
    }
  });

export const iniciarInventario = createServerFn({
  method: "POST",
})
  .middleware([requireOperario])
  .validator((data: unknown) => iniciarSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data: resultado, error } = await supabaseAdmin.rpc(
      "iniciar_inventario",
      {
        p_sector: data.sector,
        p_posicion: data.posicion,
        p_altura: data.altura,

        p_operario_id: context.operarioId,
        p_operario_nombre: context.operario,

        p_id_inventario: data.id_inventario,
      } as never,
    );

    if (error) {
      lanzarErrorInventario(
        error,
        "No se pudo iniciar el inventario.",
      );
    }

    return resultado as unknown as InventarioIniciado;
  });

/*
 * REGISTRAR UN ESCANEO
 */

const escaneoSchema = z.object({
  id_inventario: z.string().uuid(),

  codigo: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, "Debe escanear o ingresar un código.")
    .max(100),
});

export const registrarEscaneoInventario = createServerFn({
  method: "POST",
})
  .middleware([requireOperario])
  .validator((data: unknown) => escaneoSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data: resultado, error } = await supabaseAdmin.rpc(
      "registrar_escaneo_inventario",
      {
        p_id_inventario: data.id_inventario,
        p_codigo: data.codigo,
        p_operario_id: context.operarioId,
      } as never,
    );

    if (error) {
      lanzarErrorInventario(
        error,
        "No se pudo guardar el escaneo.",
      );
    }

    return resultado as unknown as ResultadoEscaneoInventario;
  });

/*
 * FINALIZAR Y OBTENER EL RESULTADO
 */

const finalizarSchema = z.object({
  id_inventario: z.string().uuid(),
});

export const finalizarInventario = createServerFn({
  method: "POST",
})
  .middleware([requireOperario])
  .validator((data: unknown) => finalizarSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data: resultado, error } = await supabaseAdmin.rpc(
      "finalizar_inventario",
      {
        p_id_inventario: data.id_inventario,
        p_operario_id: context.operarioId,
      } as never,
    );

    if (error) {
      lanzarErrorInventario(
        error,
        "No se pudo finalizar el inventario.",
      );
    }

    return resultado as unknown as ResultadoInventario;
  });

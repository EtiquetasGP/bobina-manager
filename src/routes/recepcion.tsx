import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardPlus,
  Loader2,
  PackageOpen,
  Printer,
  RefreshCw,
} from "lucide-react";

import {
  buscarEtiqueta,
  consultarBobina,
  registrarRecepcionMultiple,
  type BobinaFicha,
} from "@/lib/bobinas.functions";

import {
  confirmarRecepcionProveedor,
  listarPreRecepcionesPendientes,
  type DetalleConfirmacionProveedor,
  type PreRecepcionLinea,
} from "@/lib/pre-recepciones.functions";

import { generarEtiquetaZpl } from "@/lib/zebra-label";

import {
  obtenerImpresoraPredeterminada,
  enviarZpl,
} from "@/lib/browser-print";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/recepcion")({
  component: Recepcion,

  errorComponent: () => (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <p
        role="alert"
        className="rounded-md bg-destructive/10 p-4 text-base text-destructive"
      >
        No se pudo cargar la pantalla de recepción. Recargue la página.
      </p>
    </main>
  ),

  notFoundComponent: () => (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <p>Pantalla no encontrada.</p>
    </main>
  ),

  head: () => ({
    meta: [
      {
        title: "Recepción de Bobinas | Coquimbito",
      },
      {
        name: "description",
        content:
          "Registrar el ingreso de una o varias bobinas en planta Coquimbito.",
      },
      {
        property: "og:title",
        content: "Recepción de Bobinas | Coquimbito",
      },
      {
        property: "og:description",
        content:
          "Registrar el ingreso de una o varias bobinas en planta Coquimbito.",
      },
      {
        property: "og:type",
        content: "website",
      },
      {
        name: "twitter:card",
        content: "summary_large_image",
      },
    ],
  }),
});

type Exito = {
  ok: boolean;
  ids_bobinas: string[];
  cantidad_solicitada: number;
  cantidad_creada: number;
  mensaje: string;
  codigo_etiqueta: string;
  descripcion: string;
  cantidad: string;
};

type ExitoProveedor = {
  id_envio: string;
  proveedor: string;
  numero_remito: string;
  cantidad_creada: number;
  ids_bobinas: string[];
  detalles: DetalleConfirmacionProveedor[];
};

type Pantalla =
  | "inicio"
  | "manual"
  | "proveedor";

type EnvioPendiente = {
  id_envio: string;

  proveedor: string;
  numero_remito: string;
  fecha_despacho: string;

  observacion: string;

  cantidad_productos: number;
  cantidad_bobinas_pendientes: number;

  lineas: PreRecepcionLinea[];
};

type LineaRecepcionProveedorFormulario = {
  cantidad_recibida: string;
  cantidad_por_bobina: string;
  ubicacion: string;
};

const inputClass = "h-14 text-lg";

function formatearFecha(
  fecha: string,
) {
  const partes =
    fecha
      .slice(0, 10)
      .split("-");

  if (partes.length !== 3) {
    return fecha;
  }

  const [
    anio,
    mes,
    dia,
  ] = partes;

  return `${dia}/${mes}/${anio}`;
}

function Recepcion() {
  const router =
    useRouter();

  /*
   * =====================================================
   * FUNCIONES DE SERVIDOR
   * =====================================================
   */

  const lookup =
    useServerFn(
      buscarEtiqueta,
    );

  const consultar =
    useServerFn(
      consultarBobina,
    );

  const registrar =
    useServerFn(
      registrarRecepcionMultiple,
    );

  const listarPendientes =
    useServerFn(
      listarPreRecepcionesPendientes,
    );

  const confirmarProveedor =
    useServerFn(
      confirmarRecepcionProveedor,
    );

  /*
   * =====================================================
   * NAVEGACIÓN
   * =====================================================
   */

  const [
    pantalla,
    setPantalla,
  ] =
    useState<Pantalla>(
      "inicio",
    );

  const [
    envioSeleccionado,
    setEnvioSeleccionado,
  ] =
    useState<EnvioPendiente | null>(
      null,
    );

  /*
   * =====================================================
   * PRE-RECEPCIONES
   * =====================================================
   */

  const [
    lineasPendientes,
    setLineasPendientes,
  ] =
    useState<
      PreRecepcionLinea[]
    >([]);

  const [
    cargandoPendientes,
    setCargandoPendientes,
  ] =
    useState(false);

  const [
    errorPendientes,
    setErrorPendientes,
  ] =
    useState<string | null>(
      null,
    );

  const cargarPendientes =
    useCallback(
      async () => {
        setCargandoPendientes(
          true,
        );

        setErrorPendientes(
          null,
        );

        try {
          const res =
            await listarPendientes();

          setLineasPendientes(
            res.lineas,
          );
        } catch (e) {
          setErrorPendientes(
            e instanceof Error
              ? e.message
              : "No se pudieron consultar las recepciones pendientes.",
          );
        } finally {
          setCargandoPendientes(
            false,
          );
        }
      },
      [listarPendientes],
    );

  useEffect(() => {
    void cargarPendientes();
  }, [cargarPendientes]);

  /*
   * Agrupar líneas por envío.
   *
   * Para una línea parcial mostramos solamente
   * la cantidad que todavía queda pendiente.
   */

  const enviosPendientes =
    useMemo(() => {
      const mapa =
        new Map<
          string,
          EnvioPendiente
        >();

      for (
        const linea
        of lineasPendientes
      ) {
        const yaRecibidas =
          Number(
            linea.cantidad_bobinas_recibidas ??
              0,
          );

        const pendientes =
          Math.max(
            0,
            Number(
              linea.cantidad_bobinas,
            ) -
              yaRecibidas,
          );

        const existente =
          mapa.get(
            linea.id_envio,
          );

        if (existente) {
          existente.lineas.push(
            linea,
          );

          existente.cantidad_productos +=
            1;

          existente.cantidad_bobinas_pendientes +=
            pendientes;

          continue;
        }

        mapa.set(
          linea.id_envio,
          {
            id_envio:
              linea.id_envio,

            proveedor:
              linea.proveedor,

            numero_remito:
              linea.numero_remito,

            fecha_despacho:
              linea.fecha_despacho,

            observacion:
              linea.observacion,

            cantidad_productos:
              1,

            cantidad_bobinas_pendientes:
              pendientes,

            lineas: [
              linea,
            ],
          },
        );
      }

      return Array.from(
        mapa.values(),
      );
    }, [
      lineasPendientes,
    ]);

  /*
   * =====================================================
   * RECEPCIÓN MANUAL
   * =====================================================
   */

  const [
    codigo,
    setCodigo,
  ] =
    useState("");

  const [
    descripcion,
    setDescripcion,
  ] =
    useState("");

  const [
    descripcionBloqueada,
    setDescripcionBloqueada,
  ] =
    useState(false);

  const [
    cantidadBobinas,
    setCantidadBobinas,
  ] =
    useState("1");

  const [
    cantidad,
    setCantidad,
  ] =
    useState("");

  const [
    proveedor,
    setProveedor,
  ] =
    useState("");

  const [
    ubicacion,
    setUbicacion,
  ] =
    useState("");


  const [
    buscando,
    setBuscando,
  ] =
    useState(false);

  const [
    enviando,
    setEnviando,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    exito,
    setExito,
  ] =
    useState<Exito | null>(
      null,
    );

  /*
   * =====================================================
   * RECEPCIÓN DE PROVEEDOR
   * =====================================================
   */

  const [
    lineasProveedorFormulario,
    setLineasProveedorFormulario,
  ] =
    useState<
      Record<
        number,
        LineaRecepcionProveedorFormulario
      >
    >({});


  const [
    enviandoProveedor,
    setEnviandoProveedor,
  ] =
    useState(false);

  const [
    errorProveedor,
    setErrorProveedor,
  ] =
    useState<string | null>(
      null,
    );

  const [
    exitoProveedor,
    setExitoProveedor,
  ] =
    useState<ExitoProveedor | null>(
      null,
    );

  const recepcionProveedorEnCursoRef =
    useRef(false);

  /*
   * =====================================================
   * IMPRESIÓN
   * =====================================================
   */

  const [
    imprimiendo,
    setImprimiendo,
  ] =
    useState(false);

  const [
    idsImpresos,
    setIdsImpresos,
  ] =
    useState<string[]>(
      [],
    );

  const [
    idsPendientesImpresion,
    setIdsPendientesImpresion,
  ] =
    useState<string[]>(
      [],
    );

  const [
    errorImpresion,
    setErrorImpresion,
  ] =
    useState<string | null>(
      null,
    );

  const codigoActualRef =
    useRef(codigo);

  codigoActualRef.current =
    codigo;

  /*
   * =====================================================
   * LIMPIEZAS
   * =====================================================
   */

  const limpiar = () => {
    setCodigo("");
    setDescripcion("");
    setDescripcionBloqueada(
      false,
    );

    setCantidadBobinas(
      "1",
    );

    setCantidad("");

    setProveedor("");
    setUbicacion("");

    setBuscando(false);
    setEnviando(false);

    setError(null);
    setExito(null);

    setImprimiendo(false);

    setIdsImpresos([]);

    setIdsPendientesImpresion(
      [],
    );

    setErrorImpresion(
      null,
    );
  };

  const limpiarProveedor =
    () => {
      recepcionProveedorEnCursoRef.current =
        false;

      setEnvioSeleccionado(
        null,
      );

      setLineasProveedorFormulario(
        {},
      );

      setEnviandoProveedor(
        false,
      );

      setErrorProveedor(
        null,
      );

      setExitoProveedor(
        null,
      );
    };

  const volverInicio =
    () => {
      limpiar();
      limpiarProveedor();

      setPantalla(
        "inicio",
      );

      void cargarPendientes();
    };

  const abrirRecepcionManual =
    () => {
      limpiar();
      limpiarProveedor();

      setPantalla(
        "manual",
      );
    };

  /*
   * =====================================================
   * ABRIR ENVÍO DEL PROVEEDOR
   * =====================================================
   */

  const abrirEnvioProveedor =
    (
      envio: EnvioPendiente,
    ) => {
      limpiar();

      recepcionProveedorEnCursoRef.current =
        false;

      setErrorProveedor(
        null,
      );

      setExitoProveedor(
        null,
      );

      const formulario: Record<
        number,
        LineaRecepcionProveedorFormulario
      > = {};

      for (
        const linea
        of envio.lineas
      ) {
        const recibidas =
          Number(
            linea.cantidad_bobinas_recibidas ??
              0,
          );

        const pendientes =
          Math.max(
            0,
            Number(
              linea.cantidad_bobinas,
            ) -
              recibidas,
          );

        formulario[
          linea.id_pre_recepcion
        ] = {
          /*
           * Por defecto proponemos recibir
           * todo lo pendiente.
           */
          cantidad_recibida:
            String(
              pendientes,
            ),

          cantidad_por_bobina: "",
          ubicacion:
            linea.ubicacion_recepcion ??
            "",
        };
      }

      setLineasProveedorFormulario(
        formulario,
      );

      setEnvioSeleccionado(
        envio,
      );

      setPantalla(
        "proveedor",
      );
    };

  const actualizarLineaProveedor =
    (
      id: number,
      cambios: Partial<LineaRecepcionProveedorFormulario>,
    ) => {
      setLineasProveedorFormulario(
        (actuales) => ({
          ...actuales,

          [id]: {
            ...actuales[id],
            ...cambios,
          },
        }),
      );

      setErrorProveedor(
        null,
      );
    };

  /*
   * =====================================================
   * BÚSQUEDA CÓDIGO RECEPCIÓN MANUAL
   * =====================================================
   */

  const onChangeCodigo = (
    value: string,
  ) => {
    setCodigo(value);

    setDescripcion("");

    setDescripcionBloqueada(
      false,
    );

    setError(null);
  };

  const onBlurCodigo =
    async () => {
      const valor =
        codigo.trim();

      if (!valor) {
        setDescripcion("");

        setDescripcionBloqueada(
          false,
        );

        return;
      }

      setBuscando(true);
      setError(null);

      try {
        const res =
          await lookup({
            data: {
              codigo_etiqueta:
                valor,
            },
          });

        if (
          codigoActualRef.current.trim() !==
          valor
        ) {
          return;
        }

        if (res.existe) {
          setDescripcion(
            res.descripcion,
          );

          setDescripcionBloqueada(
            true,
          );
        } else {
          setDescripcion("");

          setDescripcionBloqueada(
            false,
          );
        }
      } catch (e) {
        if (
          codigoActualRef.current.trim() ===
          valor
        ) {
          setError(
            e instanceof Error
              ? e.message
              : "No se pudo consultar la etiqueta.",
          );
        }
      } finally {
        if (
          codigoActualRef.current.trim() ===
          valor
        ) {
          setBuscando(false);
        }
      }
    };

  /*
   * =====================================================
   * CONSULTAR BOBINA PARA IMPRESIÓN
   * =====================================================
   */

  const obtenerBobinaParaImprimir =
    async (
      idBobina: string,
    ): Promise<BobinaFicha> => {
      const res: {
        bobina:
          | BobinaFicha
          | null;
      } =
        await consultar({
          data: {
            id_bobina:
              idBobina,
          },
        });

      if (!res.bobina) {
        throw new Error(
          `No se pudo recuperar la información de ${idBobina}.`,
        );
      }

      return res.bobina;
    };

  /*
   * =====================================================
   * IMPRESIÓN ZEBRA
   * =====================================================
   */

  const imprimirEtiquetas =
    async (
      idsAImprimir: string[],
    ) => {
      if (
        idsAImprimir.length ===
        0
      ) {
        return;
      }

      if (imprimiendo) {
        return;
      }

      setImprimiendo(
        true,
      );

      setErrorImpresion(
        null,
      );

      let idEnProceso =
        "";

      try {
        const impresora =
          await obtenerImpresoraPredeterminada();

        for (
          const idBobina
          of idsAImprimir
        ) {
          idEnProceso =
            idBobina;

          const bobina =
            await obtenerBobinaParaImprimir(
              idBobina,
            );

          const zpl =
            generarEtiquetaZpl({
              id_bobina:
                bobina.id_bobina,

              codigo_etiqueta:
                bobina.codigo_etiqueta ??
                "",

              descripcion:
                bobina.descripcion ??
                "",

              cantidad:
                bobina.cantidad_actual ??
                0,
            });

          await enviarZpl(
            impresora,
            zpl,
          );

          setIdsImpresos(
            (
              anteriores,
            ) =>
              anteriores.includes(
                idBobina,
              )
                ? anteriores
                : [
                    ...anteriores,
                    idBobina,
                  ],
          );

          setIdsPendientesImpresion(
            (
              anteriores,
            ) =>
              anteriores.filter(
                (id) =>
                  id !==
                  idBobina,
              ),
          );
        }
      } catch (e) {
        console.error(
          "Error de impresión Zebra:",
          e,
        );

        setErrorImpresion(
          idEnProceso
            ? `La recepción quedó registrada, pero la impresión se detuvo en ${idEnProceso}.`
            : "La recepción quedó registrada, pero no se pudo acceder a la impresora Zebra.",
        );
      } finally {
        setImprimiendo(
          false,
        );
      }
    };

  /*
   * =====================================================
   * REGISTRAR RECEPCIÓN MANUAL
   * =====================================================
   */

  const onSubmit =
    async (
      event:
        React.FormEvent,
    ) => {
      event.preventDefault();

      if (enviando) {
        return;
      }

      setError(null);

      setErrorImpresion(
        null,
      );

      if (!proveedor.trim()) {
        return setError("Ingrese el proveedor.");
      }
      if (!ubicacion.trim()) {
        return setError("Ingrese la ubicación.");
      }

      const codigoLimpio =
        codigo.trim();

      const cantidadNum =
        Number(cantidad);

      const cantidadBobinasNum =
        Number(
          cantidadBobinas,
        );

      if (!codigoLimpio) {
        return setError(
          "Ingrese el código de etiqueta.",
        );
      }

      if (
        !descripcion.trim()
      ) {
        return setError(
          "La descripción es obligatoria para un código nuevo.",
        );
      }

      if (
        !Number.isInteger(
          cantidadBobinasNum,
        ) ||
        cantidadBobinasNum <
          1 ||
        cantidadBobinasNum >
          100
      ) {
        return setError(
          "La cantidad de bobinas debe ser un número entero entre 1 y 100.",
        );
      }

      if (
        !Number.isInteger(
          cantidadNum,
        ) ||
        cantidadNum <= 0
      ) {
        return setError(
          "La cantidad por bobina debe ser un número entero positivo.",
        );
      }

      setEnviando(true);

      try {
        const res =
          await registrar({
            data: {
              codigo_etiqueta:
                codigoLimpio,

              descripcion:
                descripcion.trim(),

              cantidad:
                cantidadNum,

              cantidad_bobinas:
                cantidadBobinasNum,

              proveedor:
                proveedor.trim(),

              ubicacion:
                ubicacion.trim(),
            },
          });

        if (
          !res.ok &&
          res.cantidad_creada ===
            0
        ) {
          setError(
            res.mensaje,
          );

          return;
        }

        const datosExito: Exito =
          {
            ok: res.ok,

            ids_bobinas:
              res.ids_bobinas,

            cantidad_solicitada:
              res.cantidad_solicitada,

            cantidad_creada:
              res.cantidad_creada,

            mensaje:
              res.mensaje,

            codigo_etiqueta:
              codigoLimpio,

            descripcion:
              descripcion.trim(),

            cantidad:
              String(
                cantidadNum,
              ),
          };

        setExito(
          datosExito,
        );

        setIdsImpresos(
          [],
        );

        setIdsPendientesImpresion(
          [
            ...res.ids_bobinas,
          ],
        );

        await imprimirEtiquetas(
          res.ids_bobinas,
        );
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "No se pudo registrar la recepción.",
        );
      } finally {
        setEnviando(
          false,
        );
      }
    };

  /*
   * =====================================================
   * CONFIRMAR RECEPCIÓN DEL PROVEEDOR
   * =====================================================
   */

  const confirmarEnvioProveedor =
    async () => {
      if (
        !envioSeleccionado
      ) {
        return;
      }

      if (
        enviandoProveedor ||
        recepcionProveedorEnCursoRef.current
      ) {
        return;
      }

      setErrorProveedor(
        null,
      );

      setErrorImpresion(
        null,
      );

      let totalRecibido =
        0;

      const lineasEnviar =
        [];

      for (
        const linea
        of envioSeleccionado.lineas
      ) {
        const formulario =
          lineasProveedorFormulario[
            linea.id_pre_recepcion
          ];

        if (!formulario) {
          return setErrorProveedor(
            `Faltan datos para ${linea.codigo_etiqueta}.`,
          );
        }

        if (!formulario.cantidad_recibida.trim()) {
          return setErrorProveedor(`Complete las bobinas recibidas de ${linea.codigo_etiqueta}.`);
        }
        const cantidadCorregida = formulario.cantidad_por_bobina.trim()
          ? Number(formulario.cantidad_por_bobina) : null;
        if (cantidadCorregida !== null && (
          !Number.isInteger(cantidadCorregida) || cantidadCorregida <= 0 || cantidadCorregida > 1_000_000_000
        )) {
          return setErrorProveedor(`La cantidad por bobina de ${linea.codigo_etiqueta} debe ser un entero entre 1 y 1.000.000.000.`);
        }

        const cantidadRecibida =
          Number(
            formulario.cantidad_recibida,
          );

        const yaRecibidas =
          Number(
            linea.cantidad_bobinas_recibidas ??
              0,
          );

        const pendientes =
          Math.max(
            0,
            Number(
              linea.cantidad_bobinas,
            ) -
              yaRecibidas,
          );

        if (
          !Number.isInteger(
            cantidadRecibida,
          ) ||
          cantidadRecibida <
            0
        ) {
          return setErrorProveedor(
            `La cantidad recibida de ${linea.codigo_etiqueta} debe ser un número entero igual o mayor a cero.`,
          );
        }

        if (
          cantidadRecibida >
          pendientes
        ) {
          return setErrorProveedor(
            `Para ${linea.codigo_etiqueta} quedan ${pendientes} bobinas pendientes.`,
          );
        }

        if (
          cantidadRecibida >
            0 &&
          !formulario.ubicacion.trim()
        ) {
          return setErrorProveedor(
            `Ingrese la ubicación para ${linea.codigo_etiqueta}.`,
          );
        }

        totalRecibido +=
          cantidadRecibida;

        lineasEnviar.push({
          cantidad_por_bobina: cantidadRecibida > 0 ? cantidadCorregida : null,
          id_pre_recepcion:
            linea.id_pre_recepcion,

          cantidad_recibida:
            cantidadRecibida,

          ubicacion:
            formulario.ubicacion.trim(),
        });
      }

      if (
        totalRecibido ===
        0
      ) {
        return setErrorProveedor(
          "Debe registrar al menos una bobina recibida.",
        );
      }

      recepcionProveedorEnCursoRef.current =
        true;

      setEnviandoProveedor(
        true,
      );

      try {
        const res =
          await confirmarProveedor({
            data: {
              id_envio:
                envioSeleccionado.id_envio,

              lineas:
                lineasEnviar,
            },
          });

        setExitoProveedor({
          id_envio:
            envioSeleccionado.id_envio,

          proveedor:
            envioSeleccionado.proveedor,

          numero_remito:
            envioSeleccionado.numero_remito,

          cantidad_creada:
            res.cantidad_creada,

          ids_bobinas:
            res.ids_bobinas,

          detalles:
            res.detalles,
        });

        /*
         * Las bobinas YA existen en Supabase
         * antes de intentar imprimir.
         */

        setIdsImpresos(
          [],
        );

        setIdsPendientesImpresion(
          [
            ...res.ids_bobinas,
          ],
        );

        await imprimirEtiquetas(
          res.ids_bobinas,
        );
      } catch (e) {
        recepcionProveedorEnCursoRef.current =
          false;

        setErrorProveedor(
          e instanceof Error
            ? e.message
            : "No se pudo confirmar la recepción del proveedor.",
        );
      } finally {
        setEnviandoProveedor(
          false,
        );
      }
    };

  /*
   * =====================================================
   * ÉXITO RECEPCIÓN MANUAL
   * =====================================================
   */

  if (exito) {
    const recepcionParcial =
      !exito.ok;

    const esUnaBobina =
      exito.cantidad_creada ===
      1;

    const impresionTerminada =
      !imprimiendo &&
      idsPendientesImpresion.length ===
        0 &&
      idsImpresos.length ===
        exito.cantidad_creada &&
      exito.cantidad_creada >
        0;

    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-10">

        <div className="rounded-xl border border-border bg-card p-8 text-center">

          {recepcionParcial ? (
            <AlertTriangle
              className="mx-auto size-16 text-destructive"
              aria-hidden="true"
            />
          ) : (
            <CheckCircle2
              className="mx-auto size-16 text-primary"
              aria-hidden="true"
            />
          )}

          <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">

            {recepcionParcial
              ? "RECEPCIÓN PARCIAL"
              : esUnaBobina
                ? "BOBINA REGISTRADA CORRECTAMENTE"
                : `${exito.cantidad_creada} BOBINAS REGISTRADAS CORRECTAMENTE`}

          </h1>

          {recepcionParcial && (
            <div
              role="alert"
              className="mt-6 rounded-md bg-destructive/10 p-4 text-left text-destructive"
            >

              <p className="font-semibold">
                {exito.mensaje}
              </p>

              <p className="mt-2 text-sm">
                No vuelva a registrar la recepción completa sin revisar primero los CQ creados.
              </p>

            </div>
          )}

          {esUnaBobina ? (
            <>
              <p className="mt-6 text-sm uppercase text-muted-foreground">
                ID Bobina
              </p>

              <p className="text-4xl font-bold tabular-nums">
                {exito.ids_bobinas[0]}
              </p>
            </>
          ) : (
            <>
              <p className="mt-6 text-sm uppercase text-muted-foreground">
                IDs de bobinas generados
              </p>

              <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-border bg-background p-4">

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">

                  {exito.ids_bobinas.map(
                    (id) => (
                      <div
                        key={id}
                        className="rounded-md border border-border px-3 py-2 text-center text-base font-bold tabular-nums"
                      >
                        {id}
                      </div>
                    ),
                  )}

                </div>

              </div>
            </>
          )}

          <dl className="mt-8 space-y-3 text-left text-lg">

            <div className="flex justify-between gap-4 border-b border-border pb-2">

              <dt className="text-muted-foreground">
                Código de etiqueta
              </dt>

              <dd className="font-semibold">
                {exito.codigo_etiqueta}
              </dd>

            </div>

            <div className="flex justify-between gap-4 border-b border-border pb-2">

              <dt className="text-muted-foreground">
                Descripción
              </dt>

              <dd className="text-right font-semibold">
                {exito.descripcion}
              </dd>

            </div>

            <div className="flex justify-between gap-4 border-b border-border pb-2">

              <dt className="text-muted-foreground">
                Cantidad por bobina
              </dt>

              <dd className="font-semibold tabular-nums">
                {exito.cantidad}
              </dd>

            </div>

            <div className="flex justify-between gap-4 border-b border-border pb-2">

              <dt className="text-muted-foreground">
                Bobinas solicitadas
              </dt>

              <dd className="font-semibold tabular-nums">
                {exito.cantidad_solicitada}
              </dd>

            </div>

            <div className="flex justify-between gap-4">

              <dt className="text-muted-foreground">
                Bobinas creadas
              </dt>

              <dd className="font-semibold tabular-nums">
                {exito.cantidad_creada}
              </dd>

            </div>

          </dl>

          <div className="mt-8">

            {imprimiendo && (
              <div className="rounded-md border border-border bg-background p-4">

                <p className="flex items-center justify-center gap-2 text-lg font-semibold">

                  <Loader2
                    className="size-5 animate-spin"
                    aria-hidden="true"
                  />

                  IMPRIMIENDO ETIQUETAS…

                </p>

                <p className="mt-2 text-sm text-muted-foreground">
                  {idsImpresos.length} de{" "}
                  {exito.cantidad_creada} bobinas enviadas a la Zebra
                </p>

              </div>
            )}

            {impresionTerminada && (
              <div className="rounded-md bg-primary/10 p-4">

                <div className="flex items-center justify-center gap-2">

                  <Printer
                    className="size-5 text-primary"
                    aria-hidden="true"
                  />

                  <p className="font-semibold">
                    IMPRESIÓN COMPLETADA
                  </p>

                </div>

                <p className="mt-2 text-sm">
                  Se imprimieron 2 stickers por cada bobina.
                </p>

              </div>
            )}

            {errorImpresion && (
              <div
                role="alert"
                className="rounded-md bg-destructive/10 p-4 text-left text-destructive"
              >

                <p className="font-semibold">
                  {errorImpresion}
                </p>

                <p className="mt-2 text-sm">
                  Las bobinas YA quedaron registradas en Supabase. No vuelva a cargarlas.
                </p>

                {idsPendientesImpresion.length >
                  0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="mt-4 h-14 w-full text-base"
                    disabled={
                      imprimiendo
                    }
                    onClick={() =>
                      void imprimirEtiquetas(
                        idsPendientesImpresion,
                      )
                    }
                  >

                    <Printer
                      className="mr-2 size-5"
                      aria-hidden="true"
                    />

                    REIMPRIMIR ETIQUETAS PENDIENTES

                  </Button>
                )}

              </div>
            )}

          </div>

          <div className="mt-8 flex flex-col gap-3">

            <Button
              size="lg"
              className="h-16 text-xl font-semibold"
              disabled={
                imprimiendo
              }
              onClick={() => {
                volverInicio();
                router.invalidate();
              }}
            >
              NUEVA RECEPCIÓN
            </Button>

            <Button
              asChild
              variant="outline"
              size="lg"
              className={
                imprimiendo
                  ? "pointer-events-none h-12 text-base opacity-50"
                  : "h-12 text-base"
              }
            >
              <Link to="/">
                VOLVER AL MENÚ
              </Link>
            </Button>

          </div>

        </div>

      </main>
    );
  }

  /*
   * =====================================================
   * ÉXITO RECEPCIÓN PROVEEDOR
   * =====================================================
   */

  if (exitoProveedor) {
    const quedanPendientes =
      exitoProveedor.detalles.some(
        (detalle) =>
          Number(
            detalle.cantidad_pendiente,
          ) > 0,
      );

    const totalPendiente =
      exitoProveedor.detalles.reduce(
        (
          acumulado,
          detalle,
        ) =>
          acumulado +
          Number(
            detalle.cantidad_pendiente,
          ),
        0,
      );

    const impresionTerminada =
      !imprimiendo &&
      idsPendientesImpresion.length ===
        0 &&
      idsImpresos.length ===
        exitoProveedor.cantidad_creada &&
      exitoProveedor.cantidad_creada >
        0;

    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-10">

        <div className="rounded-xl border border-border bg-card p-8 text-center">

          {quedanPendientes ? (
            <AlertTriangle
              className="mx-auto size-16 text-primary"
              aria-hidden="true"
            />
          ) : (
            <CheckCircle2
              className="mx-auto size-16 text-primary"
              aria-hidden="true"
            />
          )}

          <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">

            {quedanPendientes
              ? "RECEPCIÓN PARCIAL REGISTRADA"
              : "RECEPCIÓN COMPLETA REGISTRADA"}

          </h1>

          <p className="mt-2 text-base text-muted-foreground">

            {exitoProveedor.proveedor}
            {" · "}
            Remito{" "}
            {exitoProveedor.numero_remito}

          </p>

          <div className="mt-7 rounded-lg bg-muted p-5">

            <p className="text-sm uppercase text-muted-foreground">
              Bobinas creadas ahora
            </p>

            <p className="mt-1 text-4xl font-bold">
              {exitoProveedor.cantidad_creada}
            </p>

            {quedanPendientes && (
              <p className="mt-2 text-sm text-muted-foreground">
                Quedan {totalPendiente} bobinas pendientes de recepción.
              </p>
            )}

          </div>

          <p className="mt-7 text-sm uppercase text-muted-foreground">
            CQ generados
          </p>

          <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-border bg-background p-4">

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">

              {exitoProveedor.ids_bobinas.map(
                (id) => (
                  <div
                    key={id}
                    className="rounded-md border border-border px-3 py-2 text-center text-base font-bold tabular-nums"
                  >
                    {id}
                  </div>
                ),
              )}

            </div>

          </div>

          <div className="mt-7 space-y-3 text-left">

            {exitoProveedor.detalles.map(
              (detalle) => (
                <div
                  key={
                    detalle.id_pre_recepcion
                  }
                  className="rounded-lg border border-border p-4"
                >

                  <p className="font-bold">
                    {detalle.codigo_etiqueta}
                  </p>

                  <div className="mt-2 grid gap-1 text-sm text-muted-foreground sm:grid-cols-3">

                    <p>
                      Recibidas ahora:{" "}
                      <span className="font-semibold text-foreground">
                        {detalle.cantidad_recibida_ahora}
                      </span>
                    </p>

                    <p>
                      Recibidas total:{" "}
                      <span className="font-semibold text-foreground">
                        {detalle.cantidad_recibida_total}
                      </span>
                    </p>

                    <p>
                      Pendientes:{" "}
                      <span className="font-semibold text-foreground">
                        {detalle.cantidad_pendiente}
                      </span>
                    </p>

                  </div>

                </div>
              ),
            )}

          </div>

          <div className="mt-8">

            {imprimiendo && (
              <div className="rounded-md border border-border bg-background p-4">

                <p className="flex items-center justify-center gap-2 text-lg font-semibold">

                  <Loader2
                    className="size-5 animate-spin"
                    aria-hidden="true"
                  />

                  IMPRIMIENDO ETIQUETAS…

                </p>

                <p className="mt-2 text-sm text-muted-foreground">

                  {idsImpresos.length} de{" "}
                  {exitoProveedor.cantidad_creada} bobinas enviadas a la Zebra

                </p>

              </div>
            )}

            {impresionTerminada && (
              <div className="rounded-md bg-primary/10 p-4">

                <div className="flex items-center justify-center gap-2">

                  <Printer
                    className="size-5 text-primary"
                    aria-hidden="true"
                  />

                  <p className="font-semibold">
                    IMPRESIÓN COMPLETADA
                  </p>

                </div>

                <p className="mt-2 text-sm">
                  Se imprimieron 2 stickers por cada bobina creada.
                </p>

              </div>
            )}

            {errorImpresion && (
              <div
                role="alert"
                className="rounded-md bg-destructive/10 p-4 text-left text-destructive"
              >

                <p className="font-semibold">
                  {errorImpresion}
                </p>

                <p className="mt-2 text-sm">
                  Las bobinas YA quedaron registradas en Supabase. No vuelva a confirmar esta recepción.
                </p>

                {idsPendientesImpresion.length >
                  0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="mt-4 h-14 w-full text-base"
                    disabled={
                      imprimiendo
                    }
                    onClick={() =>
                      void imprimirEtiquetas(
                        idsPendientesImpresion,
                      )
                    }
                  >

                    <Printer
                      className="mr-2 size-5"
                      aria-hidden="true"
                    />

                    REIMPRIMIR ETIQUETAS PENDIENTES

                  </Button>
                )}

              </div>
            )}

          </div>

          <Button
            type="button"
            size="lg"
            className="mt-8 h-16 w-full text-xl font-semibold"
            disabled={
              imprimiendo
            }
            onClick={() => {
              volverInicio();
              router.invalidate();
            }}
          >
            VOLVER A RECEPCIÓN
          </Button>

        </div>

      </main>
    );
  }

  /*
   * =====================================================
   * DETALLE Y CONFIRMACIÓN DE PROVEEDOR
   * =====================================================
   */

  if (
    pantalla ===
      "proveedor" &&
    envioSeleccionado
  ) {
    const totalARecibir =
      envioSeleccionado.lineas.reduce(
        (
          acumulado,
          linea,
        ) => {
          const valor =
            Number(
              lineasProveedorFormulario[
                linea.id_pre_recepcion
              ]?.cantidad_recibida ??
                0,
            );

          if (
            !Number.isInteger(
              valor,
            ) ||
            valor < 0
          ) {
            return acumulado;
          }

          return (
            acumulado +
            valor
          );
        },
        0,
      );

    return (
      <main className="mx-auto max-w-3xl px-6 py-10">

        <button
          type="button"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          onClick={
            volverInicio
          }
        >

          <ArrowLeft
            className="size-4"
            aria-hidden="true"
          />

          Volver a Recepción

        </button>

        <div className="mt-6 flex items-start gap-4">

          <PackageOpen
            className="mt-1 size-9 shrink-0"
            aria-hidden="true"
          />

          <div>

            <h1 className="text-3xl font-bold tracking-tight">
              RECEPCIÓN DE PROVEEDOR
            </h1>

            <p className="mt-1 text-base text-muted-foreground">
              Verifique las bobinas que llegaron físicamente.
            </p>

          </div>

        </div>

        <section className="mt-8 rounded-xl border border-border bg-card p-5">

          <h2 className="text-lg font-bold">
            DATOS DEL ENVÍO
          </h2>

          <dl className="mt-4 text-base">

            <div className="flex justify-between gap-4 border-b border-border py-3">

              <dt className="text-muted-foreground">
                Proveedor
              </dt>

              <dd className="text-right font-semibold">
                {envioSeleccionado.proveedor}
              </dd>

            </div>

            <div className="flex justify-between gap-4 border-b border-border py-3">

              <dt className="text-muted-foreground">
                N.º de remito
              </dt>

              <dd className="text-right font-semibold">
                {envioSeleccionado.numero_remito}
              </dd>

            </div>

            <div className="flex justify-between gap-4 border-b border-border py-3">

              <dt className="text-muted-foreground">
                Fecha de despacho
              </dt>

              <dd className="text-right font-semibold">
                {formatearFecha(
                  envioSeleccionado.fecha_despacho,
                )}
              </dd>

            </div>

            <div className="flex justify-between gap-4 py-3">

              <dt className="text-muted-foreground">
                Bobinas pendientes del envío
              </dt>

              <dd className="font-semibold">
                {envioSeleccionado.cantidad_bobinas_pendientes}
              </dd>

            </div>

          </dl>

          {envioSeleccionado.observacion && (
            <div className="mt-4 rounded-lg bg-muted p-4">

              <p className="text-sm font-semibold">
                Observación del proveedor
              </p>

              <p className="mt-1 text-base">
                {envioSeleccionado.observacion}
              </p>

            </div>
          )}

        </section>


        <section className="mt-8">

          <h2 className="text-xl font-bold">
            PRODUCTOS DEL ENVÍO
          </h2>

          <div className="mt-4 space-y-5">

            {envioSeleccionado.lineas.map(
              (
                linea,
                indice,
              ) => {
                const yaRecibidas =
                  Number(
                    linea.cantidad_bobinas_recibidas ??
                      0,
                  );

                const pendientes =
                  Math.max(
                    0,
                    Number(
                      linea.cantidad_bobinas,
                    ) -
                      yaRecibidas,
                  );

                const formulario =
                  lineasProveedorFormulario[
                    linea.id_pre_recepcion
                  ];

                return (
                  <div
                    key={
                      linea.id_pre_recepcion
                    }
                    className="rounded-xl border border-border bg-card p-5"
                  >

                    <p className="text-sm font-semibold uppercase text-muted-foreground">
                      Producto {indice + 1}
                    </p>

                    <p className="mt-1 text-2xl font-bold">
                      {linea.codigo_etiqueta}
                    </p>

                    <p className="mt-1 text-base text-muted-foreground">
                      {linea.descripcion}
                    </p>

                    <dl className="mt-5">

                      <div className="flex justify-between gap-4 border-b border-border py-3">

                        <dt className="text-muted-foreground">
                          Bobinas declaradas
                        </dt>

                        <dd className="font-semibold">
                          {linea.cantidad_bobinas}
                        </dd>

                      </div>

                      <div className="flex justify-between gap-4 border-b border-border py-3">

                        <dt className="text-muted-foreground">
                          Recibidas anteriormente
                        </dt>

                        <dd className="font-semibold">
                          {yaRecibidas}
                        </dd>

                      </div>

                      <div className="flex justify-between gap-4 border-b border-border py-3">

                        <dt className="text-muted-foreground">
                          Pendientes
                        </dt>

                        <dd className="font-semibold">
                          {pendientes}
                        </dd>

                      </div>

                      <div className="flex justify-between gap-4 py-3">

                        <dt className="text-muted-foreground">
                          Cantidad por bobina
                        </dt>

                        <dd className="font-semibold">
                          {linea.cantidad_por_bobina}
                        </dd>

                      </div>

                    </dl>

                    <div className="mt-5 grid gap-5 sm:grid-cols-2">

                      <div className="space-y-2">

                        <Label
                          htmlFor={`recibidas-${linea.id_pre_recepcion}`}
                          className="text-base"
                        >
                          Bobinas recibidas
                        </Label>

                        <Input
                          id={`recibidas-${linea.id_pre_recepcion}`}
                          required
                          className={inputClass}
                          type="number"
                          min={0}
                          max={pendientes}
                          step={1}
                          inputMode="numeric"
                          value={
                            formulario?.cantidad_recibida ??
                            ""
                          }
                          onChange={(e) =>
                            actualizarLineaProveedor(
                              linea.id_pre_recepcion,
                              {
                                cantidad_recibida:
                                  e.target.value.replace(
                                    /[^0-9]/g,
                                    "",
                                  ),
                              },
                            )
                          }
                        />

                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`cantidad-bobina-${linea.id_pre_recepcion}`} className="text-base">
                          Corrección de cantidad por bobina
                        </Label>
                        <Input
                          id={`cantidad-bobina-${linea.id_pre_recepcion}`}
                          className={inputClass}
                          type="number"
                          min={1}
                          max={1_000_000_000}
                          step={1}
                          inputMode="numeric"
                          placeholder={String(linea.cantidad_por_bobina)}
                          value={formulario?.cantidad_por_bobina ?? ""}
                          onChange={(e) => actualizarLineaProveedor(linea.id_pre_recepcion, {
                            cantidad_por_bobina: e.target.value,
                          })}
                        />
                        <p className="text-sm text-muted-foreground">
                          Completar en el caso de que la cantidad por bobina entregada sea erronea.
                        </p>
                      </div>

                      <div className="space-y-2">

                        <Label
                          htmlFor={`ubicacion-${linea.id_pre_recepcion}`}
                          className="text-base"
                        >
                          Ubicación
                        </Label>

                        <Input
                          id={`ubicacion-${linea.id_pre_recepcion}`}
                          required={Number(formulario?.cantidad_recibida) > 0}
                          className={inputClass}
                          value={
                            formulario?.ubicacion ??
                            ""
                          }
                          maxLength={200}
                          onChange={(e) =>
                            actualizarLineaProveedor(
                              linea.id_pre_recepcion,
                              {
                                ubicacion:
                                  e.target.value,
                              },
                            )
                          }
                        />

                      </div>

                    </div>

                  </div>
                );
              },
            )}

          </div>

        </section>

        <div className="mt-8 rounded-xl border border-border bg-card p-5">

          <div className="flex justify-between gap-4 text-lg">

            <span>
              Bobinas a recibir ahora
            </span>

            <strong>
              {totalARecibir}
            </strong>

          </div>

          <p className="mt-2 text-sm text-muted-foreground">
            Se generará un CQ independiente por cada bobina recibida y se imprimirán 2 stickers por CQ.
          </p>

        </div>

        {errorProveedor && (
          <p
            role="alert"
            className="mt-6 rounded-md bg-destructive/10 p-4 text-base text-destructive"
          >
            {errorProveedor}
          </p>
        )}

        <Button
          type="button"
          size="lg"
          disabled={
            enviandoProveedor ||
            totalARecibir ===
              0
          }
          className="mt-6 h-20 w-full text-2xl font-bold"
          onClick={() =>
            void confirmarEnvioProveedor()
          }
        >

          {enviandoProveedor ? (
            <>
              <Loader2
                className="size-6 animate-spin"
                aria-hidden="true"
              />

              CONFIRMANDO…
            </>
          ) : (
            `CONFIRMAR RECEPCIÓN DE ${totalARecibir} BOBINAS`
          )}

        </Button>

        <Button
          type="button"
          variant="outline"
          size="lg"
          className="mt-3 h-12 w-full"
          disabled={
            enviandoProveedor
          }
          onClick={
            volverInicio
          }
        >
          CANCELAR
        </Button>

      </main>
    );
  }

  /*
   * =====================================================
   * RECEPCIÓN MANUAL
   * =====================================================
   */

  if (
    pantalla ===
    "manual"
  ) {
    const cantidadBobinasVista =
      Number(
        cantidadBobinas,
      );

    return (
      <main className="mx-auto max-w-2xl px-6 py-10">

        <button
          type="button"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          onClick={
            volverInicio
          }
        >

          <ArrowLeft
            className="size-4"
            aria-hidden="true"
          />

          Volver a Recepción

        </button>

        <h1 className="mt-6 text-3xl font-bold tracking-tight">
          RECEPCIÓN MANUAL
        </h1>

        <p className="mt-1 text-base text-muted-foreground">
          Complete los datos una sola vez y defina cuántas bobinas desea ingresar.
        </p>

        <form
          onSubmit={
            onSubmit
          }
          className="mt-8 space-y-6"
        >

          <div className="space-y-2">

            <Label
              htmlFor="codigo"
              className="text-base"
            >
              Código de etiqueta
            </Label>

            <Input
              id="codigo"
              className={
                inputClass
              }
              value={
                codigo
              }
              maxLength={100}
              autoComplete="off"
              onChange={(e) =>
                onChangeCodigo(
                  e.target.value,
                )
              }
              onBlur={
                onBlurCodigo
              }
              required
            />

            {buscando && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">

                <Loader2
                  className="size-4 animate-spin"
                  aria-hidden="true"
                />

                Buscando etiqueta…

              </p>
            )}

          </div>

          <div className="space-y-2">

            <Label
              htmlFor="descripcion"
              className="text-base"
            >
              Descripción
            </Label>

            <Input
              id="descripcion"
              className={
                inputClass
              }
              value={
                descripcion
              }
              maxLength={500}
              readOnly={
                descripcionBloqueada
              }
              onChange={(e) =>
                setDescripcion(
                  e.target.value,
                )
              }
              required
            />

            {descripcionBloqueada && (
              <p className="text-sm text-muted-foreground">
                Descripción tomada del maestro de etiquetas.
              </p>
            )}

          </div>

          <div className="grid gap-6 sm:grid-cols-2">

            <div className="space-y-2">

              <Label
                htmlFor="cantidad-bobinas"
                className="text-base"
              >
                Cantidad de bobinas
              </Label>

              <Input
                id="cantidad-bobinas"
                className={
                  inputClass
                }
                type="number"
                min={1}
                max={100}
                step={1}
                inputMode="numeric"
                value={
                  cantidadBobinas
                }
                onChange={(e) =>
                  setCantidadBobinas(
                    e.target.value.replace(
                      /[^0-9]/g,
                      "",
                    ),
                  )
                }
                required
              />

              <p className="text-sm text-muted-foreground">
                Entre 1 y 100. Cada bobina recibirá un CQ distinto.
              </p>

            </div>

            <div className="space-y-2">

              <Label
                htmlFor="cantidad"
                className="text-base"
              >
                Cantidad por bobina
              </Label>

              <Input
                id="cantidad"
                className={
                  inputClass
                }
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                value={
                  cantidad
                }
                onChange={(e) =>
                  setCantidad(
                    e.target.value.replace(
                      /[^0-9]/g,
                      "",
                    ),
                  )
                }
                required
              />

              <p className="text-sm text-muted-foreground">
                Esta cantidad se asignará a cada bobina creada.
              </p>

            </div>

          </div>

          <div className="grid gap-6 sm:grid-cols-2">

            <div className="space-y-2">

              <Label
                htmlFor="proveedor"
                className="text-base"
              >
                Proveedor *
              </Label>

              <Input
                id="proveedor"
                required
                className={
                  inputClass
                }
                value={
                  proveedor
                }
                maxLength={200}
                onChange={(e) =>
                  setProveedor(
                    e.target.value,
                  )
                }
              />

            </div>

            <div className="space-y-2">

              <Label
                htmlFor="ubicacion"
                className="text-base"
              >
                Ubicación *
              </Label>

              <Input
                id="ubicacion"
                required
                className={
                  inputClass
                }
                value={
                  ubicacion
                }
                maxLength={200}
                onChange={(e) =>
                  setUbicacion(
                    e.target.value,
                  )
                }
              />

            </div>

          </div>


          {error && (
            <p
              role="alert"
              className="rounded-md bg-destructive/10 p-4 text-base text-destructive"
            >
              {error}
            </p>
          )}

          <Button
            type="submit"
            size="lg"
            disabled={
              enviando
            }
            className="h-20 w-full text-2xl font-bold"
          >

            {enviando ? (
              <>
                <Loader2
                  className="size-6 animate-spin"
                  aria-hidden="true"
                />

                REGISTRANDO…
              </>
            ) : Number.isInteger(
                cantidadBobinasVista,
              ) &&
              cantidadBobinasVista >
                1 ? (
              `INGRESAR ${cantidadBobinasVista} BOBINAS`
            ) : (
              "INGRESAR BOBINA"
            )}

          </Button>

        </form>

      </main>
    );
  }

  /*
   * =====================================================
   * PANTALLA INICIAL DE RECEPCIÓN
   * =====================================================
   */

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">

      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >

        <ArrowLeft
          className="size-4"
          aria-hidden="true"
        />

        Menú principal

      </Link>

      <h1 className="mt-6 text-3xl font-bold tracking-tight">
        RECEPCIÓN DE BOBINAS
      </h1>

      <p className="mt-1 text-base text-muted-foreground">
        Seleccione el tipo de recepción que desea realizar.
      </p>

      <section className="mt-8">

        <div className="rounded-xl border border-border bg-card p-6">

          <div className="flex items-start gap-4">

            <ClipboardPlus
              className="mt-1 size-9 shrink-0"
              aria-hidden="true"
            />

            <div className="flex-1">

              <h2 className="text-xl font-bold">
                NUEVA RECEPCIÓN MANUAL
              </h2>

              <p className="mt-1 text-base text-muted-foreground">
                Registrar directamente una o varias bobinas que ingresan a Coquimbito.
              </p>

              <Button
                type="button"
                size="lg"
                className="mt-5 h-14 w-full text-lg font-semibold"
                onClick={
                  abrirRecepcionManual
                }
              >
                ABRIR RECEPCIÓN MANUAL
              </Button>

            </div>

          </div>

        </div>

      </section>

      <section className="mt-10">

        <div className="flex items-center justify-between gap-4">

          <div>

            <h2 className="text-xl font-bold">
              RECEPCIONES PENDIENTES DE PROVEEDORES
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              Envíos declarados por proveedores que todavía deben ser confirmados en Coquimbito.
            </p>

          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={
              cargandoPendientes
            }
            onClick={() =>
              void cargarPendientes()
            }
          >

            <RefreshCw
              className={
                cargandoPendientes
                  ? "mr-2 size-4 animate-spin"
                  : "mr-2 size-4"
              }
              aria-hidden="true"
            />

            ACTUALIZAR

          </Button>

        </div>

        {cargandoPendientes &&
          enviosPendientes.length ===
            0 && (
            <div className="mt-5 rounded-xl border border-border bg-card p-6 text-center">

              <Loader2
                className="mx-auto size-7 animate-spin"
                aria-hidden="true"
              />

              <p className="mt-3 text-muted-foreground">
                Cargando recepciones pendientes…
              </p>

            </div>
          )}

        {errorPendientes && (
          <div
            role="alert"
            className="mt-5 rounded-md bg-destructive/10 p-4 text-destructive"
          >

            <p className="font-semibold">
              {errorPendientes}
            </p>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() =>
                void cargarPendientes()
              }
            >
              REINTENTAR
            </Button>

          </div>
        )}

        {!cargandoPendientes &&
          !errorPendientes &&
          enviosPendientes.length ===
            0 && (
            <div className="mt-5 rounded-xl border border-border bg-card p-6 text-center">

              <PackageOpen
                className="mx-auto size-8 text-muted-foreground"
                aria-hidden="true"
              />

              <p className="mt-3 font-semibold">
                No hay recepciones pendientes de proveedores.
              </p>

            </div>
          )}

        <div className="mt-5 space-y-4">

          {enviosPendientes.map(
            (envio) => (
              <div
                key={
                  envio.id_envio
                }
                className="rounded-xl border border-border bg-card p-5"
              >

                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

                  <div>

                    <p className="text-xl font-bold">
                      {envio.proveedor}
                    </p>

                    <p className="mt-1 text-base">
                      Remito{" "}
                      <span className="font-semibold">
                        {envio.numero_remito}
                      </span>
                    </p>

                    <p className="mt-1 text-sm text-muted-foreground">
                      Fecha de despacho:{" "}
                      {formatearFecha(
                        envio.fecha_despacho,
                      )}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">

                      <span className="rounded-md bg-muted px-3 py-1 text-sm font-semibold">
                        {envio.cantidad_productos}{" "}
                        producto
                        {envio.cantidad_productos ===
                        1
                          ? ""
                          : "s"}{" "}
                        pendiente
                        {envio.cantidad_productos ===
                        1
                          ? ""
                          : "s"}
                      </span>

                      <span className="rounded-md bg-muted px-3 py-1 text-sm font-semibold">
                        {envio.cantidad_bobinas_pendientes}{" "}
                        bobina
                        {envio.cantidad_bobinas_pendientes ===
                        1
                          ? ""
                          : "s"}{" "}
                        pendiente
                        {envio.cantidad_bobinas_pendientes ===
                        1
                          ? ""
                          : "s"}
                      </span>

                    </div>

                  </div>

                  <Button
                    type="button"
                    size="lg"
                    className="h-14 shrink-0 px-6 text-base font-semibold"
                    onClick={() =>
                      abrirEnvioProveedor(
                        envio,
                      )
                    }
                  >
                    ABRIR RECEPCIÓN
                  </Button>

                </div>

              </div>
            ),
          )}

        </div>

      </section>

    </main>
  );
}

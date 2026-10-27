import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Printer,
} from "lucide-react";

import {
  buscarEtiqueta,
  consultarBobina,
  registrarAltaInventarioMultiple,
  registrarInventarioExistente,
  type BobinaFicha,
} from "@/lib/bobinas.functions";

import { generarEtiquetaZpl } from "@/lib/zebra-label";

import {
  obtenerImpresoraPredeterminada,
  enviarZpl,
} from "@/lib/browser-print";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InventarioConteo } from "@/components/inventario-conteo";

export const Route = createFileRoute("/inventario")({
  component: Inventario,

  errorComponent: () => (
    <main className="module-screen mx-auto max-w-2xl px-6 py-10">
      <p
        role="alert"
        className="rounded-md bg-destructive/10 p-4 text-base text-destructive"
      >
        No se pudo cargar la pantalla de inventario. Recargue la página.
      </p>
    </main>
  ),

  notFoundComponent: () => (
    <main className="module-screen mx-auto max-w-2xl px-6 py-10">
      <p>Pantalla no encontrada.</p>
    </main>
  ),

  head: () => ({
    meta: [
      {
        title: "Inventario de Bobinas | Coquimbito",
      },
      {
        name: "description",
        content:
          "Inventariar bobinas en planta Coquimbito: recontar bobinas existentes o dar de alta bobinas encontradas sin ID.",
      },
      {
        property: "og:title",
        content: "Inventario de Bobinas | Coquimbito",
      },
      {
        property: "og:description",
        content:
          "Recontar bobinas existentes o dar de alta bobinas encontradas en planta Coquimbito.",
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

const inputClass = "h-14 text-lg";

const texto = (valor: unknown) =>
  valor === null ||
  valor === undefined ||
  valor === ""
    ? "—"
    : String(valor);

function Fila({
  etiqueta,
  valor,
}: {
  etiqueta: string;
  valor: React.ReactNode;
}) {
  return (
    <div className="flex justify-between gap-4 border-b border-border py-3 last:border-0">
      <dt className="text-muted-foreground">
        {etiqueta}
      </dt>

      <dd className="text-right font-semibold">
        {valor}
      </dd>
    </div>
  );
}

type Exito = {
  ok: boolean;
  ids_bobinas: string[];
  cantidad_solicitada: number;
  cantidad_creada: number;
  mensaje: string;

  codigo_etiqueta: string | null;
  descripcion: string | null;
  cantidad_actual: number | string | null;
  ubicacion: string | null;
  vigencia: string | null;

  origen: "existente" | "alta";
};

type Modo =
  | "escaneo"
  | "existente"
  | "alta";

function Inventario() {
  const [opcion, setOpcion] = useState<"menu" | "ajuste" | "conteo">("menu");

  if (opcion === "conteo") {
    return <InventarioConteo onVolver={() => setOpcion("menu")} />;
  }

  if (opcion === "ajuste") {
    return (
      <>
        <div className="mx-auto max-w-3xl px-6 pt-6">
          <Button type="button" variant="outline" onClick={() => setOpcion("menu")}>
            Volver a opciones de Inventario
          </Button>
        </div>
        <AjustarCantidad />
      </>
    );
  }

  return (
    <main className="module-screen mx-auto max-w-3xl px-6 py-10">
      <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Menú principal
      </Link>
      <h1 className="mt-6 text-3xl font-bold tracking-tight">Inventario</h1>
      <div className="mt-8 grid gap-5">
        <button type="button" onClick={() => setOpcion("ajuste")}
          className="rounded-xl border border-border bg-card p-6 text-left shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="block text-2xl font-semibold">Ajustar cantidad</span>
          <span className="mt-2 block text-muted-foreground">Registrar la cantidad física y la ubicación de una bobina, o dar de alta una bobina sin registrar.</span>
        </button>
        <button type="button" onClick={() => setOpcion("conteo")}
          className="rounded-xl border border-border bg-card p-6 text-left shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="block text-2xl font-semibold">Inventario</span>
          <span className="mt-2 block text-muted-foreground">Seleccionar un sector, escanear bobinas y consultar las diferencias al finalizar.</span>
        </button>
      </div>
    </main>
  );
}

function AjustarCantidad() {
  const consultar =
    useServerFn(consultarBobina);

  const lookup =
    useServerFn(buscarEtiqueta);

  const invExistente =
    useServerFn(registrarInventarioExistente);

  const altaInvMultiple =
    useServerFn(registrarAltaInventarioMultiple);

  const escanerRef =
    useRef<HTMLInputElement>(null);

  const [modo, setModo] =
    useState<Modo>("escaneo");

  const [entrada, setEntrada] =
    useState("");

  const [buscando, setBuscando] =
    useState(false);

  const [enviando, setEnviando] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [noEncontrada, setNoEncontrada] =
    useState(false);

  const [exito, setExito] =
    useState<Exito | null>(null);

  const [bobina, setBobina] =
    useState<BobinaFicha | null>(null);

  const [codigo, setCodigo] =
    useState("");

  const [descripcion, setDescripcion] =
    useState("");

  const [
    descripcionBloqueada,
    setDescripcionBloqueada,
  ] = useState(false);

  const [
    cantidadBobinas,
    setCantidadBobinas,
  ] = useState("1");

  const [fechaIngreso, setFechaIngreso] =
    useState("");

  const [proveedor, setProveedor] =
    useState("");

  const [cantidad, setCantidad] =
    useState("");

  const [ubicacion, setUbicacion] =
    useState("");


  const [observacion, setObservacion] =
    useState("");

  /*
   * Estados de impresión.
   * Solo se utilizan para altas por Inventario.
   */
  const [imprimiendo, setImprimiendo] =
    useState(false);

  const [idsImpresos, setIdsImpresos] =
    useState<string[]>([]);

  const [
    idsPendientesImpresion,
    setIdsPendientesImpresion,
  ] = useState<string[]>([]);

  const [
    errorImpresion,
    setErrorImpresion,
  ] = useState<string | null>(null);

  useEffect(() => {
    if (
      modo === "escaneo" &&
      !exito
    ) {
      escanerRef.current?.focus();
    }
  }, [modo, exito]);

  const reiniciar = () => {
    setModo("escaneo");

    setEntrada("");

    setError(null);
    setNoEncontrada(false);
    setExito(null);

    setBobina(null);

    setCodigo("");
    setDescripcion("");
    setDescripcionBloqueada(false);

    setCantidadBobinas("1");

    setFechaIngreso("");
    setProveedor("");

    setCantidad("");
    setUbicacion("");
    setObservacion("");

    setImprimiendo(false);
    setIdsImpresos([]);
    setIdsPendientesImpresion([]);
    setErrorImpresion(null);
  };

  /*
   * =====================================================
   * ESCANEO / IDENTIFICACIÓN
   * =====================================================
   */

  const procesar = async () => {
    const valor =
      entrada.trim();

    if (!valor) return;

    setBuscando(true);
    setError(null);
    setNoEncontrada(false);

    try {
      /*
       * Si empieza por CQ-, buscamos una bobina existente.
       */
      if (
        valor
          .toUpperCase()
          .startsWith("CQ-")
      ) {
        const idBobina =
          valor.toUpperCase();

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
          setNoEncontrada(true);
          setEntrada("");

          escanerRef.current?.focus();

          return;
        }

        setBobina(
          res.bobina,
        );

        setUbicacion(
          res.bobina.ubicacion ??
            "",
        );

        setModo("existente");

        return;
      }

      /*
       * Si no es CQ, interpretamos el valor
       * como código de etiqueta para dar de alta.
       */
      const res =
        await lookup({
          data: {
            codigo_etiqueta:
              valor,
          },
        });

      setCodigo(valor);

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

      setModo("alta");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "No se pudo procesar el valor ingresado.",
      );
    } finally {
      setBuscando(false);
    }
  };

  /*
   * =====================================================
   * CONSULTAR FICHA ACTUAL
   * =====================================================
   */

  const recargarFicha =
    async (
      id: string,
    ): Promise<BobinaFicha | null> => {
      try {
        const res: {
          bobina:
            | BobinaFicha
            | null;
        } =
          await consultar({
            data: {
              id_bobina:
                id,
            },
          });

        return res.bobina;
      } catch {
        return null;
      }
    };

  /*
   * =====================================================
   * IMPRIMIR ALTAS DE INVENTARIO
   * =====================================================
   *
   * Cada CQ se consulta nuevamente en Supabase.
   * Cada generarEtiquetaZpl() imprime 2 stickers.
   */

  const imprimirAltasInventario =
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

      setImprimiendo(true);
      setErrorImpresion(null);

      let idEnProceso = "";

      try {
        /*
         * Detectamos la Zebra una sola vez
         * para toda la tanda.
         */
        const impresora =
          await obtenerImpresoraPredeterminada();

        /*
         * Imprimimos CQ por CQ.
         */
        for (
          const idBobina
          of idsAImprimir
        ) {
          idEnProceso =
            idBobina;

          const ficha =
            await recargarFicha(
              idBobina,
            );

          if (!ficha) {
            throw new Error(
              `No se pudo recuperar ${idBobina}.`,
            );
          }

          const zpl =
            generarEtiquetaZpl({
              id_bobina:
                ficha.id_bobina,

              codigo_etiqueta:
                ficha.codigo_etiqueta ??
                "",

              descripcion:
                ficha.descripcion ??
                "",

              cantidad:
                ficha.cantidad_actual ??
                0,
            });

          await enviarZpl(
            impresora,
            zpl,
          );

          setIdsImpresos(
            (anteriores) =>
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
            (anteriores) =>
              anteriores.filter(
                (id) =>
                  id !==
                  idBobina,
              ),
          );
        }
      } catch (e) {
        console.error(
          "Error de impresión Zebra en alta de inventario:",
          e,
        );

        setErrorImpresion(
          idEnProceso
            ? `Las bobinas quedaron dadas de alta, pero la impresión se detuvo en ${idEnProceso}.`
            : "Las bobinas quedaron dadas de alta, pero no se pudo acceder a la impresora Zebra.",
        );
      } finally {
        setImprimiendo(false);
      }
    };

  /*
   * =====================================================
   * INVENTARIO DE BOBINA EXISTENTE
   * =====================================================
   *
   * NO imprime.
   */

  const onSubmitExistente =
    async (
      event:
        React.FormEvent,
    ) => {
      event.preventDefault();

      setError(null);

      if (!bobina) return;

      if (!ubicacion.trim()) {
        return setError("Ingrese la ubicación de la bobina.");
      }

      const cantidadNum =
        Number(cantidad);

      if (
        !Number.isInteger(
          cantidadNum,
        ) ||
        cantidadNum <= 0
      ) {
        return setError(
          "La cantidad contada debe ser un número entero positivo.",
        );
      }

      setEnviando(true);

      try {
        const res =
          await invExistente({
            data: {
              id_bobina:
                bobina.id_bobina,

              cantidad:
                cantidadNum,

              ubicacion:
                ubicacion.trim(),

              observacion:
                observacion.trim(),
            },
          });

        const ficha =
          await recargarFicha(
            res.id_bobina,
          );

        setExito({
          ok: true,

          ids_bobinas: [
            res.id_bobina,
          ],

          cantidad_solicitada:
            1,

          cantidad_creada:
            1,

          mensaje:
            "Inventario registrado correctamente.",

          codigo_etiqueta:
            ficha?.codigo_etiqueta ??
            bobina.codigo_etiqueta,

          descripcion:
            ficha?.descripcion ??
            bobina.descripcion,

          cantidad_actual:
            ficha?.cantidad_actual ??
            cantidadNum,

          ubicacion:
            ficha?.ubicacion ??
            (
              ubicacion.trim() ||
              bobina.ubicacion
            ),

          vigencia:
            ficha?.vigencia ??
            bobina.vigencia,

          origen:
            "existente",
        });

        /*
         * NO imprimimos stickers para un ajuste
         * de una bobina existente.
         */
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "No se pudo registrar el inventario.",
        );
      } finally {
        setEnviando(false);
      }
    };

  /*
   * =====================================================
   * ALTA MÚLTIPLE POR INVENTARIO
   * =====================================================
   */

  const onSubmitAlta =
    async (
      event:
        React.FormEvent,
    ) => {
      event.preventDefault();

      setError(null);
      setErrorImpresion(null);

      const cantidadNum =
        Number(cantidad);

      const cantidadBobinasNum =
        Number(
          cantidadBobinas,
        );

      if (!codigo.trim()) {
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
        cantidadBobinasNum < 1 ||
        cantidadBobinasNum > 100
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

      if (!fechaIngreso) {
        return setError(
          "La fecha de ingreso original es obligatoria.",
        );
      }

      setEnviando(true);

      try {
        /*
         * PRIMERO:
         * Supabase crea todos los CQ.
         */
        const res =
          await altaInvMultiple({
            data: {
              codigo_etiqueta:
                codigo.trim(),

              descripcion:
                descripcion.trim(),

              cantidad:
                cantidadNum,

              cantidad_bobinas:
                cantidadBobinasNum,

              fecha_ingreso:
                fechaIngreso,

              proveedor:
                proveedor.trim(),

              ubicacion:
                ubicacion.trim(),

              observacion:
                observacion.trim(),
            },
          });

        /*
         * Si no se creó ninguna,
         * detenemos todo.
         */
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

        /*
         * Recuperamos una ficha como referencia
         * para mostrar los datos generales.
         */
        const primeraFicha =
          res.ids_bobinas.length >
          0
            ? await recargarFicha(
                res.ids_bobinas[0],
              )
            : null;

        const datosExito: Exito =
          {
            ok:
              res.ok,

            ids_bobinas:
              res.ids_bobinas,

            cantidad_solicitada:
              res.cantidad_solicitada,

            cantidad_creada:
              res.cantidad_creada,

            mensaje:
              res.mensaje,

            codigo_etiqueta:
              primeraFicha?.codigo_etiqueta ??
              codigo.trim(),

            descripcion:
              primeraFicha?.descripcion ??
              descripcion.trim(),

            cantidad_actual:
              primeraFicha?.cantidad_actual ??
              cantidadNum,

            ubicacion:
              primeraFicha?.ubicacion ??
              ubicacion.trim(),

            vigencia:
              primeraFicha?.vigencia ??
              null,

            origen:
              "alta",
          };

        /*
         * A esta altura las bobinas YA EXISTEN.
         */
        setExito(
          datosExito,
        );

        /*
         * Todas empiezan pendientes de impresión.
         */
        setIdsImpresos([]);

        setIdsPendientesImpresion(
          [
            ...res.ids_bobinas,
          ],
        );

        /*
         * SEGUNDO:
         * imprimimos 2 stickers por cada CQ.
         */
        await imprimirAltasInventario(
          res.ids_bobinas,
        );
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "No se pudo dar de alta las bobinas.",
        );
      } finally {
        setEnviando(false);
      }
    };

  /*
   * =====================================================
   * COMPONENTES COMUNES
   * =====================================================
   */

  const volverMenu = (
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
  );

  /*
   * Campos usados en inventario existente.
   */
  const camposExistente = (
    <>
      <div className="space-y-2">

        <Label
          htmlFor="cantidad"
          className="text-base"
        >
          Cantidad contada
        </Label>

        <Input
          id="cantidad"
          className={inputClass}
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          value={cantidad}
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

      </div>

      <div className="grid gap-6 sm:grid-cols-2">

        <div className="space-y-2">

          <Label
            htmlFor="ubicacion"
            className="text-base"
          >
            Ubicación (obligatoria)
          </Label>

          <Input
            id="ubicacion"
            required
            className={inputClass}
            value={ubicacion}
            maxLength={200}
            onChange={(e) =>
              setUbicacion(
                e.target.value,
              )
            }
          />

        </div>

      </div>

      <div className="space-y-2">

        <Label
          htmlFor="observacion"
          className="text-base"
        >
          Observación (opcional)
        </Label>

        <Input
          id="observacion"
          className={inputClass}
          value={observacion}
          maxLength={1000}
          onChange={(e) =>
            setObservacion(
              e.target.value,
            )
          }
        />

      </div>
    </>
  );

  /*
   * =====================================================
   * PANTALLA DE ÉXITO
   * =====================================================
   */

  if (exito) {
    const esAlta =
      exito.origen ===
      "alta";

    const altaParcial =
      esAlta &&
      !exito.ok;

    const unaBobina =
      exito.cantidad_creada ===
      1;

    const impresionTerminada =
      esAlta &&
      !imprimiendo &&
      idsPendientesImpresion.length ===
        0 &&
      idsImpresos.length ===
        exito.cantidad_creada &&
      exito.cantidad_creada >
        0;

    return (
      <main className="module-screen mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-10">

        <div className="rounded-xl border border-border bg-card p-8 text-center">

          {altaParcial ? (
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

            {!esAlta
              ? "INVENTARIO REGISTRADO CORRECTAMENTE"
              : altaParcial
                ? "ALTA DE INVENTARIO PARCIAL"
                : unaBobina
                  ? "BOBINA DADA DE ALTA CORRECTAMENTE"
                  : `${exito.cantidad_creada} BOBINAS DADAS DE ALTA CORRECTAMENTE`}

          </h1>

          {altaParcial && (
            <div
              role="alert"
              className="mt-6 rounded-md bg-destructive/10 p-4 text-left text-destructive"
            >

              <p className="font-semibold">
                {exito.mensaje}
              </p>

              <p className="mt-2 text-sm">
                No vuelva a cargar el alta completa. Revise los CQ que sí fueron creados.
              </p>

            </div>
          )}

          {unaBobina ? (
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

          <dl className="mt-8 text-left text-lg">

            <Fila
              etiqueta="Código de etiqueta"
              valor={texto(
                exito.codigo_etiqueta,
              )}
            />

            <Fila
              etiqueta="Descripción"
              valor={texto(
                exito.descripcion,
              )}
            />

            <Fila
              etiqueta={
                esAlta
                  ? "Cantidad por bobina"
                  : "Cantidad actual"
              }
              valor={texto(
                exito.cantidad_actual,
              )}
            />

            {esAlta && (
              <>
                <Fila
                  etiqueta="Bobinas solicitadas"
                  valor={
                    exito.cantidad_solicitada
                  }
                />

                <Fila
                  etiqueta="Bobinas creadas"
                  valor={
                    exito.cantidad_creada
                  }
                />
              </>
            )}

            <Fila
              etiqueta="Ubicación"
              valor={texto(
                exito.ubicacion,
              )}
            />

            <Fila
              etiqueta="Vigencia"
              valor={texto(
                exito.vigencia,
              )}
            />

          </dl>

          {/*
           * IMPRESIÓN SOLO PARA ALTAS
           */}
          {esAlta && (
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
                    Las bobinas ya existen en Supabase. No vuelva a darlas de alta.
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
                        void imprimirAltasInventario(
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
          )}

          <div className="mt-8 flex flex-col gap-3">

            <Button
              size="lg"
              className="h-16 text-xl font-semibold"
              disabled={imprimiendo}
              onClick={reiniciar}
            >
              NUEVO INVENTARIO
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
                MENÚ PRINCIPAL
              </Link>
            </Button>

          </div>

        </div>

      </main>
    );
  }

  /*
   * =====================================================
   * INVENTARIO EXISTENTE
   * =====================================================
   */

  if (
    modo === "existente" &&
    bobina
  ) {
    return (
      <main className="module-screen mx-auto max-w-2xl px-6 py-10">

        {volverMenu}

        <h1 className="mt-6 text-3xl font-bold tracking-tight">
          AJUSTAR CANTIDAD
        </h1>

        <section className="mt-8 rounded-xl border border-border bg-card p-5">

          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Bobina actual
          </h2>

          <dl className="mt-2 text-base">

            <Fila
              etiqueta="ID de bobina"
              valor={texto(
                bobina.id_bobina,
              )}
            />

            <Fila
              etiqueta="Código de etiqueta"
              valor={texto(
                bobina.codigo_etiqueta,
              )}
            />

            <Fila
              etiqueta="Descripción"
              valor={texto(
                bobina.descripcion,
              )}
            />

            <Fila
              etiqueta="Cantidad actual"
              valor={texto(
                bobina.cantidad_actual,
              )}
            />

            <Fila
              etiqueta="Ubicación actual"
              valor={texto(
                bobina.ubicacion,
              )}
            />

            <Fila
              etiqueta="Estado"
              valor={texto(
                bobina.estado,
              )}
            />

            <Fila
              etiqueta="Vigencia"
              valor={texto(
                bobina.vigencia,
              )}
            />

            <Fila
              etiqueta="Fecha de vencimiento"
              valor={texto(
                bobina.fecha_vencimiento,
              )}
            />

          </dl>

        </section>

        <form
          onSubmit={
            onSubmitExistente
          }
          className="mt-8 space-y-6"
        >

          {camposExistente}

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
            disabled={enviando}
            className="h-20 w-full text-2xl font-bold"
          >
            {enviando
              ? "REGISTRANDO…"
              : "REGISTRAR INVENTARIO"}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-12 w-full"
            onClick={reiniciar}
          >
            Cancelar
          </Button>

        </form>

      </main>
    );
  }

  /*
   * =====================================================
   * ALTA MÚLTIPLE POR INVENTARIO
   * =====================================================
   */

  if (modo === "alta") {
    const cantidadBobinasVista =
      Number(cantidadBobinas);

    return (
      <main className="module-screen mx-auto max-w-2xl px-6 py-10">

        {volverMenu}

        <h1 className="mt-6 text-3xl font-bold tracking-tight">
          AJUSTAR CANTIDAD
        </h1>

        <p className="mt-1 text-base text-muted-foreground">
          Bobina sin ID CQ. Se dará de alta con origen INVENTARIO.
        </p>

        <form
          onSubmit={
            onSubmitAlta
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
              className={inputClass}
              value={codigo}
              maxLength={100}
              autoComplete="off"
              readOnly
            />

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
              className={inputClass}
              value={descripcion}
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
                className={inputClass}
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
                className={inputClass}
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
                htmlFor="fecha-ingreso"
                className="text-base"
              >
                Fecha de ingreso original
              </Label>

              <Input
                id="fecha-ingreso"
                className={inputClass}
                type="date"
                value={
                  fechaIngreso
                }
                onChange={(e) =>
                  setFechaIngreso(
                    e.target.value,
                  )
                }
                required
              />

            </div>

            <div className="space-y-2">

              <Label
                htmlFor="proveedor"
                className="text-base"
              >
                Proveedor (opcional)
              </Label>

              <Input
                id="proveedor"
                className={inputClass}
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

          </div>

          <div className="grid gap-6 sm:grid-cols-2">

            <div className="space-y-2">

              <Label
                htmlFor="ubicacion"
                className="text-base"
              >
                Ubicación
              </Label>

              <Input
                id="ubicacion"
                className={inputClass}
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

          <div className="space-y-2">

            <Label
              htmlFor="observacion"
              className="text-base"
            >
              Observación (opcional)
            </Label>

            <Input
              id="observacion"
              className={inputClass}
              value={
                observacion
              }
              maxLength={1000}
              onChange={(e) =>
                setObservacion(
                  e.target.value,
                )
              }
            />

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

            {enviando
              ? "REGISTRANDO…"
              : Number.isInteger(
                    cantidadBobinasVista,
                  ) &&
                  cantidadBobinasVista >
                    1
                ? `DAR DE ALTA ${cantidadBobinasVista} BOBINAS`
                : "DAR DE ALTA E INVENTARIAR"}

          </Button>

          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-12 w-full"
            onClick={reiniciar}
          >
            Cancelar
          </Button>

        </form>

      </main>
    );
  }

  /*
   * =====================================================
   * PANTALLA INICIAL
   * =====================================================
   */

  return (
    <main className="module-screen mx-auto max-w-2xl px-6 py-10">

      {volverMenu}

      <h1 className="mt-6 text-3xl font-bold tracking-tight">
        AJUSTAR CANTIDAD
      </h1>

      <div className="mt-8 space-y-2">

        <Label
          htmlFor="entrada"
          className="text-base"
        >
          Escanear ID CQ o ingresar código de etiqueta
        </Label>

        <Input
          id="entrada"
          ref={
            escanerRef
          }
          className="h-16 text-2xl tracking-wide"
          value={
            entrada
          }
          maxLength={100}
          autoComplete="off"
          placeholder="CQ-000010 o ET-0001"
          onChange={(e) =>
            setEntrada(
              e.target.value,
            )
          }
          onKeyDown={(e) => {
            if (
              e.key ===
              "Enter"
            ) {
              e.preventDefault();

              void procesar();
            }
          }}
        />

        {buscando && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">

            <Loader2
              className="size-4 animate-spin"
              aria-hidden="true"
            />

            Consultando…

          </p>
        )}

        <Button
          type="button"
          size="lg"
          className="mt-4 h-16 w-full text-xl font-semibold"
          disabled={
            buscando
          }
          onClick={() =>
            void procesar()
          }
        >
          CONTINUAR
        </Button>

      </div>

      {noEncontrada && (
        <div
          role="alert"
          className="mt-6 rounded-md bg-destructive/10 p-4 text-destructive"
        >

          <p className="text-lg font-semibold">
            BOBINA NO ENCONTRADA
          </p>

          <p className="mt-1 text-base">
            Verifique el ID. Si la bobina todavía no posee ID CQ, ingrese su código de etiqueta.
          </p>

        </div>
      )}

      {error && (
        <p
          role="alert"
          className="mt-6 rounded-md bg-destructive/10 p-4 text-base text-destructive"
        >
          {error}
        </p>
      )}

    </main>
  );
}

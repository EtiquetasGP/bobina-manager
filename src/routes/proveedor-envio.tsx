import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  Plus,
  Send,
  Trash2,
} from "lucide-react";

import { buscarEtiqueta } from "@/lib/bobinas.functions";
import { registrarPreRecepcionEnvio } from "@/lib/pre-recepciones.functions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/proveedor-envio")({
  component: ProveedorEnvio,

  errorComponent: () => (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <p
        role="alert"
        className="rounded-md bg-destructive/10 p-4 text-base text-destructive"
      >
        No se pudo cargar la pantalla de nuevo envío. Recargue la página.
      </p>
    </main>
  ),

  head: () => ({
    meta: [
      {
        title: "Nuevo Envío | Proveedores",
      },
      {
        name: "description",
        content:
          "Registrar un nuevo envío de bobinas de etiquetas para Coquimbito.",
      },
    ],
  }),
});

type ProductoFormulario = {
  id: number;

  codigo_etiqueta: string;
  descripcion: string;

  cantidad_bobinas: string;
  cantidad_por_bobina: string;

  descripcion_bloqueada: boolean;
  buscando: boolean;
};

type ExitoEnvio = {
  id_envio: string;
  proveedor: string;
  numero_remito: string;
  fecha_despacho: string;
  cantidad_productos: number;
  cantidad_bobinas: number;
};

const inputClass = "h-14 text-lg";

function crearProducto(
  id: number,
): ProductoFormulario {
  return {
    id,

    codigo_etiqueta: "",
    descripcion: "",

    cantidad_bobinas: "1",
    cantidad_por_bobina: "",

    descripcion_bloqueada: false,
    buscando: false,
  };
}

function ProveedorEnvio() {
  const buscar =
    useServerFn(buscarEtiqueta);

  const registrar =
    useServerFn(registrarPreRecepcionEnvio);

  const siguienteIdRef =
    useRef(2);

  const envioEnCursoRef =
    useRef(false);

  const [proveedor, setProveedor] =
    useState("Grupo Impresores");

  const [
    numeroRemito,
    setNumeroRemito,
  ] = useState("");

  const [
    fechaDespacho,
    setFechaDespacho,
  ] = useState("");

  const [
    observacion,
    setObservacion,
  ] = useState("");

  const [
    productos,
    setProductos,
  ] = useState<ProductoFormulario[]>([
    crearProducto(1),
  ]);

  const [enviando, setEnviando] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [exito, setExito] =
    useState<ExitoEnvio | null>(null);

  const actualizarProducto = (
    id: number,
    cambios: Partial<ProductoFormulario>,
  ) => {
    setProductos((actuales) =>
      actuales.map((producto) =>
        producto.id === id
          ? {
              ...producto,
              ...cambios,
            }
          : producto,
      ),
    );
  };

  const agregarProducto = () => {
    if (productos.length >= 50) {
      setError(
        "Un envío puede contener como máximo 50 productos.",
      );

      return;
    }

    const nuevoId =
      siguienteIdRef.current;

    siguienteIdRef.current += 1;

    setProductos((actuales) => [
      ...actuales,
      crearProducto(nuevoId),
    ]);

    setError(null);
  };

  const eliminarProducto = (
    id: number,
  ) => {
    if (productos.length === 1) {
      setError(
        "El envío debe contener al menos un producto.",
      );

      return;
    }

    setProductos((actuales) =>
      actuales.filter(
        (producto) =>
          producto.id !== id,
      ),
    );

    setError(null);
  };

  const cambiarCodigo = (
    id: number,
    valor: string,
  ) => {
    actualizarProducto(id, {
      codigo_etiqueta:
        valor,

      descripcion: "",

      descripcion_bloqueada:
        false,
    });

    setError(null);
  };

  const consultarCodigo =
    async (
      id: number,
      codigoActual: string,
    ) => {
      const codigo =
        codigoActual.trim();

      if (!codigo) {
        actualizarProducto(id, {
          descripcion: "",
          descripcion_bloqueada:
            false,
          buscando: false,
        });

        return;
      }

      actualizarProducto(id, {
        buscando: true,
      });

      try {
        const res =
          await buscar({
            data: {
              codigo_etiqueta:
                codigo,
            },
          });

        setProductos((actuales) =>
          actuales.map(
            (producto) => {
              if (
                producto.id !== id
              ) {
                return producto;
              }

              if (
                producto.codigo_etiqueta.trim() !==
                codigo
              ) {
                return {
                  ...producto,
                  buscando: false,
                };
              }

              if (res.existe) {
                return {
                  ...producto,

                  descripcion:
                    res.descripcion,

                  descripcion_bloqueada:
                    true,

                  buscando: false,
                };
              }

              return {
                ...producto,

                descripcion: "",

                descripcion_bloqueada:
                  false,

                buscando: false,
              };
            },
          ),
        );
      } catch (e) {
        actualizarProducto(id, {
          buscando: false,
        });

        setError(
          e instanceof Error
            ? e.message
            : "No se pudo consultar el código de etiqueta.",
        );
      }
    };

  const reiniciar = () => {
    siguienteIdRef.current = 2;
    envioEnCursoRef.current =
      false;

    setProveedor(
      "Grupo Impresores",
    );

    setNumeroRemito("");
    setFechaDespacho("");
    setObservacion("");

    setProductos([
      crearProducto(1),
    ]);

    setEnviando(false);
    setError(null);
    setExito(null);
  };

  const onSubmit =
    async (
      event:
        React.FormEvent,
    ) => {
      event.preventDefault();

      if (
        enviando ||
        envioEnCursoRef.current
      ) {
        return;
      }

      setError(null);

      if (!proveedor.trim()) {
        return setError(
          "Ingrese el proveedor.",
        );
      }

      if (
        !numeroRemito.trim()
      ) {
        return setError(
          "Ingrese el número de remito.",
        );
      }

      if (!fechaDespacho) {
        return setError(
          "Ingrese la fecha de despacho.",
        );
      }

      if (
        productos.length === 0
      ) {
        return setError(
          "Debe agregar al menos un producto.",
        );
      }

      const codigos =
        productos.map(
          (producto) =>
            producto.codigo_etiqueta
              .trim()
              .toUpperCase(),
        );

      if (
        codigos.some(
          (codigo) => !codigo,
        )
      ) {
        return setError(
          "Todos los productos deben tener código de etiqueta.",
        );
      }

      const codigosUnicos =
        new Set(codigos);

      if (
        codigosUnicos.size !==
        codigos.length
      ) {
        return setError(
          "No puede repetir el mismo código de etiqueta dentro del mismo envío.",
        );
      }

      for (
        const producto
        of productos
      ) {
        const cantidadBobinas =
          Number(
            producto.cantidad_bobinas,
          );

        const cantidadPorBobina =
          Number(
            producto.cantidad_por_bobina,
          );

        if (
          !producto.descripcion.trim()
        ) {
          return setError(
            `Debe ingresar la descripción del código ${producto.codigo_etiqueta.trim()}.`,
          );
        }

        if (
          !Number.isInteger(
            cantidadBobinas,
          ) ||
          cantidadBobinas < 1 ||
          cantidadBobinas > 100
        ) {
          return setError(
            `La cantidad de bobinas de ${producto.codigo_etiqueta.trim()} debe estar entre 1 y 100.`,
          );
        }

        if (
          !Number.isInteger(
            cantidadPorBobina,
          ) ||
          cantidadPorBobina <= 0
        ) {
          return setError(
            `La cantidad por bobina de ${producto.codigo_etiqueta.trim()} debe ser un número entero positivo.`,
          );
        }
      }

      envioEnCursoRef.current =
        true;

      setEnviando(true);

      try {
        const productosEnviar =
          productos.map(
            (producto) => ({
              codigo_etiqueta:
                producto.codigo_etiqueta.trim(),

              descripcion:
                producto.descripcion.trim(),

              cantidad_bobinas:
                Number(
                  producto.cantidad_bobinas,
                ),

              cantidad_por_bobina:
                Number(
                  producto.cantidad_por_bobina,
                ),
            }),
          );

        const res =
          await registrar({
            data: {
              proveedor:
                proveedor.trim(),

              numero_remito:
                numeroRemito.trim(),

              fecha_despacho:
                fechaDespacho,

              observacion:
                observacion.trim(),

              productos:
                productosEnviar,
            },
          });

        const totalBobinas =
          productosEnviar.reduce(
            (
              acumulado,
              producto,
            ) =>
              acumulado +
              producto.cantidad_bobinas,
            0,
          );

        setExito({
          id_envio:
            res.id_envio,

          proveedor:
            proveedor.trim(),

          numero_remito:
            numeroRemito.trim(),

          fecha_despacho:
            fechaDespacho,

          cantidad_productos:
            productosEnviar.length,

          cantidad_bobinas:
            totalBobinas,
        });
      } catch (e) {
        envioEnCursoRef.current =
          false;

        setError(
          e instanceof Error
            ? e.message
            : "No se pudo registrar el envío.",
        );
      } finally {
        setEnviando(false);
      }
    };

  /*
   * =====================================================
   * PANTALLA DE ÉXITO
   * =====================================================
   */

  if (exito) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-10">

        <div className="rounded-xl border border-border bg-card p-8 text-center">

          <CheckCircle2
            className="mx-auto size-16 text-primary"
            aria-hidden="true"
          />

          <h1 className="mt-4 text-3xl font-bold tracking-tight">
            ENVÍO REGISTRADO
          </h1>

          <p className="mt-2 text-base text-muted-foreground">
            El envío fue registrado correctamente.
          </p>

          <dl className="mt-8 space-y-3 text-left text-lg">

            <div className="flex justify-between gap-4 border-b border-border pb-2">

              <dt className="text-muted-foreground">
                Proveedor
              </dt>

              <dd className="text-right font-semibold">
                {exito.proveedor}
              </dd>

            </div>

            <div className="flex justify-between gap-4 border-b border-border pb-2">

              <dt className="text-muted-foreground">
                N.º de remito
              </dt>

              <dd className="font-semibold">
                {exito.numero_remito}
              </dd>

            </div>

            <div className="flex justify-between gap-4 border-b border-border pb-2">

              <dt className="text-muted-foreground">
                Fecha de despacho
              </dt>

              <dd className="font-semibold">
                {exito.fecha_despacho}
              </dd>

            </div>

            <div className="flex justify-between gap-4 border-b border-border pb-2">

              <dt className="text-muted-foreground">
                Productos
              </dt>

              <dd className="font-semibold">
                {exito.cantidad_productos}
              </dd>

            </div>

            <div className="flex justify-between gap-4">

              <dt className="text-muted-foreground">
                Bobinas declaradas
              </dt>

              <dd className="font-semibold">
                {exito.cantidad_bobinas}
              </dd>

            </div>

          </dl>

          <div className="mt-8">

            <Button
              type="button"
              size="lg"
              className="h-16 w-full text-xl font-semibold"
              onClick={reiniciar}
            >
              CARGAR OTRO ENVÍO
            </Button>

          </div>

        </div>

      </main>
    );
  }

  /*
   * =====================================================
   * FORMULARIO NUEVO ENVÍO
   * =====================================================
   */

  const totalBobinas =
    productos.reduce(
      (
        acumulado,
        producto,
      ) => {
        const valor =
          Number(
            producto.cantidad_bobinas,
          );

        if (
          !Number.isInteger(valor) ||
          valor < 1
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

  const hayBusqueda =
    productos.some(
      (producto) =>
        producto.buscando,
    );

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">

      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">
          NUEVO ENVÍO
        </h1>

        <p className="mt-2 text-base text-muted-foreground">
          Cargue los productos incluidos en el mismo remito.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="mt-8 space-y-8"
      >

        <section className="rounded-xl border border-border bg-card p-5">

          <h2 className="text-lg font-bold">
            DATOS DEL ENVÍO
          </h2>

          <div className="mt-5 grid gap-6 sm:grid-cols-2">

            <div className="space-y-2">

              <Label
                htmlFor="proveedor"
                className="text-base"
              >
                Proveedor
              </Label>

              <Input
                id="proveedor"
                className={inputClass}
                value={proveedor}
                maxLength={200}
                onChange={(e) =>
                  setProveedor(
                    e.target.value,
                  )
                }
                required
              />

            </div>

            <div className="space-y-2">

              <Label
                htmlFor="remito"
                className="text-base"
              >
                N.º de remito
              </Label>

              <Input
                id="remito"
                className={inputClass}
                value={numeroRemito}
                maxLength={200}
                autoComplete="off"
                onChange={(e) =>
                  setNumeroRemito(
                    e.target.value,
                  )
                }
                required
              />

            </div>

          </div>

          <div className="mt-6 space-y-2">

            <Label
              htmlFor="fecha-despacho"
              className="text-base"
            >
              Fecha de despacho
            </Label>

            <Input
              id="fecha-despacho"
              className={inputClass}
              type="date"
              value={fechaDespacho}
              onChange={(e) =>
                setFechaDespacho(
                  e.target.value,
                )
              }
              required
            />

          </div>

          <div className="mt-6 space-y-2">

            <Label
              htmlFor="observacion"
              className="text-base"
            >
              Observación
            </Label>

            <textarea
              id="observacion"
              value={observacion}
              maxLength={1000}
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-3 text-base shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
              onChange={(e) =>
                setObservacion(
                  e.target.value,
                )
              }
            />

          </div>

        </section>

        <section>

          <div>
            <h2 className="text-xl font-bold">
              PRODUCTOS
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              {productos.length} producto
              {productos.length === 1
                ? ""
                : "s"}{" "}
              · {totalBobinas} bobinas declaradas
            </p>
          </div>

          <div className="mt-5 space-y-6">

            {productos.map(
              (
                producto,
                indice,
              ) => (
                <div
                  key={producto.id}
                  className="rounded-xl border border-border bg-card p-5"
                >

                  <div className="flex items-center justify-between gap-4">

                    <h3 className="text-lg font-bold">
                      PRODUCTO{" "}
                      {indice + 1}
                    </h3>

                    {productos.length >
                      1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          eliminarProducto(
                            producto.id,
                          )
                        }
                      >
                        <Trash2
                          className="mr-2 size-4"
                          aria-hidden="true"
                        />

                        ELIMINAR
                      </Button>
                    )}

                  </div>

                  <div className="mt-5 space-y-2">

                    <Label
                      htmlFor={`codigo-${producto.id}`}
                      className="text-base"
                    >
                      Código de etiqueta
                    </Label>

                    <Input
                      id={`codigo-${producto.id}`}
                      className={inputClass}
                      value={
                        producto.codigo_etiqueta
                      }
                      maxLength={100}
                      autoComplete="off"
                      onChange={(e) =>
                        cambiarCodigo(
                          producto.id,
                          e.target.value,
                        )
                      }
                      onBlur={() =>
                        void consultarCodigo(
                          producto.id,
                          producto.codigo_etiqueta,
                        )
                      }
                      required
                    />

                    {producto.buscando && (
                      <p className="flex items-center gap-2 text-sm text-muted-foreground">

                        <Loader2
                          className="size-4 animate-spin"
                          aria-hidden="true"
                        />

                        Buscando etiqueta…

                      </p>
                    )}

                  </div>

                  <div className="mt-5 space-y-2">

                    <Label
                      htmlFor={`descripcion-${producto.id}`}
                      className="text-base"
                    >
                      Descripción
                    </Label>

                    <Input
                      id={`descripcion-${producto.id}`}
                      className={inputClass}
                      value={
                        producto.descripcion
                      }
                      maxLength={500}
                      readOnly={
                        producto.descripcion_bloqueada
                      }
                      onChange={(e) =>
                        actualizarProducto(
                          producto.id,
                          {
                            descripcion:
                              e.target.value,
                          },
                        )
                      }
                      required
                    />

                    {producto.descripcion_bloqueada && (
                      <p className="text-sm text-muted-foreground">
                        Descripción tomada del maestro de etiquetas.
                      </p>
                    )}

                  </div>

                  <div className="mt-5 grid gap-6 sm:grid-cols-2">

                    <div className="space-y-2">

                      <Label
                        htmlFor={`bobinas-${producto.id}`}
                        className="text-base"
                      >
                        Cantidad de bobinas
                      </Label>

                      <Input
                        id={`bobinas-${producto.id}`}
                        className={inputClass}
                        type="number"
                        min={1}
                        max={100}
                        step={1}
                        inputMode="numeric"
                        value={
                          producto.cantidad_bobinas
                        }
                        onChange={(e) =>
                          actualizarProducto(
                            producto.id,
                            {
                              cantidad_bobinas:
                                e.target.value.replace(
                                  /[^0-9]/g,
                                  "",
                                ),
                            },
                          )
                        }
                        required
                      />

                    </div>

                    <div className="space-y-2">

                      <Label
                        htmlFor={`cantidad-${producto.id}`}
                        className="text-base"
                      >
                        Cantidad por bobina
                      </Label>

                      <Input
                        id={`cantidad-${producto.id}`}
                        className={inputClass}
                        type="number"
                        min={1}
                        step={1}
                        inputMode="numeric"
                        value={
                          producto.cantidad_por_bobina
                        }
                        onChange={(e) =>
                          actualizarProducto(
                            producto.id,
                            {
                              cantidad_por_bobina:
                                e.target.value.replace(
                                  /[^0-9]/g,
                                  "",
                                ),
                            },
                          )
                        }
                        required
                      />

                    </div>

                  </div>

                </div>
              ),
            )}

          </div>

          <Button
            type="button"
            variant="outline"
            size="lg"
            className="mt-5 h-14 w-full text-base font-semibold"
            onClick={
              agregarProducto
            }
          >
            <Plus
              className="mr-2 size-5"
              aria-hidden="true"
            />

            AGREGAR OTRO PRODUCTO
          </Button>

        </section>

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
            enviando ||
            hayBusqueda
          }
          className="h-20 w-full text-2xl font-bold"
        >

          {enviando ? (
            <>
              <Loader2
                className="size-6 animate-spin"
                aria-hidden="true"
              />

              REGISTRANDO ENVÍO…
            </>
          ) : (
            <>
              <Send
                className="size-6"
                aria-hidden="true"
              />

              CONFIRMAR ENVÍO
            </>
          )}

        </Button>

      </form>

    </main>
  );
}

import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
} from "lucide-react";

import {
  buscarEtiqueta,
  registrarRecepcionMultiple,
} from "@/lib/bobinas.functions";
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
      { title: "Recepción de Bobinas | Coquimbito" },
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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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

const inputClass = "h-14 text-lg";

function Recepcion() {
  const router = useRouter();
  const lookup = useServerFn(buscarEtiqueta);
  const registrar = useServerFn(registrarRecepcionMultiple);

  const [codigo, setCodigo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [descripcionBloqueada, setDescripcionBloqueada] = useState(false);

  const [cantidadBobinas, setCantidadBobinas] = useState("1");
  const [cantidad, setCantidad] = useState("");

  const [proveedor, setProveedor] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [operario, setOperario] = useState("");

  const [buscando, setBuscando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<Exito | null>(null);

  const limpiar = () => {
    setCodigo("");
    setDescripcion("");
    setDescripcionBloqueada(false);
    setCantidadBobinas("1");
    setCantidad("");
    setProveedor("");
    setUbicacion("");
    setOperario("");
    setError(null);
    setExito(null);
  };

  const codigoActualRef = useRef(codigo);
  codigoActualRef.current = codigo;

  const onChangeCodigo = (value: string) => {
    setCodigo(value);
    setDescripcion("");
    setDescripcionBloqueada(false);
    setError(null);
  };

  const onBlurCodigo = async () => {
    const valor = codigo.trim();

    if (!valor) {
      setDescripcion("");
      setDescripcionBloqueada(false);
      return;
    }

    setBuscando(true);
    setError(null);

    try {
      const res = await lookup({
        data: {
          codigo_etiqueta: valor,
        },
      });

      if (codigoActualRef.current.trim() !== valor) return;

      if (res.existe) {
        setDescripcion(res.descripcion);
        setDescripcionBloqueada(true);
      } else {
        setDescripcion("");
        setDescripcionBloqueada(false);
      }
    } catch (e) {
      if (codigoActualRef.current.trim() === valor) {
        setError(
          e instanceof Error
            ? e.message
            : "No se pudo consultar la etiqueta.",
        );
      }
    } finally {
      if (codigoActualRef.current.trim() === valor) {
        setBuscando(false);
      }
    }
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (enviando) return;

    setError(null);

    const codigoLimpio = codigo.trim();
    const cantidadNum = Number(cantidad);
    const cantidadBobinasNum = Number(cantidadBobinas);

    if (!codigoLimpio) {
      return setError("Ingrese el código de etiqueta.");
    }

    if (!descripcion.trim()) {
      return setError(
        "La descripción es obligatoria para un código nuevo.",
      );
    }

    if (
      !Number.isInteger(cantidadBobinasNum) ||
      cantidadBobinasNum < 1 ||
      cantidadBobinasNum > 100
    ) {
      return setError(
        "La cantidad de bobinas debe ser un número entero entre 1 y 100.",
      );
    }

    if (!Number.isInteger(cantidadNum) || cantidadNum <= 0) {
      return setError(
        "La cantidad por bobina debe ser un número entero positivo.",
      );
    }

    setEnviando(true);

    try {
      const res = await registrar({
        data: {
          codigo_etiqueta: codigoLimpio,
          descripcion: descripcion.trim(),
          cantidad: cantidadNum,
          cantidad_bobinas: cantidadBobinasNum,
          proveedor: proveedor.trim(),
          ubicacion: ubicacion.trim(),
          operario: operario.trim(),
        },
      });

      if (!res.ok && res.cantidad_creada === 0) {
        setError(res.mensaje);
        return;
      }

      setExito({
        ok: res.ok,
        ids_bobinas: res.ids_bobinas,
        cantidad_solicitada: res.cantidad_solicitada,
        cantidad_creada: res.cantidad_creada,
        mensaje: res.mensaje,
        codigo_etiqueta: codigoLimpio,
        descripcion: descripcion.trim(),
        cantidad: String(cantidadNum),
      });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "No se pudo registrar la recepción.",
      );
    } finally {
      setEnviando(false);
    }
  };

  if (exito) {
    const recepcionParcial = !exito.ok;
    const esUnaBobina = exito.cantidad_creada === 1;

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
              <p className="font-semibold">{exito.mensaje}</p>
              <p className="mt-2 text-sm">
                No vuelva a registrar la recepción completa sin revisar
                primero los ID que aparecen abajo.
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
                  {exito.ids_bobinas.map((id) => (
                    <div
                      key={id}
                      className="rounded-md border border-border px-3 py-2 text-center text-base font-bold tabular-nums"
                    >
                      {id}
                    </div>
                  ))}
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
              <dt className="text-muted-foreground">Descripción</dt>
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

          <div className="mt-8 flex flex-col gap-3">
            <Button
              size="lg"
              className="h-16 text-xl font-semibold"
              onClick={() => {
                limpiar();
                router.invalidate();
              }}
            >
              NUEVA RECEPCIÓN
            </Button>

            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-12 text-base"
            >
              <Link to="/">Volver al menú</Link>
            </Button>
          </div>
        </div>
      </main>
    );
  }

  const cantidadBobinasVista = Number(cantidadBobinas);

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Menú principal
      </Link>

      <h1 className="mt-6 text-3xl font-bold tracking-tight">
        Recepción de Bobinas
      </h1>

      <p className="mt-1 text-base text-muted-foreground">
        Complete los datos una sola vez y defina cuántas bobinas desea
        ingresar.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-6">
        <div className="space-y-2">
          <Label htmlFor="codigo" className="text-base">
            Código de etiqueta
          </Label>

          <Input
            id="codigo"
            className={inputClass}
            value={codigo}
            maxLength={100}
            autoComplete="off"
            onChange={(e) => onChangeCodigo(e.target.value)}
            onBlur={onBlurCodigo}
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
          <Label htmlFor="descripcion" className="text-base">
            Descripción
          </Label>

          <Input
            id="descripcion"
            className={inputClass}
            value={descripcion}
            maxLength={500}
            readOnly={descripcionBloqueada}
            onChange={(e) => setDescripcion(e.target.value)}
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
            <Label htmlFor="cantidad-bobinas" className="text-base">
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
              value={cantidadBobinas}
              onChange={(e) =>
                setCantidadBobinas(
                  e.target.value.replace(/[^0-9]/g, ""),
                )
              }
              required
            />

            <p className="text-sm text-muted-foreground">
              Entre 1 y 100. Cada bobina recibirá un CQ distinto.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cantidad" className="text-base">
              Cantidad por bobina
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
                  e.target.value.replace(/[^0-9]/g, ""),
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
            <Label htmlFor="proveedor" className="text-base">
              Proveedor (opcional)
            </Label>

            <Input
              id="proveedor"
              className={inputClass}
              value={proveedor}
              maxLength={200}
              onChange={(e) => setProveedor(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ubicacion" className="text-base">
              Ubicación (opcional)
            </Label>

            <Input
              id="ubicacion"
              className={inputClass}
              value={ubicacion}
              maxLength={200}
              onChange={(e) => setUbicacion(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="operario" className="text-base">
            Operario (opcional)
          </Label>

          <Input
            id="operario"
            className={inputClass}
            value={operario}
            maxLength={200}
            onChange={(e) => setOperario(e.target.value)}
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
          disabled={enviando}
          className="h-20 w-full text-2xl font-bold"
        >
          {enviando
            ? "REGISTRANDO…"
            : Number.isInteger(cantidadBobinasVista) &&
                cantidadBobinasVista > 1
              ? `INGRESAR ${cantidadBobinasVista} BOBINAS`
              : "INGRESAR BOBINA"}
        </Button>
      </form>
    </main>
  );
}

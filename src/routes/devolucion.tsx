import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";

import {
  consultarBobina,
  registrarDevolucion,
  type BobinaFicha,
} from "@/lib/bobinas.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/devolucion")({
  component: Devolucion,
  errorComponent: () => (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <p
        role="alert"
        className="rounded-md bg-destructive/10 p-4 text-base text-destructive"
      >
        No se pudo cargar la pantalla de devolución. Recargue la página.
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
      { title: "Devolución de Bobinas | Coquimbito" },
      {
        name: "description",
        content:
          "Registrar la devolución de una bobina en planta Coquimbito: escaneo del ID, cantidad devuelta, línea, operario y ubicación.",
      },
      {
        property: "og:title",
        content: "Devolución de Bobinas | Coquimbito",
      },
      {
        property: "og:description",
        content:
          "Registrar la devolución de una bobina en planta Coquimbito.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Bobina = BobinaFicha;

type Exito = {
  id_bobina: string;
  cantidad_actual: string;
  linea: string;
  ubicacion: string;
  operario: string;
};

const inputClass = "h-14 text-lg";

const texto = (valor: unknown) =>
  valor === null || valor === undefined || valor === ""
    ? "—"
    : String(valor);

function Devolucion() {
  const router = useRouter();
  const consultar = useServerFn(consultarBobina);
  const registrar = useServerFn(registrarDevolucion);

  const escanerRef = useRef<HTMLInputElement>(null);
  const envioEnCursoRef = useRef(false);

  const [id, setId] = useState("");
  const [bobina, setBobina] = useState<Bobina | null>(null);

  const [buscando, setBuscando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<Exito | null>(null);

  const [cantidad, setCantidad] = useState("");
  const [linea, setLinea] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [observacion, setObservacion] = useState("");

  useEffect(() => {
    if (!bobina && !exito) {
      escanerRef.current?.focus();
    }
  }, [bobina, exito]);

  const reiniciar = () => {
    envioEnCursoRef.current = false;

    setId("");
    setBobina(null);
    setCantidad("");
    setLinea("");
    setUbicacion("");
    setObservacion("");
    setError(null);
    setExito(null);
    setEnviando(false);
  };

  const buscar = async () => {
    const valor = id.trim().toUpperCase();

    if (!valor || buscando) return;

    setBuscando(true);
    setError(null);

    try {
      const res: { bobina: Bobina | null } = await consultar({
        data: {
          id_bobina: valor,
        },
      });

      if (!res.bobina) {
        setBobina(null);
        setError("Bobina no encontrada");
        setId("");
        escanerRef.current?.focus();
        return;
      }

      setId(valor);
      setBobina(res.bobina);
      setUbicacion(res.bobina.ubicacion ?? "");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "No se pudo consultar la bobina.",
      );
    } finally {
      setBuscando(false);
    }
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    // Protección adicional contra doble registro.
    if (envioEnCursoRef.current) return;

    setError(null);

    if (!bobina) return;

    const cantidadNum = Number(cantidad);

    if (!Number.isInteger(cantidadNum) || cantidadNum <= 0) {
      return setError(
        "La cantidad devuelta debe ser un número entero positivo.",
      );
    }

    const idBobina = String(bobina.id_bobina);

    envioEnCursoRef.current = true;
    setEnviando(true);

    try {
      await registrar({
        data: {
          id_bobina: idBobina,
          cantidad: cantidadNum,
          linea: linea.trim(),
          ubicacion: ubicacion.trim(),
          observacion: observacion.trim(),
        },
      });

      const res: { bobina: Bobina | null } = await consultar({
        data: {
          id_bobina: idBobina,
        },
      });

      const actualizada = res.bobina;

      setExito({
        id_bobina: idBobina,
        cantidad_actual: texto(
          actualizada?.cantidad_actual ?? cantidadNum,
        ),
        linea: texto(
          actualizada?.ultima_linea ?? linea.trim(),
        ),
        ubicacion: texto(
          actualizada?.ubicacion ?? ubicacion.trim(),
        ),
        operario: texto(
          actualizada?.ultimo_operario_devolucion,
        ),
      });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "No se pudo registrar la devolución.",
      );
    } finally {
      envioEnCursoRef.current = false;
      setEnviando(false);
    }
  };

  if (exito) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-10">
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <CheckCircle2
            className="mx-auto size-16 text-primary"
            aria-hidden="true"
          />

          <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
            DEVOLUCIÓN REGISTRADA CORRECTAMENTE
          </h1>

          <p className="mt-6 text-sm uppercase text-muted-foreground">
            ID Bobina
          </p>

          <p className="text-4xl font-bold tabular-nums">
            {exito.id_bobina}
          </p>

          <dl className="mt-8 space-y-3 text-left text-lg">
            <div className="flex justify-between gap-4 border-b border-border pb-2">
              <dt className="text-muted-foreground">
                Nueva cantidad actual
              </dt>
              <dd className="font-semibold tabular-nums">
                {exito.cantidad_actual}
              </dd>
            </div>

            <div className="flex justify-between gap-4 border-b border-border pb-2">
              <dt className="text-muted-foreground">
                Línea
              </dt>
              <dd className="font-semibold">
                {exito.linea}
              </dd>
            </div>

            <div className="flex justify-between gap-4 border-b border-border pb-2">
              <dt className="text-muted-foreground">
                Nueva ubicación
              </dt>
              <dd className="font-semibold">
                {exito.ubicacion}
              </dd>
            </div>

            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">
                Operario
              </dt>
              <dd className="font-semibold">
                {exito.operario}
              </dd>
            </div>
          </dl>

          <div className="mt-8 flex flex-col gap-3">
            <Button
              size="lg"
              className="h-16 text-xl font-semibold"
              onClick={() => {
                reiniciar();
                router.invalidate();
              }}
            >
              NUEVA DEVOLUCIÓN
            </Button>

            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-12 text-base"
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

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
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
        DEVOLUCIÓN DE BOBINA
      </h1>

      <div className="mt-8 space-y-2">
        <Label
          htmlFor="id-bobina"
          className="text-base"
        >
          Escanear ID de bobina
        </Label>

        <Input
          id="id-bobina"
          ref={escanerRef}
          className="h-16 text-2xl tracking-wide"
          value={id}
          maxLength={100}
          autoComplete="off"
          placeholder="CQ-000001"
          onChange={(e) => setId(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void buscar();
            }
          }}
        />

        {buscando && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2
              className="size-4 animate-spin"
              aria-hidden="true"
            />
            Consultando bobina…
          </p>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="mt-6 rounded-md bg-destructive/10 p-4 text-lg font-semibold text-destructive"
        >
          {error}
        </p>
      )}

      {bobina && (
        <>
          <section className="mt-8 rounded-xl border border-border bg-card p-6">
            <h2 className="text-xl font-bold">
              {texto(bobina.id_bobina)}
            </h2>

            <dl className="mt-4 space-y-3 text-base">
              {[
                [
                  "Código de etiqueta",
                  bobina.codigo_etiqueta,
                ],
                [
                  "Descripción",
                  bobina.descripcion,
                ],
                [
                  "Cantidad actual",
                  bobina.cantidad_actual,
                ],
                [
                  "Ubicación actual",
                  bobina.ubicacion,
                ],
                [
                  "Estado",
                  bobina.estado,
                ],
                [
                  "Vigencia",
                  bobina.vigencia,
                ],
                [
                  "Fecha de vencimiento",
                  bobina.fecha_vencimiento,
                ],
              ].map(([etiqueta, valor]) => (
                <div
                  key={String(etiqueta)}
                  className="flex justify-between gap-4 border-b border-border pb-2 last:border-0 last:pb-0"
                >
                  <dt className="text-muted-foreground">
                    {String(etiqueta)}
                  </dt>
                  <dd className="text-right font-semibold">
                    {texto(valor)}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <form
            onSubmit={onSubmit}
            className="mt-8 space-y-6"
          >
            <div className="space-y-2">
              <Label
                htmlFor="cantidad"
                className="text-base"
              >
                Cantidad devuelta
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
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label
                  htmlFor="linea"
                  className="text-base"
                >
                  Línea
                </Label>

                <Input
                  id="linea"
                  className={inputClass}
                  value={linea}
                  maxLength={200}
                  onChange={(e) =>
                    setLinea(e.target.value)
                  }
                />
              </div>


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
                  value={ubicacion}
                  maxLength={200}
                  onChange={(e) =>
                    setUbicacion(e.target.value)
                  }
                />
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
                    setObservacion(e.target.value)
                  }
                />
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              className="h-16 w-full text-xl font-semibold"
              disabled={enviando}
            >
              {enviando ? (
                <>
                  <Loader2
                    className="size-5 animate-spin"
                    aria-hidden="true"
                  />
                  Registrando…
                </>
              ) : (
                "REGISTRAR DEVOLUCIÓN"
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-12 w-full text-base"
              onClick={reiniciar}
              disabled={enviando}
            >
              Escanear otra bobina
            </Button>
          </form>
        </>
      )}
    </main>
  );
}

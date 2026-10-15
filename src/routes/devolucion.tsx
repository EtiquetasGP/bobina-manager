import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";

import {
  consultarBobina,
  registrarDevolucionConSentido,
  type BobinaFicha,
} from "@/lib/bobinas.functions";
import { generarEtiquetaZpl, type ZebraLabelData } from "@/lib/zebra-label";
import { obtenerImpresoraPredeterminada, enviarZpl } from "@/lib/browser-print";

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
  sentido_bobinado: string;
  etiqueta: ZebraLabelData;
};

const inputClass = "h-14 text-lg";

const texto = (valor: unknown) =>
  valor === null || valor === undefined || valor === ""
    ? "—"
    : String(valor);

function Devolucion() {
  const router = useRouter();
  const consultar = useServerFn(consultarBobina);
  const registrar = useServerFn(registrarDevolucionConSentido);

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
  const [sentidoBobinado, setSentidoBobinado] = useState("");
  const [imprimiendo, setImprimiendo] = useState(false);
  const [impresionEnviada, setImpresionEnviada] = useState(false);
  const [errorImpresion, setErrorImpresion] = useState("");
  const [avisoRegistro, setAvisoRegistro] = useState("");
  const impresionRef = useRef(false);

  const imprimirSticker = async (etiqueta: ZebraLabelData) => {
    if (impresionRef.current) return;
    impresionRef.current = true;
    setImprimiendo(true);
    setErrorImpresion("");
    setImpresionEnviada(false);
    try {
      const impresora = await obtenerImpresoraPredeterminada();
      // Solo esta devolución usa una copia. Recepción mantiene sus dos stickers.
      const zpl = generarEtiquetaZpl(etiqueta).replace("^PQ2,0,1,Y", "^PQ1,0,1,Y");
      await enviarZpl(impresora, zpl);
      setImpresionEnviada(true);
    } catch (e) {
      setErrorImpresion(e instanceof Error ? e.message : "No se pudo enviar el sticker a la impresora.");
    } finally {
      impresionRef.current = false;
      setImprimiendo(false);
    }
  };

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
    setSentidoBobinado("");
    setErrorImpresion("");
    setImpresionEnviada(false);
    setAvisoRegistro("");
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
    if (envioEnCursoRef.current || !bobina) return;
    setError(null);
    const cantidadNum = Number(cantidad);
    if (!Number.isInteger(cantidadNum) || cantidadNum <= 0 || cantidadNum > 1_000_000_000) {
      return setError("La cantidad devuelta debe ser un entero entre 1 y 1.000.000.000.");
    }
    if (!linea.trim()) return setError("Ingrese la línea.");
    if (!ubicacion.trim()) return setError("Ingrese la ubicación.");
    if (!sentidoBobinado.trim()) return setError("Ingrese el sentido de bobinado.");

    const idBobina = bobina.id_bobina;
    const resumen: Exito = {
      id_bobina: idBobina,
      cantidad_actual: String(cantidadNum),
      linea: linea.trim(),
      ubicacion: ubicacion.trim(),
      operario: "Cuenta de la sesión",
      sentido_bobinado: sentidoBobinado.trim(),
      etiqueta: {
        id_bobina: idBobina,
        codigo_etiqueta: bobina.codigo_etiqueta ?? "",
        descripcion: bobina.descripcion ?? "",
        cantidad: cantidadNum,
      },
    };
    envioEnCursoRef.current = true;
    setEnviando(true);
    try {
      await registrar({ data: {
        id_bobina: idBobina,
        cantidad: cantidadNum,
        linea: resumen.linea,
        ubicacion: resumen.ubicacion,
        sentido_bobinado: resumen.sentido_bobinado,
        observacion: observacion.trim(),
      } });
    } catch (e) {
      envioEnCursoRef.current = false;
      setEnviando(false);
      setError(e instanceof Error ? e.message : "No se pudo registrar la devolución.");
      return;
    }

    // La devolución ya está guardada. Los errores de consulta o impresión
    // no vuelven a habilitar el registro del movimiento.
    setExito(resumen);
    setEnviando(false);
    const impresion = imprimirSticker(resumen.etiqueta);
    try {
      const res = await consultar({ data: { id_bobina: idBobina } });
      if (res.bobina) {
        setExito({ ...resumen, operario: texto(res.bobina.ultimo_operario_devolucion) });
      } else {
        setAvisoRegistro("La devolución está registrada, pero no se pudo recuperar la ficha actualizada.");
      }
    } catch {
      setAvisoRegistro("La devolución está registrada. No se pudo actualizar el nombre en el resumen; no vuelva a registrar el movimiento.");
    }
    await impresion;
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
            <div className="flex justify-between gap-4 border-t border-border pt-2">
              <dt className="text-muted-foreground">Sentido de bobinado</dt>
              <dd className="font-semibold">{exito.sentido_bobinado}</dd>
            </div>
          </dl>

          {avisoRegistro && <p role="status" className="mt-4 rounded-lg bg-muted p-3 text-sm">{avisoRegistro}</p>}
          <section className="mt-6 rounded-xl border border-border p-4 text-left space-y-3">
            <h2 className="font-semibold">Sticker exterior actualizado</h2>
            <p className="text-sm text-muted-foreground">Coloque el sticker nuevo por fuera y conserve el sticker interior como referencia de origen.</p>
            {imprimiendo && <p role="status">Enviando un sticker a la Zebra…</p>}
            {impresionEnviada && <p role="status">Se envió 1 sticker a la impresora. Verifique que haya salido correctamente.</p>}
            {errorImpresion && <p role="alert" className="text-destructive">La devolución ya está guardada. {errorImpresion} Verifique si salió el sticker antes de reintentar.</p>}
            <Button type="button" variant="outline" disabled={imprimiendo}
              onClick={() => void imprimirSticker(exito.etiqueta)}>
              {imprimiendo ? "Enviando…" : impresionEnviada ? "Reimprimir 1 sticker" : "Imprimir / reintentar 1 sticker"}
            </Button>
          </section>

          <div className="mt-8 flex flex-col gap-3">
            <Button
              size="lg"
              className="h-16 text-xl font-semibold"
              disabled={imprimiendo}
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
                max={1_000_000_000}
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
                  required
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
                  required
                  className={inputClass}
                  value={ubicacion}
                  maxLength={200}
                  onChange={(e) =>
                    setUbicacion(e.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sentido-bobinado" className="text-base">Sentido de bobinado</Label>
                <Input id="sentido-bobinado" className={inputClass}
                  required maxLength={100} autoComplete="off"
                  value={sentidoBobinado}
                  onChange={(e) => setSentidoBobinado(e.target.value)} />
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

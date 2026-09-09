import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Printer,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { generarEtiquetaZpl } from "@/lib/zebra-label";

export const Route = createFileRoute("/prueba-zebra")({
  component: PruebaZebra,
});

type ZebraDevice = {
  name?: string;
  uid?: string;
  connection?: string;
  send: (
    data: string,
    successCallback?: () => void,
    errorCallback?: (error: unknown) => void,
  ) => void;
};

type BrowserPrintApi = {
  getDefaultDevice: (
    type: "printer",
    successCallback: (device: ZebraDevice | undefined) => void,
    errorCallback?: (error: unknown) => void,
  ) => void;
};

declare global {
  interface Window {
    BrowserPrint?: BrowserPrintApi;
  }
}

function cargarScript(src: string, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existente = document.getElementById(id);

    if (existente) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.async = false;

    script.onload = () => resolve();

    script.onerror = () =>
      reject(
        new Error(
          `No se pudo cargar ${src}`,
        ),
      );

    document.head.appendChild(script);
  });
}

function PruebaZebra() {
  const [cargando, setCargando] = useState(true);
  const [buscando, setBuscando] = useState(false);
  const [imprimiendo, setImprimiendo] = useState(false);

  const [impresora, setImpresora] =
    useState<ZebraDevice | null>(null);

  const [mensaje, setMensaje] =
    useState<string | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    const cargarBrowserPrint = async () => {
      try {
        await cargarScript(
          "/BrowserPrint-3.1.250.min.js",
          "browser-print",
        );

        await cargarScript(
          "/BrowserPrint-Zebra-1.1.250.min.js",
          "browser-print-zebra",
        );

        if (!window.BrowserPrint) {
          throw new Error(
            "Browser Print no está disponible en esta computadora.",
          );
        }

        setMensaje(
          "Browser Print cargado correctamente.",
        );
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "No se pudo cargar Zebra Browser Print.",
        );
      } finally {
        setCargando(false);
      }
    };

    void cargarBrowserPrint();
  }, []);

  const detectarImpresora = () => {
    setError(null);
    setMensaje(null);
    setBuscando(true);

    if (!window.BrowserPrint) {
      setBuscando(false);
      setError(
        "Browser Print no está disponible.",
      );
      return;
    }

    window.BrowserPrint.getDefaultDevice(
      "printer",
      (device) => {
        setBuscando(false);

        if (!device) {
          setError(
            "No se encontró una impresora predeterminada.",
          );
          return;
        }

        setImpresora(device);

        setMensaje(
          `Impresora detectada: ${
            device.name ??
            device.uid ??
            "Zebra"
          }`,
        );
      },
      () => {
        setBuscando(false);

        setError(
          "No se pudo acceder a la impresora mediante Browser Print.",
        );
      },
    );
  };

  const imprimirPrueba = () => {
    if (!impresora) {
      setError(
        "Primero detecte la impresora.",
      );
      return;
    }

    if (imprimiendo) return;

    setError(null);
    setMensaje(null);
    setImprimiendo(true);

    const zpl = generarEtiquetaZpl({
      id_bobina: "CQ-999999",
      codigo_etiqueta: "458721",
      descripcion: "Trapiche Malbec 750 ml",
      cantidad: 12500,
    });

    impresora.send(
      zpl,
      () => {
        setImprimiendo(false);

        setMensaje(
          "Etiqueta de prueba enviada correctamente. Deben imprimirse 2 stickers iguales.",
        );
      },
      () => {
        setImprimiendo(false);

        setError(
          "La Zebra no pudo imprimir la etiqueta de prueba.",
        );
      },
    );
  };

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
        PRUEBA DE IMPRESORA ZEBRA
      </h1>

      <p className="mt-2 text-base text-muted-foreground">
        Esta pantalla no registra ni modifica bobinas.
      </p>

      <div className="mt-8 rounded-xl border border-border bg-card p-6">
        <div className="mb-6 rounded-lg border border-border bg-background p-5">
          <p className="text-sm font-semibold uppercase text-muted-foreground">
            Datos de prueba
          </p>

          <dl className="mt-3 space-y-2 text-base">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">
                ID / Código de barras
              </dt>
              <dd className="font-bold">
                CQ-999999
              </dd>
            </div>

            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">
                Código de etiqueta
              </dt>
              <dd className="font-semibold">
                458721
              </dd>
            </div>

            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">
                Descripción
              </dt>
              <dd className="text-right font-semibold">
                Trapiche Malbec 750 ml
              </dd>
            </div>

            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">
                Cantidad
              </dt>
              <dd className="font-semibold">
                12500
              </dd>
            </div>

            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">
                Copias
              </dt>
              <dd className="font-semibold">
                2
              </dd>
            </div>
          </dl>
        </div>

        {cargando ? (
          <p className="flex items-center gap-2 text-lg">
            <Loader2
              className="size-5 animate-spin"
              aria-hidden="true"
            />

            Cargando Browser Print…
          </p>
        ) : (
          <div className="space-y-4">
            <Button
              type="button"
              size="lg"
              className="h-16 w-full text-xl font-semibold"
              disabled={buscando || imprimiendo}
              onClick={detectarImpresora}
            >
              {buscando ? (
                <>
                  <Loader2
                    className="size-5 animate-spin"
                    aria-hidden="true"
                  />

                  Buscando impresora…
                </>
              ) : (
                <>
                  <Printer
                    className="size-5"
                    aria-hidden="true"
                  />

                  DETECTAR IMPRESORA
                </>
              )}
            </Button>

            {impresora && (
              <Button
                type="button"
                size="lg"
                className="h-16 w-full text-xl font-semibold"
                disabled={imprimiendo}
                onClick={imprimirPrueba}
              >
                {imprimiendo ? (
                  <>
                    <Loader2
                      className="size-5 animate-spin"
                      aria-hidden="true"
                    />

                    Imprimiendo…
                  </>
                ) : (
                  "IMPRIMIR ETIQUETA DE PRUEBA"
                )}
              </Button>
            )}
          </div>
        )}

        {mensaje && (
          <div className="mt-6 flex items-center gap-3 rounded-md bg-primary/10 p-4">
            <CheckCircle2
              className="size-5 text-primary"
              aria-hidden="true"
            />

            <p className="font-semibold">
              {mensaje}
            </p>
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="mt-6 rounded-md bg-destructive/10 p-4 font-semibold text-destructive"
          >
            {error}
          </p>
        )}
      </div>
    </main>
  );
}

import { createClientOnlyFn } from "@tanstack/react-start";

export type ZebraDevice = {
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

function obtenerBrowserPrintApi():
  | BrowserPrintApi
  | undefined {
  return (
    window as Window & {
      BrowserPrint?: BrowserPrintApi;
    }
  ).BrowserPrint;
}

function esperar(
  milisegundos: number,
): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(
      resolve,
      milisegundos,
    );
  });
}

function cargarScript(
  src: string,
  id: string,
): Promise<void> {
  return new Promise(
    (
      resolve,
      reject,
    ) => {
      const existente =
        document.getElementById(
          id,
        ) as HTMLScriptElement | null;

      if (existente) {
        if (
          existente.dataset.cargado ===
            "true" ||
          obtenerBrowserPrintApi()
        ) {
          resolve();
          return;
        }

        existente.addEventListener(
          "load",
          () => resolve(),
          {
            once: true,
          },
        );

        existente.addEventListener(
          "error",
          () =>
            reject(
              new Error(
                `No se pudo cargar ${src}`,
              ),
            ),
          {
            once: true,
          },
        );

        return;
      }

      const script =
        document.createElement(
          "script",
        );

      script.id = id;
      script.src = src;
      script.async = false;

      script.onload = () => {
        script.dataset.cargado =
          "true";

        resolve();
      };

      script.onerror = () => {
        reject(
          new Error(
            `No se pudo cargar ${src}`,
          ),
        );
      };

      document.head.appendChild(
        script,
      );
    },
  );
}

async function cargarBrowserPrintInterno() {
  if (
    obtenerBrowserPrintApi()
  ) {
    return;
  }

  await cargarScript(
    "/BrowserPrint-3.1.250.min.js",
    "browser-print",
  );

  await cargarScript(
    "/BrowserPrint-Zebra-1.1.250.min.js",
    "browser-print-zebra",
  );

  if (
    !obtenerBrowserPrintApi()
  ) {
    throw new Error(
      "Zebra Browser Print no está disponible en esta computadora.",
    );
  }
}

/*
 * =====================================================
 * OBTENER IMPRESORA UNA VEZ
 * =====================================================
 */

async function intentarObtenerImpresora():
  Promise<ZebraDevice> {
  const browserPrint =
    obtenerBrowserPrintApi();

  if (!browserPrint) {
    throw new Error(
      "Zebra Browser Print no está disponible.",
    );
  }

  return new Promise<ZebraDevice>(
    (
      resolve,
      reject,
    ) => {
      browserPrint.getDefaultDevice(
        "printer",

        (device) => {
          if (!device) {
            reject(
              new Error(
                "No se encontró una impresora Zebra predeterminada.",
              ),
            );

            return;
          }

          resolve(device);
        },

        (error) => {
          console.error(
            "Error accediendo a la Zebra:",
            error,
          );

          reject(
            new Error(
              "No se pudo acceder a la impresora mediante Zebra Browser Print.",
            ),
          );
        },
      );
    },
  );
}

/*
 * =====================================================
 * OBTENER IMPRESORA CON REINTENTO SEGURO
 * =====================================================
 *
 * IMPORTANTE:
 * Los reintentos ocurren ANTES de enviar cualquier ZPL.
 * Por eso no existe riesgo de imprimir stickers duplicados.
 */

async function obtenerImpresoraPredeterminadaInterna():
  Promise<ZebraDevice> {
  await cargarBrowserPrintInterno();

  let ultimoError:
    unknown = null;

  for (
    let intento = 1;
    intento <= 3;
    intento++
  ) {
    try {
      const impresora =
        await intentarObtenerImpresora();

      /*
       * Damos un pequeño tiempo a Browser Print
       * para estabilizar la conexión USB.
       */
      await esperar(400);

      return impresora;
    } catch (error) {
      ultimoError =
        error;

      console.warn(
        `Intento ${intento} de conexión Zebra falló.`,
        error,
      );

      if (
        intento < 3
      ) {
        await esperar(800);
      }
    }
  }

  console.error(
    "No se pudo acceder a la Zebra después de 3 intentos.",
    ultimoError,
  );

  throw new Error(
    "No se pudo acceder a la impresora Zebra. Verifique que esté encendida y conectada.",
  );
}

/*
 * =====================================================
 * ENVIAR ZPL
 * =====================================================
 */

async function enviarZplInterno(
  impresora: ZebraDevice,
  zpl: string,
): Promise<void> {
  await new Promise<void>(
    (
      resolve,
      reject,
    ) => {
      impresora.send(
        zpl,

        () => {
          resolve();
        },

        (error) => {
          console.error(
            "Error enviando ZPL a Zebra:",
            error,
          );

          reject(
            new Error(
              "La Zebra no pudo recibir la etiqueta.",
            ),
          );
        },
      );
    },
  );

  /*
   * Espaciamos ligeramente los trabajos.
   * Cada ZPL ya contiene ^PQ2,
   * así que siguen siendo 2 stickers por CQ.
   */
  await esperar(250);
}

/*
 * =====================================================
 * EXPORTS
 * =====================================================
 */

export const cargarBrowserPrint =
  createClientOnlyFn(
    async () => {
      await cargarBrowserPrintInterno();
    },
  );

export const obtenerImpresoraPredeterminada =
  createClientOnlyFn(
    async (): Promise<ZebraDevice> => {
      return await obtenerImpresoraPredeterminadaInterna();
    },
  );

export const enviarZpl =
  createClientOnlyFn(
    async (
      impresora: ZebraDevice,
      zpl: string,
    ): Promise<void> => {
      await enviarZplInterno(
        impresora,
        zpl,
      );
    },
  );

export const imprimirZpl =
  createClientOnlyFn(
    async (
      zpl: string,
    ): Promise<void> => {
      const impresora =
        await obtenerImpresoraPredeterminadaInterna();

      await enviarZplInterno(
        impresora,
        zpl,
      );
    },
  );

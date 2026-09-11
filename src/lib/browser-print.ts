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

type ZebraPrinterApi = {
  isReadyToPrint: (
    successCallback: (ready: boolean) => void,
    errorCallback?: (error: unknown) => void,
  ) => void;
};

type ZebraApi = {
  Printer: new (
    device: ZebraDevice,
  ) => ZebraPrinterApi;
};

/*
 * =====================================================
 * ACCESO A LAS LIBRERÍAS GLOBALES DE ZEBRA
 * =====================================================
 */

function obtenerBrowserPrintApi():
  | BrowserPrintApi
  | undefined {
  return (
    window as Window & {
      BrowserPrint?: BrowserPrintApi;
    }
  ).BrowserPrint;
}

function obtenerZebraApi():
  | ZebraApi
  | undefined {
  return (
    window as Window & {
      Zebra?: ZebraApi;
    }
  ).Zebra;
}

/*
 * =====================================================
 * UTILIDADES
 * =====================================================
 */

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

function obtenerMensajeError(
  error: unknown,
): string {
  if (
    error instanceof Error &&
    error.message
  ) {
    return error.message;
  }

  if (
    typeof error === "string"
  ) {
    return error;
  }

  try {
    return JSON.stringify(
      error,
    );
  } catch {
    return String(error);
  }
}

/*
 * =====================================================
 * CARGA DE SCRIPTS
 * =====================================================
 */

function cargarScript(
  src: string,
  id: string,
  estaDisponible: () => boolean,
): Promise<void> {
  return new Promise(
    (
      resolve,
      reject,
    ) => {
      if (
        estaDisponible()
      ) {
        resolve();
        return;
      }

      const existente =
        document.getElementById(
          id,
        ) as HTMLScriptElement | null;

      if (existente) {
        if (
          existente.dataset
            .cargado ===
            "true" ||
          estaDisponible()
        ) {
          resolve();
          return;
        }

        existente.addEventListener(
          "load",
          () => {
            existente.dataset.cargado =
              "true";

            resolve();
          },
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

/*
 * =====================================================
 * INICIALIZACIÓN DE BROWSER PRINT
 * =====================================================
 */

async function cargarBrowserPrintInterno() {
  /*
   * Antes el archivo salía inmediatamente
   * si BrowserPrint ya existía.
   *
   * Ahora comprobamos por separado la
   * librería base y BrowserPrint-Zebra.
   */

  if (
    !obtenerBrowserPrintApi()
  ) {
    await cargarScript(
      "/BrowserPrint-3.1.250.min.js",
      "browser-print",
      () =>
        Boolean(
          obtenerBrowserPrintApi(),
        ),
    );
  }

  if (
    !obtenerBrowserPrintApi()
  ) {
    throw new Error(
      "Zebra Browser Print no está disponible en esta computadora.",
    );
  }

  if (
    !obtenerZebraApi()
  ) {
    await cargarScript(
      "/BrowserPrint-Zebra-1.1.250.min.js",
      "browser-print-zebra",
      () =>
        Boolean(
          obtenerZebraApi(),
        ),
    );
  }

  if (
    !obtenerZebraApi()
  ) {
    throw new Error(
      "No se pudo cargar la librería Zebra Browser Print.",
    );
  }
}

/*
 * =====================================================
 * COMPROBAR QUE LA ZEBRA ESTÁ LISTA
 * =====================================================
 */

async function verificarImpresoraLista(
  device: ZebraDevice,
): Promise<void> {
  const zebra =
    obtenerZebraApi();

  if (!zebra) {
    throw new Error(
      "La librería Zebra no está disponible.",
    );
  }

  let printer:
    ZebraPrinterApi;

  try {
    /*
     * Zebra.Printer inicia comunicación
     * con el dispositivo y administra
     * correctamente sus consultas.
     */
    printer =
      new zebra.Printer(
        device,
      );
  } catch (error) {
    console.error(
      "No se pudo iniciar comunicación con la Zebra:",
      error,
    );

    throw new Error(
      "No se pudo iniciar la comunicación con la impresora Zebra.",
    );
  }

  await new Promise<void>(
    (
      resolve,
      reject,
    ) => {
      printer.isReadyToPrint(
        (ready) => {
          if (ready) {
            resolve();
            return;
          }

          reject(
            new Error(
              "La impresora Zebra está conectada, pero no está lista para imprimir. Revise papel, tapa y estado de la impresora.",
            ),
          );
        },

        (error) => {
          console.error(
            "Error consultando estado Zebra:",
            error,
          );

          reject(
            new Error(
              "No se pudo verificar el estado de la impresora Zebra.",
            ),
          );
        },
      );
    },
  );
}

/*
 * =====================================================
 * OBTENER IMPRESORA PREDETERMINADA
 * =====================================================
 */

async function obtenerImpresoraPredeterminadaInterna():
  Promise<ZebraDevice> {
  await cargarBrowserPrintInterno();

  const browserPrint =
    obtenerBrowserPrintApi();

  if (!browserPrint) {
    throw new Error(
      "Zebra Browser Print no está disponible.",
    );
  }

  const device =
    await new Promise<ZebraDevice>(
      (
        resolve,
        reject,
      ) => {
        browserPrint.getDefaultDevice(
          "printer",

          (
            impresora,
          ) => {
            if (!impresora) {
              reject(
                new Error(
                  "No se encontró una impresora Zebra predeterminada.",
                ),
              );

              return;
            }

            resolve(
              impresora,
            );
          },

          (error) => {
            console.error(
              "Error obteniendo impresora Zebra:",
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

  /*
   * No alcanza con que Browser Print conozca
   * cuál es la impresora predeterminada.
   *
   * Comprobamos que realmente se pueda
   * comunicar con ella y que esté lista.
   */

  await verificarImpresoraLista(
    device,
  );

  /*
   * Pequeña estabilización después de establecer
   * comunicación con la Zebra.
   */

  await esperar(300);

  return device;
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
          const detalle =
            obtenerMensajeError(
              error,
            );

          console.error(
            "Browser Print rechazó el envío ZPL:",
            detalle,
            error,
          );

          reject(
            new Error(
              `La Zebra no pudo recibir la etiqueta. ${detalle}`,
            ),
          );
        },
      );
    },
  );

  /*
   * Evitamos mandar dos trabajos ZPL
   * consecutivos en el mismo instante.
   *
   * Cada ZPL nuestro contiene ^PQ2,
   * por lo que sigue imprimiendo exactamente
   * 2 stickers por CQ.
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

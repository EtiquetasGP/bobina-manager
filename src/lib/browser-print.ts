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

function obtenerBrowserPrintApi(): BrowserPrintApi | undefined {
  return (
    window as Window & {
      BrowserPrint?: BrowserPrintApi;
    }
  ).BrowserPrint;
}

function cargarScript(
  src: string,
  id: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const existente = document.getElementById(
      id,
    ) as HTMLScriptElement | null;

    if (existente) {
      if (
        existente.dataset.cargado === "true" ||
        obtenerBrowserPrintApi()
      ) {
        resolve();
        return;
      }

      existente.addEventListener(
        "load",
        () => resolve(),
        { once: true },
      );

      existente.addEventListener(
        "error",
        () =>
          reject(
            new Error(
              `No se pudo cargar ${src}`,
            ),
          ),
        { once: true },
      );

      return;
    }

    const script =
      document.createElement("script");

    script.id = id;
    script.src = src;
    script.async = false;

    script.onload = () => {
      script.dataset.cargado = "true";
      resolve();
    };

    script.onerror = () => {
      reject(
        new Error(
          `No se pudo cargar ${src}`,
        ),
      );
    };

    document.head.appendChild(script);
  });
}

async function cargarBrowserPrintInterno() {
  if (obtenerBrowserPrintApi()) {
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

  if (!obtenerBrowserPrintApi()) {
    throw new Error(
      "Zebra Browser Print no está disponible en esta computadora.",
    );
  }
}

export const cargarBrowserPrint =
  createClientOnlyFn(async () => {
    await cargarBrowserPrintInterno();
  });

export const obtenerImpresoraPredeterminada =
  createClientOnlyFn(
    async (): Promise<ZebraDevice> => {
      await cargarBrowserPrintInterno();

      const browserPrint =
        obtenerBrowserPrintApi();

      if (!browserPrint) {
        throw new Error(
          "Zebra Browser Print no está disponible.",
        );
      }

      return new Promise<ZebraDevice>(
        (resolve, reject) => {
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

            () => {
              reject(
                new Error(
                  "No se pudo acceder a la impresora mediante Zebra Browser Print.",
                ),
              );
            },
          );
        },
      );
    },
  );

export const enviarZpl =
  createClientOnlyFn(
    async (
      impresora: ZebraDevice,
      zpl: string,
    ): Promise<void> => {
      return new Promise<void>(
        (resolve, reject) => {
          impresora.send(
            zpl,

            () => {
              resolve();
            },

            () => {
              reject(
                new Error(
                  "La Zebra no pudo imprimir la etiqueta.",
                ),
              );
            },
          );
        },
      );
    },
  );

export const imprimirZpl =
  createClientOnlyFn(
    async (
      zpl: string,
    ): Promise<void> => {
      await cargarBrowserPrintInterno();

      const browserPrint =
        obtenerBrowserPrintApi();

      if (!browserPrint) {
        throw new Error(
          "Zebra Browser Print no está disponible.",
        );
      }

      const impresora =
        await new Promise<ZebraDevice>(
          (resolve, reject) => {
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

              () => {
                reject(
                  new Error(
                    "No se pudo acceder a la impresora mediante Zebra Browser Print.",
                  ),
                );
              },
            );
          },
        );

      await new Promise<void>(
        (resolve, reject) => {
          impresora.send(
            zpl,

            () => {
              resolve();
            },

            () => {
              reject(
                new Error(
                  "La Zebra no pudo imprimir la etiqueta.",
                ),
              );
            },
          );
        },
      );
    },
  );

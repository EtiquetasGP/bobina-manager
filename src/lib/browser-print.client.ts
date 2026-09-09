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

declare global {
  interface Window {
    BrowserPrint?: BrowserPrintApi;
  }
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
      if (existente.dataset.cargado === "true") {
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

    const script = document.createElement("script");

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

export async function cargarBrowserPrint() {
  if (typeof window === "undefined") {
    throw new Error(
      "Browser Print solo está disponible desde el navegador.",
    );
  }

  if (window.BrowserPrint) {
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

  if (!window.BrowserPrint) {
    throw new Error(
      "Zebra Browser Print no está disponible en esta computadora.",
    );
  }
}

export async function obtenerImpresoraPredeterminada(): Promise<ZebraDevice> {
  await cargarBrowserPrint();

  return new Promise((resolve, reject) => {
    if (!window.BrowserPrint) {
      reject(
        new Error(
          "Zebra Browser Print no está disponible.",
        ),
      );
      return;
    }

    window.BrowserPrint.getDefaultDevice(
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
  });
}

export function enviarZpl(
  impresora: ZebraDevice,
  zpl: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    impresora.send(
      zpl,
      () => resolve(),
      () =>
        reject(
          new Error(
            "La Zebra no pudo imprimir la etiqueta.",
          ),
        ),
    );
  });
}

export async function imprimirZpl(
  zpl: string,
): Promise<void> {
  const impresora =
    await obtenerImpresoraPredeterminada();

  await enviarZpl(impresora, zpl);
}

import { createMiddleware } from "@tanstack/react-start";

export const ACCESO_COOKIE = "cq-acceso";
export const ACCESO_MAX_AGE = 60 * 60 * 12; // 12 horas

export type AccesoSession = { autorizado?: boolean };

/**
 * Middleware de función de servidor: exige una sesión de PIN válida antes de
 * ejecutar el handler. Las importaciones server-only se hacen dentro del
 * callback .server() para que nunca entren al bundle del navegador.
 */
export const requirePinAcceso = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const { useSession } = await import("@tanstack/react-start/server");
    const password = process.env["RECEPCION_SESSION_SECRET"];
    if (!password) throw new Error("RECEPCION_SESSION_SECRET no está configurado.");

    const session = await useSession<AccesoSession>({
      password,
      name: ACCESO_COOKIE,
      maxAge: ACCESO_MAX_AGE,
      cookie: { httpOnly: true, secure: true, sameSite: "lax", path: "/" },
    });

    if (!session.data.autorizado) {
      throw new Error("Acceso no autorizado: ingrese el PIN de planta.");
    }

    return next();
  },
);

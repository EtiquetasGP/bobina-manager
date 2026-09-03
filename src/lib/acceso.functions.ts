import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { ACCESO_COOKIE, ACCESO_MAX_AGE, type AccesoSession } from "./acceso.middleware";

const pinSchema = z.object({
  pin: z.string().trim().min(1).max(64),
});

// Rate limit best-effort por IP (el runtime es sin estado, sirve para frenar
// fuerza bruta casual desde una misma máquina).
const MAX_INTENTOS = 5;
const BLOQUEO_MS = 30_000;
const intentos = new Map<string, { fallos: number; hasta: number }>();

async function abrirSesion() {
  const { useSession } = await import("@tanstack/react-start/server");
  const password = process.env["RECEPCION_SESSION_SECRET"];
  if (!password) throw new Error("RECEPCION_SESSION_SECRET no está configurado.");

  return useSession<AccesoSession>({
    password,
    name: ACCESO_COOKIE,
    maxAge: ACCESO_MAX_AGE,
    cookie: { httpOnly: true, secure: true, sameSite: "lax", path: "/" },
  });
}

export const estadoAcceso = createServerFn({ method: "GET" }).handler(async () => {
  const session = await abrirSesion();
  return { autorizado: Boolean(session.data.autorizado) };
});

export const ingresarPin = createServerFn({ method: "POST" })
  .validator((data: unknown) => pinSchema.parse(data))
  .handler(async ({ data }) => {
    const esperado = process.env["RECEPCION_PIN"];
    if (!esperado) throw new Error("RECEPCION_PIN no está configurado.");

    const { getRequestIP } = await import("@tanstack/react-start/server");
    const { createHash, timingSafeEqual } = await import("node:crypto");

    const ip = getRequestIP({ xForwardedFor: true }) ?? "desconocida";
    const ahora = Date.now();
    const registro = intentos.get(ip);

    if (registro && registro.hasta > ahora) {
      return {
        ok: false as const,
        bloqueado: true as const,
        segundos: Math.ceil((registro.hasta - ahora) / 1000),
      };
    }

    const a = createHash("sha256").update(data.pin, "utf8").digest();
    const b = createHash("sha256").update(esperado.trim(), "utf8").digest();

    if (!timingSafeEqual(a, b)) {
      const fallos = (registro?.fallos ?? 0) + 1;
      intentos.set(ip, {
        fallos,
        hasta: fallos >= MAX_INTENTOS ? ahora + BLOQUEO_MS : 0,
      });
      return { ok: false as const, bloqueado: false as const, segundos: 0 };
    }

    intentos.delete(ip);
    const session = await abrirSesion();
    await session.update({ autorizado: true });
    return { ok: true as const, bloqueado: false as const, segundos: 0 };
  });

export const salirAcceso = createServerFn({ method: "POST" }).handler(async () => {
  const session = await abrirSesion();
  await session.clear();
  return { ok: true as const };
});

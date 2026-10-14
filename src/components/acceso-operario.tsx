import { useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AccesoOperarioProps = {
  children: ReactNode;
};

export function AccesoOperario({
  children,
}: AccesoOperarioProps) {
  const queryClient = useQueryClient();

  const [session, setSession] = useState<Session | null>(null);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);

  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let activo = true;
    let recibioEvento = false;

    const { data } = supabase.auth.onAuthStateChange(
      (evento, sesionActual) => {
        if (!activo) return;

        recibioEvento = true;

        if (evento === "SIGNED_OUT") {
          queryClient.clear();
        }

        setSession(sesionActual);
        setCargando(false);
      },
    );

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!activo || recibioEvento) return;

        setSession(data.session);
        setCargando(false);

        if (error) {
          setError(
            "No se pudo recuperar la sesión. Inicie sesión nuevamente.",
          );
        }
      })
      .catch(() => {
        if (!activo || recibioEvento) return;

        setCargando(false);
        setError(
          "No se pudo conectar. Intente nuevamente.",
        );
      });

    return () => {
      activo = false;
      data.subscription.unsubscribe();
    };
  }, [queryClient]);

  const ingresar = async (event: React.FormEvent) => {
    event.preventDefault();

    if (procesando) return;

    setProcesando(true);
    setError("");

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: correo.trim(),
        password: contrasena,
      });

      if (error) {
        setError(
          "No se pudo ingresar. Revise su correo y contraseña.",
        );
        return;
      }

      setContrasena("");
    } catch {
      setError(
        "No se pudo conectar. Intente nuevamente.",
      );
    } finally {
      setProcesando(false);
    }
  };

  const cerrarSesion = async () => {
    if (procesando) return;

    setProcesando(true);
    setError("");

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        setError(
          "No se pudo cerrar la sesión. Intente nuevamente.",
        );
        return;
      }

      setContrasena("");
      queryClient.clear();
      setSession(null);
    } catch {
      setError(
        "No se pudo cerrar la sesión. Intente nuevamente.",
      );
    } finally {
      setProcesando(false);
    }
  };

  if (cargando) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p className="text-lg text-muted-foreground">
          Cargando sesión…
        </p>
      </main>
    );
  }

  if (session) {
    return (
      <>
        <header className="border-b border-border bg-card">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-4">
            <div>
              <p className="text-sm text-muted-foreground">
                Cuenta activa
              </p>
              <p className="font-semibold break-all">
                {session.user.email ?? "Operario"}
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              disabled={procesando}
              onClick={() => void cerrarSesion()}
            >
              {procesando ? "Cerrando…" : "Cerrar sesión"}
            </Button>
          </div>
        </header>

        {error && (
          <p
            role="alert"
            className="mx-auto mt-4 max-w-5xl px-6 text-destructive"
          >
            {error}
          </p>
        )}

        <div key={session.user.id}>
          {children}
        </div>
      </>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-10">
      <section className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight">
          Gestión de bobinas
        </h1>

        <p className="mt-2 text-muted-foreground">
          Inicie sesión para acceder a los módulos.
        </p>

        <form
          className="mt-8 space-y-5"
          onSubmit={ingresar}
        >
          <div className="space-y-2">
            <Label htmlFor="correo-operario">
              Correo
            </Label>

            <Input
              id="correo-operario"
              type="email"
              autoComplete="username"
              className="h-12 text-base"
              required
              value={correo}
              disabled={procesando}
              onChange={(event) =>
                setCorreo(event.target.value)
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contrasena-operario">
              Contraseña
            </Label>

            <Input
              id="contrasena-operario"
              type="password"
              autoComplete="current-password"
              className="h-12 text-base"
              required
              value={contrasena}
              disabled={procesando}
              onChange={(event) =>
                setContrasena(event.target.value)
              }
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          <Button
            type="submit"
            className="h-12 w-full text-base"
            disabled={procesando}
          >
            {procesando ? "Ingresando…" : "Ingresar"}
          </Button>
        </form>
      </section>
    </main>
  );
}

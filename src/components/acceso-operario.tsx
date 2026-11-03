import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Modo = "ingresar" | "solicitar" | "recuperar" | "cambiar";

export function AccesoOperario({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const enlaceInicial = useRef<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [modo, setModo] = useState<Modo>("ingresar");
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetida, setRepetida] = useState("");
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    let activo = true;
    let recibioEvento = false;
    enlaceInicial.current ??= window.location.href;
    const url = new URL(enlaceInicial.current);
    const hash = new URLSearchParams(url.hash.slice(1));
    const esRecuperacion =
      url.searchParams.get("recuperar") === "1" || hash.get("type") === "recovery";
    if (esRecuperacion) setModo("recuperar");

    // El cliente no detecta sesiones en la URL: procesamos solo enlaces de recuperación.
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    const errorEnlace = hash.has("error") || url.searchParams.has("error");
    if (esRecuperacion) {
      url.hash = "";
      url.searchParams.delete("recuperar");
      url.searchParams.delete("error");
      url.searchParams.delete("error_code");
      url.searchParams.delete("error_description");
      window.history.replaceState(window.history.state, "", url.pathname + url.search);
    }

    const { data } = supabase.auth.onAuthStateChange((evento, actual) => {
      if (!activo) return;
      recibioEvento = true;
      if (evento === "SIGNED_OUT") queryClient.clear();
      if (evento === "PASSWORD_RECOVERY") setModo("recuperar");
      setSession(actual);
    });

    const iniciar = async () => {
      try {
        if (esRecuperacion) {
          if (errorEnlace || hash.get("type") !== "recovery" || !accessToken || !refreshToken) {
            throw new Error("enlace_invalido");
          }
          queryClient.clear();
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error || !data.session) throw new Error("enlace_invalido");
          if (activo) setSession(data.session);
        } else {
          const { data, error } = await supabase.auth.getSession();
          if (error) throw error;
          if (activo && !recibioEvento) setSession(data.session);
        }
      } catch {
        if (!activo) return;
        setError(
          esRecuperacion
            ? "El enlace venció o no es válido. Solicite uno nuevo."
            : "No se pudo recuperar la sesión. Intente nuevamente.",
        );
        if (esRecuperacion) setModo("solicitar");
      } finally {
        if (activo) setCargando(false);
      }
    };
    void iniciar();
    return () => {
      activo = false;
      data.subscription.unsubscribe();
    };
  }, [queryClient]);

  function cambiarModo(siguiente: Modo) {
    setError("");
    setMensaje("");
    setContrasena("");
    setNueva("");
    setRepetida("");
    setModo(siguiente);
  }

  async function ingresar(event: FormEvent) {
    event.preventDefault();
    if (procesando) return;
    setProcesando(true);
    setError("");
    setMensaje("");
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: correo.trim(),
        password: contrasena,
      });
      if (error) {
        setError("No se pudo ingresar. Revise su correo y contraseña.");
        return;
      }
      setContrasena("");
    } catch {
      setError("No se pudo conectar. Intente nuevamente.");
    } finally {
      setProcesando(false);
    }
  }

  async function solicitar(event: FormEvent) {
    event.preventDefault();
    if (procesando) return;
    setProcesando(true);
    setError("");
    setMensaje("");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(correo.trim(), {
        redirectTo: window.location.origin + "/?recuperar=1",
      });
      if (error) {
        setError(
          error.status === 429
            ? "Demasiados intentos. Espere unos minutos antes de solicitar otro correo."
            : "No se pudo solicitar el correo. Intente más tarde o contacte al administrador.",
        );
        return;
      }
      setMensaje(
        "Si el correo corresponde a una cuenta habilitada, recibirá un enlace para elegir una nueva contraseña. Revise también el correo no deseado.",
      );
    } catch {
      setError("No se pudo conectar. Intente nuevamente.");
    } finally {
      setProcesando(false);
    }
  }

  async function guardarContrasena(event: FormEvent) {
    event.preventDefault();
    if (procesando) return;
    setError("");
    setMensaje("");
    if (nueva.length < 8) {
      setError("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (nueva !== repetida) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setProcesando(true);
    try {
      if (!session) {
        setError("La sesión venció. Solicite un nuevo enlace.");
        return;
      }
      if (modo === "cambiar") {
        const { error } = await supabase.auth.signInWithPassword({
          email: session.user.email ?? "",
          password: contrasena,
        });
        if (error) {
          setError("La contraseña actual no es correcta o no pudo verificarse.");
          return;
        }
      }
      const { error } = await supabase.auth.updateUser({ password: nueva });
      if (error) {
        setError(
          "No se pudo actualizar. Use una contraseña diferente que cumpla los requisitos de seguridad o solicite un nuevo enlace.",
        );
        return;
      }
      setContrasena("");
      setNueva("");
      setRepetida("");
      queryClient.clear();
      const { error: errorSalida } = await supabase.auth.signOut({ scope: "local" });
      if (errorSalida) {
        setModo("ingresar");
        setMensaje("Contraseña actualizada. Cierre sesión cuando termine de operar.");
      } else {
        setSession(null);
        setModo("ingresar");
        setMensaje("Contraseña actualizada. Inicie sesión con la nueva contraseña.");
      }
    } catch {
      setError(
        "No se pudo completar la operación. Intente iniciar sesión con la nueva contraseña antes de repetir el cambio.",
      );
    } finally {
      setProcesando(false);
    }
  }

  async function cerrarSesion() {
    if (procesando) return;
    setProcesando(true);
    setError("");
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        setError("No se pudo cerrar la sesión. Intente nuevamente.");
        return;
      }
      queryClient.clear();
      setSession(null);
      cambiarModo("ingresar");
    } catch {
      setError("No se pudo cerrar la sesión. Intente nuevamente.");
    } finally {
      setProcesando(false);
    }
  }

  if (cargando)
    return (
      <main className="module-screen flex min-h-screen items-center justify-center px-6">
        <p className="text-lg text-muted-foreground">Cargando sesión…</p>
      </main>
    );

  const avisos = (
    <>
      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {mensaje && (
        <p role="status" className="rounded-lg bg-muted p-3 text-sm">
          {mensaje}
        </p>
      )}
    </>
  );

  if (session && modo === "ingresar")
    return (
      <>
        <header className="operator-bar border-b border-border bg-card">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-4">
            <div>
              <p className="text-sm text-muted-foreground">Cuenta activa</p>
              <p className="break-all font-semibold">{session.user.email ?? "Operario"}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={procesando}
                onClick={() => cambiarModo("cambiar")}
              >
                Cambiar contraseña
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={procesando}
                onClick={() => void cerrarSesion()}
              >
                {procesando ? "Cerrando…" : "Cerrar sesión"}
              </Button>
            </div>
          </div>
        </header>
        <div className="mx-auto mt-4 max-w-5xl px-6">{avisos}</div>
        <div key={session.user.id}>{children}</div>
      </>
    );

  const editando = modo === "recuperar" || modo === "cambiar";
  return (
    <main className="module-screen flex min-h-screen items-center justify-center bg-background px-6 py-10">
      <section className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight">
          {modo === "ingresar"
            ? "Gestión de bobinas"
            : modo === "solicitar"
              ? "Recuperar contraseña"
              : "Nueva contraseña"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {modo === "ingresar"
            ? "Inicie sesión para acceder a los módulos."
            : modo === "solicitar"
              ? "Ingrese el correo de su cuenta para solicitar un enlace."
              : "Elija una contraseña de al menos 8 caracteres."}
        </p>
        <form
          className="mt-8 space-y-5"
          onSubmit={editando ? guardarContrasena : modo === "solicitar" ? solicitar : ingresar}
        >
          {!editando && (
            <div className="space-y-2">
              <Label htmlFor="correo-operario">Correo</Label>
              <Input
                id="correo-operario"
                type="email"
                autoComplete="username"
                className="h-12 text-base"
                required
                value={correo}
                disabled={procesando}
                onChange={(e) => setCorreo(e.target.value)}
              />
            </div>
          )}
          {(modo === "ingresar" || modo === "cambiar") && (
            <div className="space-y-2">
              <Label htmlFor="contrasena-operario">
                {modo === "cambiar" ? "Contraseña actual" : "Contraseña"}
              </Label>
              <Input
                id="contrasena-operario"
                type="password"
                autoComplete="current-password"
                className="h-12 text-base"
                required
                value={contrasena}
                disabled={procesando}
                onChange={(e) => setContrasena(e.target.value)}
              />
            </div>
          )}
          {editando && (
            <>
              <div className="space-y-2">
                <Label htmlFor="nueva-contrasena">Nueva contraseña</Label>
                <Input
                  id="nueva-contrasena"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  className="h-12 text-base"
                  value={nueva}
                  disabled={procesando}
                  onChange={(e) => setNueva(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="repetir-contrasena">Repetir nueva contraseña</Label>
                <Input
                  id="repetir-contrasena"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  className="h-12 text-base"
                  value={repetida}
                  disabled={procesando}
                  onChange={(e) => setRepetida(e.target.value)}
                />
              </div>
            </>
          )}
          {avisos}
          <Button
            type="submit"
            className="h-12 w-full text-base"
            disabled={procesando || (editando && !session)}
          >
            {procesando
              ? "Procesando…"
              : editando
                ? "Guardar contraseña"
                : modo === "solicitar"
                  ? "Enviar enlace"
                  : "Ingresar"}
          </Button>
          {modo === "ingresar" ? (
            <Button
              type="button"
              variant="link"
              className="w-full"
              disabled={procesando}
              onClick={() => cambiarModo("solicitar")}
            >
              Olvidé mi contraseña
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={procesando}
              onClick={() => {
                if (modo === "recuperar") void cerrarSesion();
                else cambiarModo("ingresar");
              }}
            >
              {session ? "Cancelar" : "Volver al inicio de sesión"}
            </Button>
          )}
        </form>
      </section>
    </main>
  );
}

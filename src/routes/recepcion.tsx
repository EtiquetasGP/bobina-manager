import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, Lock, LogOut } from "lucide-react";

import { buscarEtiqueta, registrarRecepcion } from "@/lib/bobinas.functions";
import { estadoAcceso, ingresarPin, salirAcceso } from "@/lib/acceso.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/recepcion")({
  loader: () => estadoAcceso(),
  component: Recepcion,
  errorComponent: () => (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <p role="alert" className="rounded-md bg-destructive/10 p-4 text-base text-destructive">
        No se pudo cargar la pantalla de recepción. Recargue la página.
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
      { title: "Recepción de Bobinas | Coquimbito" },
      {
        name: "description",
        content:
          "Registrar el ingreso de una bobina en planta Coquimbito: código de etiqueta, cantidad, proveedor, ubicación y operario.",
      },
      { property: "og:title", content: "Recepción de Bobinas | Coquimbito" },
      {
        property: "og:description",
        content: "Registrar el ingreso de una bobina en planta Coquimbito.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Exito = {
  id_bobina: string;
  codigo_etiqueta: string;
  descripcion: string;
  cantidad: string;
};

const inputClass = "h-14 text-lg";

function PanelPin() {
  const router = useRouter();
  const enviarPin = useServerFn(ingresarPin);
  const [pin, setPin] = useState("");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [verificando, setVerificando] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!pin.trim()) return;
    setVerificando(true);
    setMensaje(null);
    try {
      const res = await enviarPin({ data: { pin } });
      if (res.ok) {
        setPin("");
        await router.invalidate();
        return;
      }
      setMensaje(
        res.bloqueado
          ? `Demasiados intentos. Espere ${res.segundos} segundos.`
          : "PIN incorrecto.",
      );
    } catch {
      setMensaje("No se pudo verificar el PIN. Intente nuevamente.");
    } finally {
      setVerificando(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      <Link
        to="/"
        className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> Menú principal
      </Link>

      <div className="rounded-xl border border-border bg-card p-8">
        <Lock className="mx-auto size-12 text-muted-foreground" aria-hidden="true" />
        <h1 className="mt-4 text-center text-2xl font-bold tracking-tight">
          Ingrese el PIN de planta
        </h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Acceso requerido para registrar recepciones.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <Label htmlFor="pin" className="text-base">
            PIN
          </Label>
          <Input
            id="pin"
            className="h-16 text-center text-3xl tracking-[0.5em]"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            maxLength={16}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            required
          />
          {mensaje && (
            <p role="alert" className="rounded-md bg-destructive/10 p-3 text-base text-destructive">
              {mensaje}
            </p>
          )}
          <Button
            type="submit"
            size="lg"
            disabled={verificando}
            className="h-16 w-full text-xl font-bold"
          >
            {verificando ? "VERIFICANDO…" : "ACCEDER"}
          </Button>
        </form>
      </div>
    </main>
  );
}

function Recepcion() {
  const router = useRouter();
  const { autorizado } = Route.useLoaderData();
  const lookup = useServerFn(buscarEtiqueta);
  const registrar = useServerFn(registrarRecepcion);
  const salir = useServerFn(salirAcceso);


  const [codigo, setCodigo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [descripcionBloqueada, setDescripcionBloqueada] = useState(false);
  const [cantidad, setCantidad] = useState("");
  const [proveedor, setProveedor] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [operario, setOperario] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<Exito | null>(null);

  const limpiar = () => {
    setCodigo("");
    setDescripcion("");
    setDescripcionBloqueada(false);
    setCantidad("");
    setProveedor("");
    setUbicacion("");
    setOperario("");
    setError(null);
    setExito(null);
  };

  const codigoActualRef = useRef(codigo);
  codigoActualRef.current = codigo;

  const onChangeCodigo = (value: string) => {
    setCodigo(value);
    setDescripcion("");
    setDescripcionBloqueada(false);
    setError(null);
  };

  const onBlurCodigo = async () => {
    const valor = codigo.trim();
    if (!valor) {
      setDescripcion("");
      setDescripcionBloqueada(false);
      return;
    }
    setBuscando(true);
    setError(null);
    try {
      const res = await lookup({ data: { codigo_etiqueta: valor } });
      if (codigoActualRef.current.trim() !== valor) return;
      if (res.existe) {
        setDescripcion(res.descripcion);
        setDescripcionBloqueada(true);
      } else {
        setDescripcion("");
        setDescripcionBloqueada(false);
      }
    } catch (e) {
      if (codigoActualRef.current.trim() === valor) {
        setError(e instanceof Error ? e.message : "No se pudo consultar la etiqueta.");
      }
    } finally {
      if (codigoActualRef.current.trim() === valor) {
        setBuscando(false);
      }
    }
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const codigoLimpio = codigo.trim();
    const cantidadNum = Number(cantidad);

    if (!codigoLimpio) return setError("Ingrese el código de etiqueta.");
    if (!descripcion.trim()) return setError("La descripción es obligatoria para un código nuevo.");
    if (!Number.isInteger(cantidadNum) || cantidadNum <= 0)
      return setError("La cantidad debe ser un número entero positivo.");

    setEnviando(true);
    try {
      const res = await registrar({
        data: {
          codigo_etiqueta: codigoLimpio,
          descripcion: descripcion.trim(),
          cantidad: cantidadNum,
          proveedor: proveedor.trim(),
          ubicacion: ubicacion.trim(),
          operario: operario.trim(),
        },
      });
      setExito({
        id_bobina: res.id_bobina,
        codigo_etiqueta: codigoLimpio,
        descripcion: descripcion.trim(),
        cantidad: String(cantidadNum),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo registrar la recepción.");
    } finally {
      setEnviando(false);
    }
  };

  if (!autorizado) return <PanelPin />;

  if (exito) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-10">
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <CheckCircle2 className="mx-auto size-16 text-primary" aria-hidden="true" />
          <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
            BOBINA REGISTRADA CORRECTAMENTE
          </h1>
          <p className="mt-6 text-sm uppercase text-muted-foreground">ID Bobina</p>
          <p className="text-4xl font-bold tabular-nums">{exito.id_bobina}</p>

          <dl className="mt-8 space-y-3 text-left text-lg">
            <div className="flex justify-between gap-4 border-b border-border pb-2">
              <dt className="text-muted-foreground">Código de etiqueta</dt>
              <dd className="font-semibold">{exito.codigo_etiqueta}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-border pb-2">
              <dt className="text-muted-foreground">Descripción</dt>
              <dd className="text-right font-semibold">{exito.descripcion}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Cantidad</dt>
              <dd className="font-semibold tabular-nums">{exito.cantidad}</dd>
            </div>
          </dl>

          <div className="mt-8 flex flex-col gap-3">
            <Button
              size="lg"
              className="h-16 text-xl font-semibold"
              onClick={() => {
                limpiar();
                router.invalidate();
              }}
            >
              NUEVA RECEPCIÓN
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 text-base">
              <Link to="/">Volver al menú</Link>
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
        <ArrowLeft className="size-4" aria-hidden="true" /> Menú principal
      </Link>

      <h1 className="mt-6 text-3xl font-bold tracking-tight">Recepción de Bobina</h1>
      <p className="mt-1 text-base text-muted-foreground">
        Complete los datos y confirme el ingreso.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-6">
        <div className="space-y-2">
          <Label htmlFor="codigo" className="text-base">
            Código de etiqueta
          </Label>
          <Input
            id="codigo"
            className={inputClass}
            value={codigo}
            maxLength={100}
            autoComplete="off"
            onChange={(e) => onChangeCodigo(e.target.value)}
            onBlur={onBlurCodigo}
            required
          />
          {buscando && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Buscando etiqueta…
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="descripcion" className="text-base">
            Descripción
          </Label>
          <Input
            id="descripcion"
            className={inputClass}
            value={descripcion}
            maxLength={500}
            readOnly={descripcionBloqueada}
            onChange={(e) => setDescripcion(e.target.value)}
            required
          />
          {descripcionBloqueada && (
            <p className="text-sm text-muted-foreground">
              Descripción tomada del maestro de etiquetas.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="cantidad" className="text-base">
            Cantidad
          </Label>
          <Input
            id="cantidad"
            className={inputClass}
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value.replace(/[^0-9]/g, ""))}
            required
          />
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="proveedor" className="text-base">
              Proveedor (opcional)
            </Label>
            <Input
              id="proveedor"
              className={inputClass}
              value={proveedor}
              maxLength={200}
              onChange={(e) => setProveedor(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ubicacion" className="text-base">
              Ubicación (opcional)
            </Label>
            <Input
              id="ubicacion"
              className={inputClass}
              value={ubicacion}
              maxLength={200}
              onChange={(e) => setUbicacion(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="operario" className="text-base">
            Operario (opcional)
          </Label>
          <Input
            id="operario"
            className={inputClass}
            value={operario}
            maxLength={200}
            onChange={(e) => setOperario(e.target.value)}
          />
        </div>

        {error && (
          <p role="alert" className="rounded-md bg-destructive/10 p-4 text-base text-destructive">
            {error}
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          disabled={enviando}
          className="h-20 w-full text-2xl font-bold"
        >
          {enviando ? "REGISTRANDO…" : "INGRESAR BOBINA"}
        </Button>
      </form>
    </main>
  );
}

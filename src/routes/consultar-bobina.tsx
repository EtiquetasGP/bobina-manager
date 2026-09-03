import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, XCircle } from "lucide-react";

import { consultarBobina, type BobinaFicha } from "@/lib/bobinas.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/consultar-bobina")({
  component: ConsultarBobina,
  errorComponent: () => (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <p role="alert" className="rounded-md bg-destructive/10 p-4 text-base text-destructive">
        No se pudo cargar la pantalla de consulta. Recargue la página.
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
      { title: "Consultar Bobina | Coquimbito" },
      {
        name: "description",
        content:
          "Consultar el estado, ubicación, vigencia e historial de una bobina en planta Coquimbito.",
      },
      { property: "og:title", content: "Consultar Bobina | Coquimbito" },
      {
        property: "og:description",
        content: "Consultar el estado de una bobina en planta Coquimbito.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Bobina = BobinaFicha;

const texto = (valor: unknown) =>
  valor === null || valor === undefined || valor === "" ? "—" : String(valor);

function VigenciaBadge({ vigencia }: { vigencia: string | null }) {
  const raw = String(vigencia ?? "").trim();
  if (!raw) return <span className="text-muted-foreground">—</span>;

  const upper = raw.toUpperCase();
  if (upper.includes("VENCIDO")) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-1 text-sm font-bold uppercase text-destructive">
        <XCircle className="size-4" aria-hidden="true" />
        VENCIDO
      </span>
    );
  }
  if (upper.includes("PROXIMO") || upper.includes("PRÓXIMO")) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-bold uppercase text-primary">
        <AlertTriangle className="size-4" aria-hidden="true" />
        PROXIMO A VENCER
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-3 py-1 text-sm font-bold uppercase text-foreground">
      <CheckCircle2 className="size-4" aria-hidden="true" />
      OK
    </span>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border py-3 last:border-0">
      <dt className="text-muted-foreground">{etiqueta}</dt>
      <dd className="text-right font-semibold">{valor}</dd>
    </div>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">{titulo}</h2>
      <dl className="mt-2 text-base">{children}</dl>
    </section>
  );
}

function ConsultarBobina() {
  const consultar = useServerFn(consultarBobina);
  const escanerRef = useRef<HTMLInputElement>(null);

  const [id, setId] = useState("");
  const [bobina, setBobina] = useState<Bobina | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bobina) escanerRef.current?.focus();
  }, [bobina]);

  const reiniciar = () => {
    setId("");
    setBobina(null);
    setError(null);
  };

  const buscar = async () => {
    const valor = id.trim();
    if (!valor) return;
    setBuscando(true);
    setError(null);
    setBobina(null);
    try {
      const res: { bobina: Bobina | null } = await consultar({ data: { id_bobina: valor } });
      if (!res.bobina) {
        setError("BOBINA NO ENCONTRADA");
        setId("");
        escanerRef.current?.focus();
        return;
      }
      setBobina(res.bobina);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo consultar la bobina.");
    } finally {
      setBuscando(false);
    }
  };

  if (bobina) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-10">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" /> Menú principal
        </Link>

        <h1 className="mt-6 text-3xl font-bold tracking-tight">CONSULTAR BOBINA</h1>

        <div className="mt-8 space-y-5">
          <Seccion titulo="Datos principales">
            <Fila etiqueta="ID de bobina" valor={texto(bobina.id_bobina)} />
            <Fila etiqueta="Código de etiqueta" valor={texto(bobina.codigo_etiqueta)} />
            <Fila etiqueta="Descripción" valor={texto(bobina.descripcion)} />
            <Fila etiqueta="Cantidad actual" valor={texto(bobina.cantidad_actual)} />
            <Fila etiqueta="Ubicación actual" valor={texto(bobina.ubicacion)} />
            <Fila etiqueta="Estado" valor={texto(bobina.estado)} />
            <Fila etiqueta="Vigencia" valor={<VigenciaBadge vigencia={bobina.vigencia} />} />
            <Fila etiqueta="Fecha de vencimiento" valor={texto(bobina.fecha_vencimiento)} />
          </Seccion>

          <Seccion titulo="Ingreso">
            <Fila etiqueta="Fecha de ingreso" valor={texto(bobina.fecha_ingreso)} />
            <Fila etiqueta="Proveedor" valor={texto(bobina.proveedor)} />
            <Fila etiqueta="Operario de ingreso" valor={texto(bobina.operario_ingreso)} />
            <Fila etiqueta="Origen de alta" valor={texto(bobina.origen_alta)} />
          </Seccion>

          <Seccion titulo="Última devolución">
            <Fila etiqueta="Fecha" valor={texto(bobina.ultima_fecha_devolucion)} />
            <Fila etiqueta="Línea" valor={texto(bobina.ultima_linea)} />
            <Fila etiqueta="Operario" valor={texto(bobina.ultimo_operario_devolucion)} />
          </Seccion>
        </div>

        <div className="mt-8 flex flex-col gap-3">
          <Button size="lg" className="h-16 text-xl font-semibold" onClick={reiniciar}>
            CONSULTAR OTRA BOBINA
          </Button>
          <Button asChild variant="outline" size="lg" className="h-12 text-base">
            <Link to="/">MENÚ PRINCIPAL</Link>
          </Button>
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

      <h1 className="mt-6 text-3xl font-bold tracking-tight">CONSULTAR BOBINA</h1>

      <div className="mt-8 space-y-2">
        <Label htmlFor="id-bobina" className="text-base">
          Escanear o ingresar ID de bobina
        </Label>
        <Input
          id="id-bobina"
          ref={escanerRef}
          className="h-16 text-2xl tracking-wide"
          value={id}
          maxLength={100}
          autoComplete="off"
          placeholder="CQ-000010"
          onChange={(e) => setId(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void buscar();
            }
          }}
        />
        {buscando && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Consultando bobina…
          </p>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-6 rounded-md bg-destructive/10 p-4 text-lg font-semibold text-destructive">
          {error}
        </p>
      )}
    </main>
  );
}

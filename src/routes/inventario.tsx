import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";

import {
  buscarEtiqueta,
  consultarBobina,
  registrarAltaInventario,
  registrarInventarioExistente,
  type BobinaFicha,
} from "@/lib/bobinas.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/inventario")({
  component: Inventario,
  errorComponent: () => (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <p role="alert" className="rounded-md bg-destructive/10 p-4 text-base text-destructive">
        No se pudo cargar la pantalla de inventario. Recargue la página.
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
      { title: "Inventario de Bobinas | Coquimbito" },
      {
        name: "description",
        content:
          "Inventariar bobinas en planta Coquimbito: recontar bobinas existentes o dar de alta bobinas encontradas sin ID.",
      },
      { property: "og:title", content: "Inventario de Bobinas | Coquimbito" },
      {
        property: "og:description",
        content: "Recontar bobinas existentes o dar de alta bobinas encontradas en planta Coquimbito.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const inputClass = "h-14 text-lg";

const texto = (valor: unknown) =>
  valor === null || valor === undefined || valor === "" ? "—" : String(valor);

function Fila({ etiqueta, valor }: { etiqueta: string; valor: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border py-3 last:border-0">
      <dt className="text-muted-foreground">{etiqueta}</dt>
      <dd className="text-right font-semibold">{valor}</dd>
    </div>
  );
}

type Exito = {
  id_bobina: string;
  codigo_etiqueta: string | null;
  descripcion: string | null;
  cantidad_actual: number | string | null;
  ubicacion: string | null;
  vigencia: string | null;
};

type Modo = "escaneo" | "existente" | "alta";

function Inventario() {
  const consultar = useServerFn(consultarBobina);
  const lookup = useServerFn(buscarEtiqueta);
  const invExistente = useServerFn(registrarInventarioExistente);
  const altaInv = useServerFn(registrarAltaInventario);

  const escanerRef = useRef<HTMLInputElement>(null);

  const [modo, setModo] = useState<Modo>("escaneo");
  const [entrada, setEntrada] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noEncontrada, setNoEncontrada] = useState(false);
  const [exito, setExito] = useState<Exito | null>(null);

  const [bobina, setBobina] = useState<BobinaFicha | null>(null);

  const [codigo, setCodigo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [descripcionBloqueada, setDescripcionBloqueada] = useState(false);
  const [fechaIngreso, setFechaIngreso] = useState("");
  const [proveedor, setProveedor] = useState("");

  const [cantidad, setCantidad] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [operario, setOperario] = useState("");
  const [observacion, setObservacion] = useState("");

  useEffect(() => {
    if (modo === "escaneo" && !exito) escanerRef.current?.focus();
  }, [modo, exito]);

  const reiniciar = () => {
    setModo("escaneo");
    setEntrada("");
    setError(null);
    setNoEncontrada(false);
    setExito(null);
    setBobina(null);
    setCodigo("");
    setDescripcion("");
    setDescripcionBloqueada(false);
    setFechaIngreso("");
    setProveedor("");
    setCantidad("");
    setUbicacion("");
    setOperario("");
    setObservacion("");
  };

  const procesar = async () => {
    const valor = entrada.trim();
    if (!valor) return;
    setBuscando(true);
    setError(null);
    setNoEncontrada(false);
    try {
      if (valor.toUpperCase().startsWith("CQ-")) {
        const res: { bobina: BobinaFicha | null } = await consultar({
          data: { id_bobina: valor },
        });
        if (!res.bobina) {
          setNoEncontrada(true);
          setEntrada("");
          escanerRef.current?.focus();
          return;
        }
        setBobina(res.bobina);
        setUbicacion(res.bobina.ubicacion ?? "");
        setModo("existente");
        return;
      }

      const res = await lookup({ data: { codigo_etiqueta: valor } });
      setCodigo(valor);
      if (res.existe) {
        setDescripcion(res.descripcion);
        setDescripcionBloqueada(true);
      } else {
        setDescripcion("");
        setDescripcionBloqueada(false);
      }
      setModo("alta");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo procesar el valor ingresado.");
    } finally {
      setBuscando(false);
    }
  };

  const recargarFicha = async (id: string) => {
    try {
      const res: { bobina: BobinaFicha | null } = await consultar({ data: { id_bobina: id } });
      return res.bobina;
    } catch {
      return null;
    }
  };

  const onSubmitExistente = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!bobina) return;
    const cantidadNum = Number(cantidad);
    if (!Number.isInteger(cantidadNum) || cantidadNum <= 0)
      return setError("La cantidad contada debe ser un número entero positivo.");

    setEnviando(true);
    try {
      const res = await invExistente({
        data: {
          id_bobina: bobina.id_bobina,
          cantidad: cantidadNum,
          ubicacion: ubicacion.trim(),
          operario: operario.trim(),
          observacion: observacion.trim(),
        },
      });
      const ficha = await recargarFicha(res.id_bobina);
      setExito({
        id_bobina: res.id_bobina,
        codigo_etiqueta: ficha?.codigo_etiqueta ?? bobina.codigo_etiqueta,
        descripcion: ficha?.descripcion ?? bobina.descripcion,
        cantidad_actual: ficha?.cantidad_actual ?? cantidadNum,
        ubicacion: ficha?.ubicacion ?? (ubicacion.trim() || bobina.ubicacion),
        vigencia: ficha?.vigencia ?? bobina.vigencia,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo registrar el inventario.");
    } finally {
      setEnviando(false);
    }
  };

  const onSubmitAlta = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const cantidadNum = Number(cantidad);
    if (!codigo.trim()) return setError("Ingrese el código de etiqueta.");
    if (!descripcion.trim()) return setError("La descripción es obligatoria para un código nuevo.");
    if (!Number.isInteger(cantidadNum) || cantidadNum <= 0)
      return setError("La cantidad contada debe ser un número entero positivo.");
    if (!fechaIngreso) return setError("La fecha de ingreso original es obligatoria.");

    setEnviando(true);
    try {
      const res = await altaInv({
        data: {
          codigo_etiqueta: codigo.trim(),
          descripcion: descripcion.trim(),
          cantidad: cantidadNum,
          fecha_ingreso: fechaIngreso,
          proveedor: proveedor.trim(),
          ubicacion: ubicacion.trim(),
          operario: operario.trim(),
          observacion: observacion.trim(),
        },
      });
      const ficha = await recargarFicha(res.id_bobina);
      setExito({
        id_bobina: res.id_bobina,
        codigo_etiqueta: ficha?.codigo_etiqueta ?? codigo.trim(),
        descripcion: ficha?.descripcion ?? descripcion.trim(),
        cantidad_actual: ficha?.cantidad_actual ?? cantidadNum,
        ubicacion: ficha?.ubicacion ?? ubicacion.trim(),
        vigencia: ficha?.vigencia ?? null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo dar de alta la bobina.");
    } finally {
      setEnviando(false);
    }
  };

  const volverMenu = (
    <Link
      to="/"
      className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden="true" /> Menú principal
    </Link>
  );

  const camposComunes = (
    <>
      <div className="space-y-2">
        <Label htmlFor="cantidad" className="text-base">
          Cantidad contada
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
          <Label htmlFor="ubicacion" className="text-base">
            Ubicación
          </Label>
          <Input
            id="ubicacion"
            className={inputClass}
            value={ubicacion}
            maxLength={200}
            onChange={(e) => setUbicacion(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="operario" className="text-base">
            Operario
          </Label>
          <Input
            id="operario"
            className={inputClass}
            value={operario}
            maxLength={200}
            onChange={(e) => setOperario(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="observacion" className="text-base">
          Observación (opcional)
        </Label>
        <Input
          id="observacion"
          className={inputClass}
          value={observacion}
          maxLength={1000}
          onChange={(e) => setObservacion(e.target.value)}
        />
      </div>
    </>
  );

  if (exito) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-10">
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <CheckCircle2 className="mx-auto size-16 text-primary" aria-hidden="true" />
          <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
            INVENTARIO REGISTRADO CORRECTAMENTE
          </h1>
          <p className="mt-6 text-sm uppercase text-muted-foreground">ID Bobina</p>
          <p className="text-4xl font-bold tabular-nums">{exito.id_bobina}</p>

          <dl className="mt-8 text-left text-lg">
            <Fila etiqueta="Código de etiqueta" valor={texto(exito.codigo_etiqueta)} />
            <Fila etiqueta="Descripción" valor={texto(exito.descripcion)} />
            <Fila etiqueta="Cantidad actual" valor={texto(exito.cantidad_actual)} />
            <Fila etiqueta="Ubicación" valor={texto(exito.ubicacion)} />
            <Fila etiqueta="Vigencia" valor={texto(exito.vigencia)} />
          </dl>

          <div className="mt-8 flex flex-col gap-3">
            <Button size="lg" className="h-16 text-xl font-semibold" onClick={reiniciar}>
              NUEVO INVENTARIO
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 text-base">
              <Link to="/">MENÚ PRINCIPAL</Link>
            </Button>
          </div>
        </div>
      </main>
    );
  }

  if (modo === "existente" && bobina) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-10">
        {volverMenu}
        <h1 className="mt-6 text-3xl font-bold tracking-tight">INVENTARIO</h1>

        <section className="mt-8 rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Bobina actual
          </h2>
          <dl className="mt-2 text-base">
            <Fila etiqueta="ID de bobina" valor={texto(bobina.id_bobina)} />
            <Fila etiqueta="Código de etiqueta" valor={texto(bobina.codigo_etiqueta)} />
            <Fila etiqueta="Descripción" valor={texto(bobina.descripcion)} />
            <Fila etiqueta="Cantidad actual" valor={texto(bobina.cantidad_actual)} />
            <Fila etiqueta="Ubicación actual" valor={texto(bobina.ubicacion)} />
            <Fila etiqueta="Estado" valor={texto(bobina.estado)} />
            <Fila etiqueta="Vigencia" valor={texto(bobina.vigencia)} />
            <Fila etiqueta="Fecha de vencimiento" valor={texto(bobina.fecha_vencimiento)} />
          </dl>
        </section>

        <form onSubmit={onSubmitExistente} className="mt-8 space-y-6">
          {camposComunes}

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
            {enviando ? "REGISTRANDO…" : "REGISTRAR INVENTARIO"}
          </Button>
          <Button type="button" variant="outline" size="lg" className="h-12 w-full" onClick={reiniciar}>
            Cancelar
          </Button>
        </form>
      </main>
    );
  }

  if (modo === "alta") {
    return (
      <main className="mx-auto max-w-2xl px-6 py-10">
        {volverMenu}
        <h1 className="mt-6 text-3xl font-bold tracking-tight">INVENTARIO</h1>
        <p className="mt-1 text-base text-muted-foreground">
          Bobina sin ID CQ. Se dará de alta con origen INVENTARIO.
        </p>

        <form onSubmit={onSubmitAlta} className="mt-8 space-y-6">
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
              readOnly
            />
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

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fecha-ingreso" className="text-base">
                Fecha de ingreso original
              </Label>
              <Input
                id="fecha-ingreso"
                className={inputClass}
                type="date"
                value={fechaIngreso}
                onChange={(e) => setFechaIngreso(e.target.value)}
                required
              />
            </div>
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
          </div>

          {camposComunes}

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
            {enviando ? "REGISTRANDO…" : "DAR DE ALTA E INVENTARIAR"}
          </Button>
          <Button type="button" variant="outline" size="lg" className="h-12 w-full" onClick={reiniciar}>
            Cancelar
          </Button>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      {volverMenu}
      <h1 className="mt-6 text-3xl font-bold tracking-tight">INVENTARIO</h1>

      <div className="mt-8 space-y-2">
        <Label htmlFor="entrada" className="text-base">
          Escanear ID CQ o ingresar código de etiqueta
        </Label>
        <Input
          id="entrada"
          ref={escanerRef}
          className="h-16 text-2xl tracking-wide"
          value={entrada}
          maxLength={100}
          autoComplete="off"
          placeholder="CQ-000010 o ET-0001"
          onChange={(e) => setEntrada(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void procesar();
            }
          }}
        />
        {buscando && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Consultando…
          </p>
        )}
        <Button
          type="button"
          size="lg"
          className="mt-4 h-16 w-full text-xl font-semibold"
          disabled={buscando}
          onClick={() => void procesar()}
        >
          CONTINUAR
        </Button>
      </div>

      {noEncontrada && (
        <div role="alert" className="mt-6 rounded-md bg-destructive/10 p-4 text-destructive">
          <p className="text-lg font-semibold">BOBINA NO ENCONTRADA</p>
          <p className="mt-1 text-base">
            Verifique el ID. Si la bobina todavía no posee ID CQ, ingrese su código de etiqueta.
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-6 rounded-md bg-destructive/10 p-4 text-base text-destructive">
          {error}
        </p>
      )}
    </main>
  );
}

import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  iniciarInventario,
  registrarEscaneoInventario, finalizarInventario,
  type InventarioIniciado,
  type ResultadoInventario, type BobinaInventario,
} from "@/lib/inventarios.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = { onVolver: () => void };
type Guardado = { inventario: InventarioIniciado; pendientes: string[]; total: number };
const texto = (valor: unknown) => valor == null || valor === "" ? "—" : String(valor);
const numero = (valor: number | null | undefined) => (valor ?? 0).toLocaleString("es-AR");
const alcance = (i: InventarioIniciado | ResultadoInventario) =>
  `${i.sector} · Posición: ${i.posicion ?? "Todas"} · Altura: ${i.altura ?? "Todas"}`;
const mensajeError = (e: unknown) => e instanceof Error ? e.message : "No se pudo completar la operación.";

export function InventarioConteo({ onVolver }: Props) {
  const iniciar = useServerFn(iniciarInventario);
  const escanear = useServerFn(registrarEscaneoInventario);
  const terminar = useServerFn(finalizarInventario);
  const [sector, setSector] = useState("");
  const [posicion, setPosicion] = useState("");
  const [altura, setAltura] = useState("");
  const [codigo, setCodigo] = useState("");
  const [inventario, setInventario] = useState<InventarioIniciado | null>(null);
  const [resultado, setResultado] = useState<ResultadoInventario | null>(null);
  const [total, setTotal] = useState(0);
  const [pendientes, setPendientes] = useState(0);
  const [procesando, setProcesando] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [vista, setVista] = useState("escaneadas");
  const activoRef = useRef<InventarioIniciado | null>(null);
  const colaRef = useRef<string[]>([]);
  const totalRef = useRef(0);
  const ocupadoRef = useRef(false);
  const bloqueoRef = useRef(false);
  const claveRef = useRef("");
  const inicioIdRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const montadoRef = useRef(true);

  useEffect(() => {
    montadoRef.current = true;
    let vigente = true;
    async function cargar() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error || !data.session) throw new Error("Inicie sesión para inventariar.");
        if (!vigente) return;
        claveRef.current = `inventario_conteo:${data.session.user.id}`;
        const guardado = sessionStorage.getItem(claveRef.current);
        if (guardado) {
          const recuperado = JSON.parse(guardado) as Guardado;
          if (recuperado.inventario?.id_inventario && Array.isArray(recuperado.pendientes)) {
            activoRef.current = recuperado.inventario;
            colaRef.current = recuperado.pendientes;
            totalRef.current = recuperado.total ?? 0;
            setInventario(recuperado.inventario);
            setTotal(totalRef.current);
            setPendientes(colaRef.current.length);
            setAviso("Inventario recuperado. Si hay lecturas pendientes, presione Reintentar lecturas.");
          }
        }
      } catch (e) {
        if (vigente) setError(mensajeError(e));
      } finally {
        if (vigente) setCargando(false);
      }
    }
    void cargar();
    return () => { vigente = false; montadoRef.current = false; };
  }, []);

  useEffect(() => {
    if (inventario && !resultado) inputRef.current?.focus();
  }, [inventario, resultado]);

  useEffect(() => {
    const avisar = (event: BeforeUnloadEvent) => {
      if (ocupadoRef.current || colaRef.current.length > 0 || bloqueoRef.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, []);

  function guardar() {
    if (!claveRef.current || !activoRef.current) return;
    sessionStorage.setItem(claveRef.current, JSON.stringify({
      inventario: activoRef.current,
      pendientes: colaRef.current,
      total: totalRef.current,
    } satisfies Guardado));
  }

  async function procesarCola() {
    if (ocupadoRef.current || !activoRef.current) return;
    ocupadoRef.current = true;
    try {
      while (colaRef.current.length > 0 && montadoRef.current) {
        const lectura = colaRef.current[0];
        const res = await escanear({ data: {
          id_inventario: activoRef.current.id_inventario, codigo: lectura,
        } });
        colaRef.current.shift();
        totalRef.current = res.total_escaneados;
        guardar();
        if (montadoRef.current) {
          setTotal(res.total_escaneados);
          setPendientes(colaRef.current.length);
          setAviso(`${res.codigo}: ${res.mensaje}`);
          setError("");
        }
      }
    } catch (e) {
      if (montadoRef.current) setError(`${mensajeError(e)} La lectura sigue pendiente; puede reintentar.`);
    } finally {
      ocupadoRef.current = false;
    }
  }

  async function comenzar(event: React.FormEvent) {
    event.preventDefault();
    if (bloqueoRef.current || !claveRef.current) return;
    if (!/^[A-Z]+$/.test(sector.trim().toUpperCase())) {
      setError("Ingrese un sector válido, por ejemplo B."); return;
    }
    bloqueoRef.current = true; setProcesando(true); setError("");
    try {
      inicioIdRef.current ??= crypto.randomUUID();
      const res = await iniciar({ data: {
        id_inventario: inicioIdRef.current,
        sector: sector.trim().toUpperCase(),
        posicion: posicion.trim() || null,
        altura: altura.trim() || null,
      } });
      activoRef.current = res; colaRef.current = []; totalRef.current = 0;
      guardar();
      setInventario(res); setTotal(0); setPendientes(0);
      setAviso("Inventario iniciado. Puede comenzar a escanear.");
    } catch (e) { setError(mensajeError(e)); }
    finally { bloqueoRef.current = false; setProcesando(false); }
  }

  function agregar(event: React.FormEvent) {
    event.preventDefault();
    if (bloqueoRef.current || !activoRef.current) return;
    const limpio = codigo.trim().toUpperCase();
    if (!limpio || limpio.length > 100) { setError("Ingrese un código de hasta 100 caracteres."); return; }
    try {
      // Guardar la lectura antes de enviarla; el servidor elimina duplicados.
      colaRef.current.push(limpio);
      guardar();
      setPendientes(colaRef.current.length); setCodigo("");
      inputRef.current?.focus();
      void procesarCola();
    } catch (e) {
      colaRef.current.pop();
      setError(`No se pudo conservar la lectura en esta computadora. ${mensajeError(e)}`);
    }
  }

  async function finalizar() {
    if (bloqueoRef.current || !activoRef.current) return;
    if (ocupadoRef.current || colaRef.current.length) {
      setError("Espere a que se guarden todas las lecturas. Si hubo un error, presione Reintentar lecturas."); return;
    }
    if (codigo.trim()) { setError("Agregue el código escrito antes de finalizar."); return; }
    bloqueoRef.current = true; setProcesando(true); setError("");
    try {
      const res = await terminar({ data: { id_inventario: activoRef.current.id_inventario } });
      setResultado(res); setAviso("");
      sessionStorage.removeItem(claveRef.current);
    } catch (e) { setError(mensajeError(e)); }
    finally { bloqueoRef.current = false; setProcesando(false); }
  }


  if (cargando) return <main className="mx-auto max-w-4xl px-6 py-10"><p>Cargando inventario…</p></main>;

  if (resultado) {
    const res = resultado;
    const filas: { codigo: string; bobina: BobinaInventario | null; detalle: string }[] =
      vista === "faltantes" ? res.bobinas_faltantes.map(b => ({ codigo: b.id_bobina, bobina: b, detalle: "No escaneada" })) :
      vista === "otras" ? res.bobinas_otra_ubicacion.map(l => ({ codigo: l.codigo, bobina: l.bobina, detalle: {
        OTRA_UBICACION: "Otra ubicación", UBICACION_SIN_FORMATO: "Ubicación sin formato",
        ESTADO_DISTINTO_DE_ALMACEN: "Estado distinto de ALMACEN", NO_ESPERADA_AL_INICIO: "No esperada al inicio",
      }[l.motivo] })) :
      vista === "desconocidas" ? res.codigos_no_reconocidos.map(l => ({ codigo: l.codigo, bobina: null, detalle: "Código no reconocido" })) :
      vista === "encontradas" ? res.bobinas_encontradas.map(l => ({ codigo: l.codigo, bobina: l.bobina, detalle: "Encontrada" })) :
      res.bobinas_escaneadas.map(l => ({ codigo: l.codigo, bobina: l.bobina, detalle: l.reconocida ? "Bobina reconocida" : "Sin registro al escanear" }));
    return <main className="mx-auto max-w-6xl px-6 py-10 space-y-6">
      <Button variant="outline" onClick={onVolver}>Volver a Inventario</Button>
      <div><h1 className="text-3xl font-bold">Resultado del inventario</h1>
        <p className="mt-2">{alcance(res)}</p>
        <p className="text-sm text-muted-foreground">Operario: {res.operario_nombre} · Finalizado: {new Date(res.fecha_finalizacion).toLocaleString("es-AR", { timeZone: "America/Argentina/Mendoza" })}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Esperadas", res.resumen.total_esperadas], ["Códigos escaneados", res.resumen.total_codigos_escaneados],
          ["Encontradas", res.resumen.total_encontradas], ["Faltantes", res.resumen.total_faltantes],
          ["No esperadas", res.resumen.total_bobinas_no_esperadas], ["No reconocidos", res.resumen.total_codigos_no_reconocidos],
        ].map(([label, value]) => <div key={String(label)} className="rounded-xl border p-4"><p>{label}</p><p className="text-2xl font-bold">{numero(Number(value))}</p></div>)}
      </div>
      <p>Etiquetas registradas en las bobinas faltantes: <strong>{numero(res.resumen.total_etiquetas_faltantes)}</strong></p>
      <section className="space-y-3 rounded-xl border p-5" aria-labelledby="titulo-faltantes">
        <h2 id="titulo-faltantes" className="text-xl font-bold">Bobinas faltantes ({res.bobinas_faltantes.length})</h2>
        {res.bobinas_faltantes.length > 0 ? <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted"><tr>
              {["ID bobina", "Código etiqueta", "Descripción", "Cantidad registrada", "Ubicación registrada"].map(t => <th key={t} className="p-3 text-left">{t}</th>)}
            </tr></thead>
            <tbody>{res.bobinas_faltantes.map(b => <tr key={b.id_bobina} className="border-t">
              <td className="p-3 font-semibold">{b.id_bobina}</td>
              <td className="p-3">{texto(b.codigo_etiqueta)}</td>
              <td className="p-3">{texto(b.descripcion)}</td>
              <td className="p-3">{numero(b.cantidad_actual)}</td>
              <td className="p-3">{texto(b.ubicacion)}</td>
            </tr>)}</tbody>
          </table>
        </div> : <p>No hay bobinas faltantes en este inventario.</p>}
      </section>
      <div className="space-y-2"><Label htmlFor="vista-inventario">Listado</Label>
        <select id="vista-inventario" className="h-12 w-full rounded-md border bg-background px-3" value={vista} onChange={e => setVista(e.target.value)}>
          <option value="escaneadas">Todos los códigos escaneados</option>
          <option value="encontradas">Encontradas</option><option value="faltantes">Faltantes</option>
          <option value="otras">Bobinas no esperadas / otra ubicación</option><option value="desconocidas">Códigos no reconocidos</option>
        </select>
      </div>
      <div className="overflow-x-auto rounded-xl border"><table className="w-full text-sm">
        <thead className="bg-muted"><tr>{["ID bobina / código", "Código etiqueta", "Descripción", "Cantidad", "Ubicación", "Estado", "Ingreso", "Vencimiento", "Proveedor", "Resultado"].map(t => <th key={t} className="p-3 text-left">{t}</th>)}</tr></thead>
        <tbody>{filas.map(f => <tr key={f.codigo} className="border-t">
          <td className="p-3 font-semibold">{f.codigo}</td><td className="p-3">{texto(f.bobina?.codigo_etiqueta)}</td>
          <td className="p-3">{texto(f.bobina?.descripcion)}</td><td className="p-3">{f.bobina ? numero(f.bobina.cantidad_actual) : "—"}</td>
          <td className="p-3">{texto(f.bobina?.ubicacion)}</td><td className="p-3">{texto(f.bobina?.estado)}</td>
          <td className="p-3">{texto(f.bobina?.fecha_ingreso)}</td><td className="p-3">{texto(f.bobina?.fecha_vencimiento)}</td>
          <td className="p-3">{texto(f.bobina?.proveedor)}</td><td className="p-3">{f.detalle}</td>
        </tr>)}{!filas.length && <tr><td colSpan={10} className="p-5">No hay registros en este listado.</td></tr>}</tbody>
      </table></div>
      <p className="text-sm text-muted-foreground">El escaneo confirma presencia. Las cantidades son las registradas en el sistema; este conteo no modifica el stock.</p>
    </main>;
  }

  return <main className="mx-auto max-w-4xl px-6 py-10 space-y-6">
    {!inventario && <Button variant="outline" onClick={onVolver}>Volver</Button>}
    <h1 className="text-3xl font-bold">Inventario</h1>
    {error && <p role="alert" className="rounded-xl bg-destructive/10 p-4 text-destructive">{error}</p>}
    {!inventario ? <form onSubmit={comenzar} className="space-y-6">
      <p>Ingrese el sector, la posición y la altura que desea inventariar.</p>
      <div className="grid gap-5 sm:grid-cols-3">
        <div className="space-y-2"><Label htmlFor="sector-inventario">Sector</Label>
          <Input id="sector-inventario" autoComplete="off" required pattern="[A-Za-z]+" placeholder="Ejemplo: B" value={sector} disabled={procesando}
            onChange={e => { setSector(e.target.value.toUpperCase()); setPosicion(""); setAltura(""); inicioIdRef.current = null; }} />
        </div>
        <div className="space-y-2"><Label htmlFor="posicion-inventario">Posición</Label>
          <Input id="posicion-inventario" autoComplete="off" pattern="[0-9]+" placeholder="Todas" value={posicion} disabled={procesando}
            onChange={e => { setPosicion(e.target.value); setAltura(""); inicioIdRef.current = null; }} />
          <Button type="button" variant="outline" size="sm" disabled={procesando} onClick={() => { setPosicion(""); setAltura(""); inicioIdRef.current = null; }}>Todas</Button>
        </div>
        <div className="space-y-2"><Label htmlFor="altura-inventario">Altura</Label>
          <Input id="altura-inventario" autoComplete="off" pattern="[0-9]+" placeholder="Todas" value={altura} disabled={procesando || !posicion.trim()}
            onChange={e => { setAltura(e.target.value); inicioIdRef.current = null; }} />
          <Button type="button" variant="outline" size="sm" disabled={procesando} onClick={() => { setAltura(""); inicioIdRef.current = null; }}>Todas</Button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">Ejemplo: B.74.03. Posición y altura vacías incluyen Todas.</p>
      <Button type="submit" className="h-14 w-full text-lg" disabled={procesando || !claveRef.current}>{procesando ? "Iniciando…" : "Iniciar inventario"}</Button>
    </form> : <>
      <p className="rounded-xl border p-4 font-semibold">{alcance(inventario)}</p>
      <form onSubmit={agregar} className="space-y-3">
        <Label htmlFor="codigo-conteo">Escanear bobina</Label>
        <Input ref={inputRef} id="codigo-conteo" className="h-16 text-xl" autoComplete="off" value={codigo} disabled={procesando}
          onChange={e => setCodigo(e.target.value)} placeholder="Escanee el código y presione Enter" />
        <Button type="submit" disabled={procesando}>Agregar código</Button>
      </form>
      <div className="rounded-xl border p-5"><p>Códigos únicos guardados</p><p className="text-4xl font-bold">{numero(total)}</p>
        <p className="mt-2 text-sm">Lecturas pendientes de guardar: {pendientes}</p></div>
      {aviso && <p role="status" aria-live="polite" className="rounded-xl bg-muted p-4">{aviso}</p>}
      {pendientes > 0 && <Button variant="outline" disabled={procesando} onClick={() => void procesarCola()}>Reintentar lecturas</Button>}
      <Button className="h-14 w-full text-lg" disabled={procesando || pendientes > 0 || Boolean(codigo.trim())} onClick={() => void finalizar()}>
        {procesando ? "Finalizando…" : "Finalizar inventario"}
      </Button>
    </>}
  </main>;
}

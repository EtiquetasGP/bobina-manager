import { useEffect, useRef, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  iniciarMapeo,
  obtenerMapeo,
  escanearMapeo,
  finalizarMapeo,
  cancelarMapeo,
  type InventarioMapeo,
  type ResultadoMapeo,
  type RespuestaLecturaMapeo,
  type FilaMapeo,
} from "@/lib/inventario-mapeo.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Lectura = {
  id_lectura: string;
  codigo: string;
  ubicacion: string | null;
  confirmar_traslado: boolean;
};
type Guardado = { id: string; cola: Lectura[]; ubicacion: string | null };
const errorTexto = (e: unknown) =>
  e instanceof Error ? e.message : "No se pudo completar la operación.";
const etiquetas: Record<FilaMapeo["resultado"], string> = {
  FALTANTE: "Faltante",
  NO_RECONOCIDA: "Código no reconocido",
  NO_ESPERADA: "Bobina no esperada",
  DIFERENCIA_UBICACION: "Diferencia de ubicación",
  COINCIDE: "Coincide",
  ESTADO_DISTINTO_DE_ALMACEN: "Otro estado: revisar sin trasladar",
};
const nombresResumen: Record<string, string> = {
  esperadas: "Esperadas",
  escaneadas: "Escaneadas",
  faltantes: "Faltantes",
  no_esperadas: "No esperadas",
  diferencias_ubicacion: "Diferencias de ubicación",
  no_reconocidas: "Códigos no reconocidos",
  otro_estado: "Otro estado",
};
const alcance = (i: InventarioMapeo) =>
  i.sector + " · Posición: " + (i.posicion ?? "Todas") + " · Altura: " + (i.altura ?? "Todas");

export function InventarioConteo({ onVolver }: { onVolver: () => void }) {
  const iniciar = useServerFn(iniciarMapeo),
    obtener = useServerFn(obtenerMapeo);
  const escanear = useServerFn(escanearMapeo),
    finalizar = useServerFn(finalizarMapeo),
    cancelar = useServerFn(cancelarMapeo);
  const [sector, setSector] = useState("");
  const [posicion, setPosicion] = useState("");
  const [altura, setAltura] = useState("");
  const [inventario, setInventario] = useState<InventarioMapeo | null>(null);
  const [resultado, setResultado] = useState<ResultadoMapeo | null>(null);
  const [ubicacion, setUbicacion] = useState<string | null>(null);
  const [codigo, setCodigo] = useState("");
  const [total, setTotal] = useState(0);
  const [pendientes, setPendientes] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [confirmacion, setConfirmacion] = useState<RespuestaLecturaMapeo | null>(null);
  const [filtro, setFiltro] = useState("TODAS");
  const activoRef = useRef<InventarioMapeo | null>(null);
  const colaRef = useRef<Lectura[]>([]);
  const ubicacionRef = useRef<string | null>(null);
  const claveRef = useRef("");
  const inicioRef = useRef<string | null>(null);
  const procesandoRef = useRef(false);
  const bloqueoRef = useRef(false);
  const montadoRef = useRef(true);
  const confirmacionRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function guardar() {
    if (!claveRef.current || !activoRef.current) return;
    sessionStorage.setItem(
      claveRef.current,
      JSON.stringify({
        id: activoRef.current.id_inventario,
        cola: colaRef.current,
        ubicacion: ubicacionRef.current,
      } satisfies Guardado),
    );
  }
  function aplicar(i: InventarioMapeo | ResultadoMapeo) {
    activoRef.current = i;
    setInventario(i);
    setTotal(i.total_escaneados ?? 0);
    if (i.estado === "FINALIZADO") {
      setResultado(i as ResultadoMapeo);
      colaRef.current = [];
      setPendientes(0);
    } else if (i.estado === "CANCELADO") {
      limpiar();
    }
  }
  function limpiar() {
    activoRef.current = null;
    colaRef.current = [];
    ubicacionRef.current = null;
    inicioRef.current = null;
    confirmacionRef.current = false;
    setConfirmacion(null);
    setInventario(null);
    setResultado(null);
    setUbicacion(null);
    setCodigo("");
    setTotal(0);
    setPendientes(0);
    setError("");
    if (claveRef.current) sessionStorage.removeItem(claveRef.current);
  }
  useEffect(() => {
    let vigente = true;
    montadoRef.current = true;
    async function cargar() {
      try {
        const { data, error: authError } = await supabase.auth.getSession();
        if (authError || !data.session) throw new Error("Inicie sesión para inventariar.");
        if (!vigente) return;
        claveRef.current = "inventario_mapeo_v1:" + data.session.user.id;
        const raw = sessionStorage.getItem(claveRef.current);
        const saved = raw ? (JSON.parse(raw) as Guardado) : null;
        let i = await obtener({ data: { id_inventario: saved?.id ?? null } });
        if (!i && saved?.id) i = await obtener({ data: { id_inventario: null } });
        if (!vigente || !i) return;
        aplicar(i);
        if (i.estado === "EN_CURSO") {
          colaRef.current =
            saved?.id === i.id_inventario && Array.isArray(saved.cola) ? saved.cola : [];
          ubicacionRef.current = colaRef.current.length
            ? (saved?.ubicacion ?? i.ubicacion_activa)
            : i.ubicacion_activa;
          setUbicacion(ubicacionRef.current);
          setPendientes(colaRef.current.length);
          guardar();
          setAviso(
            "Inventario recuperado. Puede continuar; si hay lecturas pendientes, presione Reintentar lecturas.",
          );
        }
      } catch (e) {
        if (vigente) setError(errorTexto(e));
      } finally {
        if (vigente) setCargando(false);
      }
    }
    void cargar();
    return () => {
      vigente = false;
      montadoRef.current = false;
    };
    // Carga una vez y recupera la sesión del servidor y la cola de esta pestaña.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (inventario && !resultado && !confirmacion) inputRef.current?.focus();
  }, [inventario, resultado, confirmacion]);
  useEffect(() => {
    const salir = (e: BeforeUnloadEvent) => {
      if (procesandoRef.current || bloqueoRef.current || colaRef.current.length) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", salir);
    return () => window.removeEventListener("beforeunload", salir);
  }, []);

  async function procesar() {
    if (procesandoRef.current || confirmacionRef.current || !activoRef.current) return;
    procesandoRef.current = true;
    setEnviando(true);
    try {
      while (colaRef.current.length && montadoRef.current) {
        const lectura = colaRef.current[0];
        const r = await escanear({
          data: { id_inventario: activoRef.current.id_inventario, ...lectura },
        });
        if (r.tipo === "CONFIRMAR") {
          confirmacionRef.current = true;
          setConfirmacion(r);
          break;
        }
        colaRef.current.shift();
        guardar();
        setPendientes(colaRef.current.length);
        setTotal(r.total_escaneados ?? 0);
        setAviso(r.codigo + ": " + r.mensaje);
        setError("");
      }
    } catch (e) {
      setError(errorTexto(e) + " Las lecturas pendientes se conservan. Puede reintentar.");
    } finally {
      procesandoRef.current = false;
      if (montadoRef.current) setEnviando(false);
    }
  }
  async function comenzar(e: FormEvent) {
    e.preventDefault();
    if (bloqueoRef.current) return;
    if (
      !/^[A-Z]+$/.test(sector.trim().toUpperCase()) ||
      (posicion && !/^\d+$/.test(posicion)) ||
      (altura && (!posicion || !/^\d+$/.test(altura)))
    ) {
      setError("Ingrese un sector y, si corresponde, una posición y altura numéricas.");
      return;
    }
    if (
      !window.confirm(
        "Al comenzar, las bobinas en ALMACEN del alcance seleccionado pasarán a " +
          sector.trim().toUpperCase() +
          ".0. Se conservará su ubicación anterior. ¿Comenzar inventario?",
      )
    )
      return;
    bloqueoRef.current = true;
    setOcupado(true);
    setError("");
    try {
      inicioRef.current ??= crypto.randomUUID();
      const i = await iniciar({
        data: {
          id_inventario: inicioRef.current,
          sector: sector.trim().toUpperCase(),
          posicion: posicion || null,
          altura: altura || null,
        },
      });
      aplicar(i);
      ubicacionRef.current = i.ubicacion_activa ?? null;
      setUbicacion(ubicacionRef.current);
      guardar();
      setAviso("Escanee primero una ubicación real y después las bobinas que encuentre allí.");
    } catch (e) {
      setError(errorTexto(e));
    } finally {
      bloqueoRef.current = false;
      setOcupado(false);
    }
  }
  function agregar(e: FormEvent) {
    e.preventDefault();
    if (bloqueoRef.current || confirmacionRef.current || !activoRef.current) return;
    const valor = codigo.trim().toUpperCase();
    if (!valor || valor.length > 100) return;
    const esUbicacion = /^[A-Z]+\.\d+\.\d+$/.test(valor);
    const i = activoRef.current;
    if (esUbicacion) {
      const [s, p, a] = valor.split(".");
      if (s !== i.sector || (i.posicion && p !== i.posicion) || (i.altura && a !== i.altura)) {
        setError("La ubicación está fuera del alcance seleccionado.");
        return;
      }
    } else if (/^[A-Z]+\./.test(valor)) {
      setError("Ubicación inválida. Use el formato B.01.01.");
      return;
    } else if (!ubicacionRef.current) {
      setError("Escanee primero una ubicación, por ejemplo B.01.01.");
      return;
    }
    const anterior = ubicacionRef.current;
    const lectura: Lectura = {
      id_lectura: crypto.randomUUID(),
      codigo: valor,
      ubicacion: esUbicacion ? null : anterior,
      confirmar_traslado: false,
    };
    colaRef.current.push(lectura);
    if (esUbicacion) ubicacionRef.current = valor;
    try {
      guardar();
    } catch {
      colaRef.current.pop();
      ubicacionRef.current = anterior;
      setError("No se pudo conservar la lectura en esta computadora. No fue enviada.");
      return;
    }
    setUbicacion(ubicacionRef.current);
    setPendientes(colaRef.current.length);
    setCodigo("");
    inputRef.current?.focus();
    void procesar();
  }
  function resolverTraslado(aceptar: boolean) {
    const lectura = colaRef.current[0];
    if (!lectura) return;
    if (aceptar) lectura.confirmar_traslado = true;
    else colaRef.current.shift();
    guardar();
    setPendientes(colaRef.current.length);
    confirmacionRef.current = false;
    setConfirmacion(null);
    void procesar();
  }
  async function cerrar(anular = false) {
    if (bloqueoRef.current || procesandoRef.current || !activoRef.current) return;
    if (!anular && (colaRef.current.length || codigo.trim())) {
      setError("Guarde todas las lecturas y vacíe el campo antes de finalizar.");
      return;
    }
    if (
      !window.confirm(
        anular
          ? "¿Cancelar este inventario y recuperar las ubicaciones anteriores? Las lecturas no se aplicarán."
          : "¿Finalizar el inventario y asignar las ubicaciones escaneadas? Las faltantes permanecerán en posición 0.",
      )
    )
      return;
    bloqueoRef.current = true;
    setOcupado(true);
    setError("");
    try {
      if (anular) {
        await cancelar({ data: { id_inventario: activoRef.current.id_inventario } });
        limpiar();
        setAviso("Inventario cancelado. Se recuperaron las ubicaciones anteriores.");
      } else {
        const r = await finalizar({ data: { id_inventario: activoRef.current.id_inventario } });
        aplicar(r);
        setAviso("");
        guardar();
      }
    } catch (e) {
      setError(errorTexto(e));
    } finally {
      bloqueoRef.current = false;
      setOcupado(false);
    }
  }
  function volver() {
    if (procesandoRef.current || bloqueoRef.current || colaRef.current.length) {
      setError("Guarde las lecturas pendientes antes de salir.");
      return;
    }
    onVolver();
  }
  function exportar() {
    if (!resultado) return;
    const esc = (x: unknown) => '"' + String(x ?? "").replaceAll('"', '""') + '"';
    const filas = [
      [
        "Bobina",
        "Código etiqueta",
        "Descripción",
        "Cantidad registrada",
        "Año",
        "Alcohol",
        "Ubicación anterior en el sistema",
        "Ubicación encontrada",
        "Ubicación actual",
        "Resultado",
      ],
      ...resultado.filas.map((f) => [
        f.codigo,
        f.informacion_anterior?.codigo_etiqueta,
        f.informacion_anterior?.descripcion,
        f.informacion_anterior?.cantidad_actual,
        f.informacion_anterior?.año,
        f.informacion_anterior?.alcohol,
        f.ubicacion_anterior,
        f.ubicacion_encontrada,
        f.ubicacion_actual,
        etiquetas[f.resultado],
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + filas.map((f) => f.map(esc).join(";")).join("\r\n")], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "inventario-" + resultado.sector + "-" + resultado.id_inventario + ".csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  if (cargando)
    return (
      <main className="module-screen mx-auto max-w-4xl p-6">
        <p>Cargando inventario…</p>
      </main>
    );
  return (
    <main className="module-screen mx-auto max-w-6xl space-y-6 px-6 py-8">
      <Button variant="outline" onClick={volver} disabled={ocupado || enviando}>
        Volver a Inventario
      </Button>
      <h1 className="text-3xl font-bold">
        {resultado ? "Resultado del inventario" : "Inventario"}
      </h1>
      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-4 text-destructive">
          {error}
        </p>
      )}
      {aviso && (
        <p role="status" className="rounded-lg bg-muted p-4">
          {aviso}
        </p>
      )}
      {resultado ? (
        <>
          <p>
            {alcance(resultado)} · Operario: {resultado.operario_nombre}
          </p>
          <p>
            Finalizado: {new Date(resultado.fecha_finalizacion).toLocaleString("es-AR")}. Las
            ubicaciones encontradas ya fueron aplicadas.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {Object.entries(resultado.resumen).map(([k, n]) => (
              <div className="rounded-xl border p-4" key={k}>
                <p>{nombresResumen[k]}</p>
                <strong className="text-2xl">{n}</strong>
              </div>
            ))}
          </div>
          <section className="space-y-3 rounded-xl border p-5">
            <h2 className="text-xl font-bold">Faltantes: {resultado.resumen.faltantes}</h2>
            <p>
              Permanecen en {resultado.sector}.0. Revise la ubicación donde figuraban antes del
              inventario.
            </p>
            {resultado.resumen.faltantes ? (
              <Tabla filas={resultado.filas.filter((f) => f.resultado === "FALTANTE")} />
            ) : (
              <p>No hay bobinas faltantes.</p>
            )}
          </section>
          <div className="flex flex-wrap gap-3">
            <Button onClick={exportar}>Descargar resultado para Excel</Button>
            <Button
              variant="outline"
              onClick={() => {
                limpiar();
                setAviso("");
              }}
            >
              Nuevo inventario
            </Button>
          </div>
          <Label htmlFor="filtro-mapeo">Listado</Label>
          <select
            id="filtro-mapeo"
            className="h-12 w-full rounded-md border bg-background px-3"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
          >
            <option value="TODAS">Todas las bobinas y códigos</option>
            {Object.entries(etiquetas).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <Tabla
            filas={resultado.filas.filter((f) => filtro === "TODAS" || f.resultado === filtro)}
          />
        </>
      ) : inventario ? (
        <>
          <p>{alcance(inventario)}</p>
          <p>
            Conteo ciego. Escanee una ubicación real y luego todas las bobinas que encuentre allí.
            Para cambiar de posición, escanee la siguiente ubicación.
          </p>
          <div className="rounded-xl border p-5">
            <p>Ubicación seleccionada</p>
            <strong className="text-3xl">{ubicacion ?? "Escanee una ubicación"}</strong>
            <p className="mt-3">
              Códigos contados: <strong>{total}</strong> · Lecturas pendientes de guardar:{" "}
              <strong>{pendientes}</strong>
            </p>
          </div>
          {confirmacion ? (
            <section
              role="alertdialog"
              aria-label="Confirmar ubicación de bobina"
              className="space-y-3 rounded-xl border p-5"
            >
              <p>
                La bobina <strong>{confirmacion.codigo}</strong> ya se escaneó en{" "}
                <strong>{confirmacion.ubicacion_anterior_lectura}</strong>.
              </p>
              <p>
                ¿Está físicamente en <strong>{confirmacion.ubicacion_activa}</strong>?
              </p>
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => resolverTraslado(true)}>Sí, corregir ubicación</Button>
                <Button variant="outline" onClick={() => resolverTraslado(false)}>
                  Conservar la primera ubicación
                </Button>
              </div>
            </section>
          ) : (
            <form className="space-y-3" onSubmit={agregar}>
              <Label htmlFor="codigo-mapeo">Escanear ubicación o bobina</Label>
              <Input
                id="codigo-mapeo"
                ref={inputRef}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                disabled={ocupado}
                autoComplete="off"
                spellCheck={false}
                placeholder="B.01.01 o CQ-000001"
                className="h-14 text-xl"
              />
              <Button type="submit" disabled={ocupado}>
                Registrar lectura
              </Button>
            </form>
          )}
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => void procesar()}
              disabled={ocupado || enviando || !!confirmacion || !pendientes}
            >
              Reintentar lecturas
            </Button>
            <Button
              onClick={() => void cerrar()}
              disabled={ocupado || enviando || !!pendientes || !!confirmacion}
            >
              Finalizar inventario
            </Button>
            <Button
              variant="outline"
              onClick={() => void cerrar(true)}
              disabled={ocupado || enviando}
            >
              Cancelar inventario
            </Button>
          </div>
        </>
      ) : (
        <form onSubmit={comenzar} className="max-w-xl space-y-5">
          <p>
            Seleccione el alcance. Al comenzar, sus bobinas en ALMACEN pasarán a posición 0 y se
            conservará la ubicación anterior para comparar al finalizar.
          </p>
          <div className="space-y-2">
            <Label htmlFor="sector-mapeo">Sector</Label>
            <Input
              id="sector-mapeo"
              value={sector}
              onChange={(e) => {
                setSector(e.target.value.toUpperCase());
                inicioRef.current = null;
              }}
              required
              maxLength={30}
              autoComplete="off"
              placeholder="B"
              disabled={ocupado}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="posicion-mapeo">Posición</Label>
            <Input
              id="posicion-mapeo"
              value={posicion}
              onChange={(e) => {
                setPosicion(e.target.value);
                inicioRef.current = null;
              }}
              inputMode="numeric"
              maxLength={10}
              autoComplete="off"
              placeholder="Todas"
              disabled={ocupado}
            />
            <Button
              type="button"
              variant="outline"
              disabled={ocupado}
              onClick={() => {
                setPosicion("");
                setAltura("");
                inicioRef.current = null;
              }}
            >
              Todas las posiciones
            </Button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="altura-mapeo">Altura</Label>
            <Input
              id="altura-mapeo"
              value={altura}
              onChange={(e) => {
                setAltura(e.target.value);
                inicioRef.current = null;
              }}
              inputMode="numeric"
              maxLength={10}
              autoComplete="off"
              placeholder="Todas"
              disabled={ocupado || !posicion}
            />
            <Button
              type="button"
              variant="outline"
              disabled={ocupado}
              onClick={() => {
                setAltura("");
                inicioRef.current = null;
              }}
            >
              Todas las alturas
            </Button>
          </div>
          <Button type="submit" disabled={ocupado}>
            {ocupado ? "Iniciando…" : "Comenzar inventario"}
          </Button>
        </form>
      )}
    </main>
  );
}

function Tabla({ filas }: { filas: FilaMapeo[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            {[
              "Bobina / código",
              "Código etiqueta",
              "Descripción",
              "Cantidad registrada",
              "Año",
              "Alcohol",
              "Ubicación anterior en el sistema",
              "Ubicación encontrada",
              "Ubicación actual",
              "Resultado",
            ].map((t) => (
              <th className="p-3 text-left" key={t}>
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr className="border-t" key={f.codigo}>
              {[
                f.codigo,
                f.informacion_anterior?.codigo_etiqueta,
                f.informacion_anterior?.descripcion,
                f.informacion_anterior?.cantidad_actual?.toLocaleString("es-AR"),
                f.informacion_anterior?.año,
                f.informacion_anterior?.alcohol,
                f.ubicacion_anterior,
                f.ubicacion_encontrada,
                f.ubicacion_actual,
                etiquetas[f.resultado],
              ].map((v, n) => (
                <td className="p-3" key={n}>
                  {v ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!filas.length && <p className="p-4">No hay registros en este listado.</p>}
    </div>
  );
}

/** Mantiene la sesión solo en la pestaña operativa actual. */
export function crearAlmacenSesionOperario(supabaseUrl: string) {
  if (typeof window === "undefined") return undefined;

  // Evita que el inicio use la sesión persistida por versiones anteriores.
  const proyecto = new URL(supabaseUrl).hostname.split(".")[0];
  const claveAnterior = `sb-${proyecto}-auth-token`;
  try {
    window.localStorage.removeItem(claveAnterior);
    window.localStorage.removeItem(`${claveAnterior}-code-verifier`);
    window.localStorage.removeItem(`${claveAnterior}-user`);
  } catch {
    // Si el navegador bloquea localStorage, la nueva sesión sigue sin utilizarlo.
  }

  // Una clave distinta por pestaña evita compartir eventos de autenticación.
  const clavePestana = "bobinas-operario-pestana";
  const prefijoSesion = "bobinas-operario-sesion-";
  let id = crypto.randomUUID();
  try {
    const entrada = performance.getEntriesByType("navigation")[0] as
      PerformanceNavigationTiming | undefined;
    const anterior = window.sessionStorage.getItem(clavePestana);
    if (entrada?.type === "reload" && anterior) {
      id = anterior;
    } else if (anterior) {
      window.sessionStorage.removeItem(prefijoSesion + anterior);
      window.sessionStorage.removeItem(prefijoSesion + anterior + "-code-verifier");
      window.sessionStorage.removeItem(prefijoSesion + anterior + "-user");
    }
    window.sessionStorage.setItem(clavePestana, id);
    const storage = window.sessionStorage;
    return { storage, storageKey: prefijoSesion + id };
  } catch {
    // Sin almacenamiento de pestaña se mantiene solo en memoria hasta recargar.
    const memoria = new Map<string, string>();
    return {
      storageKey: prefijoSesion + id,
      storage: {
        getItem: (key: string) => memoria.get(key) ?? null,
        setItem: (key: string, value: string) => {
          memoria.set(key, value);
        },
        removeItem: (key: string) => {
          memoria.delete(key);
        },
      },
    };
  }
}

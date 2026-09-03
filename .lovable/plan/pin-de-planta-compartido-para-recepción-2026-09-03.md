# PIN de planta compartido para Recepción

Objetivo: que nadie pueda ejecutar `registrar_recepcion` (ni consultar `etiquetas`) solo por tener la URL de la aplicación. Sin usuarios individuales, sin tocar Supabase.

No se modifica nada del proyecto Supabase ETIQUETAS: ni tablas, ni funciones SQL, ni triggers, ni RLS, ni políticas, ni Auth. El PIN vive fuera de la base de datos.

## Cómo lo vive el operario

1. Entra a la app y ve la pantalla principal.
2. Al tocar RECEPCIÓN, si no tiene acceso todavía, aparece una pantalla simple: "Ingrese el PIN de planta", teclado numérico grande y un botón ACCEDER.
3. Con el PIN correcto entra al formulario y el acceso queda recordado en esa PC (cookie, configurable: 12 horas por defecto).
4. PIN incorrecto: mensaje claro, sin detalles técnicos, y se puede reintentar. Tras varios intentos fallidos seguidos desde la misma PC se espera unos segundos antes de volver a probar.
5. Un botón SALIR en el formulario borra el acceso de esa PC (útil si la máquina es compartida).

## Qué protege exactamente

Las dos funciones de servidor actuales pasan a exigir acceso válido:

- `buscarEtiqueta` (consulta de descripción por código).
- `registrarRecepcion` (llamada a la RPC `registrar_recepcion`).

Si alguien llama a esos endpoints directamente con un script y sin PIN, la respuesta es un rechazo y la RPC nunca se ejecuta. La service role sigue únicamente del lado servidor, como hoy.

## Detalle técnico

- Dos secretos nuevos de proyecto (no van al navegador, se leen dentro de los handlers):
  - `RECEPCION_PIN`: el PIN compartido de planta.
  - `RECEPCION_SESSION_SECRET`: clave para firmar la cookie de acceso (se genera automáticamente).
- Nuevo `src/lib/acceso.functions.ts`:
  - `ingresarPin`: valida el PIN con comparación de tiempo constante contra `RECEPCION_PIN` y, si es correcto, emite una cookie `HttpOnly`, `SameSite=Lax`, `Secure`, firmada con HMAC-SHA256 sobre `{ exp }` usando `RECEPCION_SESSION_SECRET`.
  - `estadoAcceso`: indica si la cookie actual es válida (para decidir qué pantalla mostrar).
  - `salirAcceso`: expira la cookie.
- Nuevo `src/lib/acceso.server.ts`: helper server-only que verifica firma y expiración de la cookie; y `requirePinAcceso`, un `createMiddleware({ type: 'function' }).server(...)` que lanza error si la cookie no es válida.
- `src/lib/bobinas.functions.ts`: se agrega `.middleware([requirePinAcceso])` a `buscarEtiqueta` y `registrarRecepcion`. La lógica de negocio y los parámetros `p_*` de la RPC quedan idénticos.
- `src/routes/recepcion.tsx`: si `estadoAcceso` no es válido, renderiza el panel de PIN en lugar del formulario; se agrega botón SALIR. El formulario y la pantalla de éxito no cambian.
- Rate limit simple en memoria por IP para `ingresarPin` (p. ej. 5 intentos, luego espera). Es best-effort en un runtime sin estado, suficiente para frenar fuerza bruta casual.
- Se mantiene el CSRF middleware existente en `src/start.ts`.

## Límites conocidos

- Un PIN compartido no identifica quién hizo cada recepción; para eso sigue estando el campo Operario del formulario (texto libre, como hoy).
- Si el PIN se filtra, hay que rotar el secreto `RECEPCION_PIN`.
- Tras crear o cambiar el secreto hay que publicar la app para que el valor llegue a producción.

## Verificación

- Llamada directa a `registrarRecepcion` sin cookie: rechazada, sin ejecutar la RPC.
- PIN correcto: acceso al formulario y `buscarEtiqueta` funcionando con `ET-0001`.
- PIN incorrecto: rechazo y bloqueo temporal tras varios intentos.
- Sin altas reales en Supabase durante las pruebas.

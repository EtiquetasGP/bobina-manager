-- Inventario ciego con mapeo. Instalar no inicia ni reinicia inventarios.
BEGIN;

CREATE TABLE IF NOT EXISTS public.inventarios_mapeo (
  id_inventario uuid PRIMARY KEY,
  sector text NOT NULL CHECK (sector ~ '^[A-Z]+$'),
  posicion text CHECK (posicion ~ '^[0-9]+$'),
  altura text CHECK (altura ~ '^[0-9]+$'),
  operario_id uuid NOT NULL,
  operario_nombre text NOT NULL CHECK (length(trim(operario_nombre)) BETWEEN 1 AND 200),
  estado text NOT NULL CHECK (estado IN ('PREPARANDO','EN_CURSO','FINALIZANDO','FINALIZADO','CANCELADO')),
  fecha_inicio timestamptz NOT NULL DEFAULT clock_timestamp(),
  fecha_finalizacion timestamptz,
  ubicacion_activa text,
  resultado jsonb,
  CHECK (altura IS NULL OR posicion IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS inventarios_mapeo_sector_activo
 ON public.inventarios_mapeo(sector) WHERE estado = 'EN_CURSO';
CREATE UNIQUE INDEX IF NOT EXISTS inventarios_mapeo_operario_activo
 ON public.inventarios_mapeo(operario_id) WHERE estado = 'EN_CURSO';

CREATE TABLE IF NOT EXISTS public.inventarios_mapeo_bobinas (
  id_inventario uuid NOT NULL REFERENCES public.inventarios_mapeo,
  codigo text NOT NULL,
  esperada boolean NOT NULL DEFAULT false,
  informacion_anterior jsonb,
  ubicacion_encontrada text,
  fecha_escaneo timestamptz,
  PRIMARY KEY(id_inventario,codigo)
);
CREATE INDEX IF NOT EXISTS inventarios_mapeo_codigo
 ON public.inventarios_mapeo_bobinas(codigo);
CREATE TABLE IF NOT EXISTS public.inventarios_mapeo_lecturas (
  id_lectura uuid PRIMARY KEY,
  id_inventario uuid NOT NULL REFERENCES public.inventarios_mapeo,
  codigo text NOT NULL,
  ubicacion text,
  fecha timestamptz NOT NULL DEFAULT clock_timestamp(),
  respuesta jsonb NOT NULL
);

ALTER TABLE public.inventarios_mapeo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventarios_mapeo_bobinas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventarios_mapeo_lecturas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.inventarios_mapeo, public.inventarios_mapeo_bobinas,
 public.inventarios_mapeo_lecturas FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT,UPDATE ON public.inventarios_mapeo, public.inventarios_mapeo_bobinas,
 public.inventarios_mapeo_lecturas TO service_role;

CREATE OR REPLACE FUNCTION public.inventario_mapeo_sector(p_ubicacion text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
 SELECT substring(upper(trim(p_ubicacion)) FROM '^([A-Z]+)');
$$;

-- Solo lectura: devuelve lecturas propias, nunca stock esperado mientras se cuenta.
CREATE OR REPLACE FUNCTION public.obtener_inventario_mapeo(p_operario_id uuid, p_id_inventario uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v public.inventarios_mapeo%rowtype; v_total integer;
BEGIN
 IF p_operario_id IS NULL THEN RAISE EXCEPTION 'Debe iniciar sesión.'; END IF;
 SELECT * INTO v FROM public.inventarios_mapeo
 WHERE operario_id=p_operario_id AND
 ((p_id_inventario IS NOT NULL AND id_inventario=p_id_inventario)
 OR (p_id_inventario IS NULL AND estado='EN_CURSO'))
 ORDER BY fecha_inicio DESC LIMIT 1;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF v.estado='FINALIZADO' THEN RETURN v.resultado; END IF;
 SELECT count(*) INTO v_total FROM public.inventarios_mapeo_bobinas
 WHERE id_inventario=v.id_inventario AND fecha_escaneo IS NOT NULL;
 RETURN jsonb_build_object('id_inventario',v.id_inventario,'sector',v.sector,
 'posicion',v.posicion,'altura',v.altura,'estado',v.estado,
 'fecha_inicio',v.fecha_inicio,'ubicacion_activa',v.ubicacion_activa,
 'total_escaneados',v_total);
END; $$;

CREATE OR REPLACE FUNCTION public.iniciar_inventario_mapeo(
 p_id_inventario uuid,p_sector text,p_posicion text,p_altura text,
 p_operario_id uuid,p_operario_nombre text)
RETURNS jsonb LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v_sector text:=upper(trim(p_sector)); v_pos text:=nullif(trim(p_posicion),'');
 v_alt text:=nullif(trim(p_altura),''); v public.inventarios_mapeo%rowtype;
BEGIN
 IF p_id_inventario IS NULL OR p_operario_id IS NULL THEN RAISE EXCEPTION 'Falta identificar inventario u operario.'; END IF;
 IF v_sector IS NULL OR v_sector !~ '^[A-Z]+$' OR length(v_sector)>30 THEN RAISE EXCEPTION 'Ingrese un sector válido.'; END IF;
 IF (v_pos IS NOT NULL AND v_pos !~ '^[0-9]+$') OR
 (v_alt IS NOT NULL AND v_alt !~ '^[0-9]+$') OR (v_alt IS NOT NULL AND v_pos IS NULL)
 THEN RAISE EXCEPTION 'Posición o altura inválida.'; END IF;
 IF p_operario_nombre IS NULL OR length(trim(p_operario_nombre)) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Falta el nombre del operario.'; END IF;
 PERFORM pg_advisory_xact_lock(719261026);
 SELECT * INTO v FROM public.inventarios_mapeo WHERE id_inventario=p_id_inventario FOR UPDATE;
 IF FOUND THEN
  IF v.operario_id<>p_operario_id OR v.sector<>v_sector OR
  v.posicion IS DISTINCT FROM v_pos OR v.altura IS DISTINCT FROM v_alt
  THEN RAISE EXCEPTION 'El identificador corresponde a otro inventario.'; END IF;
  RETURN public.obtener_inventario_mapeo(p_operario_id,p_id_inventario);
 END IF;
 IF EXISTS(SELECT 1 FROM public.inventarios_mapeo WHERE estado='EN_CURSO' AND (sector=v_sector OR operario_id=p_operario_id))
 THEN RAISE EXCEPTION 'Ya hay un inventario activo para este sector o este operario. Retómelo antes de comenzar otro.'; END IF;
 -- Bloqueo breve durante la copia y el reinicio, no durante todo el conteo.
 LOCK TABLE public.bobinas IN SHARE ROW EXCLUSIVE MODE;
 INSERT INTO public.inventarios_mapeo(id_inventario,sector,posicion,altura,operario_id,operario_nombre,estado)
 VALUES(p_id_inventario,v_sector,v_pos,v_alt,p_operario_id,trim(p_operario_nombre),'PREPARANDO');
 INSERT INTO public.inventarios_mapeo_bobinas(id_inventario,codigo,esperada,informacion_anterior)
 SELECT p_id_inventario,b.id_bobina,true,to_jsonb(b) FROM public.bobinas b
 WHERE b.estado='ALMACEN' AND public.inventario_mapeo_sector(b.ubicacion)=v_sector
 AND (v_pos IS NULL OR split_part(upper(trim(b.ubicacion)),'.',2)=v_pos)
 AND (v_alt IS NULL OR split_part(upper(trim(b.ubicacion)),'.',3)=v_alt);
 IF EXISTS(SELECT 1 FROM public.picking_preparacion_bobinas p
 JOIN public.inventarios_mapeo_bobinas d ON d.codigo=p.id_bobina AND d.id_inventario=p_id_inventario
 WHERE p.fecha_liberacion IS NULL)
 THEN RAISE EXCEPTION 'Hay bobinas reservadas para picking en este alcance. Termine o libere esas preparaciones antes de inventariar.'; END IF;
 IF EXISTS(SELECT 1 FROM public.inventarios_mapeo_bobinas a
 JOIN public.inventarios_mapeo_bobinas d ON d.codigo=a.codigo AND d.id_inventario=p_id_inventario
 JOIN public.inventarios_mapeo h ON h.id_inventario=a.id_inventario
 WHERE h.estado='EN_CURSO') THEN RAISE EXCEPTION 'Una bobina ya participa de otro inventario activo.'; END IF;
 UPDATE public.bobinas b SET ubicacion=v_sector||'.0'
 FROM public.inventarios_mapeo_bobinas d
 WHERE d.id_inventario=p_id_inventario AND d.codigo=b.id_bobina;
 UPDATE public.inventarios_mapeo SET estado='EN_CURSO' WHERE id_inventario=p_id_inventario;
 RETURN public.obtener_inventario_mapeo(p_operario_id,p_id_inventario);
END; $$;

CREATE OR REPLACE FUNCTION public.registrar_lectura_inventario_mapeo(
 p_id_inventario uuid,p_id_lectura uuid,p_codigo text,p_ubicacion text,
 p_confirmar_traslado boolean,p_operario_id uuid)
RETURNS jsonb LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v public.inventarios_mapeo%rowtype; d public.inventarios_mapeo_bobinas%rowtype;
 v_codigo text:=upper(trim(p_codigo)); v_ubic text:=upper(trim(p_ubicacion));
 v_bobina jsonb; r jsonb; v_evento public.inventarios_mapeo_lecturas%rowtype;
BEGIN
 IF p_id_lectura IS NULL OR p_operario_id IS NULL OR v_codigo IS NULL OR length(v_codigo) NOT BETWEEN 1 AND 100
 THEN RAISE EXCEPTION 'Lectura inválida.'; END IF;
 PERFORM pg_advisory_xact_lock(719261026);
 SELECT * INTO v FROM public.inventarios_mapeo WHERE id_inventario=p_id_inventario FOR UPDATE;
 IF NOT FOUND OR v.operario_id<>p_operario_id THEN RAISE EXCEPTION 'No se encontró un inventario de este operario.'; END IF;
 SELECT * INTO v_evento FROM public.inventarios_mapeo_lecturas WHERE id_lectura=p_id_lectura;
 IF FOUND THEN
  IF v_evento.id_inventario<>p_id_inventario OR v_evento.codigo<>v_codigo OR v_evento.ubicacion IS DISTINCT FROM v_ubic
  THEN RAISE EXCEPTION 'Identificador de lectura ya utilizado.'; END IF;
  RETURN v_evento.respuesta;
 END IF;
 IF v.estado<>'EN_CURSO' THEN RAISE EXCEPTION 'Este inventario ya está cerrado.'; END IF;
 IF v_codigo ~ '^[A-Z]+[.][0-9]+[.][0-9]+$' THEN
  v_ubic:=v_codigo;
  IF split_part(v_ubic,'.',1)<>v.sector OR
  (v.posicion IS NOT NULL AND split_part(v_ubic,'.',2)<>v.posicion) OR
  (v.altura IS NOT NULL AND split_part(v_ubic,'.',3)<>v.altura)
  THEN RAISE EXCEPTION 'La ubicación escaneada está fuera del alcance seleccionado.'; END IF;
  UPDATE public.inventarios_mapeo SET ubicacion_activa=v_ubic WHERE id_inventario=p_id_inventario;
  r:=jsonb_build_object('tipo','UBICACION','codigo',v_codigo,'ubicacion_activa',v_ubic,'mensaje','Ubicación seleccionada. Escanee sus bobinas.');
 ELSE
  IF v_codigo ~ '^[A-Z]+[.]' THEN RAISE EXCEPTION 'Ubicación inválida. Use el formato B.01.01.'; END IF;
  IF v_ubic IS NULL OR v_ubic !~ '^[A-Z]+[.][0-9]+[.][0-9]+$' OR
  split_part(v_ubic,'.',1)<>v.sector OR
  (v.posicion IS NOT NULL AND split_part(v_ubic,'.',2)<>v.posicion) OR
  (v.altura IS NOT NULL AND split_part(v_ubic,'.',3)<>v.altura)
  THEN RAISE EXCEPTION 'Escanee primero una ubicación válida del alcance seleccionado.'; END IF;
  SELECT * INTO d FROM public.inventarios_mapeo_bobinas WHERE id_inventario=p_id_inventario AND codigo=v_codigo;
  IF d.fecha_escaneo IS NOT NULL AND d.ubicacion_encontrada<>v_ubic AND NOT coalesce(p_confirmar_traslado,false) THEN
   RETURN jsonb_build_object('tipo','CONFIRMAR','codigo',v_codigo,'ubicacion_anterior_lectura',d.ubicacion_encontrada,
   'ubicacion_activa',v_ubic,'mensaje','Esta bobina ya fue escaneada en otra ubicación. Confirme dónde está físicamente.');
  END IF;
  SELECT to_jsonb(b) INTO v_bobina FROM public.bobinas b WHERE b.id_bobina=v_codigo FOR UPDATE;
  IF EXISTS(SELECT 1 FROM public.inventarios_mapeo_bobinas x JOIN public.inventarios_mapeo h USING(id_inventario)
   WHERE x.codigo=v_codigo AND h.estado='EN_CURSO' AND h.id_inventario<>p_id_inventario)
  THEN RAISE EXCEPTION 'La bobina participa de otro inventario activo.'; END IF;
  IF v_bobina->>'estado'='ALMACEN' AND EXISTS(SELECT 1 FROM public.picking_preparacion_bobinas
   WHERE id_bobina=v_codigo AND fecha_liberacion IS NULL)
  THEN RAISE EXCEPTION 'La bobina está reservada para picking. Libérela antes de registrarla.'; END IF;
  INSERT INTO public.inventarios_mapeo_bobinas(id_inventario,codigo,informacion_anterior,ubicacion_encontrada,fecha_escaneo)
  VALUES(p_id_inventario,v_codigo,v_bobina,v_ubic,clock_timestamp())
  ON CONFLICT(id_inventario,codigo) DO UPDATE SET
   ubicacion_encontrada=excluded.ubicacion_encontrada,
   fecha_escaneo=coalesce(public.inventarios_mapeo_bobinas.fecha_escaneo,excluded.fecha_escaneo);
  r:=jsonb_build_object('tipo','BOBINA','codigo',v_codigo,'ubicacion_activa',v_ubic,
   'duplicado',d.fecha_escaneo IS NOT NULL,'mensaje',CASE WHEN d.fecha_escaneo IS NOT NULL
   THEN 'Lectura registrada; la bobina se cuenta una sola vez.' ELSE 'Código registrado.' END);
 END IF;
 r:=r||jsonb_build_object('total_escaneados',(SELECT count(*) FROM public.inventarios_mapeo_bobinas
 WHERE id_inventario=p_id_inventario AND fecha_escaneo IS NOT NULL));
 INSERT INTO public.inventarios_mapeo_lecturas(id_lectura,id_inventario,codigo,ubicacion,respuesta)
 VALUES(p_id_lectura,p_id_inventario,v_codigo,CASE WHEN r->>'tipo'='UBICACION' THEN p_ubicacion ELSE v_ubic END,r);
 RETURN r;
END; $$;

CREATE OR REPLACE FUNCTION public.finalizar_inventario_mapeo(p_id_inventario uuid,p_operario_id uuid)
RETURNS jsonb LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v public.inventarios_mapeo%rowtype; d public.inventarios_mapeo_bobinas%rowtype;
 b public.bobinas%rowtype; filas jsonb:='[]'; f jsonb; r jsonb; tipo text;
BEGIN
 PERFORM pg_advisory_xact_lock(719261026);
 SELECT * INTO v FROM public.inventarios_mapeo WHERE id_inventario=p_id_inventario FOR UPDATE;
 IF NOT FOUND OR p_operario_id IS NULL OR v.operario_id<>p_operario_id THEN RAISE EXCEPTION 'Inventario no disponible para este operario.'; END IF;
 IF v.estado='FINALIZADO' THEN RETURN v.resultado; END IF;
 IF v.estado<>'EN_CURSO' THEN RAISE EXCEPTION 'El inventario está cerrado.'; END IF;
 UPDATE public.inventarios_mapeo SET estado='FINALIZANDO' WHERE id_inventario=p_id_inventario;
 FOR d IN SELECT * FROM public.inventarios_mapeo_bobinas WHERE id_inventario=p_id_inventario ORDER BY codigo LOOP
  SELECT * INTO b FROM public.bobinas WHERE id_bobina=d.codigo FOR UPDATE;
  tipo:=CASE WHEN d.fecha_escaneo IS NULL THEN 'FALTANTE'
   WHEN d.informacion_anterior IS NULL THEN 'NO_RECONOCIDA'
   WHEN d.informacion_anterior->>'estado' IS DISTINCT FROM 'ALMACEN' THEN 'ESTADO_DISTINTO_DE_ALMACEN'
   WHEN NOT d.esperada THEN 'NO_ESPERADA'
   WHEN upper(trim(d.informacion_anterior->>'ubicacion')) IS DISTINCT FROM d.ubicacion_encontrada THEN 'DIFERENCIA_UBICACION'
   ELSE 'COINCIDE' END;
  IF d.informacion_anterior->>'estado'='ALMACEN' THEN
   IF b.id_bobina IS NULL OR b.estado IS DISTINCT FROM 'ALMACEN' THEN
    RAISE EXCEPTION 'La bobina % cambió durante el inventario. Revise antes de finalizar.',d.codigo;
   END IF;
   UPDATE public.bobinas SET ubicacion=CASE WHEN d.fecha_escaneo IS NULL THEN v.sector||'.0' ELSE d.ubicacion_encontrada END
   WHERE id_bobina=d.codigo RETURNING * INTO b;
  END IF;
  f:=jsonb_build_object('codigo',d.codigo,'esperada',d.esperada,'resultado',tipo,
   'informacion_anterior',d.informacion_anterior,'ubicacion_anterior',d.informacion_anterior->>'ubicacion',
   'ubicacion_encontrada',d.ubicacion_encontrada,'ubicacion_actual',b.ubicacion,
   'fecha_escaneo',d.fecha_escaneo);
  filas:=filas||jsonb_build_array(f);
 END LOOP;
 r:=jsonb_build_object('id_inventario',v.id_inventario,'sector',v.sector,'posicion',v.posicion,'altura',v.altura,
 'estado','FINALIZADO','fecha_inicio',v.fecha_inicio,'fecha_finalizacion',clock_timestamp(),
 'operario_nombre',v.operario_nombre,'filas',filas,'resumen',(SELECT jsonb_build_object(
 'esperadas',count(*) FILTER(WHERE (x->>'esperada')::boolean),
 'escaneadas',count(*) FILTER(WHERE x->>'fecha_escaneo' IS NOT NULL),
 'faltantes',count(*) FILTER(WHERE x->>'resultado'='FALTANTE'),
 'no_esperadas',count(*) FILTER(WHERE x->>'resultado'='NO_ESPERADA'),
 'diferencias_ubicacion',count(*) FILTER(WHERE x->>'resultado'='DIFERENCIA_UBICACION'),
 'no_reconocidas',count(*) FILTER(WHERE x->>'resultado'='NO_RECONOCIDA'),
 'otro_estado',count(*) FILTER(WHERE x->>'resultado'='ESTADO_DISTINTO_DE_ALMACEN')) FROM jsonb_array_elements(filas) x));
 UPDATE public.inventarios_mapeo SET estado='FINALIZADO',fecha_finalizacion=(r->>'fecha_finalizacion')::timestamptz,resultado=r
 WHERE id_inventario=p_id_inventario;
 RETURN r;
END; $$;

CREATE OR REPLACE FUNCTION public.cancelar_inventario_mapeo(p_id_inventario uuid,p_operario_id uuid)
RETURNS jsonb LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v public.inventarios_mapeo%rowtype;
BEGIN
 PERFORM pg_advisory_xact_lock(719261026);
 SELECT * INTO v FROM public.inventarios_mapeo WHERE id_inventario=p_id_inventario FOR UPDATE;
 IF NOT FOUND OR p_operario_id IS NULL OR v.operario_id<>p_operario_id THEN RAISE EXCEPTION 'Inventario no disponible para este operario.'; END IF;
 IF v.estado='CANCELADO' THEN RETURN jsonb_build_object('estado','CANCELADO'); END IF;
 IF v.estado<>'EN_CURSO' THEN RAISE EXCEPTION 'No se puede cancelar un inventario finalizado.'; END IF;
 UPDATE public.inventarios_mapeo SET estado='CANCELADO',fecha_finalizacion=clock_timestamp() WHERE id_inventario=p_id_inventario;
 UPDATE public.bobinas b SET ubicacion=d.informacion_anterior->>'ubicacion'
 FROM public.inventarios_mapeo_bobinas d WHERE d.id_inventario=p_id_inventario AND d.esperada AND b.id_bobina=d.codigo;
 RETURN jsonb_build_object('estado','CANCELADO');
END; $$;

-- Impide que movimientos simultáneos alteren las bobinas que se están contando.
-- SECURITY DEFINER únicamente para consultar la reserva privada desde el trigger.
CREATE OR REPLACE FUNCTION public.proteger_bobina_inventario_mapeo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF TG_OP='UPDATE' AND NEW.id_bobina IS NOT DISTINCT FROM OLD.id_bobina
 AND NEW.ubicacion IS NOT DISTINCT FROM OLD.ubicacion AND NEW.estado IS NOT DISTINCT FROM OLD.estado
 AND NEW.cantidad_actual IS NOT DISTINCT FROM OLD.cantidad_actual THEN RETURN NEW; END IF;
 IF EXISTS(SELECT 1 FROM public.inventarios_mapeo_bobinas d JOIN public.inventarios_mapeo h USING(id_inventario)
 WHERE d.codigo=OLD.id_bobina AND h.estado='EN_CURSO' AND d.informacion_anterior->>'estado'='ALMACEN')
 THEN RAISE EXCEPTION 'La bobina % está en un inventario en curso. Finalícelo o cancélelo antes de moverla.',OLD.id_bobina; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS proteger_bobina_inventario_mapeo ON public.bobinas;
CREATE TRIGGER proteger_bobina_inventario_mapeo BEFORE UPDATE OR DELETE ON public.bobinas
 FOR EACH ROW EXECUTE FUNCTION public.proteger_bobina_inventario_mapeo();

CREATE OR REPLACE FUNCTION public.proteger_reserva_inventario_mapeo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF NEW.fecha_liberacion IS NULL AND EXISTS(SELECT 1 FROM public.inventarios_mapeo_bobinas d
 JOIN public.inventarios_mapeo h USING(id_inventario)
 WHERE d.codigo=NEW.id_bobina AND h.estado='EN_CURSO' AND d.informacion_anterior->>'estado'='ALMACEN')
 THEN RAISE EXCEPTION 'La bobina está en un inventario en curso. No puede reservarse para picking.'; END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS proteger_reserva_inventario_mapeo ON public.picking_preparacion_bobinas;
CREATE TRIGGER proteger_reserva_inventario_mapeo BEFORE INSERT OR UPDATE ON public.picking_preparacion_bobinas
 FOR EACH ROW EXECUTE FUNCTION public.proteger_reserva_inventario_mapeo();

REVOKE ALL ON FUNCTION public.inventario_mapeo_sector(text),public.obtener_inventario_mapeo(uuid,uuid),
 public.iniciar_inventario_mapeo(uuid,text,text,text,uuid,text),
 public.registrar_lectura_inventario_mapeo(uuid,uuid,text,text,boolean,uuid),
 public.finalizar_inventario_mapeo(uuid,uuid),public.cancelar_inventario_mapeo(uuid,uuid),
 public.proteger_bobina_inventario_mapeo(),public.proteger_reserva_inventario_mapeo()
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.inventario_mapeo_sector(text),public.obtener_inventario_mapeo(uuid,uuid),
 public.iniciar_inventario_mapeo(uuid,text,text,text,uuid,text),
 public.registrar_lectura_inventario_mapeo(uuid,uuid,text,text,boolean,uuid),
 public.finalizar_inventario_mapeo(uuid,uuid),public.cancelar_inventario_mapeo(uuid,uuid) TO service_role;
COMMIT;

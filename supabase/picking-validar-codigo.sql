-- Picking: el código completo define la compatibilidad.
CREATE OR REPLACE FUNCTION public.agregar_bobina_preparacion_picking(p_id_preparacion uuid, p_id_item_picking bigint, p_id_bobina text, p_cantidad bigint, p_sentido_bobinado text, p_operario_id uuid, p_operario_nombre text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
    v_codigo text := upper(btrim(p_id_bobina));
    v_nombre text := btrim(p_operario_nombre);
    v_sentido text := nullif(btrim(p_sentido_bobinado), '');
    v_preparacion public.picking_preparaciones%ROWTYPE;
    v_item public.picking_plan%ROWTYPE;
    v_bobina public.bobinas%ROWTYPE;
    v_detalle public.picking_preparacion_bobinas%ROWTYPE;
    v_id_detalle uuid;
BEGIN
    IF p_id_preparacion IS NULL OR p_id_item_picking IS NULL THEN
        RAISE EXCEPTION 'Debe indicar la preparación y el insumo.';
    END IF;
    IF v_codigo IS NULL OR v_codigo = '' THEN
        RAISE EXCEPTION 'Debe indicar el código de la bobina.';
    END IF;
    IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
        RAISE EXCEPTION 'La cantidad debe ser mayor a cero.';
    END IF;
    IF p_operario_id IS NULL OR v_nombre IS NULL OR v_nombre = '' THEN
        RAISE EXCEPTION 'No se pudo identificar al operario. Inicie sesión nuevamente.';
    END IF;
    IF length(v_sentido) > 100 THEN
        RAISE EXCEPTION 'El sentido de bobinado no puede superar los 100 caracteres.';
    END IF;

    SELECT pr.* INTO v_preparacion
    FROM public.picking_preparaciones pr
    WHERE pr.id_preparacion = p_id_preparacion;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'La preparación no existe.';
    END IF;

    PERFORM p.id_item_picking
    FROM public.picking_plan p
    WHERE p.wo = v_preparacion.wo
      AND p.fecha_programada = v_preparacion.fecha_programada
      AND p.linea = v_preparacion.linea
    ORDER BY p.id_item_picking
    FOR UPDATE;

    SELECT pr.* INTO v_preparacion
    FROM public.picking_preparaciones pr
    WHERE pr.id_preparacion = p_id_preparacion
    FOR UPDATE;
    IF v_preparacion.estado = 'ENTREGADA' THEN
        RAISE EXCEPTION 'La preparación ya fue entregada y no admite modificaciones.';
    END IF;

    SELECT p.* INTO v_item
    FROM public.picking_plan p
    WHERE p.id_item_picking = p_id_item_picking
      AND p.wo = v_preparacion.wo
      AND p.fecha_programada = v_preparacion.fecha_programada
      AND p.linea = v_preparacion.linea
      AND p.estado_plan = 'ACTIVA';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'El insumo no pertenece al plan activo de esta preparación.';
    END IF;
    IF EXISTS (
        SELECT 1 FROM public.picking_plan p
        WHERE p.wo = v_preparacion.wo
          AND p.fecha_programada = v_preparacion.fecha_programada
          AND p.linea = v_preparacion.linea
          AND p.estado_plan = 'REQUIERE_REVISION'
    ) THEN
        RAISE EXCEPTION 'La WO requiere revisión del plan antes de continuar.';
    END IF;

    SELECT b.* INTO v_bobina
    FROM public.bobinas b
    WHERE b.id_bobina = v_codigo
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'La bobina % no existe.', v_codigo;
    END IF;

    SELECT d.* INTO v_detalle
    FROM public.picking_preparacion_bobinas d
    WHERE upper(btrim(d.id_bobina)) = v_codigo
      AND d.fecha_liberacion IS NULL;
    IF FOUND THEN
        IF v_detalle.id_preparacion = p_id_preparacion
           AND v_detalle.id_item_picking = p_id_item_picking
           AND v_detalle.cantidad = p_cantidad
           AND v_detalle.sentido_bobinado IS NOT DISTINCT FROM v_sentido THEN
            RETURN jsonb_build_object(
                'ok', true, 'duplicada', true,
                'id_preparacion', p_id_preparacion,
                'id_detalle', v_detalle.id_detalle,
                'estado', v_preparacion.estado,
                'mensaje', 'La bobina ya estaba guardada en esta preparación.'
            );
        END IF;
        IF v_detalle.id_preparacion = p_id_preparacion THEN
            RAISE EXCEPTION 'La bobina % ya está seleccionada con otros datos. Quite la selección anterior antes de cambiarla.', v_codigo;
        END IF;
        RAISE EXCEPTION 'La bobina % está reservada en otra preparación.', v_codigo;
    END IF;
    IF v_preparacion.estado = 'LISTA' THEN
        RAISE EXCEPTION 'La preparación está lista. Debe reabrirla antes de agregar bobinas.';
    END IF;
    IF upper(btrim(coalesce(v_bobina.estado, ''))) <> 'ALMACEN' THEN
        RAISE EXCEPTION 'La bobina % no está disponible en ALMACEN.', v_codigo;
    END IF;
    IF v_bobina.cantidad_actual IS NULL OR p_cantidad > v_bobina.cantidad_actual THEN
        RAISE EXCEPTION 'La bobina % no tiene cantidad suficiente. Disponible: %.',
            v_codigo, coalesce(v_bobina.cantidad_actual, 0);
    END IF;
    IF upper(btrim(coalesce(v_bobina.codigo_etiqueta, '')))
       <> upper(btrim(coalesce(v_item.codigo_etiqueta, ''))) THEN
        RAISE EXCEPTION 'Código incorrecto. Se requiere % y la bobina contiene %.',
            v_item.codigo_etiqueta, v_bobina.codigo_etiqueta;
    END IF;

    -- VX y cliente se conservan como información; no condicionan la selección.
    INSERT INTO public.picking_preparacion_bobinas (
        id_preparacion, id_item_picking, id_bobina, cantidad,
        sentido_bobinado, insumo_snapshot,
        operario_seleccion_id, operario_seleccion_nombre
    ) VALUES (
        p_id_preparacion, p_id_item_picking, v_codigo, p_cantidad,
        v_sentido, to_jsonb(v_item), p_operario_id, v_nombre
    ) RETURNING id_detalle INTO v_id_detalle;

    UPDATE public.picking_preparaciones
    SET estado = 'PARCIAL', fecha_actualizacion = clock_timestamp()
    WHERE id_preparacion = p_id_preparacion;

    RETURN jsonb_build_object(
        'ok', true, 'duplicada', false,
        'id_preparacion', p_id_preparacion,
        'id_detalle', v_id_detalle, 'estado', 'PARCIAL',
        'mensaje', 'Bobina guardada y reservada correctamente.'
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.dividir_bobina_preparacion_picking(p_id_detalle uuid, p_operario_id uuid, p_operario_nombre text, p_fecha_entrega timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
    v_detalle public.picking_preparacion_bobinas%ROWTYPE;
    v_preparacion public.picking_preparaciones%ROWTYPE;
    v_bobina public.bobinas%ROWTYPE;
    v_item public.picking_plan%ROWTYPE;
    v_division public.divisiones_bobinas%ROWTYPE;

    v_nombre text := nullif(btrim(p_operario_nombre), '');

    v_raiz text;
    v_id_origen text;
    v_id_remanente text;
    v_id_salida text;

    v_remanente bigint;
    v_fecha_local date;
BEGIN

    IF p_id_detalle IS NULL THEN
        RAISE EXCEPTION 'Debe indicar la selección de bobina.';
    END IF;

    IF p_operario_id IS NULL OR v_nombre IS NULL THEN
        RAISE EXCEPTION 'No se pudo identificar al operario.';
    END IF;

    IF p_fecha_entrega IS NULL THEN
        RAISE EXCEPTION 'Debe indicar la fecha de entrega.';
    END IF;

    SELECT d.*
    INTO v_detalle
    FROM public.picking_preparacion_bobinas d
    WHERE d.id_detalle = p_id_detalle;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La selección de bobina no existe.';
    END IF;

    SELECT pr.*
    INTO STRICT v_preparacion
    FROM public.picking_preparaciones pr
    WHERE pr.id_preparacion = v_detalle.id_preparacion;

    -- Mantener el orden de bloqueo del circuito de Picking.
    PERFORM p.id_item_picking
    FROM public.picking_plan p
    WHERE p.wo = v_preparacion.wo
      AND p.fecha_programada = v_preparacion.fecha_programada
      AND p.linea = v_preparacion.linea
    ORDER BY p.id_item_picking
    FOR UPDATE;

    SELECT pr.*
    INTO STRICT v_preparacion
    FROM public.picking_preparaciones pr
    WHERE pr.id_preparacion = v_detalle.id_preparacion
    FOR UPDATE;

    SELECT d.*
    INTO STRICT v_detalle
    FROM public.picking_preparacion_bobinas d
    WHERE d.id_detalle = p_id_detalle
    FOR UPDATE;

    -- Una selección ya dividida no genera otra división.
    SELECT d.*
    INTO v_division
    FROM public.divisiones_bobinas d
    WHERE d.id_detalle_preparacion = p_id_detalle;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'ok', true,
            'ya_dividida', true,
            'division', to_jsonb(v_division)
        );
    END IF;

    IF v_preparacion.estado <> 'LISTA' THEN
        RAISE EXCEPTION
            'La preparación debe estar Lista para dividir la bobina al entregar.';
    END IF;

    IF v_detalle.fecha_liberacion IS NOT NULL THEN
        RAISE EXCEPTION 'La selección ya no tiene una reserva activa.';
    END IF;

    SELECT p.*
    INTO v_item
    FROM public.picking_plan p
    WHERE p.id_item_picking = v_detalle.id_item_picking
      AND p.wo = v_preparacion.wo
      AND p.fecha_programada = v_preparacion.fecha_programada
      AND p.linea = v_preparacion.linea
      AND p.estado_plan = 'ACTIVA';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El insumo ya no pertenece al plan activo.';
    END IF;

    SELECT b.*
    INTO v_bobina
    FROM public.bobinas b
    WHERE b.id_bobina = v_detalle.id_bobina
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La bobina seleccionada ya no existe.';
    END IF;

    IF upper(btrim(coalesce(v_bobina.estado, ''))) <> 'ALMACEN' THEN
        RAISE EXCEPTION 'La bobina debe estar en ALMACEN.';
    END IF;

    IF v_detalle.cantidad <= 0
       OR v_detalle.cantidad >= v_bobina.cantidad_actual THEN
        RAISE EXCEPTION
            'La división requiere una cantidad mayor a cero y menor que la cantidad actual.';
    END IF;

    IF upper(btrim(v_bobina.codigo_etiqueta))
       <> upper(btrim(v_item.codigo_etiqueta)) THEN
        RAISE EXCEPTION
            'La bobina no coincide con el código solicitado.';
    END IF;

    v_id_origen := v_bobina.id_bobina;

    IF v_id_origen ~ '^CQ-[0-9]+$' THEN
        v_raiz := v_id_origen;
        v_id_remanente := v_raiz || '-00';

    ELSIF v_id_origen ~ '^CQ-[0-9]+-00$' THEN
        v_raiz := left(
            v_id_origen,
            length(v_id_origen) - 3
        );
        v_id_remanente := v_id_origen;

    ELSE
        RAISE EXCEPTION
            'Esta función permite dividir una bobina original o su remanente -00. El código % requiere otro tratamiento.',
            v_id_origen;
    END IF;

    IF v_id_origen <> v_id_remanente
       AND EXISTS (
           SELECT 1
           FROM public.bobinas b
           WHERE b.id_bobina = v_id_remanente
       ) THEN
        RAISE EXCEPTION
            'Ya existe el código remanente %. Revise la bobina antes de continuar.',
            v_id_remanente;
    END IF;

    v_id_salida :=
        public.reservar_codigo_parte_bobina(v_raiz);

    v_remanente :=
        v_bobina.cantidad_actual - v_detalle.cantidad;

    v_fecha_local :=
        (
            p_fecha_entrega
            AT TIME ZONE 'America/Argentina/Mendoza'
        )::date;

    -- El historial en movimientos sigue al remanente
    -- mediante ON UPDATE CASCADE.
    UPDATE public.bobinas
    SET
        id_bobina = v_id_remanente,
        cantidad_actual = v_remanente
    WHERE id_bobina = v_id_origen;

    -- Esta tabla guarda códigos como texto, sin FK.
    -- Actualizar las referencias al código renombrado.
    IF v_id_origen <> v_id_remanente THEN
        UPDATE public.picking_preparacion_bobinas
        SET id_bobina = v_id_remanente
        WHERE id_bobina = v_id_origen;
    END IF;

    INSERT INTO public.bobinas (
        id_bobina,
        codigo_etiqueta,
        descripcion,
        cantidad_actual,
        proveedor,
        ubicacion,
        fecha_ingreso,
        fecha_vencimiento,
        vigencia,
        estado,
        origen_alta,
        "año",
        alcohol,
        vx,
        cliente,
        fecha_salida_linea,
        fecha_inicio_linea,
        ultima_linea,
        ultima_wo,
        ultima_fecha_devolucion,
        ultimo_operario_devolucion
    )
    VALUES (
        v_id_salida,
        v_bobina.codigo_etiqueta,
        v_bobina.descripcion,
        v_detalle.cantidad,
        v_bobina.proveedor,
        v_bobina.ubicacion,
        v_bobina.fecha_ingreso,
        v_bobina.fecha_vencimiento,
        v_bobina.vigencia,
        'LINEA',
        'DIVISION',
        v_bobina."año",
        v_bobina.alcohol,
        v_bobina.vx,
        v_bobina.cliente,
        p_fecha_entrega,
        v_fecha_local,
        v_preparacion.linea,
        v_preparacion.wo,
        v_bobina.ultima_fecha_devolucion,
        v_bobina.ultimo_operario_devolucion
    );

    -- El trigger de INSERT recalcula el vencimiento.
    -- Conservar exactamente el vencimiento del origen.
    UPDATE public.bobinas
    SET fecha_vencimiento = v_bobina.fecha_vencimiento
    WHERE id_bobina = v_id_salida;

    INSERT INTO public.movimientos (
        id_bobina,
        tipo_movimiento,
        fecha,
        cantidad,
        linea,
        operario,
        ubicacion,
        observacion,
        wo,
        fecha_programada,
        sentido_bobinado,
        cantidad_antes,
        cantidad_despues,
        es_parcial,
        codigo_etiqueta,
        descripcion,
        "año",
        alcohol,
        vx,
        cliente,
        id_item_picking
    )
    VALUES (
        v_id_salida,
        'SALIDA_LINEA',
        p_fecha_entrega,
        v_detalle.cantidad,
        v_preparacion.linea,
        v_nombre,
        v_bobina.ubicacion,
        'DIVISION DE ' || v_id_origen
            || ' - REMANENTE ' || v_id_remanente
            || ' - PICKING WO ' || v_preparacion.wo,
        v_preparacion.wo,
        v_preparacion.fecha_programada,
        v_detalle.sentido_bobinado,
        v_detalle.cantidad,
        v_detalle.cantidad,
        true,
        v_item.codigo_etiqueta,
        v_item.descripcion,
        v_item."año",
        v_item.alcohol,
        v_item.vx,
        v_item.cliente,
        v_item.id_item_picking
    );

    INSERT INTO public.divisiones_bobinas (
        id_preparacion,
        id_detalle_preparacion,
        id_bobina_origen,
        id_bobina_remanente,
        id_bobina_salida,
        cantidad_antes,
        cantidad_remanente,
        cantidad_salida,
        fecha_ingreso_original,
        fecha_vencimiento_original,
        datos_bobina_origen,
        operario_id,
        operario_nombre,
        fecha_division
    )
    VALUES (
        v_preparacion.id_preparacion,
        p_id_detalle,
        v_id_origen,
        v_id_remanente,
        v_id_salida,
        v_bobina.cantidad_actual,
        v_remanente,
        v_detalle.cantidad,
        v_bobina.fecha_ingreso,
        v_bobina.fecha_vencimiento,
        to_jsonb(v_bobina),
        p_operario_id,
        v_nombre,
        p_fecha_entrega
    )
    RETURNING *
    INTO v_division;

    RETURN jsonb_build_object(
        'ok', true,
        'ya_dividida', false,
        'division', to_jsonb(v_division)
    );

END;
$function$;

CREATE OR REPLACE FUNCTION public.marcar_preparacion_picking_lista(p_id_preparacion uuid, p_operario_id uuid, p_operario_nombre text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
    v_nombre text := btrim(p_operario_nombre);
    v_preparacion public.picking_preparaciones%ROWTYPE;
    v_item public.picking_plan%ROWTYPE;
    v_bobina public.bobinas%ROWTYPE;
    v_detalle public.picking_preparacion_bobinas%ROWTYPE;
    v_preparada numeric;
    v_total_bobinas bigint;
BEGIN
    IF p_id_preparacion IS NULL THEN
        RAISE EXCEPTION 'Debe indicar la preparación.';
    END IF;
    IF p_operario_id IS NULL OR v_nombre IS NULL OR v_nombre = '' THEN
        RAISE EXCEPTION 'No se pudo identificar al operario. Inicie sesión nuevamente.';
    END IF;
    SELECT pr.* INTO v_preparacion
    FROM public.picking_preparaciones pr
    WHERE pr.id_preparacion = p_id_preparacion;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'La preparación no existe.';
    END IF;

    PERFORM p.id_item_picking
    FROM public.picking_plan p
    WHERE p.wo = v_preparacion.wo
      AND p.fecha_programada = v_preparacion.fecha_programada
      AND p.linea = v_preparacion.linea
    ORDER BY p.id_item_picking
    FOR UPDATE;

    SELECT pr.* INTO v_preparacion
    FROM public.picking_preparaciones pr
    WHERE pr.id_preparacion = p_id_preparacion
    FOR UPDATE;
    IF v_preparacion.estado = 'ENTREGADA' THEN
        RAISE EXCEPTION 'La preparación ya fue entregada.';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM public.picking_plan p
        WHERE p.wo = v_preparacion.wo
          AND p.fecha_programada = v_preparacion.fecha_programada
          AND p.linea = v_preparacion.linea AND p.estado_plan = 'ACTIVA'
    ) THEN
        RAISE EXCEPTION 'La preparación ya no tiene insumos activos en el plan.';
    END IF;
    IF EXISTS (
        SELECT 1 FROM public.picking_plan p
        WHERE p.wo = v_preparacion.wo
          AND p.fecha_programada = v_preparacion.fecha_programada
          AND p.linea = v_preparacion.linea
          AND p.estado_plan = 'REQUIERE_REVISION'
    ) THEN
        RAISE EXCEPTION 'La WO requiere revisión del plan antes de continuar.';
    END IF;

    SELECT count(*) INTO v_total_bobinas
    FROM public.picking_preparacion_bobinas d
    WHERE d.id_preparacion = p_id_preparacion AND d.fecha_liberacion IS NULL;
    IF v_total_bobinas = 0 THEN
        RAISE EXCEPTION 'Debe seleccionar bobinas antes de marcar la preparación como Lista.';
    END IF;

    PERFORM b.id_bobina
    FROM public.bobinas b
    JOIN public.picking_preparacion_bobinas d ON d.id_bobina = b.id_bobina
    WHERE d.id_preparacion = p_id_preparacion AND d.fecha_liberacion IS NULL
    ORDER BY b.id_bobina
    FOR UPDATE OF b;

    FOR v_detalle IN
        SELECT d.* FROM public.picking_preparacion_bobinas d
        WHERE d.id_preparacion = p_id_preparacion AND d.fecha_liberacion IS NULL
        ORDER BY d.id_bobina
    LOOP
        SELECT p.* INTO v_item FROM public.picking_plan p
        WHERE p.id_item_picking = v_detalle.id_item_picking
          AND p.wo = v_preparacion.wo
          AND p.fecha_programada = v_preparacion.fecha_programada
          AND p.linea = v_preparacion.linea AND p.estado_plan = 'ACTIVA';
        IF NOT FOUND THEN
            RAISE EXCEPTION 'El insumo reservado con la bobina % ya no está activo. Quite esa selección y revise el plan.', v_detalle.id_bobina;
        END IF;

        -- Solo los cambios de código invalidan la identidad seleccionada.
        IF upper(btrim(coalesce(v_detalle.insumo_snapshot ->> 'codigo_etiqueta', '')))
              <> upper(btrim(coalesce(v_item.codigo_etiqueta, ''))) THEN
            RAISE EXCEPTION 'El código del insumo de la bobina % cambió en el plan. Quite esa selección y vuelva a verificarla.', v_detalle.id_bobina;
        END IF;

        SELECT b.* INTO v_bobina FROM public.bobinas b
        WHERE b.id_bobina = v_detalle.id_bobina;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'La bobina reservada % ya no existe.', v_detalle.id_bobina;
        END IF;
        IF upper(btrim(coalesce(v_bobina.estado, ''))) <> 'ALMACEN' THEN
            RAISE EXCEPTION 'La bobina % ya no está disponible en ALMACEN.', v_detalle.id_bobina;
        END IF;
        IF v_bobina.cantidad_actual IS NULL OR v_bobina.cantidad_actual < v_detalle.cantidad THEN
            RAISE EXCEPTION 'La bobina % ya no tiene cantidad suficiente. Reservada: %. Disponible: %.',
                v_detalle.id_bobina, v_detalle.cantidad, coalesce(v_bobina.cantidad_actual, 0);
        END IF;
        IF upper(btrim(coalesce(v_bobina.codigo_etiqueta, '')))
              <> upper(btrim(coalesce(v_item.codigo_etiqueta, ''))) THEN
            RAISE EXCEPTION 'La bobina % no coincide con el insumo solicitado. Revise el código.', v_detalle.id_bobina;
        END IF;
    END LOOP;

    -- Sumar todas las bobinas reservadas para cada insumo.
    FOR v_item IN
        SELECT p.* FROM public.picking_plan p
        WHERE p.wo = v_preparacion.wo
          AND p.fecha_programada = v_preparacion.fecha_programada
          AND p.linea = v_preparacion.linea AND p.estado_plan = 'ACTIVA'
        ORDER BY p.id_item_picking
    LOOP
        SELECT coalesce(sum(d.cantidad), 0) INTO v_preparada
        FROM public.picking_preparacion_bobinas d
        WHERE d.id_preparacion = p_id_preparacion
          AND d.id_item_picking = v_item.id_item_picking
          AND d.fecha_liberacion IS NULL;
        IF v_preparada < v_item.cantidad_requerida THEN
            RAISE EXCEPTION 'Falta completar el insumo %. Requerido: %. Preparado: %. Faltante: %.',
                v_item.codigo_etiqueta, v_item.cantidad_requerida,
                v_preparada, v_item.cantidad_requerida - v_preparada;
        END IF;
    END LOOP;

    IF v_preparacion.estado <> 'LISTA' THEN
        UPDATE public.picking_preparaciones
        SET estado = 'LISTA', fecha_lista = clock_timestamp(),
            operario_lista_id = p_operario_id, operario_lista_nombre = v_nombre,
            fecha_actualizacion = clock_timestamp()
        WHERE id_preparacion = p_id_preparacion;
    END IF;
    RETURN jsonb_build_object(
        'ok', true, 'id_preparacion', p_id_preparacion,
        'estado', 'LISTA', 'total_bobinas', v_total_bobinas,
        'mensaje', 'Preparación completa y lista para entregar.'
    );
END;
$function$;

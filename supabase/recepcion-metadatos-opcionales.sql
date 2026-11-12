CREATE OR REPLACE FUNCTION public.confirmar_recepcion_proveedor_con_datos(p_id_envio uuid, p_operario text, p_lineas jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
    v_item jsonb;
    v_detalle jsonb;
    v_resultado jsonb;

    v_id_pre_recepcion bigint;
    v_cantidad_recibida integer;
    v_anio text;
    v_alcohol text;

    v_ids text[];
BEGIN

    IF p_id_envio IS NULL THEN
        RAISE EXCEPTION 'Debe indicar el envío.';
    END IF;

    IF nullif(btrim(p_operario), '') IS NULL THEN
        RAISE EXCEPTION
            'No se pudo identificar al operario.';
    END IF;

    IF p_lineas IS NULL
       OR jsonb_typeof(p_lineas) <> 'array' THEN
        RAISE EXCEPTION
            'Debe informar los productos de la recepción.';
    END IF;

    IF jsonb_array_length(p_lineas) = 0 THEN
        RAISE EXCEPTION
            'Debe informar al menos un producto.';
    END IF;

    -- Cada producto debe aparecer una única vez.
    IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(p_lineas) AS x(item)
        GROUP BY
            nullif(btrim(x.item ->> 'id_pre_recepcion'), '')::bigint
        HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION
            'Un producto aparece más de una vez en la confirmación.';
    END IF;

    -- Validar todos los datos antes de crear bobinas.
    FOR v_item IN
        SELECT value
        FROM jsonb_array_elements(p_lineas)
    LOOP

        v_id_pre_recepcion :=
            nullif(btrim(v_item ->> 'id_pre_recepcion'), '')::bigint;

        v_cantidad_recibida :=
            nullif(btrim(v_item ->> 'cantidad_recibida'), '')::integer;

        IF v_id_pre_recepcion IS NULL THEN
            RAISE EXCEPTION
                'Falta identificar un producto de la recepción.';
        END IF;

        IF v_cantidad_recibida IS NULL
           OR v_cantidad_recibida < 0 THEN
            RAISE EXCEPTION
                'Debe indicar una cantidad de bobinas recibidas igual o mayor a cero.';
        END IF;

        -- Los productos que no se reciben ahora no requieren estos datos.
        IF v_cantidad_recibida > 0 THEN

            v_anio :=
                nullif(btrim(v_item ->> 'anio'), '');

            v_alcohol :=
                nullif(btrim(v_item ->> 'alcohol'), '');

            IF v_anio IS NOT NULL AND public.normalizar_anio(v_anio) IS NULL THEN
                RAISE EXCEPTION
                    'Debe indicar una añada válida para el producto de recepción %.',
                    v_id_pre_recepcion;
            END IF;

            IF v_alcohol IS NOT NULL AND public.normalizar_alcohol(v_alcohol) IS NULL THEN
                RAISE EXCEPTION
                    'Debe indicar un alcohol válido para el producto de recepción %.',
                    v_id_pre_recepcion;
            END IF;

        END IF;

    END LOOP;

    -- Reutilizar el circuito existente:
    -- valida pendientes, ubicación y corrección de cantidad;
    -- crea bobinas y actualiza la recepción parcial o completa.
    v_resultado := public.confirmar_recepcion_proveedor(
        p_id_envio,
        btrim(p_operario),
        p_lineas
    );

    -- Completar únicamente las bobinas creadas en esta confirmación.
    FOR v_detalle IN
        SELECT value
        FROM jsonb_array_elements(v_resultado -> 'detalles')
    LOOP

        v_id_pre_recepcion :=
            (v_detalle ->> 'id_pre_recepcion')::bigint;

        SELECT x.item
        INTO STRICT v_item
        FROM jsonb_array_elements(p_lineas) AS x(item)
        WHERE (x.item ->> 'id_pre_recepcion')::bigint
              = v_id_pre_recepcion;

        IF (v_item ->> 'cantidad_recibida')::integer > 0 THEN

            v_anio :=
                nullif(btrim(v_item ->> 'anio'), '');

            v_alcohol :=
                nullif(btrim(v_item ->> 'alcohol'), '');

            SELECT coalesce(
                array_agg(x.id_bobina),
                ARRAY[]::text[]
            )
            INTO v_ids
            FROM jsonb_array_elements_text(
                v_detalle -> 'ids_bobinas'
            ) AS x(id_bobina);

            UPDATE public.bobinas
            SET
                "año" = v_anio,
                alcohol = v_alcohol
            WHERE id_bobina = ANY(v_ids);

            UPDATE public.movimientos
            SET
                "año" = v_anio,
                alcohol = v_alcohol
            WHERE id_bobina = ANY(v_ids)
              AND tipo_movimiento = 'RECEPCION';

        END IF;

    END LOOP;

    RETURN v_resultado;

END;
$function$;

CREATE OR REPLACE FUNCTION public.registrar_recepcion_con_datos(p_codigo_etiqueta text, p_descripcion text, p_cantidad bigint, p_proveedor text, p_ubicacion text, p_operario text, p_anio text, p_alcohol text)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
    v_id_bobina text;
    v_anio text := nullif(btrim(p_anio), '');
    v_alcohol text := nullif(btrim(p_alcohol), '');
BEGIN

    IF nullif(btrim(p_codigo_etiqueta), '') IS NULL THEN
        RAISE EXCEPTION 'Debe indicar el código de etiqueta.';
    END IF;

    IF p_cantidad IS NULL
       OR p_cantidad <= 0
       OR p_cantidad > 1000000000 THEN
        RAISE EXCEPTION
            'La cantidad por bobina debe estar entre 1 y 1000000000.';
    END IF;

    IF nullif(btrim(p_proveedor), '') IS NULL THEN
        RAISE EXCEPTION 'Debe indicar el proveedor.';
    END IF;

    IF nullif(btrim(p_ubicacion), '') IS NULL THEN
        RAISE EXCEPTION 'Debe indicar la ubicación.';
    END IF;

    IF nullif(btrim(p_operario), '') IS NULL THEN
        RAISE EXCEPTION
            'No se pudo identificar al operario.';
    END IF;

    IF v_anio IS NOT NULL AND public.normalizar_anio(v_anio) IS NULL THEN
        RAISE EXCEPTION
            'Debe indicar una añada válida, por ejemplo 2026.';
    END IF;

    IF v_alcohol IS NOT NULL AND public.normalizar_alcohol(v_alcohol) IS NULL THEN
        RAISE EXCEPTION
            'Debe indicar un alcohol válido, por ejemplo 12,5%%.';
    END IF;

    v_id_bobina := public.registrar_recepcion(
        btrim(p_codigo_etiqueta),
        btrim(p_descripcion),
        p_cantidad,
        btrim(p_proveedor),
        btrim(p_ubicacion),
        btrim(p_operario)
    );

    UPDATE public.bobinas
    SET
        "año" = v_anio,
        alcohol = v_alcohol
    WHERE id_bobina = v_id_bobina;

    UPDATE public.movimientos
    SET
        "año" = v_anio,
        alcohol = v_alcohol
    WHERE id_bobina = v_id_bobina
      AND tipo_movimiento = 'RECEPCION';

    RETURN v_id_bobina;

END;
$function$;

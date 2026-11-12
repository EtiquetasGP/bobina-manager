CREATE OR REPLACE FUNCTION public.listar_bobinas_picking(p_codigo_etiqueta text, p_limite integer DEFAULT 50)
 RETURNS TABLE(id_bobina text, codigo_etiqueta text, descripcion text, cantidad_actual bigint, fecha_ingreso date, proveedor text, ubicacion text, estado text, "año" text, alcohol text, vx text, cliente text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    select
        b.id_bobina,
        b.codigo_etiqueta,
        b.descripcion,
        b.cantidad_actual,
        b.fecha_ingreso,
        b.proveedor,
        b.ubicacion,
        b.estado,
        b."año",
        b.alcohol,
        b.vx,
        b.cliente
    from public.bobinas b
    where upper(trim(b.codigo_etiqueta)) = upper(trim(p_codigo_etiqueta))
      and upper(trim(coalesce(b.estado, ''))) = 'ALMACEN'
      and b.cantidad_actual > 0
      and not exists (
        select 1 from public.picking_preparacion_bobinas d
        where upper(btrim(d.id_bobina)) = upper(btrim(b.id_bobina))
          and d.fecha_liberacion is null
      )
    order by
        b.fecha_ingreso asc,
        b.id_bobina asc
    limit least(greatest(coalesce(p_limite, 50), 1), 100);
$function$;

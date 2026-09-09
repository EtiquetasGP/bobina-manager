export type ZebraLabelData = {
  id_bobina: string;
  codigo_etiqueta: string;
  descripcion: string;
  cantidad: number | string;
};

function limpiarTextoZpl(valor: string) {
  return valor
    .replace(/\^/g, " ")
    .replace(/~/g, " ")
    .replace(/\r?\n/g, " ")
    .trim();
}

/*
 * Calcula el tamaño de la descripción para mantenerla
 * SIEMPRE en una sola línea.
 *
 * La fuente Zebra A0 no ocupa todo el ancho declarado por carácter.
 * Usamos un factor aproximado de 0.55 para aprovechar mejor
 * los 559 dots de una etiqueta de 70 mm a 203 dpi.
 */
function calcularTamanoDescripcion(texto: string) {
  const anchoDisponible = 519;
  const caracteres = Math.max(texto.length, 1);

  const anchoEstimado = Math.floor(
    anchoDisponible / (caracteres * 0.55),
  );

  const ancho = Math.max(
    11,
    Math.min(30, anchoEstimado),
  );

  const alto = Math.max(
    18,
    Math.min(34, Math.round(ancho * 1.15)),
  );

  return {
    alto,
    ancho,
  };
}

export function generarEtiquetaZpl(datos: ZebraLabelData) {
  const id = limpiarTextoZpl(datos.id_bobina).toUpperCase();
  const codigo = limpiarTextoZpl(datos.codigo_etiqueta);
  const descripcion = limpiarTextoZpl(datos.descripcion);
  const cantidad = limpiarTextoZpl(String(datos.cantidad));

  const lineaDescripcion = `Descripción: ${descripcion}`;

  const tamanoDescripcion =
    calcularTamanoDescripcion(lineaDescripcion);

  return `
^XA
^PW559
^LL240
^LH0,0
^CI28
^PR4
~SD15

^FO38,4
^BY3,2,62
^BCN,62,N,N,N
^FD${id}^FS

^FO0,69
^A0N,29,29
^FB559,1,0,C,0
^FD${id}^FS

^FO18,101
^A0N,38,34
^FDEtiqueta: ${codigo}^FS

^FO18,146
^A0N,${tamanoDescripcion.alto},${tamanoDescripcion.ancho}
^FD${lineaDescripcion}^FS

^FO18,193
^A0N,38,34
^FDCantidad: ${cantidad}^FS

^PQ2,0,1,Y
^XZ
`.trim();
}

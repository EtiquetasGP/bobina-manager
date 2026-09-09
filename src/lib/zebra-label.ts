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
 * Calcula automáticamente el tamaño de la descripción
 * para mantenerla SIEMPRE en una sola línea.
 *
 * Etiqueta: 70 mm = 559 dots a 203 dpi.
 * Dejamos aproximadamente 20 dots de margen a cada lado.
 */
function calcularTamanoDescripcion(texto: string) {
  const anchoDisponible = 519;
  const cantidadCaracteres = Math.max(texto.length, 1);

  // Estimación conservadora del ancho permitido por carácter.
  let ancho = Math.floor(anchoDisponible / cantidadCaracteres);

  // Límites para que no quede ni exageradamente grande ni ilegible.
  ancho = Math.min(ancho, 25);
  ancho = Math.max(ancho, 9);

  // La altura puede ser algo mayor que el ancho para conservar legibilidad.
  let alto = Math.round(ancho * 1.25);

  alto = Math.min(alto, 30);
  alto = Math.max(alto, 14);

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

^FO30,5
^BY2,2,64
^BCN,64,N,N,N
^FD${id}^FS

^FO185,71
^A0N,25,25
^FD${id}^FS

^FO20,104
^A0N,34,30
^FDEtiqueta: ${codigo}^FS

^FO20,149
^A0N,${tamanoDescripcion.alto},${tamanoDescripcion.ancho}
^FD${lineaDescripcion}^FS

^FO20,194
^A0N,34,30
^FDCantidad: ${cantidad}^FS

^PQ2,0,1,Y
^XZ
`.trim();
}

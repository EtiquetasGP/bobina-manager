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

function tamanoDescripcion(texto: string) {
  const largo = texto.length;

  if (largo <= 32) return { alto: 28, ancho: 22 };
  if (largo <= 42) return { alto: 25, ancho: 18 };
  if (largo <= 52) return { alto: 22, ancho: 15 };
  if (largo <= 65) return { alto: 19, ancho: 12 };

  return { alto: 16, ancho: 9 };
}

export function generarEtiquetaZpl(datos: ZebraLabelData) {
  const id = limpiarTextoZpl(datos.id_bobina);
  const codigo = limpiarTextoZpl(datos.codigo_etiqueta);
  const descripcion = limpiarTextoZpl(datos.descripcion);
  const cantidad = limpiarTextoZpl(String(datos.cantidad));

  const lineaDescripcion = `Descripción: ${descripcion}`;
  const tamano = tamanoDescripcion(lineaDescripcion);

  return `
^XA
^PW559
^LL240
^LH0,0
^CI28
^PR4
~SD15

^FO105,8
^BY2,2,45
^BCN,45,Y,N,N
^FD${id}^FS

^FO24,108
^A0N,28,22
^FDEtiqueta: ${codigo}^FS

^FO24,150
^A0N,${tamano.alto},${tamano.ancho}
^FD${lineaDescripcion}^FS

^FO24,194
^A0N,28,22
^FDCantidad: ${cantidad}^FS

^PQ2,0,1,Y
^XZ
`.trim();
}

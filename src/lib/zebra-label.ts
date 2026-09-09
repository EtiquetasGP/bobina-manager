export type EtiquetaZebraInput = {
  id_bobina: string;
  codigo_etiqueta: string;
  descripcion: string;
  cantidad: string | number;
  copias?: number;
};

function limpiarTexto(valor: string | number | null | undefined): string {
  return String(valor ?? "")
    .replace(/\r/g, " ")
    .replace(/\n/g, " ")
    .replace(/\^/g, " ")
    .replace(/~/g, " ")
    .trim();
}

function partirDescripcion(
  texto: string,
  maxLinea1 = 32,
  maxLinea2 = 32,
): { linea1: string; linea2: string } {
  const limpio = limpiarTexto(texto);

  if (limpio.length <= maxLinea1) {
    return {
      linea1: limpio,
      linea2: "",
    };
  }

  const corte1 = limpio.lastIndexOf(" ", maxLinea1);
  const idx1 = corte1 > 0 ? corte1 : maxLinea1;

  const linea1 = limpio.slice(0, idx1).trim();
  const resto = limpio.slice(idx1).trim();

  if (resto.length <= maxLinea2) {
    return {
      linea1,
      linea2: resto,
    };
  }

  const corte2 = resto.lastIndexOf(" ", maxLinea2);
  const idx2 = corte2 > 0 ? corte2 : maxLinea2;

  return {
    linea1,
    linea2: resto.slice(0, idx2).trim(),
  };
}

export function generarEtiquetaZpl({
  id_bobina,
  codigo_etiqueta,
  descripcion,
  cantidad,
  copias = 2,
}: EtiquetaZebraInput): string {
  const id = limpiarTexto(id_bobina).toUpperCase();
  const codigo = limpiarTexto(codigo_etiqueta);
  const cant = limpiarTexto(cantidad);
  const descPartida = partirDescripcion(descripcion);

  const descripcionEnDosLineas = descPartida.linea2.length > 0;

  const bloqueDescripcion = descripcionEnDosLineas
    ? `
^FO20,142^A0N,24,24^FDDescripcion: ${descPartida.linea1}^FS
^FO20,170^A0N,24,24^FD${descPartida.linea2}^FS
^FO20,198^A0N,30,30^FDCantidad: ${cant}^FS
`
    : `
^FO20,142^A0N,26,26^FDDescripcion: ${descPartida.linea1}^FS
^FO20,188^A0N,32,32^FDCantidad: ${cant}^FS
`;

  return `
^XA
^PW559
^LL240
^LH0,0
^CI28

^FO25,8^BY2,2,62^BCN,62,N,N,N^FD${id}^FS
^FO180,74^A0N,24,24^FD${id}^FS

^FO20,104^A0N,34,34^FDEtiqueta: ${codigo}^FS
${bloqueDescripcion}

^PQ${copias}
^XZ
`.trim();
}

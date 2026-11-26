const numberFormat = new Intl.NumberFormat('es-PE');

/** Cifra con el formato local de Perú (separador de miles con coma). */
export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

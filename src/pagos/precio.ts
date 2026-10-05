import { localeActual } from '../i18n';

/**
 * Precios en céntimos de franco (rappen), como los guarda Firestore y los
 * cobrará Stripe: enteros, sin errores de redondeo. null es un favor gratis.
 *
 * Quien ayuda se lleva el precio entero; quien pide paga encima la gestión:
 * un 8 %, y como poco CHF 1 para que los servicios baratos no salgan a
 * pérdida después de lo que cobra Stripe.
 */
export const COMISION = 0.08;
export const COMISION_MINIMA = 100;
export const PRECIO_MINIMO = 500;
export const PRECIO_MAXIMO = 100000;

export function comision(precio: number): number {
  return Math.max(COMISION_MINIMA, Math.round(precio * COMISION));
}

/** Lo que paga quien pide: el precio más la gestión. */
export function totalAPagar(precio: number): number {
  return precio + comision(precio);
}

export function precioValido(precio: number | null): boolean {
  return precio === null || (Number.isInteger(precio) && precio >= PRECIO_MINIMO && precio <= PRECIO_MAXIMO);
}

/**
 * "CHF 40" en tarjetas y "CHF 40.00" (o "40,00 CHF" en español) cuando
 * importan los céntimos, con el formato de moneda del idioma.
 */
export function formatearPrecio(centimos: number, { exacto = false }: { exacto?: boolean } = {}): string {
  const redondo = centimos % 100 === 0 && !exacto;
  return new Intl.NumberFormat(localeActual(), {
    style: 'currency',
    currency: 'CHF',
    minimumFractionDigits: redondo ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(centimos / 100);
}

/**
 * Lo que se teclea en el campo de precio, en céntimos: "40", "12.50",
 * "12,5" o "CHF 40". null si no es un importe.
 */
export function leerPrecio(texto: string): number | null {
  const limpio = texto.replace(/chf|fr\.?|\s/gi, '').replace(',', '.');
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(limpio)) return null;
  return Math.round(parseFloat(limpio) * 100);
}

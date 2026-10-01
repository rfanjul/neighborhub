import type { PagoMovimiento } from '../firebase/data';

/** Un pago de ejemplo: Ana pagó CHF 43.20 a Luis por subir un sofá. */
export const pago = (cambios: Partial<PagoMovimiento> = {}): PagoMovimiento => ({
  serviceId: 's1',
  rol: 'pagado',
  estado: 'retenido',
  importe: 4320,
  precio: 4000,
  comision: 320,
  titulo: 'Subir un sofá',
  otraPersona: 'Luis',
  fecha: Date.UTC(2026, 9, 1, 12),
  ...cambios,
});

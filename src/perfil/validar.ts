import type { Clave } from '../i18n';

/**
 * Datos del perfil que hacen falta para publicar u ofrecer ayuda, y cómo se
 * validan. Lo mismo comprueban las reglas de Firestore al guardarlos.
 */
export type CamposPerfil = {
  name: string;
  /** DD/MM/AAAA */
  dateOfBirth: string;
  city: string;
  postalCode: string;
  languages: string[];
};

export type ErroresPerfil = Partial<Record<keyof CamposPerfil, Clave>>;

/** Letras (de cualquier idioma), espacios, puntos, guiones y apóstrofos. */
const TEXTO = /^\p{L}[\p{L} .'’-]*$/u;
/** Códigos postales suizos. */
const CODIGO_POSTAL = /^[1-9]\d{3}$/;
const EDAD_MINIMA = 16;
const EDAD_MAXIMA = 120;

const textoValido = (texto: string, min: number, max: number) => {
  const t = texto.trim();
  return t.length >= min && t.length <= max && TEXTO.test(t);
};

/** La fecha como Date si es un DD/MM/AAAA que existe; si no, null. */
export function leerFecha(texto: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto.trim());
  if (!m) return null;
  const [dia, mes, anio] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia ? fecha : null;
}

/** Años cumplidos en `hoy`. */
export function edad(nacimiento: Date, hoy: Date): number {
  let anios = hoy.getUTCFullYear() - nacimiento.getUTCFullYear();
  const antesDelCumple =
    hoy.getUTCMonth() < nacimiento.getUTCMonth() ||
    (hoy.getUTCMonth() === nacimiento.getUTCMonth() && hoy.getUTCDate() < nacimiento.getUTCDate());
  if (antesDelCumple) anios -= 1;
  return anios;
}

/** Mientras se escribe: solo cifras, con las barras puestas (14031992 → 14/03/1992). */
export function formatearFecha(texto: string): string {
  const cifras = texto.replace(/\D/g, '').slice(0, 8);
  return [cifras.slice(0, 2), cifras.slice(2, 4), cifras.slice(4)].filter(Boolean).join('/');
}

export function validarPerfil(c: CamposPerfil, hoy = new Date()): ErroresPerfil {
  const errores: ErroresPerfil = {};
  if (!textoValido(c.name, 2, 60)) errores.name = 'datos.errores.nombre';
  const nacimiento = leerFecha(c.dateOfBirth);
  if (!nacimiento || nacimiento > hoy || edad(nacimiento, hoy) > EDAD_MAXIMA) errores.dateOfBirth = 'datos.errores.nacimiento';
  else if (edad(nacimiento, hoy) < EDAD_MINIMA) errores.dateOfBirth = 'datos.errores.edad';
  if (!textoValido(c.city, 2, 50)) errores.city = 'datos.errores.ciudad';
  if (!CODIGO_POSTAL.test(c.postalCode.trim())) errores.postalCode = 'datos.errores.codigoPostal';
  if (!c.languages.length) errores.languages = 'datos.errores.idiomas';
  return errores;
}

/** Perfil con todo lo necesario para publicar u ofrecer ayuda. */
export function perfilCompleto(
  perfil: { name?: string | null; dateOfBirth?: string | null; city?: string | null; postalCode?: string | null; languages?: string | null } | null | undefined,
  hoy = new Date()
): boolean {
  if (!perfil) return false;
  const errores = validarPerfil(
    {
      name: perfil.name ?? '',
      dateOfBirth: perfil.dateOfBirth ?? '',
      city: perfil.city ?? '',
      postalCode: perfil.postalCode ?? '',
      languages: (perfil.languages ?? '').split(',').map((l) => l.trim()).filter(Boolean),
    },
    hoy
  );
  return Object.keys(errores).length === 0;
}

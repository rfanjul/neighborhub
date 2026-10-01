import { t, type Clave } from '../i18n';

// Traduce los errores de Firestore y Storage a algo que un usuario entienda,
// en su idioma. El SDK habla de "client is offline" también cuando la base de
// datos no existe o no está activada, así que ese caso se trata como "sin
// conexión con el servidor", no como "no tienes internet".
const porCodigo: Record<string, Clave> = {
  unavailable: 'erroresDatos.sinServidor',
  'failed-precondition': 'erroresDatos.sinServidor',
  'permission-denied': 'erroresDatos.sinPermiso',
  'storage/unauthorized': 'erroresDatos.fotoSinPermiso',
  'storage/quota-exceeded': 'erroresDatos.sinEspacio',
  'storage/retry-limit-exceeded': 'erroresDatos.subidaLenta',
};

export function dataErrorMessage(error: unknown): string {
  const code = (error as { code?: unknown })?.code;
  if (typeof code === 'string' && porCodigo[code]) {
    return t(porCodigo[code]);
  }
  const message = error instanceof Error ? error.message : '';
  if (/offline/i.test(message)) {
    return t(porCodigo.unavailable);
  }
  return message || t('comun.errorInesperado');
}

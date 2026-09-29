import { t, type Clave } from '../i18n';

// Traduce los códigos de Firebase Auth a mensajes para el usuario, en su
// idioma. Cualquier otro error se muestra tal cual.
const messages: Record<string, Clave> = {
  'auth/invalid-email': 'erroresAuth.emailInvalido',
  'auth/missing-password': 'erroresAuth.faltaContrasena',
  'auth/weak-password': 'erroresAuth.contrasenaDebil',
  'auth/email-already-in-use': 'erroresAuth.emailEnUso',
  'auth/user-not-found': 'erroresAuth.credenciales',
  'auth/wrong-password': 'erroresAuth.credenciales',
  'auth/invalid-credential': 'erroresAuth.credenciales',
  'auth/too-many-requests': 'erroresAuth.demasiadosIntentos',
  'auth/network-request-failed': 'erroresAuth.sinConexion',
  'auth/account-exists-with-different-credential': 'erroresAuth.otroMetodo',
  'auth/operation-not-allowed': 'erroresAuth.metodoDesactivado',
};

// Se mira el campo `code` en lugar de `instanceof FirebaseError`: el SDK se
// carga en varios formatos (ESM, CJS, RN) y un error creado por una copia del
// módulo no pasa el instanceof de otra.
function errorCode(error: unknown): string | null {
  if (error instanceof Error) {
    const code = (error as Error & { code?: unknown }).code;
    return typeof code === 'string' ? code : null;
  }
  return null;
}

export function authErrorMessage(error: unknown): string {
  const code = errorCode(error);
  if (code && messages[code]) {
    return t(messages[code]);
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return t('comun.errorInesperado');
}

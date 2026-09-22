// Traduce los códigos de Firebase Auth a mensajes para el usuario.
// Cualquier otro error se muestra tal cual.
const messages: Record<string, string> = {
  'auth/invalid-email': 'El email no es válido.',
  'auth/missing-password': 'Escribe tu contraseña.',
  'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
  'auth/email-already-in-use': 'Ya existe una cuenta con ese email.',
  'auth/user-not-found': 'Email o contraseña incorrectos.',
  'auth/wrong-password': 'Email o contraseña incorrectos.',
  'auth/invalid-credential': 'Email o contraseña incorrectos.',
  'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos.',
  'auth/network-request-failed': 'Sin conexión. Revisa tu red.',
  'auth/account-exists-with-different-credential':
    'Ya existe una cuenta con ese email usando otro método de acceso.',
  'auth/operation-not-allowed': 'Este método de acceso no está activado en Firebase.',
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
    return messages[code];
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Ha ocurrido un error inesperado.';
}

// Traduce los errores de Firestore y Storage a algo que un usuario entienda.
// El SDK habla de "client is offline" también cuando la base de datos no
// existe o no está activada, así que ese caso se trata como "sin conexión
// con el servidor", no como "no tienes internet".
const porCodigo: Record<string, string> = {
  unavailable: 'No se pudo conectar con el servidor. Inténtalo de nuevo en un momento.',
  'failed-precondition': 'No se pudo conectar con el servidor. Inténtalo de nuevo en un momento.',
  'permission-denied': 'No tienes permiso para hacer esto.',
  'storage/unauthorized': 'No tienes permiso para subir esta foto.',
  'storage/quota-exceeded': 'No queda espacio para más fotos.',
  'storage/retry-limit-exceeded': 'La subida de la foto tardó demasiado. Revisa la conexión.',
};

export function dataErrorMessage(error: unknown): string {
  const code = (error as { code?: unknown })?.code;
  if (typeof code === 'string' && porCodigo[code]) {
    return porCodigo[code];
  }
  const message = error instanceof Error ? error.message : '';
  if (/offline/i.test(message)) {
    return porCodigo.unavailable;
  }
  return message || 'Ha ocurrido un error inesperado.';
}

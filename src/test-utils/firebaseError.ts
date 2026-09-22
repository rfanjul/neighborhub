/**
 * Error equivalente al que lanza el SDK de Firebase Auth: un Error normal con
 * `code` y el mensaje prefijado que usa el propio SDK.
 */
export function firebaseError(code: string, message = 'Something went wrong') {
  return Object.assign(new Error(`Firebase: ${message} (${code}).`), { code, name: 'FirebaseError' });
}

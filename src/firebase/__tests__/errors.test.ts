import { dataErrorMessage } from '../errors';

const conCodigo = (code: string, message = 'raw') => Object.assign(new Error(message), { code });

describe('dataErrorMessage', () => {
  it('trata "client is offline" como fallo del servidor, no del móvil', () => {
    expect(dataErrorMessage(new Error('Failed to get document because the client is offline.'))).toBe(
      'No se pudo conectar con el servidor. Inténtalo de nuevo en un momento.'
    );
  });

  it.each([
    ['unavailable', 'No se pudo conectar con el servidor. Inténtalo de nuevo en un momento.'],
    ['permission-denied', 'No tienes permiso para hacer esto.'],
    ['storage/unauthorized', 'No tienes permiso para subir esta foto.'],
    ['storage/quota-exceeded', 'No queda espacio para más fotos.'],
  ])('traduce %s', (code, esperado) => {
    expect(dataErrorMessage(conCodigo(code))).toBe(esperado);
  });

  it('deja pasar el mensaje de un error desconocido', () => {
    expect(dataErrorMessage(new Error('algo raro'))).toBe('algo raro');
  });

  it('da un mensaje genérico si no hay nada que mostrar', () => {
    expect(dataErrorMessage(undefined)).toBe('Ha ocurrido un error inesperado.');
  });
});

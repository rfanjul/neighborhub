import { authErrorMessage } from '../errors';
import { firebaseError } from '../../test-utils/firebaseError';

describe('authErrorMessage', () => {
  it.each([
    ['auth/invalid-email', 'El email no es válido.'],
    ['auth/missing-password', 'Escribe tu contraseña.'],
    ['auth/weak-password', 'La contraseña debe tener al menos 6 caracteres.'],
    ['auth/email-already-in-use', 'Ya existe una cuenta con ese email.'],
    ['auth/too-many-requests', 'Demasiados intentos. Espera unos minutos.'],
    ['auth/network-request-failed', 'Sin conexión. Revisa tu red.'],
    ['auth/operation-not-allowed', 'Este método de acceso no está activado en Firebase.'],
    ['auth/account-exists-with-different-credential', 'Ya existe una cuenta con ese email usando otro método de acceso.'],
  ])('traduce %s', (code, expected) => {
    expect(authErrorMessage(firebaseError(code))).toBe(expected);
  });

  it.each(['auth/user-not-found', 'auth/wrong-password', 'auth/invalid-credential'])(
    'no revela si falla el email o la contraseña (%s)',
    (code) => {
      expect(authErrorMessage(firebaseError(code))).toBe('Email o contraseña incorrectos.');
    }
  );

  it('deja pasar el mensaje de un código de Firebase sin traducir', () => {
    expect(authErrorMessage(firebaseError('auth/internal-error', 'Internal error'))).toBe(
      'Firebase: Internal error (auth/internal-error).'
    );
  });

  it('usa el mensaje de un Error normal', () => {
    expect(authErrorMessage(new Error('Falta EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID'))).toBe(
      'Falta EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID'
    );
  });

  it.each([[null], [undefined], ['texto suelto'], [{ code: 'auth/invalid-email' }], [new Error('')]])(
    'devuelve un mensaje genérico para %p',
    (value) => {
      expect(authErrorMessage(value)).toBe('Ha ocurrido un error inesperado.');
    }
  );
});

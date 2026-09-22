import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  GoogleAuthProvider,
  OAuthProvider,
} from 'firebase/auth';
import { AuthProvider, useAuth } from '../AuthContext';
import { auth } from '../../firebase';
import { googleCancelled, googleCancelledError, googleSignInMock, googleSuccess } from '../../test-utils/mocks';
import { firebaseError } from '../../test-utils/firebaseError';

jest.mock('../environment', () => ({ isExpoGo: false }));
jest.mock('@react-native-google-signin/google-signin', () => require('../../test-utils/mocks').googleSignInMock);

jest.mock('firebase/auth', () => ({
  onAuthStateChanged: jest.fn(() => jest.fn()),
  createUserWithEmailAndPassword: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  signInWithCredential: jest.fn(),
  signOut: jest.fn(),
  updateProfile: jest.fn(),
  GoogleAuthProvider: { credential: jest.fn((idToken: string) => ({ provider: 'google', idToken })) },
  OAuthProvider: jest.fn().mockImplementation((providerId: string) => ({
    credential: jest.fn((params: object) => ({ provider: providerId, ...params })),
  })),
}));

jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'nonce-en-claro'),
  digestStringAsync: jest.fn().mockResolvedValue('nonce-hasheado'),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
}));

const wrapper = ({ children }: { children: React.ReactNode }) => <AuthProvider>{children}</AuthProvider>;

// render/renderHook son asíncronos desde @testing-library/react-native 14.
async function renderAuth() {
  return renderHook(() => useAuth(), { wrapper });
}

/** Devuelve el callback que AuthProvider pasó a onAuthStateChanged. */
function authStateCallback() {
  return (onAuthStateChanged as jest.Mock).mock.calls.at(-1)![1] as (user: unknown) => void;
}

const fakeUser = (overrides: object = {}) => ({ uid: 'uid-1', email: 'ana@example.com', displayName: null, ...overrides });

beforeEach(() => {
  jest.clearAllMocks();
  (onAuthStateChanged as jest.Mock).mockImplementation(() => jest.fn());
  (AppleAuthentication.isAvailableAsync as jest.Mock).mockResolvedValue(true);
  googleSignInMock.GoogleSignin.signOut.mockResolvedValue(null);
});

describe('sesión', () => {
  it('empieza inicializando y sin usuario', async () => {
    const { result } = await renderAuth();
    expect(result.current.initializing).toBe(true);
    expect(result.current.user).toBeNull();
  });

  it('expone el usuario cuando Firebase restaura la sesión', async () => {
    const { result } = await renderAuth();
    const user = fakeUser();
    await act(async () => {
      authStateCallback()(user);
    });
    await waitFor(() => expect(result.current.initializing).toBe(false));
    expect(result.current.user).toBe(user);
  });

  it('deja de inicializar aunque no haya sesión guardada', async () => {
    const { result } = await renderAuth();
    await act(async () => {
      authStateCallback()(null);
    });
    await waitFor(() => expect(result.current.initializing).toBe(false));
    expect(result.current.user).toBeNull();
  });

  it('cancela la suscripción al desmontar', async () => {
    const unsubscribe = jest.fn();
    (onAuthStateChanged as jest.Mock).mockReturnValue(unsubscribe);
    await (await renderAuth()).unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('useAuth fuera del provider avisa en vez de devolver undefined', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(renderHook(() => useAuth())).rejects.toThrow('useAuth debe usarse dentro de <AuthProvider>');
    consoleError.mockRestore();
  });
});

describe('registro con email', () => {
  it('crea la cuenta y guarda el nombre', async () => {
    const user = fakeUser();
    (createUserWithEmailAndPassword as jest.Mock).mockResolvedValue({ user });
    const { result } = await renderAuth();

    await act(async () => {
      await result.current.register('Ana Pérez', 'ana@example.com', 'secreto123');
    });

    expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(auth, 'ana@example.com', 'secreto123');
    expect(updateProfile).toHaveBeenCalledWith(user, { displayName: 'Ana Pérez' });
  });

  it('limpia los espacios del email y del nombre', async () => {
    (createUserWithEmailAndPassword as jest.Mock).mockResolvedValue({ user: fakeUser() });
    const { result } = await renderAuth();

    await act(async () => {
      await result.current.register('  Ana  ', '  ana@example.com  ', 'secreto123');
    });

    expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(auth, 'ana@example.com', 'secreto123');
    expect(updateProfile).toHaveBeenCalledWith(expect.anything(), { displayName: 'Ana' });
  });

  it('no toca el perfil si el nombre viene vacío', async () => {
    (createUserWithEmailAndPassword as jest.Mock).mockResolvedValue({ user: fakeUser() });
    const { result } = await renderAuth();

    await act(async () => {
      await result.current.register('   ', 'ana@example.com', 'secreto123');
    });

    expect(updateProfile).not.toHaveBeenCalled();
  });

  it('propaga el error de Firebase para que la pantalla lo traduzca', async () => {
    (createUserWithEmailAndPassword as jest.Mock).mockRejectedValue(firebaseError('auth/email-already-in-use'));
    const { result } = await renderAuth();

    await expect(result.current.register('Ana', 'ana@example.com', 'secreto123')).rejects.toMatchObject({
      code: 'auth/email-already-in-use',
    });
    expect(updateProfile).not.toHaveBeenCalled();
  });
});

describe('login con email', () => {
  it('entra con las credenciales, sin espacios en el email', async () => {
    (signInWithEmailAndPassword as jest.Mock).mockResolvedValue({ user: fakeUser() });
    const { result } = await renderAuth();

    await act(async () => {
      await result.current.login(' ana@example.com ', 'secreto123');
    });

    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(auth, 'ana@example.com', 'secreto123');
  });

  it('propaga credenciales incorrectas', async () => {
    (signInWithEmailAndPassword as jest.Mock).mockRejectedValue(firebaseError('auth/invalid-credential'));
    const { result } = await renderAuth();

    await expect(result.current.login('ana@example.com', 'mala')).rejects.toMatchObject({
      code: 'auth/invalid-credential',
    });
  });
});

describe('recuperar contraseña', () => {
  it('pide a Firebase el email de restablecimiento', async () => {
    (sendPasswordResetEmail as jest.Mock).mockResolvedValue(undefined);
    const { result } = await renderAuth();

    await act(async () => {
      await result.current.resetPassword(' ana@example.com ');
    });

    expect(sendPasswordResetEmail).toHaveBeenCalledWith(auth, 'ana@example.com');
  });

  it('propaga un email desconocido', async () => {
    (sendPasswordResetEmail as jest.Mock).mockRejectedValue(firebaseError('auth/user-not-found'));
    const { result } = await renderAuth();

    await expect(result.current.resetPassword('nadie@example.com')).rejects.toMatchObject({
      code: 'auth/user-not-found',
    });
  });
});

describe('login con Google', () => {
  it('cambia el idToken de Google por una sesión de Firebase', async () => {
    googleSignInMock.GoogleSignin.signIn.mockResolvedValue(googleSuccess('id-token-google'));
    (signInWithCredential as jest.Mock).mockResolvedValue({ user: fakeUser() });
    const { result } = await renderAuth();

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.loginWithGoogle();
    });

    expect(ok).toBe(true);
    expect(GoogleAuthProvider.credential).toHaveBeenCalledWith('id-token-google');
    expect(signInWithCredential).toHaveBeenCalledWith(auth, { provider: 'google', idToken: 'id-token-google' });
  });

  it('devuelve false si el usuario cierra el diálogo', async () => {
    googleSignInMock.GoogleSignin.signIn.mockResolvedValue(googleCancelled);
    const { result } = await renderAuth();

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.loginWithGoogle();
    });

    expect(ok).toBe(false);
    expect(signInWithCredential).not.toHaveBeenCalled();
  });

  it('devuelve false si el SDK lanza el error de cancelación', async () => {
    googleSignInMock.GoogleSignin.signIn.mockRejectedValue(googleCancelledError());
    const { result } = await renderAuth();

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.loginWithGoogle();
    });

    expect(ok).toBe(false);
  });

  it('avisa si Google no devuelve idToken', async () => {
    googleSignInMock.GoogleSignin.signIn.mockResolvedValue(googleSuccess(null));
    const { result } = await renderAuth();

    await expect(result.current.loginWithGoogle()).rejects.toThrow('Google no devolvió un idToken.');
  });

  it('propaga los demás errores del SDK', async () => {
    googleSignInMock.GoogleSignin.signIn.mockRejectedValue(Object.assign(new Error('play services'), { code: '2' }));
    const { result } = await renderAuth();

    await expect(result.current.loginWithGoogle()).rejects.toThrow('play services');
  });

  it('avisa si falta el client id de iOS en .env', async () => {
    const previous = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
    delete process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
    const { result } = await renderAuth();

    await expect(result.current.loginWithGoogle()).rejects.toThrow('Falta EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID');
    expect(googleSignInMock.GoogleSignin.signIn).not.toHaveBeenCalled();

    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = previous;
  });
});

describe('login con Apple', () => {
  const appleCredential = (overrides: object = {}) => ({
    identityToken: 'id-token-apple',
    fullName: { givenName: 'Ana', familyName: 'Pérez' },
    ...overrides,
  });

  it('manda a Apple el nonce hasheado y a Firebase el nonce en claro', async () => {
    (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue(appleCredential());
    (signInWithCredential as jest.Mock).mockResolvedValue({ user: fakeUser() });
    const { result } = await renderAuth();

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.loginWithApple();
    });

    expect(ok).toBe(true);
    expect(AppleAuthentication.signInAsync).toHaveBeenCalledWith(
      expect.objectContaining({ nonce: 'nonce-hasheado' })
    );
    expect(OAuthProvider).toHaveBeenCalledWith('apple.com');
    expect(signInWithCredential).toHaveBeenCalledWith(
      auth,
      expect.objectContaining({ idToken: 'id-token-apple', rawNonce: 'nonce-en-claro' })
    );
  });

  it('guarda el nombre que Apple solo envía la primera vez', async () => {
    const user = fakeUser({ displayName: null });
    (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue(appleCredential());
    (signInWithCredential as jest.Mock).mockResolvedValue({ user });
    const { result } = await renderAuth();

    await act(async () => {
      await result.current.loginWithApple();
    });

    expect(updateProfile).toHaveBeenCalledWith(user, { displayName: 'Ana Pérez' });
  });

  it('no pisa un nombre que ya existe', async () => {
    (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue(appleCredential());
    (signInWithCredential as jest.Mock).mockResolvedValue({ user: fakeUser({ displayName: 'Ana P.' }) });
    const { result } = await renderAuth();

    await act(async () => {
      await result.current.loginWithApple();
    });

    expect(updateProfile).not.toHaveBeenCalled();
  });

  it('no llama a updateProfile en los logins siguientes, cuando Apple no manda nombre', async () => {
    (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue(appleCredential({ fullName: null }));
    (signInWithCredential as jest.Mock).mockResolvedValue({ user: fakeUser() });
    const { result } = await renderAuth();

    await act(async () => {
      await result.current.loginWithApple();
    });

    expect(updateProfile).not.toHaveBeenCalled();
  });

  it('devuelve false si el usuario cancela', async () => {
    (AppleAuthentication.signInAsync as jest.Mock).mockRejectedValue(
      Object.assign(new Error('cancelado'), { code: 'ERR_REQUEST_CANCELED' })
    );
    const { result } = await renderAuth();

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.loginWithApple();
    });

    expect(ok).toBe(false);
    expect(signInWithCredential).not.toHaveBeenCalled();
  });

  it('propaga los demás errores de Apple', async () => {
    (AppleAuthentication.signInAsync as jest.Mock).mockRejectedValue(new Error('error 1000'));
    const { result } = await renderAuth();

    await expect(result.current.loginWithApple()).rejects.toThrow('error 1000');
  });

  it('avisa si Apple no devuelve identityToken', async () => {
    (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue(appleCredential({ identityToken: null }));
    const { result } = await renderAuth();

    await expect(result.current.loginWithApple()).rejects.toThrow('Apple no devolvió un identityToken.');
  });

  it('avisa cuando Sign in with Apple no está disponible', async () => {
    (AppleAuthentication.isAvailableAsync as jest.Mock).mockResolvedValue(false);
    const { result } = await renderAuth();

    await expect(result.current.loginWithApple()).rejects.toThrow('no está disponible');
    expect(AppleAuthentication.signInAsync).not.toHaveBeenCalled();
  });
});

describe('cerrar sesión', () => {
  it('cierra la sesión en Firebase y en Google', async () => {
    (signOut as jest.Mock).mockResolvedValue(undefined);
    const { result } = await renderAuth();

    await act(async () => {
      await result.current.logout();
    });

    expect(signOut).toHaveBeenCalledWith(auth);
    expect(googleSignInMock.GoogleSignin.signOut).toHaveBeenCalled();
  });

  it('cierra igual aunque no hubiera sesión de Google', async () => {
    (signOut as jest.Mock).mockResolvedValue(undefined);
    googleSignInMock.GoogleSignin.signOut.mockRejectedValue(new Error('sin sesión'));
    const { result } = await renderAuth();

    await expect(result.current.logout()).resolves.toBeUndefined();
    expect(signOut).toHaveBeenCalledWith(auth);
  });

  it('propaga un fallo de Firebase al cerrar sesión', async () => {
    (signOut as jest.Mock).mockRejectedValue(firebaseError('auth/network-request-failed'));
    const { result } = await renderAuth();

    await expect(result.current.logout()).rejects.toMatchObject({ code: 'auth/network-request-failed' });
  });
});

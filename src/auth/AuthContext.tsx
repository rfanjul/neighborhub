import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  OAuthProvider,
  createUserWithEmailAndPassword,
  deleteUser,
  reauthenticateWithCredential,
  revokeAccessToken,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { auth } from '../firebase';
import { api, ensureUserDocument, type MiPerfil } from '../firebase/data';
import { isExpoGo } from './environment';
import { olvidarEsteDispositivo } from '../notificaciones';

// El módulo de Google es nativo y no existe en Expo Go: importarlo ahí rompe
// la app al arrancar, así que se carga solo en el development build.
type GoogleModule = typeof import('@react-native-google-signin/google-signin');
let google: GoogleModule | null = null;
if (!isExpoGo) {
  google = require('@react-native-google-signin/google-signin') as GoogleModule;
  google.GoogleSignin.configure({
    // El client ID iOS sale del GoogleService-Info.plist; el web es el que
    // Firebase usa para validar el idToken.
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
  });
}

type AuthContextValue = {
  user: User | null;
  /** Perfil del usuario en Firestore (público y privado); null mientras no haya sesión */
  profile: MiPerfil | null;
  /** Relee el perfil tras editarlo o completar el onboarding */
  refreshProfile: () => Promise<void>;
  /** true mientras Firebase restaura la sesión guardada al arrancar */
  initializing: boolean;
  register: (name: string, email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  /** Resuelve a false si el usuario cancela el diálogo nativo */
  loginWithGoogle: () => Promise<boolean>;
  loginWithApple: () => Promise<boolean>;
  logout: () => Promise<void>;
  /**
   * Borra la cuenta y los datos propios. Primero confirma que es la persona
   * (Firebase lo exige): con la contraseña si entró con email, o volviendo
   * a pasar por Apple o Google. Resuelve a false si cancela.
   */
  deleteAccount: (password?: string) => Promise<boolean>;
  /** Cómo entró: 'password', 'apple.com' o 'google.com'. */
  provider: string | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<MiPerfil | null>(null);
  const [initializing, setInitializing] = useState(true);

  const refreshProfile = useCallback(async () => {
    const actual = auth.currentUser;
    if (!actual) {
      setProfile(null);
      return;
    }
    try {
      // El documento puede no existir todavía si es el primer acceso con
      // Google o Apple, donde no pasamos por el registro con email.
      await ensureUserDocument(actual.uid, { name: actual.displayName ?? '', email: actual.email ?? '' });
      setProfile(await api.getMe());
    } catch {
      // Sin Firestore (offline o reglas) la app sigue usable: se entra al
      // muro sin perfil y se reintenta al editar los datos.
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    return onAuthStateChanged(auth, async (next) => {
      setUser(next);
      if (next) {
        await refreshProfile();
      } else {
        setProfile(null);
      }
      setInitializing(false);
    });
  }, [refreshProfile]);

  const register = async (name: string, email: string, password: string) => {
    const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
    if (name.trim()) {
      await updateProfile(credential.user, { displayName: name.trim() });
    }
  };

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  };

  const loginWithGoogle = async () => {
    if (!google) {
      throw new Error('Google Sign-In no está disponible en Expo Go; usa el development build.');
    }
    if (!process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID) {
      throw new Error('Falta EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID en .env (ver README).');
    }
    const { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } = google;
    try {
      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse(response)) {
        return false; // cancelado por el usuario
      }
      const idToken = response.data.idToken;
      if (!idToken) {
        throw new Error('Google no devolvió un idToken.');
      }
      await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
      return true;
    } catch (error) {
      if (isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_CANCELLED) {
        return false;
      }
      throw error;
    }
  };

  /**
   * Pasa por Apple y devuelve la credencial de Firebase (con su nonce) y el
   * código de autorización; null si la persona cancela.
   */
  const pedirApple = async (scopes: AppleAuthentication.AppleAuthenticationScope[]) => {
    if (!(await AppleAuthentication.isAvailableAsync())) {
      throw new Error('Sign in with Apple no está disponible aquí (Expo Go o simulador sin Apple ID).');
    }
    // Firebase pide un nonce: se manda a Apple el hash SHA-256 y a Firebase
    // el valor en claro, así puede comprobar que el token es de esta petición.
    const rawNonce = Crypto.randomUUID();
    const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

    let appleCredential: AppleAuthentication.AppleAuthenticationCredential;
    try {
      appleCredential = await AppleAuthentication.signInAsync({ requestedScopes: scopes, nonce: hashedNonce });
    } catch (error) {
      if ((error as { code?: string }).code === 'ERR_REQUEST_CANCELED') {
        return null;
      }
      throw error;
    }
    if (!appleCredential.identityToken) {
      throw new Error('Apple no devolvió un identityToken.');
    }
    const credential = new OAuthProvider('apple.com').credential({ idToken: appleCredential.identityToken, rawNonce });
    return { appleCredential, credential };
  };

  /** Pasa por Google y devuelve la credencial de Firebase; null si cancela. */
  const pedirGoogle = async () => {
    if (!google) {
      throw new Error('Google Sign-In no está disponible en Expo Go; usa el development build.');
    }
    const { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } = google;
    try {
      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse(response)) return null;
      if (!response.data.idToken) throw new Error('Google no devolvió un idToken.');
      return GoogleAuthProvider.credential(response.data.idToken);
    } catch (error) {
      if (isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_CANCELLED) return null;
      throw error;
    }
  };

  const loginWithApple = async () => {
    const apple = await pedirApple([
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ]);
    if (!apple) return false;
    const { appleCredential, credential } = apple;
    const result = await signInWithCredential(auth, credential);

    // Apple solo envía el nombre la primera vez; guardarlo ya o se pierde.
    const fullName = [appleCredential.fullName?.givenName, appleCredential.fullName?.familyName]
      .filter(Boolean)
      .join(' ');
    if (fullName && !result.user.displayName) {
      await updateProfile(result.user, { displayName: fullName });
    }
    return true;
  };

  const deleteAccount = async (password?: string) => {
    const actual = auth.currentUser;
    if (!actual) throw new Error('Not signed in');
    const metodo = actual.providerData?.[0]?.providerId ?? 'password';

    // 1. Confirmar que es la persona, con el mismo método con el que entró.
    if (metodo === 'apple.com') {
      const apple = await pedirApple([]);
      if (!apple) return false;
      await reauthenticateWithCredential(actual, apple.credential);
      // Apple pide revocar el acceso de la app al borrar la cuenta.
      if (apple.appleCredential.authorizationCode) {
        try {
          await revokeAccessToken(auth, apple.appleCredential.authorizationCode);
        } catch {
          // Sin la clave de Apple configurada en Firebase no se puede revocar;
          // la cuenta se borra igualmente.
        }
      }
    } else if (metodo === 'google.com') {
      const credential = await pedirGoogle();
      if (!credential) return false;
      await reauthenticateWithCredential(actual, credential);
    } else {
      if (!password) throw Object.assign(new Error('Password required'), { code: 'auth/missing-password' });
      await reauthenticateWithCredential(actual, EmailAuthProvider.credential(actual.email ?? '', password));
    }

    // 2. Sus datos y, por último, la cuenta.
    await api.deleteMyData();
    await deleteUser(actual);
    try {
      await google?.GoogleSignin.signOut();
    } catch {
      // no había sesión de Google
    }
    return true;
  };

  const logout = async () => {
    // Antes de salir, mientras aún hay sesión para poder escribir.
    await olvidarEsteDispositivo();
    await signOut(auth);
    // Si no se cierra también en Google, la próxima vez no deja elegir cuenta.
    try {
      await google?.GoogleSignin.signOut();
    } catch {
      // no había sesión de Google; nada que hacer
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        refreshProfile,
        initializing,
        register,
        login,
        resetPassword,
        loginWithGoogle,
        loginWithApple,
        logout,
        deleteAccount,
        provider: user?.providerData?.[0]?.providerId ?? (user ? 'password' : null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}

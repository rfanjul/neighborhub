import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  GoogleAuthProvider,
  OAuthProvider,
  createUserWithEmailAndPassword,
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
import { isExpoGo } from './environment';

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
  /** true mientras Firebase restaura la sesión guardada al arrancar */
  initializing: boolean;
  register: (name: string, email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  /** Resuelve a false si el usuario cancela el diálogo nativo */
  loginWithGoogle: () => Promise<boolean>;
  loginWithApple: () => Promise<boolean>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (next) => {
      setUser(next);
      setInitializing(false);
    });
  }, []);

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

  const loginWithApple = async () => {
    if (!(await AppleAuthentication.isAvailableAsync())) {
      throw new Error('Sign in with Apple no está disponible aquí (Expo Go o simulador sin Apple ID).');
    }
    // Firebase pide un nonce: se manda a Apple el hash SHA-256 y a Firebase
    // el valor en claro, así puede comprobar que el token es de esta petición.
    const rawNonce = Crypto.randomUUID();
    const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

    let appleCredential: AppleAuthentication.AppleAuthenticationCredential;
    try {
      appleCredential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'ERR_REQUEST_CANCELED') {
        return false;
      }
      throw error;
    }
    if (!appleCredential.identityToken) {
      throw new Error('Apple no devolvió un identityToken.');
    }

    const provider = new OAuthProvider('apple.com');
    const credential = provider.credential({ idToken: appleCredential.identityToken, rawNonce });
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

  const logout = async () => {
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
      value={{ user, initializing, register, login, resetPassword, loginWithGoogle, loginWithApple, logout }}
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

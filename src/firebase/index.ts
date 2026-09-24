import { getApp, getApps, initializeApp } from 'firebase/app';
import { getFirestore, initializeFirestore, type Firestore } from '@firebase/firestore';
import { getAuth, initializeAuth, type Auth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// `firebase/auth` resuelve al build de navegador en tsc; el build de React
// Native (con persistencia en AsyncStorage) vive en @firebase/auth bajo la
// condición "react-native", que Metro sí respeta. Por eso va con require.
const { getReactNativePersistence } = require('@firebase/auth');

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

let auth: Auth;
try {
  auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
} catch {
  // Fast Refresh vuelve a ejecutar el módulo; initializeAuth lanza "already initialized".
  auth = getAuth(app);
}

// El transporte por WebChannel de Firestore no funciona de forma fiable en
// React Native: unas redes lo bloquean y la autodetección no siempre acierta
// (el síntoma es "client is offline" o una promesa que nunca resuelve). Con
// long polling forzado va siempre, a cambio de algo más de tráfico.
let db: Firestore;
try {
  db = initializeFirestore(app, { experimentalForceLongPolling: true });
} catch {
  // Fast Refresh: ya estaba inicializado.
  db = getFirestore(app);
}

export { auth, db };

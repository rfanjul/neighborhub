// jest.setup.ts mockea src/firebase para el resto de la suite; aquí interesa
// el módulo real, así que se descarta ese mock y se recarga en cada caso.
jest.unmock('../firebase');

const env = {
  EXPO_PUBLIC_FIREBASE_API_KEY: 'api-key',
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: 'demo.firebaseapp.com',
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'demo',
  EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: 'demo.appspot.com',
  EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '123',
  EXPO_PUBLIC_FIREBASE_APP_ID: '1:123:ios:abc',
};

type Mocks = {
  initializeApp: jest.Mock;
  getApp: jest.Mock;
  getApps: jest.Mock;
  initializeAuth: jest.Mock;
  getAuth: jest.Mock;
  getReactNativePersistence: jest.Mock;
  initializeFirestore: jest.Mock;
  connectAuthEmulator: jest.Mock;
  connectFirestoreEmulator: jest.Mock;
  connectStorageEmulator: jest.Mock;
  getFunctions: jest.Mock;
  connectFunctionsEmulator: jest.Mock;
};

/** Carga src/firebase con mocks frescos y devuelve el módulo y sus espías. */
function loadFirebase(
  options: { existingApps?: unknown[]; initializeAuthThrows?: boolean; connectThrows?: boolean } = {}
) {
  const mocks: Mocks = {
    initializeApp: jest.fn(() => ({ name: 'nueva-app' })),
    getApp: jest.fn(() => ({ name: 'app-existente' })),
    getApps: jest.fn(() => options.existingApps ?? []),
    initializeAuth: jest.fn(() => {
      if (options.initializeAuthThrows) throw new Error('already initialized');
      return { id: 'auth-nuevo' };
    }),
    getAuth: jest.fn(() => ({ id: 'auth-existente' })),
    getReactNativePersistence: jest.fn((storage: unknown) => ({ persistencia: storage })),
    initializeFirestore: jest.fn(() => ({ id: 'firestore' })),
    connectAuthEmulator: jest.fn(() => {
      if (options.connectThrows) throw new Error('already connected');
    }),
    connectFirestoreEmulator: jest.fn(),
    connectStorageEmulator: jest.fn(),
    getFunctions: jest.fn(() => ({ id: 'functions' })),
    connectFunctionsEmulator: jest.fn(),
  };

  jest.resetModules();
  jest.doMock('firebase/app', () => ({
    initializeApp: mocks.initializeApp,
    getApp: mocks.getApp,
    getApps: mocks.getApps,
  }));
  jest.doMock('firebase/auth', () => ({
    initializeAuth: mocks.initializeAuth,
    getAuth: mocks.getAuth,
    connectAuthEmulator: mocks.connectAuthEmulator,
  }));
  jest.doMock('@firebase/firestore', () => ({
    initializeFirestore: mocks.initializeFirestore,
    getFirestore: jest.fn(() => ({ id: 'firestore-existente' })),
    connectFirestoreEmulator: mocks.connectFirestoreEmulator,
  }));
  jest.doMock('firebase/storage', () => ({
    getStorage: jest.fn(() => ({ id: 'storage' })),
    connectStorageEmulator: mocks.connectStorageEmulator,
  }));
  jest.doMock('firebase/functions', () => ({
    getFunctions: mocks.getFunctions,
    connectFunctionsEmulator: mocks.connectFunctionsEmulator,
  }));
  jest.doMock('@firebase/auth', () => ({ getReactNativePersistence: mocks.getReactNativePersistence }));
  jest.doMock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: { almacen: true } }));

  const firebase = require('../firebase');
  return { firebase, mocks };
}

const originalEnv = process.env;

beforeEach(() => {
  process.env = { ...originalEnv, ...env };
});

afterAll(() => {
  process.env = originalEnv;
});

describe('inicialización de Firebase', () => {
  it('crea la app con la configuración del entorno', () => {
    const { mocks } = loadFirebase();

    expect(mocks.initializeApp).toHaveBeenCalledWith({
      apiKey: 'api-key',
      authDomain: 'demo.firebaseapp.com',
      projectId: 'demo',
      storageBucket: 'demo.appspot.com',
      messagingSenderId: '123',
      appId: '1:123:ios:abc',
    });
    expect(mocks.getApp).not.toHaveBeenCalled();
  });

  it('reutiliza la app ya creada en lugar de crear otra', () => {
    const { mocks } = loadFirebase({ existingApps: [{ name: 'app-existente' }] });

    expect(mocks.initializeApp).not.toHaveBeenCalled();
    expect(mocks.getApp).toHaveBeenCalled();
  });

  it('guarda la sesión en AsyncStorage para que sobreviva al cierre de la app', () => {
    const { firebase, mocks } = loadFirebase();

    expect(mocks.getReactNativePersistence).toHaveBeenCalledWith({ almacen: true });
    expect(mocks.initializeAuth).toHaveBeenCalledWith(expect.anything(), {
      persistence: { persistencia: { almacen: true } },
    });
    expect(firebase.auth).toEqual({ id: 'auth-nuevo' });
  });

  it('fuerza long polling en Firestore, que en React Native falla sin él', () => {
    const { firebase, mocks } = loadFirebase();

    expect(mocks.initializeFirestore).toHaveBeenCalledWith(expect.anything(), {
      experimentalForceLongPolling: true,
    });
    expect(firebase.db).toEqual({ id: 'firestore' });
  });

  it('recupera la instancia existente cuando Fast Refresh reejecuta el módulo', () => {
    const { firebase, mocks } = loadFirebase({ initializeAuthThrows: true });

    expect(mocks.getAuth).toHaveBeenCalled();
    expect(firebase.auth).toEqual({ id: 'auth-existente' });
  });
});

describe('firebaseConfigured', () => {
  it('es true con api key y project id', () => {
    expect(loadFirebase().firebase.firebaseConfigured).toBe(true);
  });

  it.each(['EXPO_PUBLIC_FIREBASE_API_KEY', 'EXPO_PUBLIC_FIREBASE_PROJECT_ID'])(
    'es false si falta %s',
    (missing) => {
      delete process.env[missing];

      expect(loadFirebase().firebase.firebaseConfigured).toBe(false);
    }
  );
});

describe('modo demo con emuladores', () => {
  it('sin EXPO_PUBLIC_USE_EMULATORS habla con el proyecto real', () => {
    const { firebase, mocks } = loadFirebase();

    expect(firebase.usandoEmuladores).toBe(false);
    expect(mocks.connectAuthEmulator).not.toHaveBeenCalled();
    expect(mocks.connectFirestoreEmulator).not.toHaveBeenCalled();
    expect(mocks.connectStorageEmulator).not.toHaveBeenCalled();
    expect(mocks.connectFunctionsEmulator).not.toHaveBeenCalled();
  });

  it('los pagos van a las Functions de Zúrich', () => {
    const { firebase, mocks } = loadFirebase();

    expect(mocks.getFunctions).toHaveBeenCalledWith({ name: 'nueva-app' }, 'europe-west6');
    expect(firebase.functions).toEqual({ id: 'functions' });
  });

  it('con EXPO_PUBLIC_USE_EMULATORS=1 conecta auth, Firestore y Storage a los emuladores locales', () => {
    process.env.EXPO_PUBLIC_USE_EMULATORS = '1';
    const { firebase, mocks } = loadFirebase();

    expect(firebase.usandoEmuladores).toBe(true);
    expect(mocks.connectAuthEmulator).toHaveBeenCalledWith({ id: 'auth-nuevo' }, 'http://127.0.0.1:9099', { disableWarnings: true });
    expect(mocks.connectFirestoreEmulator).toHaveBeenCalledWith({ id: 'firestore' }, '127.0.0.1', 8180);
    expect(mocks.connectStorageEmulator).toHaveBeenCalledWith({ id: 'storage' }, '127.0.0.1', 9199);
    expect(mocks.connectFunctionsEmulator).toHaveBeenCalledWith({ id: 'functions' }, '127.0.0.1', 5001);
  });

  it('el host se puede cambiar, p. ej. para un móvil en la misma red', () => {
    process.env.EXPO_PUBLIC_USE_EMULATORS = '1';
    process.env.EXPO_PUBLIC_EMULATOR_HOST = '192.168.1.20';
    const { mocks } = loadFirebase();

    expect(mocks.connectFirestoreEmulator).toHaveBeenCalledWith(expect.anything(), '192.168.1.20', 8180);
  });

  it('si Fast Refresh reejecuta el módulo y ya estaban conectados, no rompe', () => {
    process.env.EXPO_PUBLIC_USE_EMULATORS = '1';

    expect(() => loadFirebase({ connectThrows: true })).not.toThrow();
  });
});

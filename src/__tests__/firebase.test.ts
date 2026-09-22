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
};

/** Carga src/firebase con mocks frescos y devuelve el módulo y sus espías. */
function loadFirebase(options: { existingApps?: unknown[]; initializeAuthThrows?: boolean } = {}) {
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

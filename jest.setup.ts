
// Las variables de entorno llegan por .env en la app real; en los tests se
// fijan aquí para que Google no falle por configuración ausente.
process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = 'test-ios-client-id';
process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID = 'test-web-client-id';

// Firebase se inicializa contra un proyecto real al importar src/firebase:
// en los tests basta con un objeto marcador que los mocks de firebase/auth
// reciben como primer argumento.
jest.mock('./src/firebase', () => ({ auth: { __mockAuth: true }, firebaseConfigured: true }));

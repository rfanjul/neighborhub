
// Las variables de entorno llegan por .env en la app real; en los tests se
// fijan aquí para que Google no falle por configuración ausente.
process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = 'test-ios-client-id';
process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID = 'test-web-client-id';

// Firebase se inicializa contra un proyecto real al importar src/firebase:
// en los tests basta con un objeto marcador que los mocks de firebase/auth
// reciben como primer argumento.
jest.mock('./src/firebase', () => ({ auth: { __mockAuth: true }, firebaseConfigured: true }));

// La capa de Firestore toca red y arrastra los paquetes ESM de @firebase:
// se mockea para toda la suite y cada test ajusta lo que necesite.
jest.mock('./src/firebase/data', () => ({
  ensureUserDocument: jest.fn(async () => undefined),
  api: {
    getMe: jest.fn(async () => null),
    updateMe: jest.fn(async () => null),
    listServices: jest.fn(async () => []),
    getService: jest.fn(async () => null),
    createService: jest.fn(async () => null),
    listMyServices: jest.fn(async () => []),
    updateService: jest.fn(async () => null),
    countCompletedHelps: jest.fn(async () => 0),
    getUserProfile: jest.fn(async () => null),
    rateHelper: jest.fn(async () => undefined),
    getReview: jest.fn(async () => null),
    listReviewsFor: jest.fn(async () => []),
    listServicesBy: jest.fn(async () => []),
    deleteMyData: jest.fn(async () => undefined),
    applyToService: jest.fn(async () => null),
    listMyApplications: jest.fn(async () => []),
    listApplicationsForService: jest.fn(async () => []),
    selectApplicant: jest.fn(async () => undefined),
    subscribeMessages: jest.fn(() => () => {}),
    sendMessage: jest.fn(async () => undefined),
    uploadMyPhoto: jest.fn(async () => null),
    uploadServicePhoto: jest.fn(async () => ''),
    deleteServicePhoto: jest.fn(async () => undefined),
    activarCobros: jest.fn(async () => 'https://accounts.stripe.com/r/acct_test'),
    estadoCobros: jest.fn(async () => ({ conCuenta: true, activos: true, pendiente: false })),
    pagarOferta: jest.fn(async () => 'https://checkout.stripe.com/c/pay/cs_test'),
    pagarServicio: jest.fn(async () => 'https://checkout.stripe.com/c/pay/cs_crear'),
    elegirOfertaPagada: jest.fn(async () => undefined),
    cancelarServicio: jest.fn(async () => ({ reembolsado: 0 })),
    misPagos: jest.fn(async () => []),
    guardarDispositivo: jest.fn(async () => undefined),
    misBloqueos: jest.fn(async () => []),
    bloquear: jest.fn(async () => undefined),
    desbloquear: jest.fn(async () => undefined),
    denunciar: jest.fn(async () => undefined),
    olvidarDispositivo: jest.fn(async () => undefined),
  },
}));

// El idioma elegido se guarda en AsyncStorage; en test, su mock en memoria.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Las pantallas leen los márgenes seguros del dispositivo; en test no hay
// dispositivo, así que se usa el mock que publica la propia librería.
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

// El mapa es nativo: en test se sustituye por vistas que exponen sus props.
jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View, Pressable } = require('react-native');
  const MapView = ({ children, testID, onPress }: any) => (
    <Pressable testID={testID} onPress={() => onPress?.()}>{children}</Pressable>
  );
  const Marker = ({ testID, onPress, title, coordinate }: any) => (
    <Pressable
      testID={testID}
      accessibilityLabel={title}
      onPress={() => onPress?.({ stopPropagation: () => {} })}
      {...{ coordinate }}
    />
  );
  return { __esModule: true, default: MapView, Marker, PROVIDER_GOOGLE: 'google', View };
});

// Ubicación por defecto: sin permiso. Cada test que la necesite la ajusta.
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(async () => ({ granted: false })),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));

// Avisos push: módulo nativo. Cada test ajusta permisos y respuestas.
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: 'ExponentPushToken[test]' })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
}));

// Configuración remota: pagos activos por defecto; un test los apaga con __ponerPagos(false).
jest.mock('./src/config/remota', () => {
  let activos = true;
  return {
    cargarConfig: jest.fn(async () => undefined),
    pagosActivos: () => activos,
    usePagosActivos: () => activos,
    __ponerPagos: (valor: boolean) => {
      activos = valor;
    },
  };
});

import type { ConfigContext, ExpoConfig } from 'expo/config';

// Expo CLI carga .env antes de evaluar este archivo, así que los valores
// de Google llegan por process.env sin dotenv.
// API key de Google Maps para iOS (Google Cloud -> Credentials). Sin ella la
// app usa el mapa nativo de Apple; ver src/screens/MapScreen.tsx.
const googleMapsIosApiKey = process.env.GOOGLE_MAPS_IOS_API_KEY;

const googleIosUrlScheme =
  process.env.GOOGLE_IOS_URL_SCHEME || 'com.googleusercontent.apps.PENDIENTE-VER-README';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Neighborhub',
  slug: 'login-demo',
  scheme: 'logindemo',
  ios: {
    ...config.ios,
    bundleIdentifier: 'com.app.neighborhub',
    usesAppleSignIn: true,
  },
  android: {
    ...config.android,
    package: 'com.app.neighborhub',
  },
  extra: {
    ...config.extra,
    googleMapsEnabled: Boolean(googleMapsIosApiKey),
  },
  plugins: [
    'expo-dev-client',
    'expo-font',
    [
      'expo-camera',
      {
        cameraPermission: 'Neighborhub usa la cámara para que te hagas la foto de perfil.',
        recordAudioAndroid: false,
      },
    ],
    [
      'expo-image-picker',
      { photosPermission: 'Neighborhub usa tus fotos para que ilustres los servicios que publicas.' },
    ],
    [
      'expo-location',
      { locationWhenInUsePermission: 'Neighborhub usa tu ubicación para mostrarte peticiones de ayuda cerca.' },
    ],
    [
      'expo-splash-screen',
      { image: './assets/splash-icon.png', resizeMode: 'contain', backgroundColor: '#FBF3EA', imageWidth: 180 },
    ],
    'expo-apple-authentication',
    ['@react-native-google-signin/google-signin', { iosUrlScheme: googleIosUrlScheme }],
    ['react-native-maps', googleMapsIosApiKey ? { iosGoogleMapsApiKey: googleMapsIosApiKey } : {}],
  ],
});

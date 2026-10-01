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
    infoPlist: {
      ...config.ios?.infoPlist,
      // La app está en inglés, alemán y español: así iOS elige bien el idioma
      // de lo nativo (botón de Apple, permisos) y deja cambiarlo en Ajustes.
      CFBundleDevelopmentRegion: 'en',
      CFBundleLocalizations: ['en', 'de', 'es'],
      // Solo HTTPS estándar (Firebase): exenta de la declaración de
      // exportación, así App Store Connect no la pregunta en cada build.
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  // Textos nativos (permisos y nombre) en cada idioma.
  locales: {
    en: './languages/en.json',
    de: './languages/de.json',
    es: './languages/es.json',
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
        cameraPermission: 'Neighborhub uses the camera for your profile photo and to take pictures of the help you need.',
        recordAudioAndroid: false,
      },
    ],
    [
      'expo-image-picker',
      { photosPermission: 'Neighborhub uses your photos so you can illustrate the requests you post.' },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Neighborhub uses your location to show you requests for help nearby and to place yours on the map.',
      },
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

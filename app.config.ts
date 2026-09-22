import type { ConfigContext, ExpoConfig } from 'expo/config';

// Expo CLI carga .env antes de evaluar este archivo, así que los valores
// de Google llegan por process.env sin dotenv.
const googleIosUrlScheme =
  process.env.GOOGLE_IOS_URL_SCHEME || 'com.googleusercontent.apps.PENDIENTE-VER-README';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Login Demo',
  slug: 'login-demo',
  scheme: 'logindemo',
  ios: {
    ...config.ios,
    bundleIdentifier: 'com.neighborhub',
    usesAppleSignIn: true,
  },
  android: {
    ...config.android,
    package: 'com.neighborhub',
  },
  plugins: [
    'expo-dev-client',
    'expo-apple-authentication',
    ['@react-native-google-signin/google-signin', { iosUrlScheme: googleIosUrlScheme }],
  ],
});

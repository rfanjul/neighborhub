# Login Demo

App iOS en React Native (Expo SDK 57) con Firebase Authentication:
email + contraseña, Google y Sign in with Apple.

- Bundle ID: `com.rfanjul.logindemo`
- Proyecto Firebase: el mismo que Neighbo (config copiada en `.env`)
- Necesita un **development build** (`expo run:ios`), no Expo Go: Google
  nativo y Apple usan módulos nativos.

## Estructura

```
App.tsx                        Providers + navegador
app.config.ts                  Bundle ID, Apple Sign-In, plugin de Google (lee .env)
src/firebase.ts                initializeAuth con persistencia en AsyncStorage
src/auth/AuthContext.tsx       register / login / resetPassword / loginWithGoogle / loginWithApple / logout
src/auth/errors.ts             Códigos de Firebase -> mensajes legibles
src/navigation/RootNavigator   Splash -> (Welcome/Login/Register/Forgot) o Home según sesión
src/screens/*                  Pantallas
```

## Configuración (una sola vez)

### 1. Xcode 26
Expo SDK 57 no compila con Xcode 15. Instala Xcode 26 desde el App Store,
ábrelo una vez, acepta la licencia e inicia sesión con tu Apple ID de
desarrollador en *Settings → Accounts*.

### 2. Firebase: registrar la app iOS
Consola de Firebase → proyecto Neighbo → *Project settings → General → Your
apps → Add app → iOS*:

1. Bundle ID: `com.rfanjul.logindemo`. Nombre cualquiera. Sin App Store ID.
2. Descarga `GoogleService-Info.plist` y guárdalo en la raíz de este proyecto
   (está en `.gitignore`).
3. Copia dos valores del plist a `.env`:
   - `CLIENT_ID` → `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
   - `REVERSED_CLIENT_ID` → `GOOGLE_IOS_URL_SCHEME`

   Para verlos rápido:
   ```bash
   grep -A1 -E "REVERSED_CLIENT_ID|<key>CLIENT_ID" GoogleService-Info.plist
   ```

### 3. Firebase: proveedores
*Authentication → Sign-in method*:
- **Email/Password**: activado (ya lo estaba).
- **Google**: activado (ya lo estaba). El *Web client ID* ya está en
  `EXPO_PUBLIC_GOOGLE_CLIENT_ID`.
- **Apple**: activar. Para iOS nativo no hace falta rellenar Services ID,
  Team ID ni clave privada; solo *Enable → Save*.

### 4. Apple Developer: capability
En https://developer.apple.com/account → *Certificates, IDs & Profiles →
Identifiers*: si `com.rfanjul.logindemo` no existe, Xcode lo creará al
compilar con firma automática. Comprueba que el App ID tiene marcada la
capability **Sign In with Apple** (Xcode la añade sola por el entitlement
que genera Expo; si no, márcala a mano y guarda).

## Ejecutar

```bash
npx expo run:ios
```

La primera vez genera `ios/`, instala pods y compila (varios minutos). Con
`--device` compila para tu iPhone conectado. Después, para iterar solo en
JS basta con `npx expo start` y abrir la app ya instalada.

Si cambias algo en `app.config.ts` o `.env` que afecte a nativo (el URL
scheme de Google, por ejemplo), regenera con:

```bash
npx expo prebuild --platform ios --clean && npx expo run:ios
```

## Probar

- **Email**: crear cuenta → cerrar sesión → entrar → "olvidé mi contraseña"
  (llega un email de Firebase).
- **Google**: abre el selector nativo de cuentas de Google. Funciona en
  simulador.
- **Apple**: en simulador hace falta tener un Apple ID iniciado en
  *Settings → Sign in*; en un iPhone físico funciona directamente. Apple solo
  envía el nombre la primera vez; para volver a probarlo como "primer
  login", revoca la app en *Settings → Apple ID → Sign in with Apple*.
- Cierra y reabre la app: la sesión se restaura sin pasar por el login.

## Errores típicos

| Síntoma | Causa |
|---|---|
| `Missing iosUrlScheme` al compilar | `GOOGLE_IOS_URL_SCHEME` vacío en `.env` |
| Google: `DEVELOPER_ERROR` / vuelve sin token | `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` no coincide con el plist, o el bundle ID en Firebase es otro |
| Apple: `auth/operation-not-allowed` | Proveedor Apple sin activar en Firebase |
| Apple: botón no responde / error 1000 | Capability no activa en el App ID, o simulador sin Apple ID |
| `auth/invalid-credential` con Google | El `webClientId` no es el de este proyecto Firebase |

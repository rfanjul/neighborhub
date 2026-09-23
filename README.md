# Login Demo

App iOS en React Native (Expo SDK 57) con Firebase Authentication:
email + contraseña, Google y Sign in with Apple.

- Bundle ID: `com.app.neighborhub`
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

1. Bundle ID: `com.app.neighborhub`. Nombre cualquiera. Sin App Store ID.
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
Identifiers*: si `com.app.neighborhub` no existe, Xcode lo creará al
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

## Probar en un iPhone sin Xcode (EAS Build)

Google y Apple necesitan un development build; en Expo Go no existen esos
módulos nativos. Si el Mac no puede compilar para la versión de iOS del
teléfono, EAS compila en la nube:

```bash
npx eas-cli login                                      # cuenta de Expo
npx eas-cli device:create                              # registra el UDID del iPhone
npx eas-cli build --profile development --platform ios # compila y da un enlace
```

`eas device:create` abre un perfil de registro que se instala desde el propio
iPhone; después, el build se descarga desde el enlace que imprime el comando.
La primera vez pide las credenciales de Apple Developer para generar el
certificado y el perfil de aprovisionamiento.

Una vez instalada la app, se conecta a Metro como cualquier development build:

```bash
npx expo start --dev-client
```

## Reglas de seguridad

`firestore.rules` y `storage.rules` son las que hay que publicar en la
consola (Firestore -> Rules y Storage -> Rules). Sin la de
`service-photos/` la subida de fotos de un servicio falla con
`storage/unauthorized`.

Están probadas contra los emuladores de Firebase, sin tocar el proyecto
real ni necesitar que Firestore esté activado en la nube:

```bash
npm run test:rules   # arranca Firestore y Storage locales, prueba y los apaga
```

Hace falta Java (17 o superior). `firebase-tools` está fijado a la v13
porque la 14 en adelante exige Java 21; en CI se usa Java 21 igualmente.

Cubren, entre otras cosas, que nadie pueda darse créditos, valoración o
verificación a sí mismo, aprobarse sus propios servicios o escribir en
conversaciones ajenas.

## Tests

```bash
npm test              # 101 tests, 10 suites
npm run test:coverage # además escribe coverage/ (HTML en coverage/lcov-report)
npm run typecheck     # tsc --noEmit
```

Cubren el contexto de autenticación (email, Google, Apple, logout, sesión
restaurada), la traducción de los códigos de error de Firebase, la
inicialización del SDK con persistencia, la detección de Expo Go, las cuatro
pantallas y el enrutado según haya sesión. Firebase y los módulos nativos
van mockeados, así que no tocan la red ni necesitan simulador.

## CI (GitHub Actions)

`.github/workflows/ci.yml` se ejecuta en cada push a cualquier rama y en cada
pull request:

1. `npm run typecheck`
2. `npm test -- --coverage --ci`

El job falla si algún test se pone en rojo **o** si la cobertura baja del 90%
en statements, branches, functions o lines — el umbral está en
`coverageThreshold` dentro de `jest.config.js`, así que se aplica igual en
local. El resumen de cobertura queda en la página del workflow y el informe
HTML como artefacto (`coverage`, 14 días).

### Bloquear el merge (hay que activarlo a mano en GitHub)

El workflow por sí solo marca la PR en rojo, pero no impide el merge hasta
que la rama esté protegida. En el repositorio: *Settings → Branches → Add
branch ruleset* (o *Add rule* en la interfaz clásica) sobre `main`, y activa:

- **Require status checks to pass before merging** → busca y añade el check
  **`Tests y cobertura`**.
- **Require branches to be up to date before merging** (opcional pero
  recomendable: evita que una PR verde rompa main al mezclarse con otra).
- **Do not allow bypassing the above settings**, si quieres que la regla
  aplique también a los administradores.

Con eso, una PR con tests en rojo o con menos del 90% de cobertura deja el
botón de merge deshabilitado.

## CI (GitLab)

`.gitlab-ci.yml` ejecuta en cada push:

1. `npm run typecheck`
2. `npm test -- --coverage`

El porcentaje de cobertura sale en el pipeline y en los merge requests
(anotado línea a línea vía Cobertura), los resultados de los tests en la
pestaña *Tests*, y el informe HTML completo queda como artefacto — además
de publicarse en GitLab Pages desde la rama por defecto.

Para que el badge de cobertura salga en el repositorio: *Settings → CI/CD →
General pipelines → Test coverage parsing* ya no hace falta (lo fija el
campo `coverage:` del job), basta con añadir el badge
`%{default_branch}/coverage.svg` en *Settings → General → Badges*.

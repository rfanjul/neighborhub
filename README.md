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

Si el iPhone no está en la misma red que el Mac, con túnel
(`npx expo start --dev-client --tunnel`). En ese caso la URL que se abre en
la app tiene que ser **https**:

```
exp+login-demo://expo-development-client/?url=https%3A%2F%2F<subdominio>.exp.direct
```

Si el túnel de Expo no arranca (`failed to start tunnel`, o en el log de
ngrok `ERR_NGROK_108`), no es un fallo del proyecto: usa una cuenta de
ngrok compartida por todos los usuarios de Expo y a veces llega a su
límite de sesiones. Alternativa sin cuenta, con Cloudflare
(`brew install cloudflared`):

```bash
cloudflared tunnel --url http://localhost:8085
# copia la URL https://….trycloudflare.com que imprime y:
EXPO_PACKAGER_PROXY_URL=https://….trycloudflare.com npx expo start --dev-client --port 8085
```

La URL para la app es entonces
`exp+login-demo://expo-development-client/?url=<URL de cloudflare codificada>`.
`EXPO_PACKAGER_PROXY_URL` hace que el manifiesto anuncie el bundle con esa
dirección https en vez de la IP local.

Con `http://` la app descarga el manifiesto pero no el bundle y sale
"Could not connect to development server": iOS (App Transport Security)
solo permite HTTP sin cifrar en la red local, no hacia un dominio de
internet como `exp.direct`. Safari sí lo abre, porque no está sujeto a esa
restricción, y eso despista.

## Mapa

El mapa pinta los servicios que tienen coordenadas (se guardan al
publicarlos) y los filtra por distancia a tu ubicación.

Usa **Google Maps** si `GOOGLE_MAPS_IOS_API_KEY` está definida al compilar;
si no, el mapa nativo de Apple. Para activarlo:

1. Google Cloud Console del proyecto -> *APIs & Services* -> *Library* ->
   **Maps SDK for iOS** -> Enable (requiere facturación activada).
2. *Credentials* -> *Create credentials* -> *API key*. Restríngela a
   *iOS apps* con el bundle `com.app.neighborhub` y a la API *Maps SDK for iOS*.
3. Ponla en `.env` como `GOOGLE_MAPS_IOS_API_KEY` y en EAS
   (`npx eas-cli env:create --name GOOGLE_MAPS_IOS_API_KEY ...`).
4. Build nuevo: el SDK de Google Maps va dentro del binario.

## Datos de prueba

`scripts/seed.js` crea 10 vecinos de Zúrich con 3 servicios **aprobados**
cada uno (título, descripción, categoría, fotos, GPS, duración, disponibilidad,
autor con foto y valoración). Todo lleva `seed: true` y ids `seed-…`.

Usa el Admin SDK, que se salta las reglas, así que necesita credenciales de
administrador. En Firebase Console → ⚙️ Configuración del proyecto → Cuentas de
servicio → **Generar nueva clave privada**, guárdala como
`service-account.json` en la raíz (está en `.gitignore`, nunca la subas) y:

```bash
npm run seed         # crea o actualiza (idempotente)
npm run seed:clean   # borra solo lo sembrado, más sus ofertas y mensajes
npm run seed -- --ofertas "Move table"   # 3 vecinos de prueba ofertan en tu servicio
```

`--ofertas` acepta el título exacto o el id del servicio; si estaba pendiente
lo aprueba, porque solo los aprobados admiten ofertas.

También vale `GOOGLE_APPLICATION_CREDENTIALS=/ruta/clave.json` o, contra el
emulador, `FIRESTORE_EMULATOR_HOST=localhost:8180`. Los vecinos de prueba
son solo perfiles de Firestore, no cuentas con las que se pueda iniciar sesión.

## Modo demo (emuladores locales)

Para ver y probar todas las pantallas sin tocar Firebase ni usar tu cuenta:
la app habla con los emuladores locales y hay una cuenta demo con servicios y
ofertas en cada estado (abierto con ofertas, en curso con chat, pendiente de
revisión, ofertas enviadas y elegidas, ayudas con reseñas).

```bash
npm run demo:emulators   # terminal 1: Auth, Firestore y Storage locales
npm run demo:seed        # terminal 2: vecinos de prueba + cuenta demo
npm run demo:app         # terminal 2: Metro en el puerto 8086
```

En el simulador, abre `exp+login-demo://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8086`
y en "Entrar con email" pulsa **Entrar con la cuenta demo** (solo aparece en
este modo). La cuenta vive solo en el emulador: `demo:seed` se niega a crearla
contra el proyecto real. Los datos se pierden al parar los emuladores.

## Web (Firebase Hosting)

La web pública (portada, cómo funciona, preguntas, soporte con formulario
de contacto, privacidad y términos) está en inglés, alemán y español en
https://neighborhood-c4dc9.web.app: `/en/`, `/de/` y `/es/`, cada una con
`/privacy`, `/terms` y `/support` (las URL que pide App Store Connect para
cada idioma). La raíz lleva a cada cual a su idioma.

Los textos están en `web-src/textos-{en,de,es}.js` (un test comprueba que
tienen las mismas claves) y las plantillas en `scripts/build-web.js`, que
genera `web/{en,de,es}/`. Lo estático (`styles.css`, `contacto.js`,
`idioma.js`, `img/`) vive directamente en `web/`.

```bash
npm run web:build                   # genera las páginas
npm run hosting:deploy -- --check   # lista lo que subiría
npm run hosting:deploy              # genera y publica con service-account.json
```

Los mensajes del formulario se guardan en Firestore (`contactMessages`) y se
leen en la consola de Firebase; las reglas solo dejan crear mensajes bien
formados. Para probarla en local: `npx firebase emulators:start --only
hosting,firestore --project demo-neighborhub` y abre http://127.0.0.1:5050.

## Administración (web /admin)

https://neighborhood-c4dc9.web.app/admin — ver, corregir y aprobar
servicios: los pendientes de revisión salen primero; se puede cambiar el
título, la categoría, la descripción, la duración, la disponibilidad y el
precio, aprobar (se ve en la app al momento) o despublicar. Los que ya están
en marcha solo se consultan.

Entra con email y contraseña quien tenga el claim `admin`, que solo pone el
Admin SDK (las reglas lo comprueban en cada escritura):

```bash
npm run admin -- --email tu@correo           # crea la cuenta o la hace admin
npm run admin -- --email tu@correo --nueva-clave
npm run admin -- --email tu@correo --quitar  # deja de ser admin al momento
npm run admin -- --lista
```

La contraseña nueva solo se muestra en el terminal. Una cuenta que entra
en la app con Apple o Google no tiene contraseña: dale una con
`--nueva-clave` o usa otro email. La sesión de la web dura lo que la
pestaña.

En local: `npm run demo:emulators`, `npx firebase emulators:start --only
hosting --project demo-neighborhub` y http://127.0.0.1:5050/admin (con un
admin creado con `FIRESTORE_EMULATOR_HOST=127.0.0.1:8180
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 FIREBASE_PROJECT_ID=demo-neighborhub
npm run admin -- --email admin@neighborhub.test`).

## Reglas de seguridad

`firestore.rules` y `storage.rules` son las que tienen que estar publicadas
en Firebase. Si en producción van por detrás, la app falla con "No tienes
permiso" (p. ej. al ofertar o al ver ofertas) o con `storage/unauthorized`
al subir fotos. Con `service-account.json` en la raíz (ver Datos de prueba):

```bash
npm run rules:deploy -- --check   # compara con lo publicado, sin tocar nada
npm run rules:deploy              # publica solo lo que haya cambiado
```

También se pueden pegar a mano en la consola (Firestore → Rules y
Storage → Rules). Firebase guarda el historial para volver atrás.

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

## Versiones

Cada build que sube a App Store Connect tiene su entrada en
[CHANGELOG.md](CHANGELOG.md) y su etiqueta en git (`v1.1.0-build.5`). El
paso a paso está en [docs/VERSIONES.md](docs/VERSIONES.md).

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

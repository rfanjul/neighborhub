# Cambios

Cada versión que sale en una build de EAS tiene aquí su entrada y en git su
etiqueta `v<versión>-build.<número>` (ver [docs/VERSIONES.md](docs/VERSIONES.md)).
Lo que aún no está en ninguna build va en **Sin publicar**.

## Sin publicar

### Alta de servicio más simple y datos del perfil validados
- **Nuevo servicio**: sin «Duración» ni «Distancia máxima». Lo que cuenta es
  si es gratis o su precio, que pasa al sitio de la duración (debajo de las
  fotos). Los servicios nuevos se guardan con `durationLabel: '—'` (el detalle
  ya no lo enseña) y un radio fijo de 5 km.
- **Tus datos**: nombre, fecha de nacimiento, ciudad, código postal e idiomas
  son obligatorios y se validan (la bio es opcional, hasta 500 caracteres):
  nombre y ciudad con letras, fecha real en DD/MM/AAAA (las barras se ponen
  solas) y al menos 16 años, código postal suizo de 4 cifras, al menos un
  idioma. Los errores salen en rojo bajo cada campo (`src/perfil/validar.ts`).
- **Para publicar u ofrecer ayuda** hace falta el perfil completo: si falta
  algo, la app lo explica y lleva a *Tus datos*. Se puede seguir mirando el
  muro sin completarlo.
- **Reglas**: lo mismo al guardar (solo los campos que cambian, para no
  bloquear perfiles antiguos a medias) y la fecha de `privado/` en DD/MM/AAAA.
  Publicadas.
- La cuenta de revisión y la demo tienen fecha de nacimiento (perfil completo).

## [1.1.0 (17)] — 2026-10-03 · TestFlight → revisión de App Store

Build EAS `9343c09d` desde el commit `316412b`. Es la que se manda a revisión,
con los pagos encendidos (Stripe en modo de prueba) y publicación manual. La
web, los textos de App Store y los datos de la cuenta de revisión ya están
publicados.

### Textos, web y App Store con los pagos
La 1.1.0 va a la revisión de Apple **con los pagos encendidos** (Stripe en
modo de prueba) y **publicación manual**: apagarlos para la revisión y
encenderlos después sería una función oculta (Guideline 2.3.1).

- App: el carrusel de bienvenida cuenta que se puede poner precio (se paga al
  publicar y se guarda hasta que esté hecho) y que al marcarlo como hecho quien
  ayudó recibe el precio entero.
- Web (en/de/es): portada sin «sin dinero» ni créditos (favor o precio justo,
  pagos seguros), **condiciones** con precios, pagos, gestión del 8 %,
  cancelación y reembolso, cobros con Stripe (Stripe Connected Account
  Agreement) e impuestos de quien ayuda; **privacidad** con datos de pagos,
  Stripe, notificaciones push (Expo) y conservación contable de 10 años;
  **ayuda** con tres preguntas sobre pagos.
- App Store (`store.config.json`): descripción, texto promocional, palabras
  clave y «What's New» de la 1.1 en los tres idiomas; publicación manual. Las
  seis capturas, de nuevo con precios («CHF 20» en el muro, el precio en el
  detalle y «pagado y guardado» en las ofertas) y subtítulos nuevos.
- `docs/APP_REVIEW.md`: guion con el flujo de pago, respuesta con la Guideline
  3.1.3(e), *Notes* para la revisión, checklist de App Store Connect y qué hacer
  al aprobarla (Stripe en modo real).
- Datos de la revisión (`npm run seed:revision -- --cuenta acct_…`): «Move a
  table…» queda sin pagar (quien revisa paga con la tarjeta 4242, elige y lo
  marca como hecho), con vecinos que pueden cobrar; «Hang a big mirror…» pasa a
  favor gratis. En el emulador (`demo:seed`) ya sale pagado, para las capturas.

## [1.1.0 (16)] — 2026-10-03 · TestFlight

Build EAS `e06df070` desde el commit `a5be292`. Trae el pago al crear el
servicio y la privacidad (email y fecha de nacimiento en `privado/`). Las
reglas, Functions y web de abajo ya están publicadas (reglas en transición).

### Pagos: se paga al crear el servicio
Nuevo flujo acordado: el dinero se cobra **al crear** un servicio con precio
(precio + 8 %, mínimo CHF 1) y queda retenido en Neighborhub; al marcarlo como
hecho quien lo pidió, el precio entero va a quien ayudó.

1. Crear con precio → Stripe Checkout al momento. Sin pagar no se revisa ni se
   publica (la administración no puede aprobarlo).
2. Elegir oferta → no se cobra nada más; el servidor apunta a quién se le
   pagará (tiene que tener los cobros activos).
3. «Hecho» → solo quien pidió (o la administración) → transferencia.
4. Cancelar → solo antes de elegir a nadie; si estaba pagado, se devuelve todo.

#### Servidor y web (se publican aparte)
- Functions nuevas: `pagarServicio`, `elegirOferta`, `cancelarServicio`,
  `adminCancelarServicio`, `adminMarcarHecho`. El webhook atiende el pago al
  crear (`alCrear`) y devuelve los que llegan tarde (cancelado, otro precio,
  enlace sustituido). `pagarOferta` sigue para los servicios de antes y, si ya
  está pagado al crear, solo elige (las builds hasta la 15 eligen por ahí).
  `liberarPago` busca la cuenta de cobro si falta.
- **Reglas: quien ayuda ya no puede dar el servicio por hecho** (liberaba su
  propio pago); solo lo pone «en curso». Uno pagado no cambia de precio, no se
  borra (se cancela) ni se elige desde la app; la administración no aprueba uno
  con precio sin pagar (con los pagos encendidos) ni le cambia el precio si ya
  está pagado. Estado nuevo `cancelled` (solo lo pone el servidor).
- Administración: «Falta el pago» en la lista y no deja aprobar; precio
  bloqueado si está pagado; botones **Rechazar (y devolver)** y **Marcar como
  hecho y pagar**; estado «Cancelado».

#### App
- Crear con precio: el botón es «Pagar CHF … y enviar»; abre Stripe y lleva al
  servicio. Si no se paga, el servicio lo ofrece («Para enviarlo a revisión,
  paga…») y Actividad lo marca «Falta el pago».
- Pagado y sin elegir: «CHF … pagados y guardados…»; elegir explica que quien
  ayude recibe el precio al marcarlo como hecho y que ya no se cancela.
- **Cancelar servicio** antes de elegir (con el reembolso si estaba pagado);
  estado «Cancelado». Borrar la cuenta cancela (y devuelve) los pagados.

### Privacidad: email y fecha de nacimiento fuera del perfil público
Cualquier vecino con sesión podía leer `users/{uid}` entero, y con él el email
y la fecha de nacimiento de todos (la app no los enseñaba, pero las reglas lo
permitían). Ahora van en `privado/{uid}`.

#### Servidor y web (se publican aparte)
- Reglas de Firestore: `privado/{uid}` (`email`, `dateOfBirth`) lo lee y
  escribe solo su dueño; la administración lo lee. El email se apunta al
  crear la cuenta y ya no cambia desde la app. `users/` ya no admite `email`
  ni `dateOfBirth`, ni al crear ni al editar.
- Functions: `adminReintentarPago` saca el email de quien pidió de
  `privado/`; `adminUsuarios`, el de los vecinos de ejemplo (sin cuenta).
- Administración: el editor de servicios lee el email de `privado/`.
- `npm run seed` los siembra en `privado/` (con `seed: true`, así que
  `seed:clean` se los lleva).
- `npm run migrar:privado` mueve los de los perfiles existentes: simulacro
  por defecto, `-- --aplicar` para escribir; respeta lo que ya haya en
  `privado/`. **Aún sin ejecutar en producción.**

#### App
- El alta crea el perfil público y `privado/` en la misma escritura; la fecha
  de nacimiento de *Datos personales* se guarda en `privado/`, y *Borrar
  cuenta* también lo borra (si no puede, no sigue).
- El perfil de otros vecinos ya no trae email ni fecha de nacimiento.

#### Al publicar
Publicado el 2026-10-03 **en transición**: `privado/` ya está en las reglas
(la build nueva lo necesita para dar de alta), pero `users/` aún admite el
email y la fecha de nacimiento, porque las builds hasta la 1.1.0 (15) —la de la
revisión de Apple incluida— los escriben ahí. Cuando ya no se usen: volver a
prohibirlos (líneas `TRANSICIÓN` de `firestore.rules` y sus tests), publicar las
reglas y ejecutar `npm run migrar:privado -- --aplicar`.

## [1.1.0 (15)] — 2026-10-02 · TestFlight

Build EAS `210d4690` desde el commit `2d4f468`. Trae a la app el botón para
volver a pagar (abajo, «App»); lo de servidor y web se publicó aparte y no
depende de la build.

### Solo servidor y web (publicados aparte)
- Administración → cada servicio con precio tiene una sección **Pago**: estado,
  importes, quién paga y quién cobra, el último error y los movimientos en
  Stripe (cobro, reembolsos, transferencias) con sus ids. Pestaña **Con pago**
  y chip del estado del pago en la lista.
- **Reintentar el pago** a quien ayudó (servicio terminado y pago en error,
  reembolsado o retenido). El dinero siempre es de quien pidió, nunca del
  saldo de Neighborhub: si el cobro aún lo tiene, se transfiere desde él; si
  se le devolvió, **se le pide que vuelva a pagar** con un enlace nuevo de
  Stripe Checkout (24 h; la administración lo enseña con «Copiar enlace» y
  puede generar otro, que anula el anterior). Al pagarlo, el precio va a quien
  ayudó al momento desde ese nuevo cobro. Si la transferencia ya está en
  Stripe, solo la apunta. Cada intento queda en `pagos/{id}.intentos`.
  Functions `adminVerPago` y `adminReintentarPago` (solo con el claim admin).
- Aviso push «Falta tu pago» a quien pidió (en/de/es), que abre Ajustes → Pagos.
- **Servicios con precio elegidos sin pagar** (con los pagos apagados se eligen
  como favor gratis y nadie cobra): salen en «Con pago» con el chip «Sin
  cobrar», y la administración puede **pedir el pago** a quien pidió (precio +
  gestión) con el mismo enlace. Se abre `pagos/{id}` (`sinPagoAlElegir`) hacia
  la cuenta de cobro de quien ayudó; el servicio solo gana `cobroPedido` (aviso
  «Falta tu pago» con su propio texto) y, al pagar, su resumen de pago entero.
- `misPagos` da a quien pidió el enlace (`urlPago`) mientras vale.
- Administración → pestaña **Usuarios**: las cuentas de Firebase Auth con su
  perfil (nombre, email, dónde, cómo entra —Apple, Google, email—, alta,
  último acceso, admin, desactivada, cobros activos, valoración, pedidos y
  ayudas), con búsqueda; al tocar una, su ficha con los servicios que pide y
  en los que ayuda (se abren en el editor). Los vecinos de ejemplo salen al
  final como ficticios. Function `adminUsuarios` (solo con el claim admin; no
  devuelve fecha de nacimiento ni bio).

### App
- Ajustes → Pagos: «Falta tu pago» con el botón **Pagar CHF …**, y la lista se
  actualiza al volver de Stripe.
- Ofertas del servicio: si hay que volver a pagar, lo explica con el botón
  para pagar (las builds anteriores siguen diciendo «reembolsado», que es
  verdad).

## [1.1.0 (14)] — 2026-10-02 · TestFlight

Build EAS `fade6f98` desde el commit `f5b4492`.

### Cambiado
- Ajustes → **Pagos** sale también con los pagos apagados si ya tienes
  pagos o cobros (antes desaparecía y no había forma de ver el historial).
  La cuenta de revisión de Apple no tiene, así que no lo ve.

### Solo web (Hosting, publicada aparte; no depende de la build)
- Administración: el botón **Pagos** y *Despublicar* piden confirmación con un
  diálogo dentro de la página en vez de `confirm()`, que algunos navegadores
  bloquean (el botón parecía no hacer nada).
- `/admin` se sirve sin caché (`Cache-Control: no-cache` en `firebase.json`,
  que ahora `scripts/deploy-hosting.js` también publica).

## [1.1.0 (13)] — 2026-10-02 · TestFlight

Build EAS `185ad3c9` desde el commit `8c1cedf`. La app es **igual que la
11**: desde `39aa871` solo cambian la web de administración (Hosting),
`firebase.json`, `scripts/deploy-hosting.js` y la documentación.

## [1.1.0 (12)] — 2026-10-02 · TestFlight

Build EAS `b0f8b086` desde el commit `1ea3257`. La app es **igual que la
11**: entre los dos commits solo cambian `CHANGELOG.md` y
`docs/VERSIONES.md`. Para la revisión vale cualquiera de las dos.

## [1.1.0 (11)] — 2026-10-02 · TestFlight → revisión de App Store

Rama `feature/pagos`. Build EAS `9e38810d` desde el commit `39aa871`. Es la
que se manda a revisión con la respuesta a la Guideline 2.1
([docs/APP_REVIEW.md](docs/APP_REVIEW.md)), con los **pagos apagados** en
`config/app`.

Builds intermedias desde la 6:
| Build | Commit | Qué añadía |
|---|---|---|
| 8 y 9 | `aa909a3` | Pagos en el perfil y notificaciones push |
| 10 | `c820f98` | Bloquear y denunciar, pagos en ajustes y el arreglo del reembolso |
| 11 | `39aa871` | Interruptor de pagos |
| 12 | `1ea3257` | Nada en la app (solo documentación) |

### Añadido
- **Interruptor de pagos** (`config/app.pagosActivos`, en la web de
  administración): apagados, la app no enseña precios, cobros ni pagos y
  todo funciona como favores gratis; las reglas y `pagarOferta` lo
  respetan. Se apagan para la revisión de Apple hasta tener Stripe en real.
- **Bloquear y denunciar** (normas de contenido de usuarios de Apple, 1.2):
  denunciar un servicio, un vecino o una conversación con un motivo, desde
  la app (queda en `reports/`); bloquear y desbloquear vecinos desde su
  perfil, el detalle del servicio o el chat (⋯). A quien bloqueas no lo
  ves en el muro, el mapa ni las ofertas, y no puede escribirte ni
  ofertarse en lo tuyo (también en las reglas). Ajustes → Vecinos
  bloqueados. La web de administración tiene una pestaña **Denuncias**
  para revisarlas (despublicar el servicio o darla por revisada).
- Ajustes → **Pagos**: lo que has pagado y lo que cobras, con su estado
  (sin completar, retenido, pagado/cobrado) y «Ver todos». Función
  `misPagos` (sin datos de Stripe). *Publicado; funciona con la app de la
  build 6.*
- **Notificaciones push** (`expo-notifications` + servicio de Expo), en el
  idioma de cada uno: oferta nueva, mensaje nuevo, servicio aprobado, te
  han elegido (con el pago asegurado), pago confirmado, marcado como hecho,
  te han valorado, pago transferido/cobrado y cobros activados. Tocar una
  abre su pantalla. Los tokens van en `dispositivos/{uid}`, privado; se
  borran al cerrar sesión o si Expo los da por caducados. *Necesita build
  nueva (módulo nativo y capacidad Push en iOS).*

### Corregido
- Un pago real del Sandbox lo **devolvió el emulador local** (el reenvío de
  `stripe listen` seguía abierto y el emulador no conocía el servicio), y
  al completarlo la transferencia falló en silencio. Ahora cada pago lleva
  su proyecto y el webhook ignora los de otro entorno; nunca se devuelve un
  pago sin registro propio; y si la transferencia falla queda
  «reembolsado» o «error» (la app lo dice) en vez de «retenido».

## [1.1.0 (6)] — 2026-10-01 · TestFlight, prueba interna de pagos

Rama `feature/pagos`. Build EAS `5f270eb4` desde el commit `390eab0`.
Usa los pagos **en modo test**: tarjetas de prueba de Stripe, sin dinero real.

Publicado a la vez en Firebase (`neighborhood-c4dc9`): Cloud Functions de
pagos (europe-west6, y `liberarPago` en europe-west1), secretos de Stripe en
Secret Manager, reglas de Firestore y las páginas `/pago`, `/cobros` y
`/admin`. En Stripe (Sandbox), dos webhooks hacia `stripeWebhook`: pagos
(`checkout.session.completed`) y Connect (`account.updated`).

### Añadido
- Web de administración en `/admin` (Firebase Hosting): lista de servicios
  por estado con buscador, y editor para corregir título, categoría,
  descripción, duración, disponibilidad y precio, aprobar o despublicar.
  Login con email y contraseña; solo entran cuentas con el claim `admin`.
- `npm run admin`: crea cuentas de administración (contraseña generada que
  solo se ve en el terminal), quita el permiso o lista quién lo tiene.
- Reglas de Firestore: la administración lee todos los servicios y los
  aprueba, despublica o corrige mientras nadie está ayudando; no cambia
  quién pide ni quién ayuda.
- Pagos con Stripe Connect (modo test, Sandbox de Stripe), probados de
  extremo a extremo con los emuladores: cobros activados, pago de CHF 32.40
  con tarjeta de prueba, CHF 30 transferidos a quien ayudó y CHF 1.05 netos
  para la plataforma tras la comisión de Stripe:
  - Perfil → **Activar cobros**: formulario de Stripe para quien ayuda
    (cuenta conectada, Accounts v2), y su estado al volver a la app.
  - En servicios con precio, ofrecerse exige tener los cobros activos, y
    elegir oferta es **pagar** en Stripe Checkout (precio + 8 %); el
    servidor acepta el servicio al confirmarse y el dinero queda retenido.
  - Al marcarlo como hecho, el precio se transfiere a quien ayudó.
  - Cloud Functions en `functions/` (22 tests contra el emulador), reglas
    que dejan pagos y cuentas solo al servidor, y páginas de vuelta
    `/pago` y `/cobros` en la web.

### Para probarla
- Tarjeta de prueba `4242 4242 4242 4242`, cualquier fecha futura y CVC.
- Quien ayuda activa los cobros con los datos de prueba que ofrece Stripe
  («Testtelefonnummer», «Testcode», «Testkonto»).
- Los movimientos se ven en el Dashboard del Sandbox (Payments y Connect →
  Transfers).

## [1.1.0 (5)] — 2026-10-01 · TestFlight, prueba interna

Rama `feature/pagos`. Build EAS `f08174d5` desde el commit `2118ac7`.
Primera fase de los pagos: los servicios tienen precio, pero **todavía no se
cobra nada** (eso llega con Stripe Connect en la fase 3).

### Añadido
- Precio en los servicios: al publicar se elige **Favor gratis** o **Con
  precio** (de CHF 5 a CHF 1000; admite coma decimal). Se guarda en
  `priceCents` (céntimos de franco); `null` es gratis.
- Gestión del 8 % que paga quien pide **encima** del precio, como poco
  CHF 1; quien ayuda recibe el precio entero. El formulario enseña lo que se
  pagará (CHF 40 → CHF 43.20) y lo calcula `src/pagos/precio.ts`, con el
  formato de moneda de cada idioma (`CHF 40.00`, `40,00 CHF`).
- Tarjetas del muro con el precio o «Gratis», y en el detalle el precio con
  una nota distinta para quien pide (total con gestión) y quien ayuda
  (recibe el precio entero).
- Reglas de Firestore: el precio es un entero entre 500 y 100000 o nada, y
  solo se cambia mientras el servicio está pendiente de revisión.
- `npm run seed:revision`: cuenta para la revisión de Apple con datos en cada
  pantalla y contraseña generada que solo se muestra en el terminal.

### Cambiado
- Fuera los créditos de la interfaz (muro, perfil, «cr» en las tarjetas) y
  el lema de bienvenida ya no dice «sin dinero».
- Datos de prueba con precios: mudanzas CHF 40, pintura CHF 80, perros
  CHF 20 y el resto gratis.

### Para probarla
1. `npm run seed` desde esta rama para que los servicios de prueba del
   proyecto real tengan precio (la 1.0 ignora ese campo).
2. Opcional: `npm run rules:deploy` publica las reglas que validan el precio
   (compatibles con la 1.0, que no envía precio).

### Pendiente
- Cobro, retención, pago a quien ayuda y reembolsos (fases 2 y 3).
- La web, los términos y la ficha de la tienda siguen diciendo que no hay
  dinero: se cambian al lanzar la 1.1 (fase 4).

## [1.0.0 (4)] — 2026-10-01 · enviada a revisión de App Store

Build EAS `4bf00478` desde el commit `6a09961`. Primera versión pública.

### Qué trae
- Cuenta con email, Sign in with Apple o Google; borrar la cuenta y sus
  datos desde la app.
- Muro de servicios del barrio y mapa, con distancias reales.
- Publicar servicios con fotos y ubicación; un admin los revisa antes de que
  se vean.
- Ofertas con comentario, elegir una, chat privado, marcar como hecho y
  valorar de 1 a 5 con comentario.
- Perfil público de cada vecino con sus ayudas, servicios, reseñas e
  insignias; denunciar servicios y perfiles.
- Inglés, alemán y español, con selector de idioma.
- Web en Firebase Hosting (landing, privacidad, términos, soporte y
  contacto) en los tres idiomas.
- Ficha de App Store en los tres idiomas con capturas de iPhone 6,5".

### Cambios desde la build 3
- Chat con la foto de la otra persona; botones de la oferta elegida uno
  debajo del otro; título del muro que no empuja los créditos en alemán;
  decimales con el separador del idioma; idiomas en minúscula en español.
- Datos de prueba más creíbles (fechas, orden, avatares acordes al nombre).

### Builds anteriores
| Build | Commit | Notas |
|---|---|---|
| 1.0.0 (3) | `b393461` | Sin «Añadir créditos» y cifrado estándar declarado |

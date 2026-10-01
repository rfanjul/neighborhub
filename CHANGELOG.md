# Cambios

Cada versión que sale en una build de EAS tiene aquí su entrada y en git su
etiqueta `v<versión>-build.<número>` (ver [docs/VERSIONES.md](docs/VERSIONES.md)).
Lo que aún no está en ninguna build va en **Sin publicar**.

## Sin publicar

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
- Pagos con Stripe Connect (pendientes de probar contra el Sandbox: falta
  aceptar la responsabilidad de pérdidas en el perfil de plataforma de
  Stripe, y publicar las Functions requiere el plan Blaze):
  - Perfil → **Activar cobros**: formulario de Stripe para quien ayuda
    (cuenta conectada, Accounts v2), y su estado al volver a la app.
  - En servicios con precio, ofrecerse exige tener los cobros activos, y
    elegir oferta es **pagar** en Stripe Checkout (precio + 8 %); el
    servidor acepta el servicio al confirmarse y el dinero queda retenido.
  - Al marcarlo como hecho, el precio se transfiere a quien ayudó.
  - Cloud Functions en `functions/` (22 tests contra el emulador), reglas
    que dejan pagos y cuentas solo al servidor, y páginas de vuelta
    `/pago` y `/cobros` en la web.

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

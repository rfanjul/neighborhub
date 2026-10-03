# App Review: respuesta a la Guideline 2.1 (Information Needed)

Apple pidió, para la primera revisión (1.0.0 (4), 2026-10-01), una grabación
en un iPhone físico y seis datos sobre la app. Abajo:

1. **Guion de la grabación** (en español, para grabarla).
2. **Texto para responder** en App Store Connect (en inglés).
3. **Texto para Notes** de *App Review Information* (en inglés), para que
   quede para próximas revisiones.

La versión que se manda es la **1.1.0 con los pagos encendidos** (Stripe en
modo de prueba durante la revisión) y **publicación manual**: cuando Apple la
apruebe, antes de publicarla, Stripe pasa a modo real (ver el final). Apagar
los pagos para la revisión y encenderlos después sería una función oculta
(Guideline 2.3.1).

---

## 1. Guion de la grabación (iPhone físico, iOS al día)

Grabar con el **Centro de control → Grabación de pantalla**, con la app
**cerrada** (Apple quiere que empiece abriéndola). Unos 4 o 5 minutos. Sin
notificaciones de otras apps (modo Concentración).

1. **Abrir la app** desde el icono. Pasar el carrusel de bienvenida.
2. **Registro:** *Create an account* → nombre, un email nuevo y contraseña →
   completar el perfil → llega al muro.
3. **Cerrar sesión:** Perfil → ⚙️ → *Log out*.
4. **Login:** *Sign in with email* → la cuenta de revisión
   (`appreview@neighborhub.test`).
5. **Muro y detalle:** bajar por el muro, abrir un servicio de un vecino.
6. **Denunciar (contenido de usuarios):** en el detalle, *🚩 Report this
   request* → elegir un motivo → sale «Thanks for letting us know… within 24
   hours».
7. **Bloquear:** *🚫 Block {nombre}* → confirmar → vuelve al muro y ese
   servicio ya no aparece. Perfil → ⚙️ → *Blocked neighbors* → *Unblock*.
8. **Ofrecer ayuda:** abrir otro servicio → *Apply to help* → escribir un
   comentario → *Send offer*.
9. **Pagar, elegir y chatear:** Activity → *My services* → «Move a table to
   the balcony» (CHF 30) → *Pay CHF 32.40* → en Stripe, tarjeta
   `4242 4242 4242 4242`, fecha futura, CVC cualquiera → volver a la app
   («paid and held») → abrir el perfil de quien oferta (y volver) → *Choose*
   (no cobra nada más) → *Open chat* → mandar un mensaje → menú **⋯** del chat
   (enseñar *Report conversation* y *Block*), cancelar.
10. **Completar, cobrar y valorar:** en «Move a table…» → *Mark as completed*
    → 5 estrellas y un comentario (el precio va a quien ayudó). Perfil → ⚙️ →
    *Payments* para enseñar el pago.
11. **Publicar y cancelar:** botón **+** → título, categoría, foto, *Paid*,
    CHF 20 → *Pay CHF 21.60 and submit* → pagar con la tarjeta de prueba →
    queda en revisión → *Cancel request* → explica que se devuelve todo.
12. **Borrar la cuenta:** cerrar sesión → entrar con la cuenta creada en el
    paso 2 → Perfil → ⚙️ → *Delete account* → confirmar → vuelve a la
    bienvenida.
13. Parar la grabación.

Antes de grabar (y antes de mandarla a revisión): los **pagos encendidos** en
la web de administración, y `npm run seed:revision -- --cuenta-de rfanjul@gmail.com` (datos
de la cuenta de revisión sin cambiar su contraseña; `--cuenta-de` es alguien con los cobros activos en el Sandbox de Stripe: los
vecinos de prueba cobran en su cuenta). Vuelve a ejecutarlo después de grabar para dejar «Move a table…»
sin pagar para Apple.

Subir el vídeo en App Store Connect → la respuesta al mensaje de App Review
(admite adjuntos) o como enlace (iCloud Drive / Google Drive, «cualquiera
con el enlace»).

---

## 2. Respuesta a Apple y Notes (el mismo texto, copiar y pegar)

Apple pide la información en la respuesta **y** en *App Review Information →
Notes* (máximo 4000 caracteres; este tiene 3256). Pega lo mismo en los dos
sitios; en la respuesta, adjunta además el vídeo. El usuario y la contraseña de
la cuenta de revisión van en sus campos de *App Review Information*, no aquí.

```text
1. SCREEN RECORDING
Attached, recorded on an iPhone with the latest iOS, starting from launching the app: account registration, sign-in, browsing and offering help, paying for a paid request (Stripe test card), choosing a helper, chat, marking the job as done and rating (the helper is paid), posting a request, reporting and blocking, and account deletion.

2. PURPOSE AND AUDIENCE
Neighborhub connects neighbors who need a hand with everyday tasks (carrying furniture, walking a dog, shopping, small repairs) with neighbors nearby who can help, as a favor or for a fair price agreed upfront. It is for adults (16+), starting in Zurich, Switzerland. It solves not knowing who around you could help and trusting a stranger: every request is moderated before it is published, helpers have public ratings and reviews, the chat only opens once a helper is chosen, and for paid requests the money is held until the job is done.

3. HOW TO USE IT (demo account in App Review Information, "Sign in with email")
- Home: nearby requests; open one and tap "Apply to help".
- Paid request: Activity > My services > "Move a table to the balcony" (CHF 30). Tap "Pay CHF 32.40" and pay with Stripe test card 4242 4242 4242 4242 (any future date, any CVC), then return to the app ("paid and held"). Choose one of the three offers (nothing more is charged), open the chat, then "Mark as completed" and rate: the CHF 30 goes to the helper. Profile > Settings > Payments shows it.
- "Hang a big mirror in the hallway": a free favor in progress with its chat.
- "+" posts a request (free or with a price paid when submitting); it goes to moderation. Before choosing someone it can be cancelled with a full refund ("Cancel request").
- Report and block: on any request, profile and in the chat "..." menu. Blocked users: Profile > Settings > Blocked neighbors.
- Account deletion: Profile > Settings > Delete account.
Sample data is in Zurich (move the map there).

4. EXTERNAL SERVICES
Google Firebase (Authentication, Firestore, Storage, Cloud Functions, Hosting); Stripe (payments with Stripe Checkout, payouts to helpers with Stripe Connect); Sign in with Apple; Google Sign-In; Apple MapKit; Expo push notification service and EAS Build; Picsum Photos and DiceBear only for sample images.

5. REGIONAL DIFFERENCES
The app works the same in all regions. Content is local (users see requests near them); the community starts in Zurich. Prices are in Swiss francs. Available in English, German and Spanish.

6. REGULATED INDUSTRY / THIRD-PARTY MATERIAL
Not a regulated industry and no protected third-party material. No in-app purchases or paid digital content: neighbors pay each other for physical services performed outside the app, so under Guideline 3.1.3(e) they pay with Stripe Checkout (card or Apple Pay). Payments are processed by Stripe, a licensed payment provider; helpers are verified by Stripe before receiving payouts. During review Stripe runs in test mode.

USER-GENERATED CONTENT (1.2): users accept Terms of Use with zero tolerance for objectionable content. Requests are moderated before publishing; users can report requests, users and chats and block users. Reports are reviewed within 24 hours. Support: https://neighborhood-c4dc9.web.app/en/support
```

---

## 4. Checklist en App Store Connect

1. Versión **1.1.0**: textos, palabras clave, «What's New», capturas y
   **publicación manual** ya subidos con `npx eas-cli metadata:push`.
2. *Build*: elegir la última 1.1.0 (la de esta versión de textos).
3. *App Privacy* → añadir **Purchases → Purchase History** (vinculado a la
   identidad, para la funcionalidad de la app; sin seguimiento). Los datos de
   tarjeta y bancarios los recoge Stripe en su web, no la app.
4. *App Review Information*: usuario `appreview@neighborhub.test`, su
   contraseña, y en *Notes* el texto de la sección 2.
5. Responder al mensaje de la Guideline 2.1 con el texto de la sección 2 y el
   vídeo adjunto.
6. **Pagos encendidos** en la administración y `seed:revision` ejecutado, y
   *Submit for Review*.

## 5. Al aprobarla (antes de publicar)

Como es de publicación manual, Apple la deja en «Pending Developer Release»:

1. Stripe en modo real: activar la cuenta de la plataforma en *live*, aceptar
   allí también la responsabilidad de pérdidas de Connect y crear los dos
   webhooks (pagos y Connect) apuntando a `stripeWebhook`.
2. Poner las claves reales en Secret Manager desde un terminal propio
   (`firebase functions:secrets:set STRIPE_SECRET_KEY` y
   `STRIPE_WEBHOOK_SECRET`) y volver a desplegar las Functions.
3. Probar un pago real pequeño y devolverlo; entonces *Release this version*.

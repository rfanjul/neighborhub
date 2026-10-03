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
la web de administración, y `npm run seed:revision -- --cuenta acct_…` (datos
de la cuenta de revisión sin cambiar su contraseña; `--cuenta` es una cuenta
conectada del Sandbox de Stripe con cobros activos, a la que cobran los vecinos
de prueba). Vuelve a ejecutarlo después de grabar para dejar «Move a table…»
sin pagar para Apple.

Subir el vídeo en App Store Connect → la respuesta al mensaje de App Review
(admite adjuntos) o como enlace (iCloud Drive / Google Drive, «cualquiera
con el enlace»).

---

## 2. Respuesta para App Store Connect (copiar y pegar)

> Hello, thank you for reviewing Neighborhub. Please find the requested
> information below. The screen recording is attached.
>
> **1. Screen recording**
> Attached: recorded on an iPhone with the latest iOS, starting from launching
> the app. It shows account registration, sign-in, the main flow (browsing
> requests, offering help, choosing a helper, chatting, marking a request as
> done and rating), posting a request, reporting content, blocking and
> unblocking a user, and deleting the account (Profile → Settings → Delete
> account).
>
> **2. Purpose and audience**
> Neighborhub connects neighbors who need a hand with small everyday tasks
> (carrying furniture, walking a dog, shopping, small repairs) with
> neighbors nearby who can help. It is for adults (16+) living in the same
> area, starting in Zurich, Switzerland. It solves the problem of not knowing
> who around you could help, and of trusting someone you don't know: every
> request is checked by our moderators before it is published, helpers have
> public profiles with ratings and reviews, and the chat between the two
> people only opens once a helper is chosen.
>
> **3. How to use the app (demo account)**
> Sign in with the demo account provided in App Review Information
> ("Sign in with email"). It already has content on every screen:
> - Home: requests from neighbors nearby. Open one and tap "Apply to help".
> - Activity → My services → "Move a table to the balcony": offers from three
>   neighbors. Tap a neighbor to see their profile and reviews, choose one and
>   open the chat.
> - "Hang a big mirror in the hallway": a request in progress with its chat;
>   "Mark as completed" lets you rate the helper.
> - "+" posts a new request (it goes to moderation first).
> - Reporting and blocking: "Report this request" / "Block" on any request,
>   "Report" / "Block" on any profile, and the "⋯" menu in a chat. Blocked
>   users are listed in Profile → Settings → Blocked neighbors.
> - Account deletion: Profile → Settings → Delete account.
> The sample neighborhood is in Zurich: distances look large from other
> locations, and the map opens where you are (move it to Zurich).
>
> **4. External services**
> - Google Firebase: Authentication (email/password, Sign in with Apple,
>   Google Sign-In), Cloud Firestore (data), Cloud Storage (photos), Cloud
>   Functions (server logic and notifications) and Hosting (website, support
>   and privacy pages).
> - Stripe: payments for paid requests (Stripe Checkout) and payouts to
>   helpers (Stripe Connect).
> - Apple: Sign in with Apple, MapKit (maps) and push notifications (through
>   Expo's push notification service).
> - Google Sign-In SDK.
> - Expo / EAS (build and push notification delivery).
> - Sample content: placeholder photos from Picsum Photos and avatars from
>   DiceBear (only in the demo data).
>
> **5. Regional differences**
> The app works the same in all regions. Content is local by nature (users see
> requests near them); the current community is in Zurich. The app is
> available in English, German and Spanish.
>
> **6. Regulated industry / third-party material**
> Neighborhub does not operate in a regulated industry and does not include
> protected third-party material. It has no in-app purchases or paid digital
> content. Neighbors can pay each other for real-world help that takes place
> outside the app (moving furniture, dog walking, small repairs); under
> Guideline 3.1.3(e) these physical services are paid with Stripe Checkout,
> and the money is only released to the helper when the person who asked
> marks the job as done. During review Stripe is in test mode (card
> 4242 4242 4242 4242).
>
> **User-generated content (Guideline 1.2)**
> Users must accept the Terms of Use, which have zero tolerance for
> objectionable content and abusive users. Every new request is reviewed by a
> moderator before it becomes visible. Users can report requests, users and
> conversations in the app, and block users (blocked users can't message them
> or offer on their requests, and their content is hidden). We review every
> report within 24 hours and remove offending content and users. Contact:
> https://neighborhood-c4dc9.web.app/en/support

---

## 3. Notes de App Review Information (copiar y pegar)

En App Store Connect → la versión 1.1.0 → *App Review Information* → *Notes*
(el usuario y la contraseña de la cuenta de revisión van en sus campos):

```text
Demo account: username above; the password is the one already entered in App Review Information. The account has content on every screen.

PAYMENTS (Guideline 3.1.3(e)): Neighborhub lets neighbors pay each other for real-world help that happens outside the app (moving furniture, dog walking, small repairs). These physical services are paid with Stripe Checkout (card or Apple Pay in Safari), not In-App Purchase. During review Stripe runs in TEST mode: pay with card 4242 4242 4242 4242, any future expiry date, any CVC and name.

Full payment flow with the demo account:
1. Activity → My services → "Move a table to the balcony" (CHF 30). Tap "Pay CHF 32.40" and pay with the test card, then return to the app: it now says "paid and held".
2. Choose one of the three offers. Nothing more is charged.
3. Tap "Mark as completed" and rate the helper: the CHF 30 is transferred to them. Profile → Settings → Payments shows the payment.
4. "+" posts a new request. With a price you pay when submitting and it goes to moderation; until someone is chosen it can be cancelled ("Cancel request") with a full refund.
Free favors need no payment (e.g. "Hang a big mirror in the hallway", in progress with a chat).

Report and block: on any request ("Report this request" / "Block"), on any profile and in the chat "⋯" menu. Blocked users: Profile → Settings → Blocked neighbors. Reports are reviewed within 24 hours. Account deletion: Profile → Settings → Delete account.
Sample data is in Zurich, Switzerland (move the map there). No in-app purchases. External services: Firebase, Stripe, Sign in with Apple, Google Sign-In, MapKit, Expo push. English, German and Spanish; works the same in all regions.
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
   contraseña, y las *Notes* de arriba.
5. Responder al mensaje de la Guideline 2.1 con el texto de la sección 2 y el
   vídeo.
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

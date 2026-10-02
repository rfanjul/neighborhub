# App Review: respuesta a la Guideline 2.1 (Information Needed)

Apple pidió, para la primera revisión (1.0.0 (4), 2026-10-01), una grabación
en un iPhone físico y seis datos sobre la app. Abajo:

1. **Guion de la grabación** (en español, para grabarla).
2. **Texto para responder** en App Store Connect (en inglés).
3. **Texto para Notes** de *App Review Information* (en inglés), para que
   quede para próximas revisiones.

La build que se manda a revisión tiene que incluir bloquear y denunciar
(1.1.0 (10) en adelante).

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
9. **Elegir y chatear:** Activity → *My services* → «Move a table to the
   balcony» → abrir el perfil de quien oferta (y volver) → *Choose* → *Open
   chat* → mandar un mensaje → menú **⋯** del chat (enseñar *Report
   conversation* y *Block*), cancelar.
10. **Completar y valorar:** «Hang a big mirror in the hallway» → *Mark as
    completed* → 5 estrellas y un comentario.
11. **Publicar:** botón **+** → título, categoría, foto → *Submit for review*
    (explica que la revisa un moderador antes de publicarse).
12. **Borrar la cuenta:** cerrar sesión → entrar con la cuenta creada en el
    paso 2 → Perfil → ⚙️ → *Delete account* → confirmar → vuelve a la
    bienvenida.
13. Parar la grabación.

Antes de grabar: `npm run seed` (vecinos y servicios en el muro) y
`npm run seed:revision` (datos de la cuenta de revisión, sin cambiar su
contraseña). Si los pagos están activos en esa build, «Move a table» tiene
precio y *Choose* abre el pago: o se graba con una tarjeta de prueba
(Sandbox) o se desactivan los pagos para la revisión.

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
> content.
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

> Demo account: see username and password above (the account already has
> content on every screen).
> Main flow: Home → open a request → Apply to help. Activity → My services →
> "Move a table to the balcony" → choose an offer → chat. "Hang a big mirror
> in the hallway" → Mark as completed → rate. "+" posts a request (reviewed
> by a moderator before it is published).
> Report and block: on any request ("Report this request" / "Block"), on any
> profile, and in the chat "⋯" menu. Blocked users: Profile → Settings →
> Blocked neighbors. Reports are reviewed within 24 hours.
> Account deletion: Profile → Settings → Delete account.
> Sample data is in Zurich, Switzerland: move the map to Zurich to see it.
> No in-app purchases. External services: Firebase (Auth, Firestore, Storage,
> Functions, Hosting), Sign in with Apple, Google Sign-In, MapKit, Expo push.
> Available in English, German and Spanish; works the same in all regions.

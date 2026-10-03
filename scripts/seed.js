#!/usr/bin/env node
/**
 * Siembra (o borra) los datos de prueba en Firestore con el Admin SDK,
 * que se salta las reglas de seguridad: desde la app no se podría crear
 * perfiles ajenos ni servicios ya aprobados.
 *
 *   npm run seed          → crea/actualiza 10 vecinos, sus reseñas y 30 servicios
 *   npm run seed:clean    → borra todo lo que lleve `seed: true`
 *   npm run seed -- --ofertas "Move table"
 *                         → 3 vecinos de prueba ofertan en ese servicio
 *   npm run demo:seed     → todo lo anterior más una cuenta demo con
 *                           servicios y ofertas en cada estado (solo emulador)
 *   npm run seed:revision → lo mismo en el proyecto real, con la cuenta para
 *                           la revisión de Apple y una contraseña nueva que
 *                           solo se muestra en el terminal
 *                           (-- --email otro@correo, -- --nueva-clave)
 *
 * Credenciales, por orden:
 *   1. FIRESTORE_EMULATOR_HOST  → contra el emulador, sin credenciales.
 *   2. GOOGLE_APPLICATION_CREDENTIALS o ./service-account.json
 *      (clave de cuenta de servicio; está en .gitignore).
 *   3. Application Default Credentials (gcloud auth application-default login).
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { construir, cuentaDemo, cuentaRevision, avatar, foto } = require('./seed-data');

/** Crea o sobrescribe los documentos de prueba. Idempotente. */
async function sembrar(db, { Timestamp } = {}) {
  const fecha = Timestamp ? (d) => Timestamp.fromDate(d) : (d) => d;
  // Fechas relativas al momento de sembrar: el muro siempre parece reciente.
  const { usuarios, servicios, resenas } = construir({ fecha, ahora: new Date() });
  const batch = db.batch();
  for (const u of usuarios) {
    batch.set(db.collection('users').doc(u.id), u.data);
    batch.set(db.collection('privado').doc(u.id), u.privado);
  }
  for (const s of servicios) batch.set(db.collection('helpRequests').doc(s.id), s.data);
  for (const r of resenas) batch.set(db.collection('reviews').doc(r.id), r.data);
  await batch.commit();
  return { usuarios: usuarios.length, servicios: servicios.length, resenas: resenas.length };
}

// Quién oferta y qué dice: vecinos con mano para mover y montar cosas.
const ofertantes = [
  { id: 'seed-user-02', comentario: "Hi! I live nearby and I'm free this weekend. I've helped a few neighbors with this kind of thing and can bring straps and my own tools. Just tell me the time." },
  { id: 'seed-user-08', comentario: "Hello, carpenter here, so I'm used to heavy furniture and tricky stairs. I can come any evening after 18:00 or on Saturday morning." },
  { id: 'seed-user-04', comentario: "Hey! Student around the corner with flexible hours. Happy to lend a hand, and I can bring a friend if it's heavy." },
];

/**
 * Tres vecinos de prueba ofertan en un servicio real (id o título exacto).
 * Solo los servicios aprobados admiten ofertas, así que si estaba
 * pendiente lo aprueba, como haría un admin desde la consola.
 */
async function ofertar(db, servicio, { Timestamp } = {}) {
  const ahora = Timestamp ? () => Timestamp.now() : () => new Date();
  let ref = db.collection('helpRequests').doc(servicio);
  let snap = await ref.get();
  if (!snap.exists) {
    const buscados = (await db.collection('helpRequests').get()).docs.filter(
      (d) => !d.data().seed && String(d.data().title).trim().toLowerCase() === servicio.trim().toLowerCase(),
    );
    if (buscados.length !== 1) {
      throw new Error(buscados.length ? `Hay ${buscados.length} servicios "${servicio}"; usa el id` : `No encuentro el servicio "${servicio}"`);
    }
    snap = buscados[0];
    ref = snap.ref;
  }
  const s = snap.data();
  if (!['pending', 'approved'].includes(s.status)) throw new Error(`El servicio está ${s.status}; ya no admite ofertas`);

  const aprobado = s.status === 'pending';
  const batch = db.batch();
  if (aprobado) batch.update(ref, { status: 'approved', updatedAt: ahora() });
  for (const o of ofertantes) {
    const perfil = await db.collection('users').doc(o.id).get();
    if (!perfil.exists) throw new Error('Faltan los vecinos de prueba: ejecuta antes npm run seed');
    batch.set(db.collection('applications').doc(`${ref.id}_${o.id}`), {
      serviceId: ref.id,
      serviceTitle: s.title,
      applicantId: o.id,
      applicantName: perfil.data().name,
      requesterId: s.requesterId,
      comment: o.comentario,
      status: 'pending',
      seed: true,
      createdAt: ahora(),
    });
  }
  await batch.commit();
  return { servicioId: ref.id, titulo: s.title, ofertas: ofertantes.length, aprobado };
}

/** Borra solo lo sembrado (seed == true), nunca datos reales. */
async function limpiar(db) {
  let borrados = 0;
  // Ofertas de prueba hechas sobre servicios reales.
  const ofertas = await db.collection('applications').where('seed', '==', true).get();
  for (const o of ofertas.docs) {
    await o.ref.delete();
    borrados++;
  }
  for (const coleccion of ['reviews', 'helpRequests', 'users', 'privado', 'cuentasCobro', 'pagos']) {
    const snap = await db.collection(coleccion).where('seed', '==', true).get();
    for (const d of snap.docs) {
      // Las ofertas y mensajes que otros hayan hecho sobre servicios de prueba.
      if (coleccion === 'helpRequests') {
        const mensajes = await d.ref.collection('messages').get();
        for (const m of mensajes.docs) await m.ref.delete();
        const ofertas = await db.collection('applications').where('serviceId', '==', d.id).get();
        for (const o of ofertas.docs) await o.ref.delete();
      }
      await d.ref.delete();
      borrados++;
    }
  }
  return borrados;
}

/**
 * Modo demo: siembra y añade una cuenta con datos en cada pantalla (ver
 * prepararCuenta). Solo contra los emuladores: su contraseña está en
 * seed-data.js, así que nunca va al proyecto real.
 */
async function demo(db, auth, { Timestamp } = {}) {
  if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new Error('El modo demo solo va contra los emuladores (npm run demo:seed)');
  }
  await sembrar(db, { Timestamp });
  const { uid, email, password, nombre } = cuentaDemo;
  await auth.deleteUser(uid).catch(() => {});
  await auth.createUser({ uid, email, password, displayName: nombre });
  // En el emulador no se habla con Stripe: una cuenta de cobro inventada y el
  // servicio con precio ya pagado, para ver en las capturas cómo queda.
  await prepararCuenta(db, { uid, email, nombre }, { Timestamp, cuentaCobro: 'acct_demo', pagado: true });
  return { email };
}

/**
 * La cuenta para la revisión de Apple, en el proyecto real: siembra los
 * vecinos y le deja los mismos datos que a la demo. La contraseña se genera
 * aquí y solo se devuelve (no queda en ningún fichero); si la cuenta ya
 * existe se respeta la suya, salvo con nuevaClave.
 */
async function revision(db, auth, { email = cuentaRevision.email, nuevaClave = false, cuentaCobro = null, Timestamp } = {}) {
  await sembrar(db, { Timestamp });
  let usuario = await auth.getUserByEmail(email).catch((e) => {
    if (e.code === 'auth/user-not-found') return null;
    throw e;
  });
  let password = null;
  if (!usuario) {
    password = generarClave();
    usuario = await auth.createUser({
      uid: cuentaRevision.uid, email, password, emailVerified: true, displayName: cuentaRevision.nombre,
    });
  } else if (nuevaClave) {
    password = generarClave();
    await auth.updateUser(usuario.uid, { password });
  }
  await prepararCuenta(db, { uid: usuario.uid, email, nombre: cuentaRevision.nombre }, { Timestamp, cuentaCobro });
  return { uid: usuario.uid, email, password };
}

/** Fácil de teclear para quien revisa: sin 0/O ni 1/l/I, en tres grupos de cuatro. */
function generarClave() {
  const letras = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const grupo = () => Array.from({ length: 4 }, () => letras[crypto.randomInt(letras.length)]).join('');
  return `${grupo()}-${grupo()}-${grupo()}`;
}

/**
 * Deja una cuenta con algo que ver en cada pantalla: un servicio con precio
 * abierto con tres ofertas (sin pagar: se paga con la tarjeta de prueba de
 * Stripe y se elige), un favor en curso con chat, otro pendiente de
 * revisión, una oferta enviada y otra elegida, y dos ayudas ya valoradas.
 * Todo lleva seed: true, así que npm run seed:clean lo borra (la cuenta de
 * Auth no).
 *
 * cuentaCobro: la cuenta conectada de Stripe (modo prueba) a la que cobran
 * los vecinos que ofertan; sin ella no se les puede elegir en uno de pago.
 * pagado: «Move a table» ya pagado y retenido (solo en el emulador).
 */
async function prepararCuenta(db, { uid, email, nombre }, { Timestamp, cuentaCobro = null, pagado = false } = {}) {
  const fecha = Timestamp ? (d) => Timestamp.fromDate(d) : (d) => d;
  const hace = (horas) => fecha(new Date(Date.now() - horas * 3600000));

  const photoURL = avatar(nombre);
  const b = db.batch();
  const yo = { requesterId: uid, requesterName: nombre, requesterRating: 4.5, requesterResponseLabel: '< 1h', requesterPhotoURL: photoURL };
  b.set(db.doc(`privado/${uid}`), { email, dateOfBirth: null, seed: true });
  b.set(db.doc(`users/${uid}`), {
    name: nombre, bio: 'Designer, new in Langstrasse. Happy to help with anything creative or techy.',
    city: 'Zürich', postalCode: '8004', country: 'Switzerland', languages: 'English, German, Spanish',
    credits: 20, level: 2, levelLabel: 'Helpful neighbor', servicesCompleted: 2, rating: 4.5, ratingSum: 9, ratingCount: 2,
    responseLabel: '< 1h', identityVerified: true, onboardingCompleted: true, photoURL, seed: true, createdAt: hace(24 * 40),
  });
  // Dos ayudas ya valoradas: el servicio cerrado y su reseña, para que su
  // perfil tenga ayudas y reseñas que cuadren.
  [['seed-user-01', 'Anna Weber', 5, 'Set up my new printer in minutes. Lovely!'], ['seed-user-05', 'Mia Schneider', 4, 'Great help with the kids\u2019 bikes.']]
    .forEach(([autor, autorNombre, rating, comment], i) => {
      const id = `demo-review-${i + 1}`;
      const serviceTitle = i ? 'Pumped and oiled two bikes' : 'Set up a printer';
      b.set(db.doc(`helpRequests/${id}`), {
        title: serviceTitle, category: 'other', description: serviceTitle, priceCents: null, photos: [], coords: null,
        durationLabel: '1 hour', availableLabel: '', locationLabel: '', travelRadiusKm: 5, status: 'rated',
        requesterId: autor, requesterName: autorNombre, requesterPhotoURL: avatar(autorNombre),
        helperId: uid, helperName: nombre, seed: true, createdAt: hace(24 * (11 + i * 12)), updatedAt: hace(24 * (10 + i * 12)),
      });
      b.set(db.doc(`reviews/${id}`), {
        serviceId: id, serviceTitle, reviewerId: autor, reviewerName: autorNombre, reviewerPhotoURL: avatar(autorNombre),
        revieweeId: uid, rating, comment, seed: true, createdAt: hace(24 * (10 + i * 12)),
      });
    });

  const servicio = (id, datos) =>
    b.set(db.doc(`helpRequests/${id}`), {
      category: 'moving', priceCents: null, locationLabel: '', travelRadiusKm: 5, durationLabel: '1 hour', availableLabel: 'This week',
      coords: { latitude: 47.3785, longitude: 8.5262 }, helperId: null, helperName: null, seed: true,
      createdAt: hace(26), updatedAt: hace(26), ...yo, ...datos,
    });
  const mesa = { precio: 3000, comision: 240, total: 3240 };
  servicio('demo-move-table', {
    title: 'Move a table to the balcony', status: 'approved', photos: [foto(1068)], priceCents: mesa.precio,
    description: 'Solid oak table, about 40 kg. It needs to go from the living room to the balcony, through one door. Two people will do.',
    ...(pagado ? { pago: { estado: 'retenido', ...mesa } } : {}),
  });
  // Un pago anterior (de otra revisión) no debe quedar colgado del servicio rehecho.
  b.delete(db.doc('pagos/demo-move-table'));
  if (pagado) {
    b.set(db.doc('pagos/demo-move-table'), {
      serviceId: 'demo-move-table', titulo: 'Move a table to the balcony', requesterId: uid, requesterName: nombre,
      helperId: null, helperName: '', cuentaDestino: null, ...mesa, moneda: 'chf', estado: 'retenido', alCrear: true,
      chargeId: 'ch_demo', paymentIntentId: 'pi_demo', seed: true, creado: hace(26), actualizado: hace(26),
    });
  }
  // Un favor (gratis) ya en curso: con precio y sin pago no cuadraría con el flujo de pagos.
  servicio('demo-mirror', {
    title: 'Hang a big mirror in the hallway', status: 'accepted', category: 'other', photos: [foto(834)], priceCents: null,
    // Cada uno en su sitio: con chinchetas superpuestas el mapa elige mal.
    coords: { latitude: 47.3773, longitude: 8.5243 },
    helperId: 'seed-user-08', helperName: 'Elias Huber', createdAt: hace(30),
    description: 'Heavy mirror (120 x 80 cm) that needs proper anchors in a concrete wall. I have the drill.',
  });
  servicio('demo-sofa', {
    title: 'Help me choose a second-hand sofa', status: 'pending', category: 'other', photos: [],
    coords: { latitude: 47.3794, longitude: 8.5283 },
    description: 'Two options on Ricardo, both in Oerlikon. Come and sit on them with me and help me decide?', createdAt: hace(18),
  });
  b.set(db.doc('applications/demo-mirror_seed-user-08'), {
    serviceId: 'demo-mirror', serviceTitle: 'Hang a big mirror in the hallway', applicantId: 'seed-user-08', applicantName: 'Elias Huber',
    requesterId: uid, comment: 'Carpenter here, I have the right anchors for concrete.', status: 'selected', seed: true, createdAt: hace(28),
  });
  [['seed-user-08', 'Hi Alex! Saturday at 10 works for me?'], [uid, 'Perfect, see you then. Second floor, left door.'], ['seed-user-08', 'Great, I will bring the anchors 👍']]
    .forEach(([senderId, text], i) =>
      b.set(db.doc(`helpRequests/demo-mirror/messages/m${i + 1}`), {
        senderId, senderName: senderId === uid ? nombre : 'Elias Huber', text, createdAt: hace(27 - i),
      })
    );

  // Mis ofertas: una esperando y otra elegida (con el servicio ya en curso).
  b.set(db.doc(`applications/seed-service-07-1_${uid}`), {
    serviceId: 'seed-service-07-1', serviceTitle: 'Midday walks for Frida (dachshund)', applicantId: uid, applicantName: nombre,
    requesterId: 'seed-user-07', comment: 'I work from home on Mondays and Fridays, happy to walk Frida.', status: 'pending', seed: true, createdAt: hace(5),
  });
  b.set(db.doc(`applications/seed-service-03-1_${uid}`), {
    serviceId: 'seed-service-03-1', serviceTitle: 'Pick up a box of vegetables from the farm shop', applicantId: uid, applicantName: nombre,
    requesterId: 'seed-user-03', comment: 'I pass by the farm shop on Thursdays anyway!', status: 'selected', seed: true, createdAt: hace(20),
  });
  b.update(db.doc('helpRequests/seed-service-03-1'), { status: 'accepted', helperId: uid, helperName: nombre });
  await b.commit();

  await ofertar(db, 'demo-move-table', { Timestamp });

  // Quien oferta en el de pago tiene los cobros activos (si no, no se le podría elegir).
  if (cuentaCobro) {
    const cobros = db.batch();
    for (const o of ofertantes) {
      cobros.set(db.doc(`cuentasCobro/${o.id}`), { stripeAccountId: cuentaCobro, cobrosActivos: true, seed: true });
      cobros.update(db.doc(`users/${o.id}`), { cobrosActivos: true });
    }
    await cobros.commit();
  }
}

function proyecto() {
  if (process.env.FIREBASE_PROJECT_ID) return process.env.FIREBASE_PROJECT_ID;
  const env = path.join(__dirname, '..', '.env');
  if (fs.existsSync(env)) {
    const m = fs.readFileSync(env, 'utf8').match(/^EXPO_PUBLIC_FIREBASE_PROJECT_ID=(.+)$/m);
    if (m) return m[1].trim();
  }
  throw new Error('No encuentro el id del proyecto: define FIREBASE_PROJECT_ID o rellena .env');
}

/**
 * App del Admin SDK con las credenciales de la cabecera: contra el emulador
 * si FIRESTORE_EMULATOR_HOST está definido. Lo comparte scripts/admin.js.
 */
function iniciarAdmin() {
  const { initializeApp, cert, applicationDefault } = require('firebase-admin/app');
  const projectId = proyecto();
  const clave = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, '..', 'service-account.json');
  const credential = process.env.FIRESTORE_EMULATOR_HOST
    ? undefined
    : fs.existsSync(clave)
      ? cert(JSON.parse(fs.readFileSync(clave, 'utf8')))
      : applicationDefault();
  const app = initializeApp({ projectId, ...(credential && { credential }) });
  const destino = process.env.FIRESTORE_EMULATOR_HOST ? `emulador ${process.env.FIRESTORE_EMULATOR_HOST}` : projectId;
  return { app, destino };
}

async function main() {
  const { getFirestore, Timestamp } = require('firebase-admin/firestore');
  const { app, destino } = iniciarAdmin();
  const db = getFirestore(app);
  if (process.argv.includes('--revision')) {
    const { getAuth } = require('firebase-admin/auth');
    const iEmail = process.argv.indexOf('--email');
    // La cuenta conectada (modo prueba) que cobra por los vecinos de prueba: sin
    // ella quien revisa no puede elegir a nadie en el servicio de pago.
    const iCuenta = process.argv.indexOf('--cuenta');
    const cuentaCobro = iCuenta !== -1 ? process.argv[iCuenta + 1] : null;
    if (!/^acct_\w+$/.test(cuentaCobro || '')) {
      throw new Error('Falta la cuenta de cobro de prueba: npm run seed:revision -- --cuenta acct_… (una cuenta conectada del Sandbox con cobros activos)');
    }
    const r = await revision(db, getAuth(), {
      email: iEmail !== -1 ? process.argv[iEmail + 1] : undefined,
      nuevaClave: process.argv.includes('--nueva-clave'),
      cuentaCobro,
      Timestamp,
    });
    console.log(`🍏 ${destino}: cuenta para la revisión de Apple lista, con datos en cada pantalla\n`);
    console.log(`   Usuario:     ${r.email}`);
    console.log(
      r.password
        ? `   Contraseña:  ${r.password}\n\n   Cópiala ahora en App Store Connect > App Review Information: no se guarda en ningún sitio.`
        : '   Contraseña:  la que ya tenía (para generar otra: npm run seed:revision -- --nueva-clave)'
    );
    return;
  }
  if (process.argv.includes('--demo')) {
    const { getAuth } = require('firebase-admin/auth');
    const { email } = await demo(db, getAuth(), { Timestamp });
    console.log(`🧪 ${destino}: datos demo listos. Entra en la app con ${email} (contraseña en scripts/seed-data.js)`);
    return;
  }
  const iOfertas = process.argv.indexOf('--ofertas');
  if (iOfertas !== -1) {
    const servicio = process.argv[iOfertas + 1];
    if (!servicio) throw new Error('Uso: npm run seed -- --ofertas "<título o id del servicio>"');
    const r = await ofertar(db, servicio, { Timestamp });
    console.log(`🙋 ${destino}: ${r.ofertas} ofertas en "${r.titulo}" (${r.servicioId})${r.aprobado ? ', y aprobado (estaba pendiente)' : ''}`);
  } else if (process.argv.includes('--clean')) {
    const n = await limpiar(db);
    console.log(`🧹 ${destino}: borrados ${n} documentos de prueba`);
  } else {
    const r = await sembrar(db, { Timestamp });
    console.log(`🌱 ${destino}: ${r.usuarios} vecinos, ${r.resenas} reseñas y ${r.servicios} servicios aprobados`);
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error('❌', e.message);
    process.exit(1);
  });
}

module.exports = { sembrar, limpiar, ofertar, demo, revision, generarClave, iniciarAdmin };

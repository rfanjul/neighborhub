#!/usr/bin/env node
/**
 * Siembra (o borra) los datos de prueba en Firestore con el Admin SDK,
 * que se salta las reglas de seguridad: desde la app no se podría crear
 * perfiles ajenos ni servicios ya aprobados.
 *
 *   npm run seed          → crea/actualiza 10 vecinos y 30 servicios
 *   npm run seed:clean    → borra todo lo que lleve `seed: true`
 *   npm run seed -- --ofertas "Move table"
 *                         → 3 vecinos de prueba ofertan en ese servicio
 *
 * Credenciales, por orden:
 *   1. FIRESTORE_EMULATOR_HOST  → contra el emulador, sin credenciales.
 *   2. GOOGLE_APPLICATION_CREDENTIALS o ./service-account.json
 *      (clave de cuenta de servicio; está en .gitignore).
 *   3. Application Default Credentials (gcloud auth application-default login).
 */
const fs = require('fs');
const path = require('path');
const { construir } = require('./seed-data');

/** Crea o sobrescribe los documentos de prueba. Idempotente. */
async function sembrar(db, { Timestamp } = {}) {
  const fecha = Timestamp ? (d) => Timestamp.fromDate(d) : (d) => d;
  const { usuarios, servicios } = construir({ fecha });
  const batch = db.batch();
  for (const u of usuarios) batch.set(db.collection('users').doc(u.id), u.data);
  for (const s of servicios) batch.set(db.collection('helpRequests').doc(s.id), s.data);
  await batch.commit();
  return { usuarios: usuarios.length, servicios: servicios.length };
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
  for (const coleccion of ['helpRequests', 'users']) {
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

function proyecto() {
  if (process.env.FIREBASE_PROJECT_ID) return process.env.FIREBASE_PROJECT_ID;
  const env = path.join(__dirname, '..', '.env');
  if (fs.existsSync(env)) {
    const m = fs.readFileSync(env, 'utf8').match(/^EXPO_PUBLIC_FIREBASE_PROJECT_ID=(.+)$/m);
    if (m) return m[1].trim();
  }
  throw new Error('No encuentro el id del proyecto: define FIREBASE_PROJECT_ID o rellena .env');
}

async function main() {
  const { initializeApp, cert, applicationDefault } = require('firebase-admin/app');
  const { getFirestore, Timestamp } = require('firebase-admin/firestore');

  const projectId = proyecto();
  const clave = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, '..', 'service-account.json');
  const credential = process.env.FIRESTORE_EMULATOR_HOST
    ? undefined
    : fs.existsSync(clave)
      ? cert(JSON.parse(fs.readFileSync(clave, 'utf8')))
      : applicationDefault();
  const db = getFirestore(initializeApp({ projectId, ...(credential && { credential }) }));

  const destino = process.env.FIRESTORE_EMULATOR_HOST ? `emulador ${process.env.FIRESTORE_EMULATOR_HOST}` : projectId;
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
    console.log(`🌱 ${destino}: ${r.usuarios} vecinos y ${r.servicios} servicios aprobados`);
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error('❌', e.message);
    process.exit(1);
  });
}

module.exports = { sembrar, limpiar, ofertar };

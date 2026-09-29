#!/usr/bin/env node
/**
 * Siembra (o borra) los datos de prueba en Firestore con el Admin SDK,
 * que se salta las reglas de seguridad: desde la app no se podría crear
 * perfiles ajenos ni servicios ya aprobados.
 *
 *   npm run seed          → crea/actualiza 10 vecinos y 30 servicios
 *   npm run seed:clean    → borra todo lo que lleve `seed: true`
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

/** Borra solo lo sembrado (seed == true), nunca datos reales. */
async function limpiar(db) {
  let borrados = 0;
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
  if (process.argv.includes('--clean')) {
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

module.exports = { sembrar, limpiar };

#!/usr/bin/env node
/**
 * Migración de una sola vez: saca el email y la fecha de nacimiento de los
 * perfiles públicos (users/{uid}, que lee cualquiera con sesión) y los pasa
 * a privado/{uid}, que solo leen su dueño y la administración.
 *
 *   npm run migrar:privado              → simulacro: cuenta lo que movería, sin escribir nada
 *   npm run migrar:privado -- --aplicar → lo mueve de verdad
 *
 * Se puede repetir: si privado/ ya tiene un valor (lo guardó la app nueva),
 * se respeta y solo se borra la copia vieja de users/. Los vecinos de prueba
 * (seed: true) llevan la marca también en privado/, para que npm run
 * seed:clean se los lleve. Cada perfil tocado dispara avisoCobros, que no
 * avisa a nadie porque cobrosActivos no cambia.
 *
 * Credenciales: las mismas que npm run seed (service-account.json); con
 * FIRESTORE_EMULATOR_HOST, contra el emulador.
 */
const { iniciarAdmin } = require('./seed');

const CAMPOS = ['email', 'dateOfBirth'];
// Cada perfil son dos escrituras (privado/ y users/) y un lote admite 500.
const POR_LOTE = 200;

const vacio = (valor) => valor == null || valor === '';

async function migrar(db, { aplicar = false, FieldValue, porLote = POR_LOTE } = {}) {
  const perfiles = await db.collection('users').get();
  const pendientes = perfiles.docs.filter((d) => CAMPOS.some((c) => d.get(c) !== undefined));

  for (let i = 0; i < pendientes.length; i += porLote) {
    const tanda = pendientes.slice(i, i + porLote);
    const privados = await db.getAll(...tanda.map((d) => db.doc(`privado/${d.id}`)));
    const lote = db.batch();
    tanda.forEach((perfil, k) => {
      const ya = privados[k].data() || {};
      const datos = {};
      for (const campo of CAMPOS) {
        const valor = perfil.get(campo);
        if (valor !== undefined && vacio(ya[campo])) datos[campo] = valor;
      }
      if (perfil.get('seed') === true) datos.seed = true;
      lote.set(privados[k].ref, datos, { merge: true });
      lote.update(perfil.ref, Object.fromEntries(CAMPOS.map((c) => [c, FieldValue.delete()])));
    });
    if (aplicar) await lote.commit();
  }
  return { perfiles: perfiles.size, movidos: pendientes.length };
}

async function main() {
  const { getFirestore, FieldValue } = require('firebase-admin/firestore');
  const { app, destino } = iniciarAdmin();
  const aplicar = process.argv.includes('--aplicar');
  const r = await migrar(getFirestore(app), { aplicar, FieldValue });
  if (aplicar) {
    console.log(`🔒 ${destino}: ${r.movidos} de ${r.perfiles} perfiles pasan su email y fecha de nacimiento a privado/`);
  } else {
    console.log(`🔍 ${destino} (simulacro, no se ha escrito nada): ${r.movidos} de ${r.perfiles} perfiles tienen email o fecha de nacimiento en users/`);
    if (r.movidos) console.log('   Para moverlos: npm run migrar:privado -- --aplicar');
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error('❌', e.message);
    process.exit(1);
  });
}

module.exports = { migrar };

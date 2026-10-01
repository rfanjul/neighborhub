#!/usr/bin/env node
/**
 * Publica firestore.rules y storage.rules con la clave de service-account.json
 * (la misma de scripts/seed.js), sin depender de `firebase login`. Solo
 * publica lo que difiere de lo que ya está en producción; Firebase guarda
 * el historial, así que se puede volver atrás desde la consola.
 *
 *   npm run rules:deploy               → publica lo que haya cambiado
 *   npm run rules:deploy -- --check    → solo compara, no publica nada
 */
const fs = require('fs');
const path = require('path');
const { cert } = require('firebase-admin/app');

const raiz = path.join(__dirname, '..');
const leer = (f) => fs.readFileSync(path.join(raiz, f), 'utf8');
const soloComprobar = process.argv.includes('--check');

async function main() {
  const clave = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(raiz, 'service-account.json');
  if (!fs.existsSync(clave)) throw new Error('Falta service-account.json (ver README → Datos de prueba)');
  const cuenta = JSON.parse(fs.readFileSync(clave, 'utf8'));
  const { access_token } = await cert(cuenta).getAccessToken();
  const p = `projects/${cuenta.project_id}`;
  const bucket = (leer('.env').match(/^EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=(.+)$/m) || [])[1]?.trim();

  const pedir = async (url, opts = {}) => {
    const r = await fetch(`https://firebaserules.googleapis.com/v1/${url}`, {
      ...opts,
      headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
    });
    const json = await r.json();
    if (json.error) throw new Error(`${json.error.status}: ${json.error.message}`);
    return json;
  };

  const destinos = [['firestore.rules', 'cloud.firestore']];
  if (bucket) destinos.push(['storage.rules', `firebase.storage/${bucket}`]);

  let pendientes = 0;
  for (const [fichero, release] of destinos) {
    const local = leer(fichero);
    const actual = await pedir(`${p}/releases/${release}`);
    const publicadas = (await pedir(actual.rulesetName)).source.files[0].content;
    if (publicadas.trim() === local.trim()) {
      console.log(`= ${fichero}: ya al día`);
      continue;
    }
    pendientes++;
    if (soloComprobar) {
      console.log(`≠ ${fichero}: difiere de lo publicado (${actual.updateTime})`);
      continue;
    }
    // Crear el ruleset valida la sintaxis antes de tocar nada.
    const nuevo = await pedir(`${p}/rulesets`, {
      method: 'POST',
      body: JSON.stringify({ source: { files: [{ name: fichero, content: local }] } }),
    });
    await pedir(`${p}/releases/${release}`, {
      method: 'PATCH',
      body: JSON.stringify({ release: { name: `${p}/releases/${release}`, rulesetName: nuevo.name } }),
    });
    console.log(`✅ ${fichero}: publicadas en ${cuenta.project_id}`);
  }
  if (soloComprobar && pendientes) process.exitCode = 1;
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Publica la carpeta web/ en Firebase Hosting con la clave de
 * service-account.json, sin depender de `firebase login`. Hace lo mismo que
 * `firebase deploy --only hosting` con la API de Hosting: crea una versión,
 * sube solo los ficheros que Hosting no tenga ya, la cierra y la publica.
 *
 *   npm run hosting:deploy               → publica web/
 *   npm run hosting:deploy -- --check    → solo lista lo que subiría
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { cert } = require('firebase-admin/app');
const { construir } = require('./build-web');

const raiz = path.join(__dirname, '..');
const API = 'https://firebasehosting.googleapis.com/v1beta1/';
const soloComprobar = process.argv.includes('--check');

/** Todos los ficheros de web/, con su ruta pública y su contenido comprimido. */
function ficheros(carpeta, base = '') {
  return fs.readdirSync(carpeta, { withFileTypes: true }).flatMap((e) => {
    if (e.name.startsWith('.')) return [];
    const ruta = path.join(carpeta, e.name);
    if (e.isDirectory()) return ficheros(ruta, `${base}/${e.name}`);
    const gz = zlib.gzipSync(fs.readFileSync(ruta), { level: 9 });
    return [{ ruta: `${base}/${e.name}`, gz, hash: crypto.createHash('sha256').update(gz).digest('hex') }];
  });
}

async function main() {
  const clave = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(raiz, 'service-account.json');
  if (!fs.existsSync(clave)) throw new Error('Falta service-account.json (ver README → Datos de prueba)');
  const cuenta = JSON.parse(fs.readFileSync(clave, 'utf8'));
  const { access_token } = await cert(cuenta).getAccessToken();
  const sitio = `sites/${process.env.HOSTING_SITE || cuenta.project_id}`;
  const cabeceras = { Authorization: `Bearer ${access_token}` };

  const pedir = async (url, opts = {}) => {
    const r = await fetch(url.startsWith('http') ? url : API + url, {
      ...opts,
      headers: { ...cabeceras, 'Content-Type': 'application/json', ...opts.headers },
    });
    const texto = await r.text();
    const json = texto ? JSON.parse(texto) : {};
    if (!r.ok) throw new Error(`${r.status} ${json.error?.status ?? ''}: ${json.error?.message ?? texto}`);
    return json;
  };

  // Siempre con la web recién generada en los tres idiomas.
  construir();
  const lista = ficheros(path.join(raiz, 'web'));
  console.log(`📦 ${lista.length} ficheros en web/ → ${sitio}`);
  if (soloComprobar) {
    lista.forEach((f) => console.log('  ', f.ruta));
    return;
  }

  // Misma configuración que firebase.json: cleanUrls, sin barra final y sus redirecciones.
  const hosting = JSON.parse(fs.readFileSync(path.join(raiz, 'firebase.json'), 'utf8')).hosting ?? {};
  const redirects = (hosting.redirects ?? []).map((r) => ({
    glob: r.source,
    statusCode: r.type ?? 301,
    location: r.destination,
  }));
  const version = await pedir(`${sitio}/versions`, {
    method: 'POST',
    body: JSON.stringify({ config: { cleanUrls: true, trailingSlashBehavior: 'REMOVE', redirects } }),
  });
  const { uploadRequiredHashes = [], uploadUrl } = await pedir(`${version.name}:populateFiles`, {
    method: 'POST',
    body: JSON.stringify({ files: Object.fromEntries(lista.map((f) => [f.ruta, f.hash])) }),
  });
  for (const hash of uploadRequiredHashes) {
    const f = lista.find((x) => x.hash === hash);
    const r = await fetch(`${uploadUrl}/${hash}`, {
      method: 'POST',
      headers: { ...cabeceras, 'Content-Type': 'application/octet-stream' },
      body: f.gz,
    });
    if (!r.ok) throw new Error(`No se pudo subir ${f.ruta}: ${r.status} ${await r.text()}`);
  }
  console.log(`⬆️  subidos ${uploadRequiredHashes.length} (el resto ya estaba en Hosting)`);

  await pedir(`${version.name}?update_mask=status`, { method: 'PATCH', body: JSON.stringify({ status: 'FINALIZED' }) });
  await pedir(`${sitio}/releases?versionName=${encodeURIComponent(version.name)}`, { method: 'POST', body: '{}' });
  const { defaultUrl } = await pedir(`projects/${cuenta.project_id}/${sitio}`);
  console.log(`✅ publicada en ${defaultUrl}`);
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});

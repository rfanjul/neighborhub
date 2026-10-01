#!/usr/bin/env node
/**
 * Cuentas de administración para la web /admin (ver, editar y aprobar
 * servicios). Ser admin es un custom claim de Firebase Auth que solo pone el
 * Admin SDK; las reglas de Firestore lo comprueban.
 *
 *   npm run admin -- --email tu@correo   → si no existe, crea la cuenta con
 *                                          una contraseña nueva que solo se
 *                                          muestra aquí; si existe, la hace admin
 *   npm run admin -- --email … --nueva-clave   otra contraseña
 *   npm run admin -- --email … --quitar        deja de ser admin
 *   npm run admin -- --lista                   quién es admin
 *
 * Credenciales: las mismas que npm run seed (service-account.json).
 */
const { generarClave, iniciarAdmin } = require('./seed');

const noExiste = (e) => {
  if (e.code === 'auth/user-not-found') return null;
  throw e;
};

/** Crea o reutiliza la cuenta y le da el claim admin. password solo si es nueva. */
async function hacerAdmin(auth, { email, nuevaClave = false }) {
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Uso: npm run admin -- --email tu@correo');
  let usuario = await auth.getUserByEmail(email).catch(noExiste);
  let password = null;
  if (!usuario) {
    password = generarClave();
    usuario = await auth.createUser({ email, password, emailVerified: true, displayName: 'Admin' });
  } else if (nuevaClave) {
    password = generarClave();
    await auth.updateUser(usuario.uid, { password });
  }
  await auth.setCustomUserClaims(usuario.uid, { ...(usuario.customClaims ?? {}), admin: true });
  return { uid: usuario.uid, email, password, nueva: !!password && !nuevaClave };
}

/** Quita el claim y cierra sus sesiones abiertas, para que deje de valer ya. */
async function quitarAdmin(auth, email) {
  const usuario = await auth.getUserByEmail(email).catch(noExiste);
  if (!usuario) throw new Error(`No hay ninguna cuenta con ${email}`);
  const { admin, ...resto } = usuario.customClaims ?? {};
  await auth.setCustomUserClaims(usuario.uid, resto);
  await auth.revokeRefreshTokens(usuario.uid);
  return { uid: usuario.uid, email, eraAdmin: !!admin };
}

async function listarAdmins(auth) {
  const admins = [];
  let pagina;
  do {
    const r = await auth.listUsers(1000, pagina);
    admins.push(...r.users.filter((u) => u.customClaims?.admin).map((u) => u.email));
    pagina = r.pageToken;
  } while (pagina);
  return admins;
}

async function main() {
  const { getAuth } = require('firebase-admin/auth');
  const { destino } = iniciarAdmin();
  const auth = getAuth();
  const arg = (nombre) => {
    const i = process.argv.indexOf(nombre);
    return i === -1 ? undefined : process.argv[i + 1];
  };

  if (process.argv.includes('--lista')) {
    const admins = await listarAdmins(auth);
    console.log(`👩‍💼 ${destino}: ${admins.length ? admins.join(', ') : 'ninguna cuenta es admin'}`);
    return;
  }
  const email = arg('--email');
  if (process.argv.includes('--quitar')) {
    const r = await quitarAdmin(auth, email);
    console.log(r.eraAdmin ? `🚫 ${destino}: ${r.email} ya no es admin` : `${r.email} no era admin`);
    return;
  }
  const r = await hacerAdmin(auth, { email, nuevaClave: process.argv.includes('--nueva-clave') });
  const web = process.env.FIRESTORE_EMULATOR_HOST ? 'http://127.0.0.1:5050/admin' : 'https://neighborhood-c4dc9.web.app/admin';
  console.log(`👩‍💼 ${destino}: ${r.email} es admin. Entra en ${web}\n`);
  console.log(`   Usuario:     ${r.email}`);
  console.log(
    r.password
      ? `   Contraseña:  ${r.password}\n\n   Guárdala ahora en tu gestor de contraseñas: no se guarda en ningún sitio.`
      : '   Contraseña:  la que ya tenía (para generar otra: --nueva-clave)'
  );
}

if (require.main === module) {
  main().catch((e) => {
    console.error('❌', e.message);
    process.exit(1);
  });
}

module.exports = { hacerAdmin, quitarAdmin, listarAdmins };

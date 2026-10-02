/**
 * Lista de usuarios para la web de administración: las cuentas de Firebase
 * Auth (cómo entran, último acceso, si están desactivadas o son admin) con
 * su perfil público de users/. Los vecinos de ejemplo (seed) tienen perfil
 * pero no cuenta: salen como ficticios.
 *
 * Recibe auth y db de fuera para poder probarlo sin red.
 */

const PROVEEDORES = { password: 'email', 'google.com': 'google', 'apple.com': 'apple' };

const milis = (t) => (t && typeof t.toMillis === 'function' ? t.toMillis() : 0);
const fechaAuth = (texto) => (texto ? Date.parse(texto) || 0 : 0);

function crearUsuarios({ auth, db }) {
  async function todasLasCuentas() {
    const cuentas = [];
    let pagina;
    do {
      const r = await auth.listUsers(1000, pagina);
      cuentas.push(...r.users);
      pagina = r.pageToken;
    } while (pagina && cuentas.length < 10000);
    return cuentas;
  }

  async function listar() {
    const [cuentas, perfiles] = await Promise.all([todasLasCuentas(), db.collection('users').get()]);
    const porUid = new Map(perfiles.docs.map((d) => [d.id, d.data()]));

    const usuario = (uid, cuenta, p = {}) => ({
      uid,
      nombre: p.name || cuenta?.displayName || '',
      email: cuenta?.email || p.email || '',
      foto: p.photoURL || cuenta?.photoURL || '',
      ciudad: p.city || '',
      codigoPostal: p.postalCode || '',
      pais: p.country || '',
      creado: fechaAuth(cuenta?.metadata?.creationTime) || milis(p.createdAt),
      ultimoAcceso: fechaAuth(cuenta?.metadata?.lastSignInTime),
      proveedores: [...new Set((cuenta?.providerData || []).map((x) => PROVEEDORES[x.providerId] || x.providerId))],
      emailVerificado: Boolean(cuenta?.emailVerified),
      desactivado: Boolean(cuenta?.disabled),
      admin: cuenta?.customClaims?.admin === true,
      ficticio: !cuenta,
      conPerfil: Boolean(porUid.get(uid)),
      perfilCompleto: p.onboardingCompleted === true,
      valoracion: typeof p.rating === 'number' ? p.rating : 0,
      valoraciones: p.ratingCount || 0,
      ayudas: p.servicesCompleted || 0,
      cobrosActivos: p.cobrosActivos === true,
    });

    const lista = cuentas.map((c) => usuario(c.uid, c, porUid.get(c.uid)));
    const conCuenta = new Set(cuentas.map((c) => c.uid));
    perfiles.docs.filter((d) => !conCuenta.has(d.id)).forEach((d) => lista.push(usuario(d.id, null, d.data())));
    // Primero las personas reales, de la más nueva a la más antigua.
    return lista.sort((a, b) => a.ficticio - b.ficticio || b.creado - a.creado);
  }

  return { listar };
}

module.exports = { crearUsuarios };

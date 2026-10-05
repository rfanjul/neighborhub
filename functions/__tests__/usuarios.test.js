/**
 * Lista de usuarios de la administración, contra el emulador de Firestore y
 * con un Auth falso.
 */
const { initializeApp, deleteApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { crearUsuarios } = require('../usuarios');

const projectId = 'demo-usuarios';
let app;
let db;

beforeAll(() => {
  app = initializeApp({ projectId }, 'usuarios');
  db = getFirestore(app);
});
afterAll(() => deleteApp(app));

beforeEach(async () => {
  await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${projectId}/databases/(default)/documents`, { method: 'DELETE' });
});

const cuenta = (uid, extra = {}) => ({
  uid,
  email: `${uid}@ejemplo.test`,
  emailVerified: true,
  disabled: false,
  metadata: { creationTime: 'Wed, 01 Oct 2026 10:00:00 GMT', lastSignInTime: 'Thu, 02 Oct 2026 18:00:00 GMT' },
  providerData: [{ providerId: 'password' }],
  ...extra,
});

function authFalso(cuentas, porPagina = 1000) {
  return {
    listUsers: jest.fn(async (max, pagina) => {
      const desde = pagina ? Number(pagina) : 0;
      const hasta = desde + Math.min(max, porPagina);
      return { users: cuentas.slice(desde, hasta), pageToken: hasta < cuentas.length ? String(hasta) : undefined };
    }),
  };
}

describe('usuarios de la administración', () => {
  it('junta la cuenta (cómo entra, último acceso, admin) con su perfil', async () => {
    await db.doc('users/ana').set({
      name: 'Ana', city: 'Zürich', postalCode: '8004', country: 'CH', photoURL: 'https://foto/ana.jpg',
      rating: 4.5, ratingCount: 2, servicesCompleted: 3, cobrosActivos: true, onboardingCompleted: true,
    });
    await db.doc('privado/ana').set({ email: 'ana@vieja.test', dateOfBirth: '1990-01-01' });
    const auth = authFalso([
      cuenta('ana', { providerData: [{ providerId: 'apple.com' }, { providerId: 'password' }] }),
      cuenta('jefa', { customClaims: { admin: true }, disabled: true }),
    ]);

    const [ana, jefa] = (await crearUsuarios({ auth, db }).listar()).sort((a, b) => a.uid.localeCompare(b.uid));

    expect(ana).toEqual({
      uid: 'ana',
      nombre: 'Ana',
      // El de la cuenta de Auth manda sobre el guardado en privado/.
      email: 'ana@ejemplo.test',
      foto: 'https://foto/ana.jpg',
      ciudad: 'Zürich',
      codigoPostal: '8004',
      pais: 'CH',
      creado: Date.UTC(2026, 9, 1, 10),
      ultimoAcceso: Date.UTC(2026, 9, 2, 18),
      proveedores: ['apple', 'email'],
      emailVerificado: true,
      desactivado: false,
      admin: false,
      ficticio: false,
      conPerfil: true,
      perfilCompleto: true,
      valoracion: 4.5,
      valoraciones: 2,
      ayudas: 3,
      cobrosActivos: true,
    });
    // Una cuenta sin perfil (la de administración) también sale.
    expect(jefa).toMatchObject({ email: 'jefa@ejemplo.test', admin: true, desactivado: true, conPerfil: false, ficticio: false });
  });

  it('los vecinos de ejemplo (perfil sin cuenta) salen al final como ficticios', async () => {
    await db.doc('users/vecino').set({ name: 'Mia', seed: true, createdAt: Timestamp.fromMillis(Date.UTC(2026, 0, 1)) });
    await db.doc('users/ana').set({ name: 'Ana' });
    const auth = authFalso([
      cuenta('vieja', { metadata: { creationTime: 'Mon, 01 Sep 2025 10:00:00 GMT' } }),
      cuenta('ana'),
    ]);

    const lista = await crearUsuarios({ auth, db }).listar();

    expect(lista.map((u) => [u.uid, u.ficticio])).toEqual([
      ['ana', false],
      ['vieja', false],
      ['vecino', true],
    ]);
    expect(lista[2]).toMatchObject({ nombre: 'Mia', email: '', proveedores: [], creado: Date.UTC(2026, 0, 1), ultimoAcceso: 0 });
  });

  it('el email de quien no tiene cuenta sale de sus datos privados', async () => {
    await db.doc('users/vecino').set({ name: 'Mia', seed: true });
    await db.doc('privado/vecino').set({ email: 'mia@example.com', dateOfBirth: null });

    const [mia] = await crearUsuarios({ auth: authFalso([]), db }).listar();

    expect(mia).toMatchObject({ uid: 'vecino', email: 'mia@example.com', ficticio: true });
  });

  it('recorre todas las páginas de cuentas', async () => {
    const auth = authFalso([cuenta('a'), cuenta('b'), cuenta('c')], 2);

    expect((await crearUsuarios({ auth, db }).listar()).map((u) => u.uid).sort()).toEqual(['a', 'b', 'c']);
    expect(auth.listUsers).toHaveBeenCalledTimes(2);
  });

  it('no devuelve datos que no hacen falta (fecha de nacimiento, bio)', async () => {
    await db.doc('users/ana').set({ name: 'Ana', dateOfBirth: '1990-01-01', bio: 'hola' });
    await db.doc('privado/ana').set({ email: 'ana@ejemplo.test', dateOfBirth: '1990-01-01' });
    const [ana] = await crearUsuarios({ auth: authFalso([cuenta('ana')]), db }).listar();

    expect(JSON.stringify(ana)).not.toMatch(/1990|hola/);
  });
});

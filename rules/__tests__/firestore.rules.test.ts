import { readFileSync } from 'fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { addDoc, collection, serverTimestamp, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';

let env: RulesTestEnvironment;

const perfilInicial = {
  name: 'Ana',
  credits: 0,
  level: 1,
  levelLabel: 'New neighbor',
  servicesCompleted: 0,
  rating: 0,
  responseLabel: '—',
  identityVerified: false,
  onboardingCompleted: false,
  photoURL: null,
};

const servicio = (overrides: object = {}) => ({
  title: 'Pintar pared',
  status: 'pending',
  requesterId: 'ana',
  requesterName: 'Ana',
  helperId: null,
  ...overrides,
});

const como = (uid: string) => env.authenticatedContext(uid).firestore();
const anonimo = () => env.unauthenticatedContext().firestore();

/** Escribe datos de partida saltándose las reglas, como haría la consola. */
async function sembrar(ruta: string, datos: object) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), ruta), datos);
  });
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-neighborhub',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8180 },
  });
});

afterEach(() => env.clearFirestore());
afterAll(() => env.cleanup());

describe('users', () => {
  it('sin sesión no se lee ningún perfil', async () => {
    await sembrar('users/ana', perfilInicial);

    await assertFails(getDoc(doc(anonimo(), 'users/ana')));
  });

  it('con sesión se leen los perfiles de los vecinos', async () => {
    await sembrar('users/ana', perfilInicial);

    await assertSucceeds(getDoc(doc(como('luis'), 'users/ana')));
  });

  it('cada uno crea su propio perfil al entrar por primera vez', async () => {
    await assertSucceeds(setDoc(doc(como('ana'), 'users/ana'), perfilInicial));
  });

  it('nadie crea el perfil de otro', async () => {
    await assertFails(setDoc(doc(como('luis'), 'users/ana'), perfilInicial));
  });

  it('nadie arranca con créditos regalados', async () => {
    await assertFails(setDoc(doc(como('ana'), 'users/ana'), { ...perfilInicial, credits: 1000 }));
  });

  it('nadie arranca verificado sin haber pasado la verificación', async () => {
    await assertFails(setDoc(doc(como('ana'), 'users/ana'), { ...perfilInicial, identityVerified: true }));
  });

  it('el perfil público no lleva email ni fecha de nacimiento (van en privado/)', async () => {
    await assertFails(setDoc(doc(como('ana'), 'users/ana'), { ...perfilInicial, email: 'ana@example.com' }));
    await assertFails(setDoc(doc(como('ana'), 'users/ana'), { ...perfilInicial, dateOfBirth: null }));
  });

  it('cada uno edita sus datos personales', async () => {
    await sembrar('users/ana', perfilInicial);

    await assertSucceeds(
      updateDoc(doc(como('ana'), 'users/ana'), { city: 'Zurich', bio: 'Hola', languages: 'German', photoURL: 'https://x' })
    );
  });

  it.each([
    ['email', 'ana@example.com'],
    ['dateOfBirth', '08/07/1979'],
  ])('nadie pone su %s en el perfil público', async (campo, valor) => {
    await sembrar('users/ana', perfilInicial);

    await assertFails(updateDoc(doc(como('ana'), 'users/ana'), { [campo]: valor }));
  });

  it.each([
    ['credits', 1000],
    ['rating', 5],
    ['level', 10],
    ['servicesCompleted', 99],
    ['identityVerified', true],
  ])('nadie se cambia a sí mismo %s', async (campo, valor) => {
    await sembrar('users/ana', perfilInicial);

    await assertFails(updateDoc(doc(como('ana'), 'users/ana'), { [campo]: valor }));
  });

  it('nadie edita el perfil de otro', async () => {
    await sembrar('users/ana', perfilInicial);

    await assertFails(updateDoc(doc(como('luis'), 'users/ana'), { city: 'Madrid' }));
  });

  it('cada uno borra su perfil (al borrar la cuenta), pero no el de otro', async () => {
    await sembrar('users/ana', perfilInicial);

    await assertFails(deleteDoc(doc(como('luis'), 'users/ana')));
    await assertFails(deleteDoc(doc(anonimo(), 'users/ana')));
    await assertSucceeds(deleteDoc(doc(como('ana'), 'users/ana')));
  });
});

describe('privado (email y fecha de nacimiento)', () => {
  const privados = { email: 'ana@example.com', dateOfBirth: null };
  const admin = () => env.authenticatedContext('jefa', { admin: true }).firestore();

  it('al entrar por primera vez se crean el perfil y los datos privados a la vez', async () => {
    const ana = como('ana');
    const lote = writeBatch(ana);
    lote.set(doc(ana, 'privado/ana'), privados);
    lote.set(doc(ana, 'users/ana'), perfilInicial);

    await assertSucceeds(lote.commit());
  });

  it('cada uno lee los suyos, cambia su fecha de nacimiento y los borra', async () => {
    const ref = doc(como('ana'), 'privado/ana');
    await assertSucceeds(setDoc(ref, privados));

    await assertSucceeds(getDoc(ref));
    await assertSucceeds(updateDoc(ref, { dateOfBirth: '08/07/1979' }));
    await assertSucceeds(updateDoc(ref, { dateOfBirth: null }));
    await assertSucceeds(deleteDoc(ref));
  });

  it('la fecha se guarda aunque el documento aún no exista (cuentas sin migrar)', async () => {
    await assertSucceeds(setDoc(doc(como('ana'), 'privado/ana'), { dateOfBirth: '08/07/1979' }, { merge: true }));
  });

  it('ningún otro vecino los lee, ni sin sesión, ni listando la colección', async () => {
    await sembrar('privado/ana', privados);

    await assertFails(getDoc(doc(como('luis'), 'privado/ana')));
    await assertFails(getDoc(doc(anonimo(), 'privado/ana')));
    await assertFails(getDocs(collection(como('luis'), 'privado')));
    await assertFails(getDoc(doc(env.authenticatedContext('luis', { admin: false }).firestore(), 'privado/ana')));
  });

  it('nadie crea, cambia ni borra los de otro', async () => {
    await assertFails(setDoc(doc(como('luis'), 'privado/ana'), privados));
    await sembrar('privado/ana', privados);

    await assertFails(updateDoc(doc(como('luis'), 'privado/ana'), { dateOfBirth: '01/01/2000' }));
    await assertFails(deleteDoc(doc(como('luis'), 'privado/ana')));
  });

  it('la administración los lee (también listando) pero no los cambia ni los borra', async () => {
    await sembrar('privado/ana', privados);

    await assertSucceeds(getDoc(doc(admin(), 'privado/ana')));
    await assertSucceeds(getDocs(collection(admin(), 'privado')));
    await assertFails(updateDoc(doc(admin(), 'privado/ana'), { dateOfBirth: '01/01/2000' }));
    await assertFails(setDoc(doc(admin(), 'privado/jefa2'), privados));
    await assertFails(deleteDoc(doc(admin(), 'privado/ana')));
  });

  it('el email no se cambia desde la app', async () => {
    await sembrar('privado/ana', privados);

    await assertFails(updateDoc(doc(como('ana'), 'privado/ana'), { email: 'otra@example.com' }));
  });

  it.each([
    ['otros campos', { ...privados, admin: true }],
    ['un email que no es texto', { ...privados, email: 42 }],
    ['un email larguísimo', { ...privados, email: `${'a'.repeat(200)}@example.com` }],
    ['una fecha que no es texto', { ...privados, dateOfBirth: 1979 }],
    ['una fecha larguísima', { ...privados, dateOfBirth: 'x'.repeat(51) }],
  ])('no se guardan %s', async (_caso, datos) => {
    await assertFails(setDoc(doc(como('ana'), 'privado/ana'), datos));
  });

  it('tampoco se cuela una fecha que no es texto al cambiarla', async () => {
    await sembrar('privado/ana', privados);

    await assertFails(updateDoc(doc(como('ana'), 'privado/ana'), { dateOfBirth: 1979 }));
  });
});

describe('helpRequests', () => {
  it('se publica pendiente de revisión y a nombre propio', async () => {
    await assertSucceeds(addDoc(collection(como('ana'), 'helpRequests'), servicio()));
  });

  it('no se publica directamente como aprobado', async () => {
    await assertFails(addDoc(collection(como('ana'), 'helpRequests'), servicio({ status: 'approved' })));
  });

  it('no se publica a nombre de otro', async () => {
    await assertFails(addDoc(collection(como('luis'), 'helpRequests'), servicio()));
  });

  describe('precio', () => {
    it.each([
      ['sin precio (favor gratis)', {}],
      ['con precio null', { priceCents: null }],
      ['con CHF 5', { priceCents: 500 }],
      ['con CHF 40', { priceCents: 4000 }],
      ['con CHF 1000', { priceCents: 100000 }],
    ])('se publica %s', async (_caso, precio) => {
      await assertSucceeds(addDoc(collection(como('ana'), 'helpRequests'), servicio(precio)));
    });

    it.each([
      ['por debajo de CHF 5', 499],
      ['por encima de CHF 1000', 100001],
      ['con medio céntimo', 4000.5],
      ['como texto', '4000'],
      ['negativo', -4000],
    ])('no se publica %s', async (_caso, priceCents) => {
      await assertFails(addDoc(collection(como('ana'), 'helpRequests'), servicio({ priceCents })));
    });

    it('mientras está pendiente se puede poner, cambiar o quitar', async () => {
      await sembrar('helpRequests/s1', servicio());
      const ana = doc(como('ana'), 'helpRequests/s1');

      await assertSucceeds(updateDoc(ana, { priceCents: 4000 }));
      await assertSucceeds(updateDoc(ana, { priceCents: 5500 }));
      await assertSucceeds(updateDoc(ana, { priceCents: null }));
      await assertFails(updateDoc(ana, { priceCents: 300 }));
    });

    it('publicado ya no cambia: puede haber ofertas con ese precio', async () => {
      await sembrar('helpRequests/s1', servicio({ status: 'approved', priceCents: 4000 }));
      const ana = doc(como('ana'), 'helpRequests/s1');

      await assertFails(updateDoc(ana, { priceCents: 3000 }));
      await assertFails(updateDoc(ana, { priceCents: null }));
      // El resto del contenido sí se puede seguir corrigiendo.
      await assertSucceeds(updateDoc(ana, { title: 'Pintar dos paredes' }));
    });
  });

  it('los aprobados los ve cualquier vecino', async () => {
    await sembrar('helpRequests/s1', servicio({ status: 'approved' }));

    await assertSucceeds(getDoc(doc(como('luis'), 'helpRequests/s1')));
  });

  it('los pendientes solo los ve quien los publicó', async () => {
    await sembrar('helpRequests/s1', servicio());

    await assertSucceeds(getDoc(doc(como('ana'), 'helpRequests/s1')));
    await assertFails(getDoc(doc(como('luis'), 'helpRequests/s1')));
  });

  // Las dos consultas que hace el muro: Firestore solo las permite si el
  // filtro garantiza que cada documento devuelto cumple la regla de lectura.
  it('el muro puede listar todos los aprobados', async () => {
    await sembrar('helpRequests/s1', servicio({ status: 'approved', requesterId: 'luis' }));

    await assertSucceeds(getDocs(query(collection(como('ana'), 'helpRequests'), where('status', '==', 'approved'))));
  });

  it('el muro puede listar los propios, estén como estén', async () => {
    await sembrar('helpRequests/s1', servicio());

    await assertSucceeds(getDocs(query(collection(como('ana'), 'helpRequests'), where('requesterId', '==', 'ana'))));
  });

  it('no se pueden listar los servicios de otro', async () => {
    await sembrar('helpRequests/s1', servicio());

    await assertFails(getDocs(query(collection(como('luis'), 'helpRequests'), where('requesterId', '==', 'ana'))));
  });

  it('se pueden listar aquellos en los que uno ayuda', async () => {
    await sembrar('helpRequests/s1', servicio({ status: 'completed', helperId: 'luis' }));

    await assertSucceeds(getDocs(query(collection(como('luis'), 'helpRequests'), where('helperId', '==', 'luis'))));
  });

  it('quien publica marca como completado un servicio aceptado', async () => {
    await sembrar('helpRequests/s1', servicio({ status: 'accepted', helperId: 'luis' }));

    await assertSucceeds(updateDoc(doc(como('ana'), 'helpRequests/s1'), { status: 'completed' }));
  });

  it('no se puede listar todo sin filtrar', async () => {
    await assertFails(getDocs(collection(como('ana'), 'helpRequests')));
  });



  it('quien publica no se aprueba su propio servicio (eso es cosa del admin)', async () => {
    await sembrar('helpRequests/s1', servicio());

    await assertFails(updateDoc(doc(como('ana'), 'helpRequests/s1'), { status: 'approved' }));
  });

  it('quien publica puede corregir el texto de su servicio', async () => {
    await sembrar('helpRequests/s1', servicio());

    await assertSucceeds(updateDoc(doc(como('ana'), 'helpRequests/s1'), { title: 'Pintar dos paredes' }));
  });

  it('quien publica edita también uno aprobado, mientras no haya elegido a nadie', async () => {
    await sembrar('helpRequests/s1', servicio({ status: 'approved' }));

    await assertSucceeds(updateDoc(doc(como('ana'), 'helpRequests/s1'), { description: 'Ahora son dos paredes', photos: [] }));
  });

  it('con una oferta ya elegida el servicio no se edita', async () => {
    await sembrar('helpRequests/s1', servicio({ status: 'accepted', helperId: 'luis' }));

    await assertFails(updateDoc(doc(como('ana'), 'helpRequests/s1'), { title: 'Otra cosa' }));
  });

  it('marcar como completado no permite colar otros cambios', async () => {
    await sembrar('helpRequests/s1', servicio({ status: 'accepted', helperId: 'luis' }));

    await assertFails(updateDoc(doc(como('luis'), 'helpRequests/s1'), { status: 'completed', title: 'Otra cosa' }));
  });

  it('completado no vuelve atrás', async () => {
    await sembrar('helpRequests/s1', servicio({ status: 'completed', helperId: 'luis' }));

    await assertFails(updateDoc(doc(como('ana'), 'helpRequests/s1'), { status: 'accepted' }));
  });

  it('completado tampoco se edita', async () => {
    await sembrar('helpRequests/s1', servicio({ status: 'completed', helperId: 'luis' }));

    await assertFails(updateDoc(doc(como('ana'), 'helpRequests/s1'), { title: 'Otra cosa' }));
  });

  it('quien publica no se cambia por otro', async () => {
    await sembrar('helpRequests/s1', servicio());

    await assertFails(updateDoc(doc(como('ana'), 'helpRequests/s1'), { requesterId: 'luis' }));
  });

  it('un extraño no toca un servicio ajeno', async () => {
    await sembrar('helpRequests/s1', servicio({ status: 'accepted', helperId: 'luis' }));

    await assertFails(updateDoc(doc(como('marta'), 'helpRequests/s1'), { title: 'Otra cosa' }));
  });


  it('una vez aceptado, quien ayuda lo marca como hecho', async () => {
    await sembrar('helpRequests/s1', servicio({ status: 'accepted', helperId: 'luis' }));

    await assertSucceeds(updateDoc(doc(como('luis'), 'helpRequests/s1'), { status: 'completed' }));
  });

  it('nadie devuelve un servicio aceptado a aprobado o pendiente', async () => {
    await sembrar('helpRequests/s1', servicio({ status: 'accepted', helperId: 'luis' }));

    await assertFails(updateDoc(doc(como('luis'), 'helpRequests/s1'), { status: 'approved' }));
    await assertFails(updateDoc(doc(como('ana'), 'helpRequests/s1'), { status: 'pending' }));
  });

  it('quien ayuda no se pasa el servicio a otro', async () => {
    await sembrar('helpRequests/s1', servicio({ status: 'accepted', helperId: 'luis' }));

    await assertFails(updateDoc(doc(como('luis'), 'helpRequests/s1'), { status: 'completed', helperId: 'marta' }));
  });

  it.each(['pending', 'approved'])('quien publica borra su servicio %s, sin nadie elegido', async (status) => {
    await sembrar('helpRequests/s1', servicio({ status }));

    await assertFails(deleteDoc(doc(como('luis'), 'helpRequests/s1')));
    await assertSucceeds(deleteDoc(doc(como('ana'), 'helpRequests/s1')));
  });

  it.each(['accepted', 'completed', 'rated'])('un servicio %s ya implica a otra persona y no se borra', async (status) => {
    await sembrar('helpRequests/s1', servicio({ status, helperId: 'luis' }));

    await assertFails(deleteDoc(doc(como('ana'), 'helpRequests/s1')));
  });
});

describe('pagos con Stripe (los escribe solo el servidor)', () => {
  beforeEach(() => sembrar('config/app', { pagosActivos: true }));

  it('con precio, la app no puede elegir oferta: lo acepta el servidor al cobrar', async () => {
    await sembrar('helpRequests/s1', servicio({ status: 'approved', priceCents: 4000 }));
    await sembrar('applications/s1_luis', { serviceId: 's1', applicantId: 'luis', status: 'pending' });

    await assertFails(
      updateDoc(doc(como('ana'), 'helpRequests/s1'), { status: 'accepted', helperId: 'luis', helperName: 'Luis', updatedAt: serverTimestamp() })
    );
  });

  it('con los pagos apagados, uno con precio se elige como si fuera gratis', async () => {
    await sembrar('config/app', { pagosActivos: false });
    await sembrar('helpRequests/s1', servicio({ status: 'approved', priceCents: 4000 }));
    await sembrar('applications/s1_luis', { serviceId: 's1', applicantId: 'luis', status: 'pending' });

    await assertSucceeds(
      updateDoc(doc(como('ana'), 'helpRequests/s1'), { status: 'accepted', helperId: 'luis', helperName: 'Luis', updatedAt: serverTimestamp() })
    );
  });

  it('la configuración la lee quien entra y solo la cambia la administración', async () => {
    await sembrar('config/app', { pagosActivos: false });

    await assertSucceeds(getDoc(doc(como('ana'), 'config/app')));
    await assertFails(getDoc(doc(anonimo(), 'config/app')));
    await assertFails(setDoc(doc(como('ana'), 'config/app'), { pagosActivos: true }));
    const admin = env.authenticatedContext('jefa', { admin: true }).firestore();
    await assertSucceeds(setDoc(doc(admin, 'config/app'), { pagosActivos: true, actualizadoPor: 'jefa' }));
    await assertFails(setDoc(doc(admin, 'config/app'), { pagosActivos: 'sí' }));
  });

  it('gratis se sigue eligiendo desde la app', async () => {
    await sembrar('helpRequests/s1', servicio({ status: 'approved', priceCents: null }));
    await sembrar('applications/s1_luis', { serviceId: 's1', applicantId: 'luis', status: 'pending' });

    await assertSucceeds(
      updateDoc(doc(como('ana'), 'helpRequests/s1'), { status: 'accepted', helperId: 'luis', helperName: 'Luis', updatedAt: serverTimestamp() })
    );
  });

  it('nadie se apunta un pago desde la app, ni quien publica ni la administración', async () => {
    await sembrar('helpRequests/s1', servicio({ status: 'approved', priceCents: 4000 }));

    await assertFails(updateDoc(doc(como('ana'), 'helpRequests/s1'), { pago: { estado: 'pagado' } }));
    await assertFails(
      updateDoc(doc(env.authenticatedContext('jefa', { admin: true }).firestore(), 'helpRequests/s1'), { pago: { estado: 'pagado' } })
    );
  });

  it('pagos y cuentas de cobro no se leen ni se escriben desde fuera, ni siendo el dueño', async () => {
    await sembrar('pagos/s1', { requesterId: 'ana', helperId: 'luis', estado: 'retenido' });
    await sembrar('cuentasCobro/luis', { stripeAccountId: 'acct_luis', cobrosActivos: true });

    await assertFails(getDoc(doc(como('ana'), 'pagos/s1')));
    await assertFails(getDoc(doc(como('luis'), 'cuentasCobro/luis')));
    await assertFails(setDoc(doc(como('luis'), 'cuentasCobro/luis'), { stripeAccountId: 'acct_otra', cobrosActivos: true }));
    await assertFails(setDoc(doc(como('ana'), 'pagos/s2'), { estado: 'pagado' }));
  });

  it('nadie se pone los cobros como activos en su perfil', async () => {
    await sembrar('users/luis', { ...perfilInicial, name: 'Luis' });

    await assertFails(updateDoc(doc(como('luis'), 'users/luis'), { cobrosActivos: true }));
  });
});

describe('dispositivos (avisos push)', () => {
  const datos = { tokens: ['ExponentPushToken[abc]'], idioma: 'es', actualizado: serverTimestamp() };

  it('cada uno guarda, lee y borra los suyos', async () => {
    const ref = doc(como('ana'), 'dispositivos/ana');
    await assertSucceeds(setDoc(ref, datos));
    await assertSucceeds(getDoc(ref));
    await assertSucceeds(updateDoc(ref, { idioma: 'de' }));
    await assertSucceeds(deleteDoc(ref));
  });

  it('nadie lee ni toca los de otro', async () => {
    await sembrar('dispositivos/ana', { tokens: ['ExponentPushToken[abc]'], idioma: 'es' });

    await assertFails(getDoc(doc(como('luis'), 'dispositivos/ana')));
    await assertFails(setDoc(doc(como('luis'), 'dispositivos/ana'), datos));
    await assertFails(getDoc(doc(anonimo(), 'dispositivos/ana')));
  });

  it('solo tokens en lista (como mucho 10), un idioma conocido y nada más', async () => {
    const ref = doc(como('ana'), 'dispositivos/ana');
    await assertFails(setDoc(ref, { ...datos, tokens: 'ExponentPushToken[abc]' }));
    await assertFails(setDoc(ref, { ...datos, tokens: Array.from({ length: 11 }, (_, i) => `t${i}`) }));
    await assertFails(setDoc(ref, { ...datos, idioma: 'fr' }));
    await assertFails(setDoc(ref, { ...datos, admin: true }));
  });
});

describe('bloquear y denunciar (contenido de usuarios)', () => {
  it('cada uno guarda y lee su lista de bloqueados; nadie más', async () => {
    const ref = doc(como('ana'), 'bloqueos/ana');
    await assertSucceeds(setDoc(ref, { usuarios: ['luis'], actualizado: serverTimestamp() }));
    await assertSucceeds(getDoc(ref));
    await assertFails(getDoc(doc(como('luis'), 'bloqueos/ana')));
    await assertFails(setDoc(doc(como('luis'), 'bloqueos/ana'), { usuarios: [] }));
    await assertFails(setDoc(ref, { usuarios: 'luis' }));
  });

  it('a quien me bloqueó ya no le llegan mis mensajes; el resto de la conversación sigue', async () => {
    await sembrar('helpRequests/s1', servicio({ status: 'accepted', helperId: 'luis' }));
    const mensaje = (uid: string) => ({ senderId: uid, senderName: uid, text: 'Hola', createdAt: serverTimestamp() });
    await assertSucceeds(addDoc(collection(como('luis'), 'helpRequests/s1/messages'), mensaje('luis')));

    await sembrar('bloqueos/ana', { usuarios: ['luis'] });

    await assertFails(addDoc(collection(como('luis'), 'helpRequests/s1/messages'), mensaje('luis')));
    await assertSucceeds(addDoc(collection(como('ana'), 'helpRequests/s1/messages'), mensaje('ana')));
  });

  it('quien me bloqueó no recibe mis ofertas', async () => {
    await sembrar('helpRequests/s1', servicio({ status: 'approved' }));
    const oferta = { serviceId: 's1', applicantId: 'luis', requesterId: 'ana', status: 'pending', comment: 'Yo puedo' };
    await sembrar('bloqueos/ana', { usuarios: ['luis'] });

    await assertFails(setDoc(doc(como('luis'), 'applications/s1_luis'), oferta));
    await assertSucceeds(setDoc(doc(como('mia'), 'applications/s1_mia'), { ...oferta, applicantId: 'mia' }));
  });

  it('se denuncia a nombre propio, con un motivo conocido; solo la administración lo lee', async () => {
    const denuncia = { reporterId: 'ana', tipo: 'user', objetoId: 'luis', motivo: 'acoso', estado: 'nuevo', createdAt: serverTimestamp() };
    await assertSucceeds(addDoc(collection(como('ana'), 'reports'), denuncia));
    await assertFails(addDoc(collection(como('ana'), 'reports'), { ...denuncia, reporterId: 'luis' }));
    await assertFails(addDoc(collection(como('ana'), 'reports'), { ...denuncia, motivo: 'me cae mal' }));
    await assertFails(addDoc(collection(como('ana'), 'reports'), { ...denuncia, estado: 'revisado' }));
    await assertFails(addDoc(collection(como('ana'), 'reports'), { ...denuncia, extra: 1 }));

    await sembrar('reports/r1', { ...denuncia, createdAt: new Date() });
    await assertFails(getDoc(doc(como('ana'), 'reports/r1')));
    const admin = env.authenticatedContext('jefa', { admin: true }).firestore();
    await assertSucceeds(getDoc(doc(admin, 'reports/r1')));
    await assertSucceeds(updateDoc(doc(admin, 'reports/r1'), { estado: 'retirado', revisadoPor: 'jefa' }));
    await assertFails(updateDoc(doc(admin, 'reports/r1'), { motivo: 'spam' }));
  });
});

describe('administración', () => {
  const admin = () => env.authenticatedContext('jefa', { admin: true }).firestore();

  it('ve los pendientes de cualquiera y puede listarlos todos', async () => {
    await sembrar('helpRequests/s1', servicio());
    await sembrar('helpRequests/s2', servicio({ status: 'accepted', requesterId: 'luis', helperId: 'ana' }));

    await assertSucceeds(getDoc(doc(admin(), 'helpRequests/s1')));
    await assertSucceeds(getDocs(collection(admin(), 'helpRequests')));
  });

  it('aprueba un pendiente y lo vuelve a despublicar', async () => {
    await sembrar('helpRequests/s1', servicio());
    const ref = doc(admin(), 'helpRequests/s1');

    await assertSucceeds(updateDoc(ref, { status: 'approved', reviewedBy: 'jefa', reviewedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(ref, { status: 'pending' }));
  });

  it('corrige el contenido y el precio, también ya publicado', async () => {
    await sembrar('helpRequests/s1', servicio({ status: 'approved', priceCents: 4000 }));

    await assertSucceeds(
      updateDoc(doc(admin(), 'helpRequests/s1'), { title: 'Pintar una pared del salón', category: 'painting', priceCents: 4500 })
    );
  });

  it('no cambia quién pide ni elige a quién ayuda', async () => {
    await sembrar('helpRequests/s1', servicio({ status: 'approved' }));
    const ref = doc(admin(), 'helpRequests/s1');

    await assertFails(updateDoc(ref, { requesterId: 'luis' }));
    await assertFails(updateDoc(ref, { helperId: 'luis', helperName: 'Luis' }));
    await assertFails(updateDoc(ref, { status: 'accepted' }));
  });

  it('no toca los que ya están en marcha', async () => {
    await sembrar('helpRequests/s1', servicio({ status: 'accepted', helperId: 'luis' }));

    await assertFails(updateDoc(doc(admin(), 'helpRequests/s1'), { status: 'pending' }));
    await assertFails(updateDoc(doc(admin(), 'helpRequests/s1'), { title: 'Otra cosa' }));
  });

  it('respeta el rango de precios', async () => {
    await sembrar('helpRequests/s1', servicio());

    await assertFails(updateDoc(doc(admin(), 'helpRequests/s1'), { priceCents: 100 }));
  });

  it('sin el claim de admin nadie aprueba, ni siquiera con una cuenta normal', async () => {
    await sembrar('helpRequests/s1', servicio({ requesterId: 'luis' }));

    await assertFails(updateDoc(doc(como('ana'), 'helpRequests/s1'), { status: 'approved' }));
    await assertFails(
      updateDoc(doc(env.authenticatedContext('ana', { admin: false }).firestore(), 'helpRequests/s1'), { status: 'approved' })
    );
    await assertFails(getDoc(doc(como('ana'), 'helpRequests/s1')));
  });
});

describe('ofertas', () => {
  const oferta = (overrides: object = {}) => ({
    serviceId: 's1',
    applicantId: 'luis',
    requesterId: 'ana',
    comment: 'Tengo rodillo y escalera',
    status: 'pending',
    ...overrides,
  });
  const ofertar = (uid: string, datos: object, id = `s1_${uid}`) => setDoc(doc(como(uid), `applications/${id}`), datos);

  describe('hacer una oferta', () => {
    it('se oferta sobre un servicio aprobado ajeno', async () => {
      await sembrar('helpRequests/s1', servicio({ status: 'approved' }));

      await assertSucceeds(ofertar('luis', oferta()));
    });

    it('no sobre uno pendiente de revisión', async () => {
      await sembrar('helpRequests/s1', servicio());

      await assertFails(ofertar('luis', oferta()));
    });

    it('no sobre uno ya aceptado', async () => {
      await sembrar('helpRequests/s1', servicio({ status: 'accepted', helperId: 'marta' }));

      await assertFails(ofertar('luis', oferta()));
    });

    it('no sobre el propio', async () => {
      await sembrar('helpRequests/s1', servicio({ status: 'approved' }));

      await assertFails(ofertar('ana', oferta({ applicantId: 'ana' })));
    });

    it('no a nombre de otro', async () => {
      await sembrar('helpRequests/s1', servicio({ status: 'approved' }));

      await assertFails(ofertar('luis', oferta({ applicantId: 'marta' }), 's1_marta'));
    });

    it('una sola por persona: el id tiene que ser servicio_uid', async () => {
      await sembrar('helpRequests/s1', servicio({ status: 'approved' }));

      await assertFails(ofertar('luis', oferta(), 's1_luis_2'));
    });

    it('nace pendiente, no seleccionada', async () => {
      await sembrar('helpRequests/s1', servicio({ status: 'approved' }));

      await assertFails(ofertar('luis', oferta({ status: 'selected' })));
    });

    it('no se engaña sobre a quién va dirigida', async () => {
      await sembrar('helpRequests/s1', servicio({ status: 'approved' }));

      await assertFails(ofertar('luis', oferta({ requesterId: 'marta' })));
    });
  });

  describe('ver ofertas', () => {
    beforeEach(() => sembrar('applications/s1_luis', oferta()));

    it('quien oferta ve las suyas (mis ofertas)', async () => {
      await assertSucceeds(getDocs(query(collection(como('luis'), 'applications'), where('applicantId', '==', 'luis'))));
    });

    it('quien publica ve las de su servicio', async () => {
      await assertSucceeds(
        getDocs(query(collection(como('ana'), 'applications'), where('serviceId', '==', 's1'), where('requesterId', '==', 'ana')))
      );
    });

    it('un tercero no las ve', async () => {
      await assertFails(getDoc(doc(como('marta'), 'applications/s1_luis')));
      await assertFails(getDocs(query(collection(como('marta'), 'applications'), where('serviceId', '==', 's1'))));
    });
  });

  describe('elegir una oferta', () => {
    beforeEach(async () => {
      await sembrar('helpRequests/s1', servicio({ status: 'approved' }));
      await sembrar('applications/s1_luis', oferta());
      await sembrar('applications/s1_marta', oferta({ applicantId: 'marta' }));
    });

    /** Lo que hace la app al elegir: todo en un lote. */
    function elegir(uid: string, elegido: string, otros: string[]) {
      const db = como(uid);
      const lote = writeBatch(db);
      lote.update(doc(db, 'helpRequests/s1'), { status: 'accepted', helperId: elegido, helperName: elegido });
      lote.update(doc(db, `applications/s1_${elegido}`), { status: 'selected' });
      for (const o of otros) lote.update(doc(db, `applications/s1_${o}`), { status: 'rejected' });
      return lote.commit();
    }

    it('quien publica elige una y rechaza el resto', async () => {
      await assertSucceeds(elegir('ana', 'luis', ['marta']));
    });

    it('nadie más puede elegir', async () => {
      await assertFails(elegir('luis', 'luis', ['marta']));
    });

    it('no se elige a quien no ha ofertado', async () => {
      await assertFails(updateDoc(doc(como('ana'), 'helpRequests/s1'), { status: 'accepted', helperId: 'pedro' }));
    });

    it('solo se elige una vez', async () => {
      await elegir('ana', 'luis', ['marta']);

      await assertFails(updateDoc(doc(como('ana'), 'helpRequests/s1'), { status: 'accepted', helperId: 'marta' }));
    });

    it('elegir no permite tocar otros campos del servicio', async () => {
      await assertFails(
        updateDoc(doc(como('ana'), 'helpRequests/s1'), { status: 'accepted', helperId: 'luis', title: 'Otra cosa' })
      );
    });

    it('quien oferta no se selecciona a sí mismo', async () => {
      await assertFails(updateDoc(doc(como('luis'), 'applications/s1_luis'), { status: 'selected' }));
    });

    it('en una oferta solo cambia su estado', async () => {
      await assertFails(updateDoc(doc(como('ana'), 'applications/s1_luis'), { status: 'selected', comment: 'otro' }));
    });

    it('quien oferta retira su oferta pendiente; un extraño no', async () => {
      await assertFails(deleteDoc(doc(como('marta'), 'applications/s1_luis')));
      await assertSucceeds(deleteDoc(doc(como('luis'), 'applications/s1_luis')));
    });

    it('quien publica borra las ofertas de su servicio mientras sigue abierto', async () => {
      await assertSucceeds(deleteDoc(doc(como('ana'), 'applications/s1_luis')));
    });

    it('una vez elegida, las ofertas ya no se borran', async () => {
      await elegir('ana', 'luis', ['marta']);

      await assertFails(deleteDoc(doc(como('luis'), 'applications/s1_luis')));
      await assertFails(deleteDoc(doc(como('ana'), 'applications/s1_marta')));
    });
  });
});

describe('mensajes de un servicio', () => {
  beforeEach(() => sembrar('helpRequests/s1', servicio({ status: 'accepted', helperId: 'luis' })));

  it('las dos partes leen la conversación', async () => {
    await sembrar('helpRequests/s1/messages/m1', { senderId: 'ana', text: 'Hola' });

    await assertSucceeds(getDoc(doc(como('ana'), 'helpRequests/s1/messages/m1')));
    await assertSucceeds(getDoc(doc(como('luis'), 'helpRequests/s1/messages/m1')));
  });

  it('un extraño no lee la conversación', async () => {
    await sembrar('helpRequests/s1/messages/m1', { senderId: 'ana', text: 'Hola' });

    await assertFails(getDoc(doc(como('marta'), 'helpRequests/s1/messages/m1')));
  });

  it('las dos partes escriben con su propio nombre', async () => {
    await assertSucceeds(addDoc(collection(como('luis'), 'helpRequests/s1/messages'), { senderId: 'luis', text: 'Voy el sábado' }));
  });

  it('nadie escribe haciéndose pasar por otro', async () => {
    await assertFails(addDoc(collection(como('luis'), 'helpRequests/s1/messages'), { senderId: 'ana', text: 'Cancelo' }));
  });

  it('un extraño no escribe en una conversación ajena', async () => {
    await assertFails(addDoc(collection(como('marta'), 'helpRequests/s1/messages'), { senderId: 'marta', text: 'Spam' }));
  });

  it('los mensajes no se editan ni se borran', async () => {
    await sembrar('helpRequests/s1/messages/m1', { senderId: 'ana', text: 'Hola' });

    await assertFails(updateDoc(doc(como('ana'), 'helpRequests/s1/messages/m1'), { text: 'Adiós' }));
    await assertFails(deleteDoc(doc(como('ana'), 'helpRequests/s1/messages/m1')));
  });
});

describe('reseñas', () => {
  const luis = { ...perfilInicial, name: 'Luis', ratingSum: 8, ratingCount: 2, servicesCompleted: 2 };

  beforeEach(async () => {
    await sembrar('users/ana', perfilInicial);
    await sembrar('users/luis', luis);
    await sembrar('helpRequests/s1', servicio({ status: 'accepted', helperId: 'luis', helperName: 'Luis' }));
  });

  /** Lo que escribe la app al valorar: reseña, perfil de quien ayudó y servicio. */
  function valorar(
    uid: string,
    {
      nota = 4,
      resena = {},
      perfil = {},
      servicioCambios = { status: 'rated' } as object | null,
      tocarPerfil = true,
    }: { nota?: number; resena?: object; perfil?: object; servicioCambios?: object | null; tocarPerfil?: boolean } = {}
  ) {
    const db = como(uid);
    const lote = writeBatch(db);
    lote.set(doc(db, 'reviews/s1'), {
      serviceId: 's1',
      serviceTitle: 'Pintar pared',
      reviewerId: uid,
      reviewerName: 'Ana',
      reviewerPhotoURL: null,
      revieweeId: 'luis',
      rating: nota,
      comment: 'Muy amable y puntual',
      createdAt: 1,
      ...resena,
    });
    if (tocarPerfil) {
      lote.update(doc(db, 'users/luis'), {
        ratingSum: 8 + nota,
        ratingCount: 3,
        servicesCompleted: 3,
        lastReviewId: 's1',
        ...perfil,
      });
    }
    if (servicioCambios) lote.update(doc(db, 'helpRequests/s1'), servicioCambios);
    return lote.commit();
  }

  it('quien publica valora a quien le ayudó y la nota se suma a su perfil', async () => {
    await assertSucceeds(valorar('ana', { nota: 5 }));

    const perfil = await getDoc(doc(como('marta'), 'users/luis'));
    expect(perfil.data()).toMatchObject({ ratingSum: 13, ratingCount: 3, servicesCompleted: 3 });
    expect((await getDoc(doc(como('ana'), 'helpRequests/s1'))).data()?.status).toBe('rated');
  });

  it('también cuando quien ayuda ya lo había marcado como completado', async () => {
    await sembrar('helpRequests/s1', servicio({ status: 'completed', helperId: 'luis' }));

    await assertSucceeds(valorar('ana'));
  });

  it('el comentario es opcional', async () => {
    await assertSucceeds(valorar('ana', { resena: { comment: '' } }));
  });

  it('solo se valora una vez por servicio', async () => {
    await assertSucceeds(valorar('ana'));
    await sembrar('helpRequests/s1', servicio({ status: 'completed', helperId: 'luis' }));

    await assertFails(valorar('ana', { perfil: { ratingSum: 16, ratingCount: 4, servicesCompleted: 4 } }));
  });

  it.each([0, 6, 3.5])('la nota %s no vale: de 1 a 5 estrellas', async (nota) => {
    await assertFails(valorar('ana', { nota }));
  });

  it('un comentario de más de 500 caracteres no vale', async () => {
    await assertFails(valorar('ana', { resena: { comment: 'x'.repeat(501) } }));
  });

  it('quien ayuda no se valora a sí mismo', async () => {
    await assertFails(valorar('luis', { resena: { reviewerId: 'luis' } }));
  });

  it('un extraño no valora un servicio ajeno', async () => {
    await assertFails(valorar('marta'));
  });

  it('no se valora a alguien que no ayudó en ese servicio', async () => {
    await sembrar('users/marta', { ...perfilInicial, name: 'Marta' });
    const db = como('ana');
    const lote = writeBatch(db);
    lote.set(doc(db, 'reviews/s1'), {
      serviceId: 's1', reviewerId: 'ana', revieweeId: 'marta', rating: 5, comment: '', createdAt: 1,
    });
    lote.update(doc(db, 'users/marta'), { ratingSum: 5, ratingCount: 1, servicesCompleted: 1, lastReviewId: 's1' });
    lote.update(doc(db, 'helpRequests/s1'), { status: 'rated' });

    await assertFails(lote.commit());
  });

  it('antes de elegir a nadie no hay nada que valorar', async () => {
    await sembrar('helpRequests/s1', servicio({ status: 'approved' }));

    await assertFails(valorar('ana'));
  });

  it('la suma del perfil tiene que cuadrar con la nota', async () => {
    await assertFails(valorar('ana', { nota: 3, perfil: { ratingSum: 8 + 5 } }));
    await assertFails(valorar('ana', { perfil: { ratingCount: 10 } }));
    await assertFails(valorar('ana', { perfil: { servicesCompleted: 50 } }));
  });

  it('la reseña no se cuela sin sumarla al perfil', async () => {
    await assertFails(valorar('ana', { tocarPerfil: false }));
  });

  it('ni sin cerrar el servicio', async () => {
    await assertFails(valorar('ana', { servicioCambios: null }));
  });

  it('valorar no permite colar más cambios en el perfil', async () => {
    await assertFails(valorar('ana', { perfil: { identityVerified: true } }));
    await assertFails(valorar('ana', { perfil: { credits: 100 } }));
  });

  it('nadie se sube la valoración a mano', async () => {
    await assertFails(updateDoc(doc(como('luis'), 'users/luis'), { ratingSum: 50, ratingCount: 10 }));
    await assertFails(
      updateDoc(doc(como('ana'), 'users/luis'), { ratingSum: 13, ratingCount: 3, servicesCompleted: 3, lastReviewId: 's1' })
    );
  });

  it('un perfil no nace con valoraciones', async () => {
    await assertFails(setDoc(doc(como('marta'), 'users/marta'), { ...perfilInicial, ratingSum: 50, ratingCount: 10 }));
  });

  it('un servicio no pasa a valorado sin reseña', async () => {
    await sembrar('helpRequests/s1', servicio({ status: 'completed', helperId: 'luis' }));

    await assertFails(updateDoc(doc(como('ana'), 'helpRequests/s1'), { status: 'rated' }));
    await assertFails(updateDoc(doc(como('luis'), 'helpRequests/s1'), { status: 'rated' }));
  });

  it('las reseñas las lee cualquiera con sesión, y no se editan ni se borran', async () => {
    await assertSucceeds(valorar('ana'));

    await assertSucceeds(getDoc(doc(como('marta'), 'reviews/s1')));
    await assertFails(getDoc(doc(anonimo(), 'reviews/s1')));
    await assertFails(updateDoc(doc(como('ana'), 'reviews/s1'), { rating: 1 }));
    await assertFails(deleteDoc(doc(como('ana'), 'reviews/s1')));
  });
});

describe('mensajes de contacto', () => {
  const mensaje = (cambios: object = {}) => ({
    tipo: 'problema', nombre: 'Ana', email: 'ana@example.com', mensaje: 'La app se cierra al abrir el mapa',
    referencia: '', origen: 'web', createdAt: serverTimestamp(), ...cambios,
  });

  it('cualquiera, incluso sin sesión, envía un mensaje bien formado', async () => {
    await assertSucceeds(addDoc(collection(anonimo(), 'contactMessages'), mensaje()));
  });

  it.each(['en', 'de', 'es'])('con el idioma de la página (%s)', async (idioma) => {
    await assertSucceeds(addDoc(collection(anonimo(), 'contactMessages'), mensaje({ idioma })));
  });

  it.each([
    ['sin email válido', { email: 'no-es-un-email' }],
    ['demasiado corto', { mensaje: 'hola' }],
    ['de un tipo que no existe', { tipo: 'spam' }],
    ['con campos de más', { admin: true }],
    ['en un idioma que no tenemos', { idioma: 'fr' }],
  ])('rechaza un mensaje %s', async (_caso, cambios) => {
    await assertFails(addDoc(collection(anonimo(), 'contactMessages'), mensaje(cambios)));
  });

  it('nadie los lee desde la app', async () => {
    await sembrar('contactMessages/m1', mensaje({ createdAt: 1 }));
    await assertFails(getDoc(doc(como('ana'), 'contactMessages/m1')));
  });
});

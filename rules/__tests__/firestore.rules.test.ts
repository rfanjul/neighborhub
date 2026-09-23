import { readFileSync } from 'fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';

let env: RulesTestEnvironment;

const perfilInicial = {
  name: 'Ana',
  email: 'ana@example.com',
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

  it('cada uno edita sus datos personales', async () => {
    await sembrar('users/ana', perfilInicial);

    await assertSucceeds(
      updateDoc(doc(como('ana'), 'users/ana'), { city: 'Zurich', bio: 'Hola', languages: 'German', photoURL: 'https://x' })
    );
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

  it('los perfiles no se borran desde la app', async () => {
    await sembrar('users/ana', perfilInicial);

    await assertFails(deleteDoc(doc(como('ana'), 'users/ana')));
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

  it('no se puede listar todo sin filtrar', async () => {
    await assertFails(getDocs(collection(como('ana'), 'helpRequests')));
  });

  it('un vecino acepta un servicio aprobado y pasa a ser quien ayuda', async () => {
    await sembrar('helpRequests/s1', servicio({ status: 'approved' }));

    await assertSucceeds(updateDoc(doc(como('luis'), 'helpRequests/s1'), { status: 'accepted', helperId: 'luis' }));
  });

  it('nadie acepta en nombre de otro', async () => {
    await sembrar('helpRequests/s1', servicio({ status: 'approved' }));

    await assertFails(updateDoc(doc(como('luis'), 'helpRequests/s1'), { status: 'accepted', helperId: 'marta' }));
  });

  it('quien publica no se aprueba su propio servicio (eso es cosa del admin)', async () => {
    await sembrar('helpRequests/s1', servicio());

    await assertFails(updateDoc(doc(como('ana'), 'helpRequests/s1'), { status: 'approved' }));
  });

  it('quien publica puede corregir el texto de su servicio', async () => {
    await sembrar('helpRequests/s1', servicio());

    await assertSucceeds(updateDoc(doc(como('ana'), 'helpRequests/s1'), { title: 'Pintar dos paredes' }));
  });

  it('quien publica no se cambia por otro', async () => {
    await sembrar('helpRequests/s1', servicio());

    await assertFails(updateDoc(doc(como('ana'), 'helpRequests/s1'), { requesterId: 'luis' }));
  });

  it('un extraño no toca un servicio ajeno', async () => {
    await sembrar('helpRequests/s1', servicio({ status: 'accepted', helperId: 'luis' }));

    await assertFails(updateDoc(doc(como('marta'), 'helpRequests/s1'), { title: 'Otra cosa' }));
  });

  it('aceptar no permite tocar nada más que el estado y los datos de quien ayuda', async () => {
    await sembrar('helpRequests/s1', servicio({ status: 'approved' }));

    await assertFails(
      updateDoc(doc(como('luis'), 'helpRequests/s1'), { status: 'accepted', helperId: 'luis', title: 'Cambiado' })
    );
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

  it('los servicios no se borran desde la app', async () => {
    await sembrar('helpRequests/s1', servicio());

    await assertFails(deleteDoc(doc(como('ana'), 'helpRequests/s1')));
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

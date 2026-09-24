import { readFileSync } from 'fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';

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

  it('los servicios no se borran desde la app', async () => {
    await sembrar('helpRequests/s1', servicio());

    await assertFails(deleteDoc(doc(como('ana'), 'helpRequests/s1')));
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

    it('las ofertas no se borran', async () => {
      await assertFails(deleteDoc(doc(como('luis'), 'applications/s1_luis')));
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

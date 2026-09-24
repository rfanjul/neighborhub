// jest.setup.ts sustituye esta capa por un mock para el resto de la suite;
// aquí se prueba la real contra un Firestore y un Storage falsos en memoria.
jest.unmock('../data');

type Doc = Record<string, any>;
const mockStore = new Map<string, Doc>();
const mockSubidas: string[] = [];
const mockBorrados: string[] = [];
let mockReloj = 0;
let mockSecuencia = 0;

jest.mock('../index', () => ({ auth: { currentUser: { uid: 'uid-1' } }, db: {} }));

jest.mock('@firebase/firestore', () => {
  const ruta = (segmentos: string[]) => segmentos.join('/');
  // Igual que el SDK real: undefined no es un valor válido en Firestore.
  const validar = (data: Doc) => {
    for (const [campo, valor] of Object.entries(data)) {
      if (valor === undefined) throw new Error(`Unsupported field value: undefined (found in field ${campo})`);
    }
  };
  return {
    doc: (_db: unknown, ...s: string[]) => ({ path: ruta(s), id: s[s.length - 1] }),
    collection: (_db: unknown, ...s: string[]) => ({ path: ruta(s) }),
    getDoc: async (r: { path: string; id: string }) => ({
      id: r.id,
      exists: () => mockStore.has(r.path),
      data: () => mockStore.get(r.path),
    }),
    setDoc: async (r: { path: string }, data: Doc) => {
      validar(data);
      mockStore.set(r.path, { ...data });
    },
    updateDoc: async (r: { path: string }, data: Doc) => {
      validar(data);
      if (!mockStore.has(r.path)) throw new Error('No document to update');
      mockStore.set(r.path, { ...mockStore.get(r.path), ...data });
    },
    addDoc: async (c: { path: string }, data: Doc) => {
      validar(data);
      const id = `auto-${++mockSecuencia}`;
      mockStore.set(`${c.path}/${id}`, { ...data });
      return { id };
    },
    query: (c: { path: string }, ...filtros: any[]) => ({ path: c.path, filtros }),
    where: (campo: string, _op: string, valor: unknown) => ({ tipo: 'where', campo, valor }),
    orderBy: (campo: string, dir: 'asc' | 'desc' = 'asc') => ({ tipo: 'orderBy', campo, dir }),
    getDocs: async (q: { path: string; filtros: any[] }) => {
      const prefijo = `${q.path}/`;
      let docs = [...mockStore.entries()]
        .filter(([p]) => p.startsWith(prefijo) && !p.slice(prefijo.length).includes('/'))
        .map(([p, data]) => ({ id: p.slice(prefijo.length), data: () => data }));
      for (const f of q.filtros) {
        if (f.tipo === 'where') docs = docs.filter((d) => d.data()[f.campo] === f.valor);
        if (f.tipo === 'orderBy') {
          docs.sort((a, b) => (a.data()[f.campo] - b.data()[f.campo]) * (f.dir === 'desc' ? -1 : 1));
        }
      }
      return { docs };
    },
    serverTimestamp: () => ++mockReloj,
    writeBatch: () => {
      const operaciones: Array<() => void> = [];
      return {
        update(r: { path: string }, data: Doc) {
          validar(data);
          operaciones.push(() => {
            if (!mockStore.has(r.path)) throw new Error('No document to update');
            mockStore.set(r.path, { ...mockStore.get(r.path), ...data });
          });
        },
        // Como el lote real: o se aplica todo o nada.
        async commit() {
          const copia = new Map(mockStore);
          try {
            operaciones.forEach((op) => op());
          } catch (e) {
            mockStore.clear();
            copia.forEach((v, k) => mockStore.set(k, v));
            throw e;
          }
        },
      };
    },
    onSnapshot: (q: { path: string; filtros: any[] }, next: (snap: any) => void) => {
      const prefijo = `${q.path}/`;
      const docs = [...mockStore.entries()]
        .filter(([p]) => p.startsWith(prefijo) && !p.slice(prefijo.length).includes('/'))
        .map(([p, data]) => ({ id: p.slice(prefijo.length), data: () => data }))
        .sort((a, b) => a.data().createdAt - b.data().createdAt);
      next({ docs });
      return () => {};
    },
  };
});

jest.mock('firebase/storage', () => ({
  getStorage: () => ({}),
  ref: (_s: unknown, path: string) => ({ path }),
  uploadBytes: async (r: { path: string }) => void mockSubidas.push(r.path),
  getDownloadURL: async (r: { path: string }) => `https://storage.example/${r.path}`,
  deleteObject: async (r: { path: string }) => void mockBorrados.push(r.path),
}));

import { api, ensureUserDocument } from '../data';

const servicioBase = {
  title: 'Pintar pared',
  category: 'painting' as const,
  description: 'Salón',
  credits: 0,
  durationLabel: '2 h',
  availableLabel: 'Flexible',
  locationLabel: '1.5 km away',
  travelRadiusKm: 5,
};

beforeEach(() => {
  mockStore.clear();
  mockSubidas.length = 0;
  mockBorrados.length = 0;
  (global as any).fetch = jest.fn(async () => ({ blob: async () => 'blob' }));
});

describe('perfil', () => {
  it('crea el documento en el primer acceso con valores por defecto', async () => {
    await ensureUserDocument('uid-1', { name: 'Ana', email: 'ana@example.com' });

    const perfil = await api.getMe();
    expect(perfil).toMatchObject({ id: 'uid-1', name: 'Ana', credits: 0, level: 1, onboardingCompleted: false });
  });

  it('pone un nombre genérico si el proveedor no dio ninguno', async () => {
    await ensureUserDocument('uid-1', { name: '', email: 'x@example.com' });

    expect((await api.getMe()).name).toBe('New neighbor');
  });

  it('no pisa un perfil que ya existe', async () => {
    await ensureUserDocument('uid-1', { name: 'Ana', email: 'ana@example.com' });
    await api.updateMe({ city: 'Zurich' });
    await ensureUserDocument('uid-1', { name: 'Otro', email: 'otro@example.com' });

    expect(await api.getMe()).toMatchObject({ name: 'Ana', city: 'Zurich' });
  });

  it('falla con un mensaje claro si el perfil no existe', async () => {
    await expect(api.getMe()).rejects.toThrow('Profile not found');
  });

  it('actualiza los datos y devuelve el perfil nuevo', async () => {
    await ensureUserDocument('uid-1', { name: 'Ana', email: 'ana@example.com' });

    const perfil = await api.updateMe({ bio: 'Me gusta pintar', languages: 'English, German' });

    expect(perfil).toMatchObject({ bio: 'Me gusta pintar', languages: 'English, German' });
  });

  it('guarda aunque haya campos vacíos, sin mandar undefined a Firestore', async () => {
    await ensureUserDocument('uid-1', { name: 'Ana', email: 'ana@example.com' });

    const perfil = await api.updateMe({ name: 'Ana', city: undefined, bio: 'Hola' });

    expect(perfil).toMatchObject({ name: 'Ana', bio: 'Hola', city: null });
  });

  it('sube la foto de perfil con el uid como nombre y guarda la URL', async () => {
    await ensureUserDocument('uid-1', { name: 'Ana', email: 'ana@example.com' });

    const perfil = await api.uploadMyPhoto('file:///foto.jpg');

    expect(mockSubidas).toEqual(['profile-photos/uid-1.jpg']);
    expect(perfil).toMatchObject({ hasPhoto: true, photoURL: 'https://storage.example/profile-photos/uid-1.jpg' });
  });
});

describe('fotos de servicios', () => {
  it('las sube a la carpeta del usuario y devuelve la URL', async () => {
    const url = await api.uploadServicePhoto('file:///pared.jpg');

    expect(mockSubidas[0]).toMatch(/^service-photos\/uid-1\/\d+-[a-z0-9]+\.jpg$/);
    expect(url).toBe(`https://storage.example/${mockSubidas[0]}`);
  });

  it('las borra a partir de su URL', async () => {
    await api.deleteServicePhoto('https://storage.example/service-photos/uid-1/a.jpg');

    expect(mockBorrados).toEqual(['https://storage.example/service-photos/uid-1/a.jpg']);
  });
});

describe('servicios', () => {
  beforeEach(async () => {
    await ensureUserDocument('uid-1', { name: 'Ana', email: 'ana@example.com' });
  });

  it('se crean pendientes de revisión y con los datos de quien los pide', async () => {
    const creado = await api.createService({
      ...servicioBase,
      photos: ['https://storage.example/a.jpg'],
      coords: { latitude: 47.37, longitude: 8.54 },
    });

    expect(creado).toMatchObject({
      title: 'Pintar pared',
      status: 'pending',
      photos: ['https://storage.example/a.jpg'],
      coords: { latitude: 47.37, longitude: 8.54 },
      distanceKm: 1.5,
      requester: { name: 'Ana' },
    });
  });

  it('guarda la foto de perfil de quien lo publica', async () => {
    mockStore.set('users/uid-1', { ...mockStore.get('users/uid-1'), photoURL: 'https://storage/ana.jpg' });

    await api.createService(servicioBase);

    const guardado = [...mockStore.entries()].find(([k]) => k.startsWith('helpRequests/'))![1];
    expect(guardado.requesterPhotoURL).toBe('https://storage/ana.jpg');
  });

  it('al leerlo usa el perfil actual del autor: foto y nombre nuevos, servicios viejos incluidos', async () => {
    mockStore.set('helpRequests/viejo', { ...servicioBase, status: 'approved', requesterId: 'luis', requesterName: 'Luis', createdAt: 1 });
    mockStore.set('users/luis', { name: 'Luis García', photoURL: 'https://storage/luis.jpg', rating: 4.5, responseLabel: '~1h' });

    const [servicio] = await api.listServices();

    expect(servicio.requester).toMatchObject({ name: 'Luis García', photoURL: 'https://storage/luis.jpg', rating: 4.5, responseLabel: '~1h' });
  });

  it('si el perfil del autor no existe se queda con la copia del servicio', async () => {
    mockStore.set('helpRequests/huerfano', {
      ...servicioBase,
      status: 'approved',
      requesterId: 'borrado',
      requesterName: 'Alguien',
      requesterPhotoURL: 'https://storage/copia.jpg',
      createdAt: 1,
    });

    const servicio = await api.getService('huerfano');

    expect(servicio.requester).toMatchObject({ name: 'Alguien', photoURL: 'https://storage/copia.jpg' });
  });

  it('edita el servicio sin mandar campos vacíos', async () => {
    const creado = await api.createService(servicioBase);

    const editado = await api.updateService(creado.id, { title: 'Pintar dos paredes', description: undefined, photos: ['https://x/1.jpg'] });

    expect(editado).toMatchObject({ title: 'Pintar dos paredes', description: 'Salón', photos: ['https://x/1.jpg'], status: 'pending' });
  });

  it('sin fotos ni coordenadas devuelve valores vacíos, no undefined', async () => {
    const creado = await api.createService(servicioBase);

    expect(creado.photos).toEqual([]);
    expect(creado.coords).toBeNull();
  });

  it('el muro enseña los aprobados de todos, del más nuevo al más viejo', async () => {
    mockStore.set('helpRequests/viejo', { ...servicioBase, title: 'Viejo', status: 'approved', requesterId: 'otro', createdAt: 1 });
    mockStore.set('helpRequests/nuevo', { ...servicioBase, title: 'Nuevo', status: 'approved', requesterId: 'otro', createdAt: 3 });

    const lista = await api.listServices();

    expect(lista.map((s) => s.title)).toEqual(['Nuevo', 'Viejo']);
  });

  it('también enseña los propios pendientes, para que quien publica los vea', async () => {
    await api.createService({ ...servicioBase, title: 'Mío pendiente' });

    const lista = await api.listServices();

    expect(lista).toEqual([expect.objectContaining({ title: 'Mío pendiente', status: 'pending' })]);
  });

  it('no enseña los pendientes de otros', async () => {
    mockStore.set('helpRequests/ajeno', { ...servicioBase, title: 'Ajeno', status: 'pending', requesterId: 'otro', createdAt: 1 });

    expect(await api.listServices()).toEqual([]);
  });

  it('un servicio propio aprobado no sale repetido', async () => {
    mockStore.set('helpRequests/mio', { ...servicioBase, title: 'Mío', status: 'approved', requesterId: 'uid-1', createdAt: 1 });

    expect((await api.listServices()).map((s) => s.id)).toEqual(['mio']);
  });

  it('ordena también con Timestamps de Firestore y con el servidor aún sin fecha', async () => {
    const ts = (ms: number) => ({ toMillis: () => ms });
    mockStore.set('helpRequests/a', { ...servicioBase, title: 'A', status: 'approved', requesterId: 'x', createdAt: ts(10) });
    mockStore.set('helpRequests/b', { ...servicioBase, title: 'B', status: 'approved', requesterId: 'x', createdAt: null });
    mockStore.set('helpRequests/c', { ...servicioBase, title: 'C', status: 'approved', requesterId: 'x', createdAt: ts(20) });

    expect((await api.listServices()).map((s) => s.title)).toEqual(['C', 'A', 'B']);
  });

  it('avisa si el servicio no existe', async () => {
    await expect(api.getService('no-existe')).rejects.toThrow('Service not found');
  });

});

describe('ofertas', () => {
  beforeEach(async () => {
    await ensureUserDocument('uid-1', { name: 'Luis', email: 'luis@example.com' });
    mockStore.set('helpRequests/s1', { ...servicioBase, status: 'approved', requesterId: 'ana', createdAt: 1 });
  });

  it('me ofrezco con un comentario y queda pendiente a mi nombre', async () => {
    const oferta = await api.applyToService('s1', '  Tengo escalera  ');

    expect(oferta).toMatchObject({ id: 's1_uid-1', status: 'pending', comment: 'Tengo escalera', serviceTitle: 'Pintar pared' });
    expect(mockStore.get('applications/s1_uid-1')).toMatchObject({ applicantId: 'uid-1', applicantName: 'Luis', requesterId: 'ana' });
  });

  it('no me ofrezco a un servicio sin aprobar', async () => {
    mockStore.set('helpRequests/s1', { ...servicioBase, status: 'pending', requesterId: 'ana' });

    await expect(api.applyToService('s1', 'Hola')).rejects.toThrow('Only approved services');
  });

  it('no me ofrezco a mi propio servicio', async () => {
    mockStore.set('helpRequests/s1', { ...servicioBase, status: 'approved', requesterId: 'uid-1' });

    await expect(api.applyToService('s1', 'Hola')).rejects.toThrow('your own service');
  });

  it('avisa si el servicio no existe', async () => {
    await expect(api.applyToService('no-existe', 'Hola')).rejects.toThrow('Service not found');
  });

  it('mis ofertas: las que he hecho yo, de la más nueva a la más vieja', async () => {
    mockStore.set('applications/a_uid-1', { serviceId: 'a', serviceTitle: 'Vieja', applicantId: 'uid-1', createdAt: 1 });
    mockStore.set('applications/b_uid-1', { serviceId: 'b', serviceTitle: 'Nueva', applicantId: 'uid-1', createdAt: 5 });
    mockStore.set('applications/b_otro', { serviceId: 'b', serviceTitle: 'Ajena', applicantId: 'otro', createdAt: 9 });

    expect((await api.listMyApplications()).map((o) => o.serviceTitle)).toEqual(['Nueva', 'Vieja']);
  });

  describe('como quien publica', () => {
    beforeEach(() => {
      mockStore.set('helpRequests/mio', { ...servicioBase, status: 'approved', requesterId: 'uid-1', createdAt: 1 });
      mockStore.set('applications/mio_luis', { serviceId: 'mio', applicantId: 'luis', applicantName: 'Luis', requesterId: 'uid-1', status: 'pending', createdAt: 1 });
      mockStore.set('applications/mio_marta', { serviceId: 'mio', applicantId: 'marta', applicantName: 'Marta', requesterId: 'uid-1', status: 'pending', createdAt: 2 });
    });

    it('veo las ofertas recibidas en mi servicio', async () => {
      expect((await api.listApplicationsForService('mio')).map((o) => o.applicantName)).toEqual(['Marta', 'Luis']);
    });

    it('al elegir una, el servicio pasa a aceptado con esa persona y el resto se rechaza', async () => {
      await api.selectApplicant('mio', 'mio_luis');

      expect(mockStore.get('helpRequests/mio')).toMatchObject({ status: 'accepted', helperId: 'luis', helperName: 'Luis' });
      expect(mockStore.get('applications/mio_luis')?.status).toBe('selected');
      expect(mockStore.get('applications/mio_marta')?.status).toBe('rejected');
    });

    it('no elige una oferta que no existe', async () => {
      await expect(api.selectApplicant('mio', 'mio_pedro')).rejects.toThrow('Offer not found');
      expect(mockStore.get('helpRequests/mio')?.status).toBe('approved');
    });

    it('mis servicios: todos los que he publicado, en cualquier estado', async () => {
      mockStore.set('helpRequests/mio2', { ...servicioBase, title: 'Pendiente', status: 'pending', requesterId: 'uid-1', createdAt: 5 });
      mockStore.set('helpRequests/ajeno', { ...servicioBase, status: 'approved', requesterId: 'otro' });

      expect((await api.listMyServices()).map((s) => s.id)).toEqual(['mio2', 'mio']);
    });

    it('marco un servicio como completado', async () => {
      await api.completeService('mio');

      expect(mockStore.get('helpRequests/mio')?.status).toBe('completed');
    });
  });

  it('cuenta las ayudas completadas, no las que siguen en curso', async () => {
    mockStore.set('helpRequests/h1', { ...servicioBase, status: 'completed', helperId: 'uid-1' });
    mockStore.set('helpRequests/h2', { ...servicioBase, status: 'rated', helperId: 'uid-1' });
    mockStore.set('helpRequests/h3', { ...servicioBase, status: 'accepted', helperId: 'uid-1' });
    mockStore.set('helpRequests/h4', { ...servicioBase, status: 'completed', helperId: 'otro' });

    expect(await api.countCompletedHelps()).toBe(2);
  });
});

describe('chat en tiempo real', () => {
  it('entrega los mensajes en orden y marca los propios', async () => {
    mockStore.set('helpRequests/s1/messages/m2', { senderId: 'otro', senderName: 'Luis', text: 'Qué tal', createdAt: 2 });
    mockStore.set('helpRequests/s1/messages/m1', { senderId: 'uid-1', senderName: 'Ana', text: 'Hola', createdAt: 1 });
    const recibidos: Array<[string, boolean]> = [];

    const dejar = api.subscribeMessages('s1', (mensajes) => recibidos.push(...mensajes.map((m) => [m.text, m.fromMe] as [string, boolean])));

    expect(recibidos).toEqual([
      ['Hola', true],
      ['Qué tal', false],
    ]);
    expect(typeof dejar).toBe('function');
  });
});

describe('documentos incompletos', () => {
  it('un perfil al que le faltan campos recibe valores por defecto', async () => {
    mockStore.set('users/uid-1', { name: 'Ana', email: 'ana@example.com' });

    expect(await api.getMe()).toMatchObject({
      bio: null,
      city: null,
      credits: 0,
      level: 1,
      levelLabel: 'New neighbor',
      rating: 0,
      responseLabel: '—',
      identityVerified: false,
      onboardingCompleted: false,
      hasPhoto: false,
      photoURL: null,
    });
  });

  it('un servicio al que le faltan campos no rompe el muro', async () => {
    mockStore.set('helpRequests/raro', { title: 'Solo título', photos: 'no-es-una-lista' });

    expect(await api.getService('raro')).toMatchObject({
      category: 'other',
      description: '',
      distanceKm: 0,
      credits: 0,
      status: 'pending',
      photos: [],
      coords: null,
      requester: { name: 'Neighbor', rating: 0, responseLabel: '—' },
    });
  });
});

describe('mensajes', () => {
  it('se envían y se leen en orden, marcando los propios', async () => {
    await ensureUserDocument('uid-1', { name: 'Ana', email: 'ana@example.com' });
    await api.sendMessage('s1', 'Hola');
    mockStore.set('helpRequests/s1/messages/m-luis', { senderId: 'otro', senderName: 'Luis', text: 'Qué tal', createdAt: 999 });

    const mensajes = await api.listMessages('s1');

    expect(mensajes.map((m) => [m.text, m.fromMe])).toEqual([
      ['Hola', true],
      ['Qué tal', false],
    ]);
  });
});

describe('sin sesión', () => {
  it('las operaciones del usuario fallan en vez de escribir en un perfil ajeno', async () => {
    const { auth } = require('../index');
    const anterior = auth.currentUser;
    auth.currentUser = null;

    await expect(api.getMe()).rejects.toThrow('Not signed in');

    auth.currentUser = anterior;
  });
});

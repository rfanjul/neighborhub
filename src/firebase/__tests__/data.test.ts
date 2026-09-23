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
  return {
    doc: (_db: unknown, ...s: string[]) => ({ path: ruta(s), id: s[s.length - 1] }),
    collection: (_db: unknown, ...s: string[]) => ({ path: ruta(s) }),
    getDoc: async (r: { path: string; id: string }) => ({
      id: r.id,
      exists: () => mockStore.has(r.path),
      data: () => mockStore.get(r.path),
    }),
    setDoc: async (r: { path: string }, data: Doc) => void mockStore.set(r.path, { ...data }),
    updateDoc: async (r: { path: string }, data: Doc) => {
      if (!mockStore.has(r.path)) throw new Error('No document to update');
      mockStore.set(r.path, { ...mockStore.get(r.path), ...data });
    },
    addDoc: async (c: { path: string }, data: Doc) => {
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

  it('sin fotos ni coordenadas devuelve valores vacíos, no undefined', async () => {
    const creado = await api.createService(servicioBase);

    expect(creado.photos).toEqual([]);
    expect(creado.coords).toBeNull();
  });

  it('el muro solo lista los aprobados, del más nuevo al más viejo', async () => {
    const a = await api.createService({ ...servicioBase, title: 'Viejo' });
    const b = await api.createService({ ...servicioBase, title: 'Pendiente' });
    const c = await api.createService({ ...servicioBase, title: 'Nuevo' });
    for (const id of [a.id, c.id]) {
      mockStore.set(`helpRequests/${id}`, { ...mockStore.get(`helpRequests/${id}`), status: 'approved' });
    }

    const lista = await api.listServices();

    expect(lista.map((s) => s.title)).toEqual(['Nuevo', 'Viejo']);
    expect(lista.find((s) => s.id === b.id)).toBeUndefined();
  });

  it('avisa si el servicio no existe', async () => {
    await expect(api.getService('no-existe')).rejects.toThrow('Service not found');
  });

  describe('aceptar', () => {
    function servicioAjeno(status: string) {
      mockStore.set('helpRequests/s1', { ...servicioBase, status, requesterId: 'otro', requesterName: 'Luis' });
    }

    it('convierte al usuario en quien ayuda', async () => {
      servicioAjeno('approved');

      const aceptado = await api.acceptService('s1');

      expect(aceptado.status).toBe('accepted');
      expect(mockStore.get('helpRequests/s1')).toMatchObject({ helperId: 'uid-1', helperName: 'Ana' });
    });

    it('solo si está aprobado', async () => {
      servicioAjeno('pending');

      await expect(api.acceptService('s1')).rejects.toThrow('Only approved services');
    });

    it('nunca el propio', async () => {
      mockStore.set('helpRequests/s1', { ...servicioBase, status: 'approved', requesterId: 'uid-1' });

      await expect(api.acceptService('s1')).rejects.toThrow("can't accept your own");
    });

    it('avisa si no existe', async () => {
      await expect(api.acceptService('no-existe')).rejects.toThrow('Service not found');
    });
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

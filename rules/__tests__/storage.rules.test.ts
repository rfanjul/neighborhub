import { readFileSync } from 'fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { getBytes, ref, uploadBytes } from 'firebase/storage';

let env: RulesTestEnvironment;

const imagen = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
const jpeg = { contentType: 'image/jpeg' };

const storageDe = (uid: string) => env.authenticatedContext(uid).storage();
const anonimo = () => env.unauthenticatedContext().storage();

async function sembrar(ruta: string) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await uploadBytes(ref(ctx.storage(), ruta), imagen, jpeg);
  });
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-neighborhub',
    storage: { rules: readFileSync('storage.rules', 'utf8'), host: '127.0.0.1', port: 9199 },
  });
});

afterEach(() => env.clearStorage());
afterAll(() => env.cleanup());

describe('fotos de perfil', () => {
  it('cada uno sube la suya, con su uid como nombre', async () => {
    await assertSucceeds(uploadBytes(ref(storageDe('ana'), 'profile-photos/ana.jpg'), imagen, jpeg));
  });

  it('nadie sube la foto de otro', async () => {
    await assertFails(uploadBytes(ref(storageDe('luis'), 'profile-photos/ana.jpg'), imagen, jpeg));
  });

  it('solo con el nombre esperado, no cualquier archivo en la carpeta', async () => {
    await assertFails(uploadBytes(ref(storageDe('ana'), 'profile-photos/otra-cosa.jpg'), imagen, jpeg));
  });

  it('sin sesión no se sube', async () => {
    await assertFails(uploadBytes(ref(anonimo(), 'profile-photos/ana.jpg'), imagen, jpeg));
  });

  it('solo imágenes', async () => {
    await assertFails(
      uploadBytes(ref(storageDe('ana'), 'profile-photos/ana.jpg'), imagen, { contentType: 'application/pdf' })
    );
  });

  it('como mucho 8 MB', async () => {
    const grande = new Uint8Array(8 * 1024 * 1024 + 1);

    await assertFails(uploadBytes(ref(storageDe('ana'), 'profile-photos/ana.jpg'), grande, jpeg));
  });

  it('son públicas, como un avatar', async () => {
    await sembrar('profile-photos/ana.jpg');

    await assertSucceeds(getBytes(ref(anonimo(), 'profile-photos/ana.jpg')));
  });
});

describe('fotos de servicios', () => {
  it('se suben a la carpeta propia', async () => {
    await assertSucceeds(uploadBytes(ref(storageDe('ana'), 'service-photos/ana/1-a.jpg'), imagen, jpeg));
  });

  it('nadie sube a la carpeta de otro', async () => {
    await assertFails(uploadBytes(ref(storageDe('luis'), 'service-photos/ana/1-a.jpg'), imagen, jpeg));
  });

  it('solo imágenes y como mucho 8 MB', async () => {
    await assertFails(
      uploadBytes(ref(storageDe('ana'), 'service-photos/ana/1-a.jpg'), imagen, { contentType: 'text/plain' })
    );
    await assertFails(
      uploadBytes(ref(storageDe('ana'), 'service-photos/ana/1-b.jpg'), new Uint8Array(8 * 1024 * 1024 + 1), jpeg)
    );
  });

  it('las ve cualquier vecino con sesión', async () => {
    await sembrar('service-photos/ana/1-a.jpg');

    await assertSucceeds(getBytes(ref(storageDe('luis'), 'service-photos/ana/1-a.jpg')));
  });

  it('sin sesión no se ven', async () => {
    await sembrar('service-photos/ana/1-a.jpg');

    await assertFails(getBytes(ref(anonimo(), 'service-photos/ana/1-a.jpg')));
  });
});

describe('fuera de las carpetas conocidas', () => {
  it('no se sube nada', async () => {
    await assertFails(uploadBytes(ref(storageDe('ana'), 'otra-carpeta/x.jpg'), imagen, jpeg));
  });
});

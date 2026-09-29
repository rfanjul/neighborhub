/**
 * El script de datos de prueba contra el emulador: siembra con el Admin
 * SDK y comprueba, como un vecino normal con las reglas activas, que el
 * muro y los perfiles se ven como en la app. Luego limpia.
 */
import { readFileSync } from 'fs';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const { sembrar, limpiar, ofertar } = require('../../scripts/seed');

// Proyecto propio: los otros tests limpian demo-neighborhub en paralelo.
const projectId = 'demo-seed';
let env: RulesTestEnvironment;
let admin: App;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId,
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
  admin = initializeApp({ projectId }, 'seed');
});

afterAll(async () => {
  await deleteApp(admin);
  await env.cleanup();
});

beforeEach(() => env.clearFirestore());

const vecino = () => env.authenticatedContext('ruben').firestore();

test('crea 10 vecinos y 30 servicios aprobados, visibles en el muro', async () => {
  const r = await sembrar(getFirestore(admin), { Timestamp });
  expect(r).toEqual({ usuarios: 10, servicios: 30 });

  const muro = await getDocs(query(collection(vecino(), 'helpRequests'), where('status', '==', 'approved')));
  expect(muro.size).toBe(30);

  const porAutor = new Map<string, number>();
  muro.forEach((d) => {
    const s = d.data();
    expect(s.title).toBeTruthy();
    expect(s.description.length).toBeGreaterThan(40);
    expect(s.photos.length).toBeGreaterThan(0);
    expect(s.coords.latitude).toBeCloseTo(47.37, 0);
    expect(s.coords.longitude).toBeCloseTo(8.53, 0);
    expect(s.createdAt).toBeTruthy();
    porAutor.set(s.requesterId, (porAutor.get(s.requesterId) ?? 0) + 1);
  });
  expect([...porAutor.values()]).toEqual(Array(10).fill(3));

  const perfil = await getDoc(doc(vecino(), 'users', 'seed-user-01'));
  expect(perfil.data()).toMatchObject({ name: 'Anna Weber', onboardingCompleted: true, city: 'Zürich' });
});

test('se puede sembrar dos veces sin duplicar', async () => {
  await sembrar(getFirestore(admin), { Timestamp });
  await sembrar(getFirestore(admin), { Timestamp });
  const muro = await getDocs(query(collection(vecino(), 'helpRequests'), where('status', '==', 'approved')));
  expect(muro.size).toBe(30);
});

test('limpiar borra lo sembrado y respeta los datos reales', async () => {
  const db = getFirestore(admin);
  await sembrar(db, { Timestamp });
  await db.doc('users/ruben').set({ name: 'Ruben' });
  await db.doc('helpRequests/real').set({ title: 'Real', status: 'approved', requesterId: 'ruben' });
  await db.doc('applications/seed-service-01-1_ruben').set({ serviceId: 'seed-service-01-1', applicantId: 'ruben' });

  expect(await limpiar(db)).toBe(40);

  expect((await db.collection('helpRequests').get()).docs.map((d) => d.id)).toEqual(['real']);
  expect((await db.collection('users').get()).docs.map((d) => d.id)).toEqual(['ruben']);
  expect((await db.collection('applications').get()).size).toBe(0);
});

describe('ofertar', () => {
  const mio = { title: 'Move table', status: 'pending', requesterId: 'ruben', requesterName: 'Ruben', helperId: null };

  test('3 vecinos distintos ofertan en mi servicio, que queda aprobado', async () => {
    const db = getFirestore(admin);
    await sembrar(db, { Timestamp });
    await db.doc('helpRequests/mesa').set(mio);

    const r = await ofertar(db, 'move table', { Timestamp });
    expect(r).toEqual({ servicioId: 'mesa', titulo: 'Move table', ofertas: 3, aprobado: true });

    // Lo que ve el dueño en la app, con las reglas activas.
    const recibidas = await getDocs(
      query(collection(vecino(), 'applications'), where('serviceId', '==', 'mesa'), where('requesterId', '==', 'ruben')),
    );
    expect(recibidas.size).toBe(3);
    const autores = recibidas.docs.map((d) => d.data().applicantId);
    expect(new Set(autores).size).toBe(3);
    recibidas.forEach((d) => {
      expect(d.id).toBe(`mesa_${d.data().applicantId}`);
      expect(d.data()).toMatchObject({ status: 'pending', serviceTitle: 'Move table' });
      expect(d.data().comment.length).toBeGreaterThan(20);
    });
    expect((await getDoc(doc(vecino(), 'helpRequests', 'mesa'))).data()?.status).toBe('approved');
  });

  test('limpiar quita las ofertas de prueba pero deja mi servicio', async () => {
    const db = getFirestore(admin);
    await sembrar(db, { Timestamp });
    await db.doc('helpRequests/mesa').set(mio);
    await ofertar(db, 'mesa', { Timestamp });

    expect(await limpiar(db)).toBe(43);
    expect((await db.collection('applications').get()).size).toBe(0);
    expect((await db.doc('helpRequests/mesa').get()).exists).toBe(true);
  });

  test('avisa si no hay vecinos de prueba, si no existe o si ya está cerrado', async () => {
    const db = getFirestore(admin);
    await db.doc('helpRequests/mesa').set(mio);
    await expect(ofertar(db, 'mesa', { Timestamp })).rejects.toThrow('npm run seed');
    await expect(ofertar(db, 'Sofa', { Timestamp })).rejects.toThrow('No encuentro');
    await db.doc('helpRequests/mesa').update({ status: 'accepted' });
    await expect(ofertar(db, 'mesa', { Timestamp })).rejects.toThrow('accepted');
  });
});

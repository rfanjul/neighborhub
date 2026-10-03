/**
 * La migración que saca el email y la fecha de nacimiento de users/ a
 * privado/, contra el emulador: con el Admin SDK como el script y luego,
 * con las reglas activas, comprobando quién ve qué.
 */
import { readFileSync } from 'fs';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc } from 'firebase/firestore';
import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const { migrar } = require('../../scripts/migrar-privado');

// Proyecto propio: los otros tests limpian el suyo en paralelo.
const projectId = 'demo-migrar';
let env: RulesTestEnvironment;
let admin: App;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId,
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
  admin = initializeApp({ projectId }, 'migrar');
});

afterAll(async () => {
  await deleteApp(admin);
  await env.cleanup();
});

beforeEach(() => env.clearFirestore());

const db = () => getFirestore(admin);
const datos = async (ruta: string) => (await db().doc(ruta).get()).data();

async function perfilesViejos() {
  await db().doc('users/ana').set({ name: 'Ana', city: 'Zürich', email: 'ana@example.com', dateOfBirth: '08/07/1979', rating: 4.5 });
  await db().doc('users/luis').set({ name: 'Luis', email: 'luis@example.com', dateOfBirth: null });
  await db().doc('users/nuevo').set({ name: 'Nuevo' });
}

test('el simulacro cuenta lo que movería sin escribir nada', async () => {
  await perfilesViejos();

  expect(await migrar(db(), { FieldValue })).toEqual({ perfiles: 3, movidos: 2 });

  expect(await datos('users/ana')).toMatchObject({ email: 'ana@example.com', dateOfBirth: '08/07/1979' });
  expect((await db().collection('privado').get()).size).toBe(0);
});

test('mueve email y fecha de nacimiento a privado/ y deja el resto del perfil', async () => {
  await perfilesViejos();

  expect(await migrar(db(), { aplicar: true, FieldValue })).toEqual({ perfiles: 3, movidos: 2 });

  expect(await datos('users/ana')).toEqual({ name: 'Ana', city: 'Zürich', rating: 4.5 });
  expect(await datos('privado/ana')).toEqual({ email: 'ana@example.com', dateOfBirth: '08/07/1979' });
  expect(await datos('users/luis')).toEqual({ name: 'Luis' });
  expect(await datos('privado/luis')).toEqual({ email: 'luis@example.com', dateOfBirth: null });
  // Quien no tenía nada privado en users/ no gana un documento vacío.
  expect(await datos('users/nuevo')).toEqual({ name: 'Nuevo' });
  expect((await db().doc('privado/nuevo').get()).exists).toBe(false);
});

test('después, otro vecino ya no ve el email ni la fecha; su dueño y la administración sí', async () => {
  await perfilesViejos();
  await migrar(db(), { aplicar: true, FieldValue });

  const luis = env.authenticatedContext('luis').firestore();
  const perfilDeAna = (await getDoc(doc(luis, 'users/ana'))).data();
  expect(perfilDeAna).toEqual({ name: 'Ana', city: 'Zürich', rating: 4.5 });
  await assertFails(getDoc(doc(luis, 'privado/ana')));

  await assertSucceeds(getDoc(doc(env.authenticatedContext('ana').firestore(), 'privado/ana')));
  await assertSucceeds(getDoc(doc(env.authenticatedContext('jefa', { admin: true }).firestore(), 'privado/ana')));
});

test('respeta lo que la app nueva ya guardó en privado/ y completa lo que falta', async () => {
  await db().doc('users/ana').set({ name: 'Ana', email: 'ana@example.com', dateOfBirth: '01/01/1980' });
  await db().doc('privado/ana').set({ dateOfBirth: '08/07/1979' });

  await migrar(db(), { aplicar: true, FieldValue });

  expect(await datos('privado/ana')).toEqual({ email: 'ana@example.com', dateOfBirth: '08/07/1979' });
  expect(await datos('users/ana')).toEqual({ name: 'Ana' });
});

test('se puede repetir: la segunda vez no queda nada que mover', async () => {
  await perfilesViejos();
  await migrar(db(), { aplicar: true, FieldValue });

  expect(await migrar(db(), { aplicar: true, FieldValue })).toEqual({ perfiles: 3, movidos: 0 });
  expect(await datos('privado/ana')).toEqual({ email: 'ana@example.com', dateOfBirth: '08/07/1979' });
});

test('los vecinos de prueba llevan seed: true también en privado/', async () => {
  await db().doc('users/seed-user-01').set({ name: 'Anna Weber', email: 'anna.weber@example.com', dateOfBirth: null, seed: true });

  await migrar(db(), { aplicar: true, FieldValue });

  expect(await datos('privado/seed-user-01')).toEqual({ email: 'anna.weber@example.com', dateOfBirth: null, seed: true });
});

test('con muchos perfiles va por lotes', async () => {
  for (let n = 1; n <= 5; n++) await db().doc(`users/u${n}`).set({ name: `U${n}`, email: `u${n}@example.com` });

  expect(await migrar(db(), { aplicar: true, FieldValue, porLote: 2 })).toEqual({ perfiles: 5, movidos: 5 });

  for (let n = 1; n <= 5; n++) {
    expect(await datos(`privado/u${n}`)).toEqual({ email: `u${n}@example.com` });
    expect(await datos(`users/u${n}`)).toEqual({ name: `U${n}` });
  }
});

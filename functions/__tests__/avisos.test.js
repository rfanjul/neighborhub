/**
 * Notificaciones contra el emulador de Firestore, con el servicio de push de
 * Expo falso: se apunta qué se manda y se responde lo preparado.
 */
const { initializeApp, deleteApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { crearAvisos, escribir, TEXTOS } = require('../avisos');

const projectId = 'demo-avisos';
let app;
let db;
let enviados;
let respuestas;
let avisos;

beforeAll(() => {
  app = initializeApp({ projectId }, 'avisos');
  db = getFirestore(app);
});
afterAll(() => deleteApp(app));

beforeEach(async () => {
  await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${projectId}/databases/(default)/documents`, { method: 'DELETE' });
  enviados = [];
  respuestas = null;
  const fetchFalso = jest.fn(async (url, opciones) => {
    const mensajes = JSON.parse(opciones.body);
    enviados.push(...mensajes);
    return { json: async () => ({ data: respuestas ?? mensajes.map(() => ({ status: 'ok' })) }) };
  });
  avisos = crearAvisos({
    db,
    fetch: fetchFalso,
    quitarToken: (uid, tokens) => db.doc(`dispositivos/${uid}`).update({ tokens: FieldValue.arrayRemove(...tokens) }),
  });
  await db.doc('dispositivos/ana').set({ idioma: 'es', tokens: ['ExponentPushToken[ana-iphone]'] });
  await db.doc('dispositivos/luis').set({ idioma: 'de', tokens: ['ExponentPushToken[luis-1]', 'ExponentPushToken[luis-2]'] });
  await db.doc('dispositivos/mia').set({ idioma: 'en', tokens: [] });
});

const servicio = (cambios = {}) => ({
  title: 'Subir un sofá', status: 'approved', requesterId: 'ana', requesterName: 'Ana', helperId: null, helperName: null, ...cambios,
});

describe('textos', () => {
  it('los tres idiomas tienen los mismos avisos y huecos', () => {
    const forma = (t) => Object.fromEntries(Object.entries(t).map(([k, [a, b]]) => [k, `${a}${b}`.match(/\{\w+\}/g)?.sort().join()]));
    expect(forma(TEXTOS.de)).toEqual(forma(TEXTOS.en));
    expect(forma(TEXTOS.es)).toEqual(forma(TEXTOS.en));
  });

  it('importes con la moneda del idioma, y en inglés si el idioma no se conoce', () => {
    expect(escribir('cobrado', 'es', { precio: 3000, titulo: 'Mesa' }).body).toMatch(/^30,00\sCHF por «Mesa»/);
    expect(escribir('cobrado', 'de', { precio: 3000, titulo: 'Mesa' }).body).toMatch(/^CHF\s30\.00 für „Mesa“/);
    expect(escribir('cobrado', 'fr', { precio: 3000, titulo: 'Mesa' }).title).toBe('You’ve been paid 💰');
  });
});

describe('a quién y qué', () => {
  it('oferta nueva: a quien pide, en su idioma, y abre sus ofertas', async () => {
    expect(await avisos.nuevaOferta({ serviceId: 's1', serviceTitle: 'Subir un sofá', requesterId: 'ana', applicantName: 'Luis' })).toBe(1);

    expect(enviados).toEqual([
      {
        to: 'ExponentPushToken[ana-iphone]',
        title: 'Nueva oferta 🙋',
        body: 'Luis se ofrece a ayudarte con «Subir un sofá».',
        sound: 'default',
        data: { pantalla: 'ServiceOffers', serviceId: 's1' },
      },
    ]);
  });

  it('mensaje: a la otra persona del chat, a todos sus dispositivos', async () => {
    await db.doc('helpRequests/s1').set(servicio({ status: 'accepted', helperId: 'luis', helperName: 'Luis' }));

    expect(await avisos.nuevoMensaje('s1', { senderId: 'ana', senderName: 'Ana', text: '¿El sábado a las 10?' })).toBe(2);
    expect(enviados.map((m) => m.to)).toEqual(['ExponentPushToken[luis-1]', 'ExponentPushToken[luis-2]']);
    expect(enviados[0]).toMatchObject({ title: 'Ana', body: '¿El sábado a las 10?', data: { pantalla: 'Chat', serviceId: 's1' } });

    enviados = [];
    await avisos.nuevoMensaje('s1', { senderId: 'luis', senderName: 'Luis', text: 'Perfecto' });
    expect(enviados.map((m) => m.to)).toEqual(['ExponentPushToken[ana-iphone]']);
  });

  it('un mensaje largo se recorta', async () => {
    await db.doc('helpRequests/s1').set(servicio({ status: 'accepted', helperId: 'luis' }));

    await avisos.nuevoMensaje('s1', { senderId: 'luis', senderName: 'Luis', text: 'x'.repeat(500) });
    expect(enviados[0].body).toHaveLength(140);
    expect(enviados[0].body.endsWith('…')).toBe(true);
  });

  it('aprobado: a quien pide', async () => {
    await avisos.cambioServicio('s1', servicio({ status: 'pending' }), servicio());

    expect(enviados).toEqual([expect.objectContaining({ to: 'ExponentPushToken[ana-iphone]', title: 'Tu servicio ya está publicado ✅' })]);
  });

  it('elegido con pago: quien ayuda sabe que tiene el dinero asegurado y quien pide ve el pago confirmado', async () => {
    const pago = { estado: 'retenido', precio: 3000, comision: 240, total: 3240 };
    await avisos.cambioServicio('s1', servicio(), servicio({ status: 'accepted', helperId: 'luis', helperName: 'Luis', pago }));

    const aLuis = enviados.find((m) => m.to === 'ExponentPushToken[luis-1]');
    const aAna = enviados.find((m) => m.to === 'ExponentPushToken[ana-iphone]');
    expect(aLuis).toMatchObject({ title: 'Du wurdest ausgewählt! 🎉', data: { pantalla: 'ServiceDetail', serviceId: 's1' } });
    expect(aLuis.body).toMatch(/Ana hat dich für „Subir un sofá“ ausgewählt\. CHF\s30\.00 sind dir sicher\./);
    expect(aAna.body).toMatch(/Has pagado 32,40\sCHF\. Luis lo recibe cuando marques «Subir un sofá» como hecho\./);
  });

  it('elegido gratis: solo quien ayuda', async () => {
    await avisos.cambioServicio('s1', servicio(), servicio({ status: 'accepted', helperId: 'luis', helperName: 'Luis' }));

    expect(enviados.map((m) => m.title)).toEqual(['Du wurdest ausgewählt! 🎉', 'Du wurdest ausgewählt! 🎉']);
  });

  it('marcado como hecho: quien pide, para que valore', async () => {
    const enCurso = servicio({ status: 'accepted', helperId: 'luis', helperName: 'Luis' });
    await avisos.cambioServicio('s1', enCurso, { ...enCurso, status: 'completed' });

    expect(enviados).toEqual([expect.objectContaining({ to: 'ExponentPushToken[ana-iphone]', title: 'Marcado como hecho' })]);
  });

  it('valorado: quien ayuda ve las estrellas', async () => {
    await db.doc('reviews/s1').set({ rating: 5 });
    const enCurso = servicio({ status: 'completed', helperId: 'luis', helperName: 'Luis' });
    await avisos.cambioServicio('s1', enCurso, { ...enCurso, status: 'rated' });

    expect(enviados[0].body).toBe('Ana hat deine Hilfe bei „Subir un sofá“ bewertet: 5/5.');
  });

  it('pago transferido: quien ayuda cobra y quien pide lo sabe', async () => {
    const base = servicio({ status: 'rated', helperId: 'luis', helperName: 'Luis' });
    await avisos.cambioServicio(
      's1',
      { ...base, pago: { estado: 'retenido', precio: 3000 } },
      { ...base, pago: { estado: 'pagado', precio: 3000 } }
    );

    expect(enviados.find((m) => m.to === 'ExponentPushToken[luis-1]')).toMatchObject({ title: 'Zahlung erhalten 💰', data: { pantalla: 'Payments' } });
    expect(enviados.find((m) => m.to === 'ExponentPushToken[ana-iphone]').body).toMatch(/Se han pagado 30,00\sCHF a Luis/);
  });

  it('hay que volver a pagar: solo quien pide, una vez, y abre sus pagos', async () => {
    const base = servicio({ status: 'rated', helperId: 'luis', helperName: 'Luis' });
    const antes = { ...base, pago: { estado: 'reembolsado', precio: 3000, total: 3240 } };
    const despues = { ...base, pago: { ...antes.pago, porPagar: true } };
    await avisos.cambioServicio('s1', antes, despues);
    await avisos.cambioServicio('s1', despues, { ...despues, updatedAt: 1 });

    expect(enviados).toHaveLength(1);
    expect(enviados[0]).toMatchObject({ to: 'ExponentPushToken[ana-iphone]', title: 'Falta tu pago 💳', data: { pantalla: 'Payments', serviceId: 's1' } });
    expect(enviados[0].body).toMatch(/Tu pago de «Subir un sofá» se devolvió y Luis aún no ha cobrado\. Toca para pagar 32,40\sCHF\./);
  });

  it('pago pedido (se eligió sin pagar): solo quien pide, una vez', async () => {
    const base = servicio({ status: 'rated', helperId: 'luis', helperName: 'Luis' });
    const despues = { ...base, cobroPedido: { total: 2160, precio: 2000 } };
    await avisos.cambioServicio('s1', base, despues);
    await avisos.cambioServicio('s1', despues, { ...despues, updatedAt: 1 });

    expect(enviados).toHaveLength(1);
    expect(enviados[0]).toMatchObject({ to: 'ExponentPushToken[ana-iphone]', title: 'Falta tu pago 💳', data: { pantalla: 'Payments', serviceId: 's1' } });
    expect(enviados[0].body).toMatch(/Luis te ayudó con «Subir un sofá»\. Toca para pagar 21,60\sCHF y que lo reciba\./);
  });

  it('cobros activados: una sola vez, al pasar a activos', async () => {
    expect(await avisos.cambioPerfil('luis', { cobrosActivos: false }, { cobrosActivos: true })).toBe(2);
    expect(await avisos.cambioPerfil('luis', { cobrosActivos: true }, { cobrosActivos: true, name: 'Luis K.' })).toBe(0);
  });

  it('sin cambios que importen, nada', async () => {
    await avisos.cambioServicio('s1', servicio(), servicio({ description: 'otra' }));
    await avisos.cambioServicio('s1', undefined, servicio());

    expect(enviados).toEqual([]);
  });
});

describe('dispositivos', () => {
  it('quien no tiene la app con avisos no recibe nada', async () => {
    expect(await avisos.avisar('mia', 'aprobado', { titulo: 'x' }, {})).toBe(0);
    expect(await avisos.avisar('nadie', 'aprobado', { titulo: 'x' }, {})).toBe(0);
    expect(enviados).toEqual([]);
  });

  it('borra los dispositivos que Expo da por desaparecidos', async () => {
    respuestas = [{ status: 'error', details: { error: 'DeviceNotRegistered' } }, { status: 'ok' }];

    expect(await avisos.avisar('luis', 'aprobado', { titulo: 'x' }, {})).toBe(1);
    expect((await db.doc('dispositivos/luis').get()).data().tokens).toEqual(['ExponentPushToken[luis-2]']);
  });

  it('si Expo falla, el aviso se pierde pero no rompe nada', async () => {
    const roto = crearAvisos({ db, fetch: async () => { throw new Error('sin red'); }, quitarToken: jest.fn() });

    expect(await roto.avisar('ana', 'aprobado', { titulo: 'x' }, {})).toBe(0);
  });
});
